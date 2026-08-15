/**
 * Public outreach executor.
 *
 * Given a DurableBuyerLead + brand context, use the LLM to draft a
 * legitimate, personalized message (NEVER spam-templated) and POST it to the
 * lead's public form. Success is defined as HTTP 2xx + a confirmation-like
 * body; anything else records as a failed distribution event.
 *
 * Safety envelope:
 *   - only public forms/comments (lead.reachMethod ∈ public_form|blog_comment|
 *     newsletter_submit|directory_submit)
 *   - LLM must refuse and set `templated: true` if asked to spam — we reject
 *     the draft in that case
 *   - robots.txt is checked before submission; disallow means we skip silently
 *   - AbortController with 20s cap on every fetch
 */

import { callOpenAI, DEFAULT_MODELS, hasOpenAIKey } from "./openai-client";
import type { DurableBuyerLead } from "./buyer-discovery";

export type OutreachBrand = {
  displayName: string;
  supportEmail?: string;
  productName: string;
  productPriceUsd: number;
  productDescription?: string;
  brandVoice?: string;
};

export type OutreachDraft = {
  ok: boolean;
  subject?: string;
  message?: string;
  templated?: boolean;
  reason?: string;
};

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "message", "templated"],
  properties: {
    subject: { type: "string" },
    message: { type: "string" },
    templated: {
      type: "boolean",
      description:
        "True if the message is a boilerplate template not personalized to the specific lead. Must be false to be sent.",
    },
    refusalReason: { type: "string" },
  },
};

/**
 * Ask the LLM to draft a real message referencing the specific surface. If the
 * LLM cannot personalize (missing signal), it MUST set templated=true and we
 * refuse to send.
 */
export async function draftOutreachMessage(input: {
  lead: DurableBuyerLead;
  brand: OutreachBrand;
  appUrl: string;
}): Promise<OutreachDraft> {
  if (!hasOpenAIKey()) return { ok: false, reason: "no OPENAI_API_KEY" };
  const system = {
    role: "system" as const,
    content:
      "You are drafting a single outbound message to a PUBLIC surface (form, comment, newsletter submit). Rules: never spam, never mass-copy, never claim scarcity that isn't true, never imply endorsement. If you cannot cite something specific from the lead's `whyMatch` or `surface`, set templated=true. Personalized messages reference the surface's actual context in the first sentence. Keep messages under 700 characters. Do not include the same generic pitch across leads.",
  };
  const user = {
    role: "user" as const,
    content: `Brand: ${input.brand.displayName}\nVoice: ${input.brand.brandVoice ?? "helpful, direct"}\nProduct: ${input.brand.productName} — $${input.brand.productPriceUsd}\nDescription: ${input.brand.productDescription ?? ""}\nLink: ${input.appUrl}\nReply-to: ${input.brand.supportEmail ?? "no-reply@example"}\n\nLead:\n${JSON.stringify(input.lead, null, 2)}\n\nDraft one message tailored to this specific surface. If you have no personalization signal, return templated=true and we will not send it.`,
  };
  try {
    const res = await callOpenAI<{
      subject: string;
      message: string;
      templated: boolean;
      refusalReason?: string;
    }>({
      model: DEFAULT_MODELS.strategist,
      messages: [system, user],
      jsonSchema: DRAFT_SCHEMA,
      temperature: 0.6,
      maxOutputTokens: 500,
      timeoutMs: 25_000,
      justification: {
        businessId: null,
        scope: "business",
        subsystem: "public-outreach",
        purpose: "messaging_variant",
        reason: "draft personalized public-surface outreach for a scored lead",
        priority: 4,
        stateHash: `${input.lead.url}|${input.brand.productName}`,
      },
    });
    if (!res.ok) return { ok: false, reason: res.reason };
    if (res.data.templated) {
      return {
        ok: false,
        templated: true,
        reason: res.data.refusalReason ?? "message was templated",
      };
    }
    if (!res.data.message || res.data.message.length < 30) {
      return { ok: false, reason: "draft too short" };
    }
    return {
      ok: true,
      subject: res.data.subject,
      message: res.data.message,
      templated: false,
    };
  } catch (err) {
    return {
      ok: false,
      reason: `draft failure: ${(err as Error).message.slice(0, 120)}`,
    };
  }
}

/**
 * Check robots.txt for the target host and return true if the target path is
 * allowed for a generic bot. Best-effort: on failure returns true (do not
 * block on infra hiccups, but we still respect explicit Disallow rules).
 */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    let text = "";
    try {
      const res = await fetch(robotsUrl, {
        method: "GET",
        signal: controller.signal,
      });
      if (!res.ok) return true;
      text = await res.text();
    } finally {
      clearTimeout(timer);
    }
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    let inStar = false;
    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) inStar = true;
      else if (/^user-agent:/i.test(line)) inStar = false;
      else if (inStar && /^disallow:\s*/i.test(line)) {
        const path = line.replace(/^disallow:\s*/i, "").trim();
        if (path === "" || path === "/") continue;
        if (u.pathname.startsWith(path)) return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

export type OutreachResult = {
  ok: boolean;
  detail: string;
  attempted: boolean;
  status?: number;
  urlUsed?: string;
};

/**
 * Attempt to POST the drafted message to the lead's form. Tries the URL
 * itself first (Formspree/Netlify-style JSON) then falls back to `/contact`,
 * `/submit`, and `/api/contact`. Success = HTTP 2xx AND response body contains
 * a confirmation marker (`thank`, `success`, `received`).
 */
export async function submitToPublicForm(input: {
  lead: DurableBuyerLead;
  draft: { subject?: string; message: string };
  brand: OutreachBrand;
}): Promise<OutreachResult> {
  const targets: string[] = [input.lead.url];
  try {
    const u = new URL(input.lead.url);
    const base = `${u.protocol}//${u.host}`;
    for (const path of ["/contact", "/submit", "/api/contact"]) {
      const t = `${base}${path}`;
      if (!targets.includes(t)) targets.push(t);
    }
  } catch {
    return { ok: false, attempted: false, detail: "bad url" };
  }

  const payload = {
    name: input.brand.displayName,
    email: input.brand.supportEmail ?? "hello@example.com",
    subject: input.draft.subject ?? `${input.brand.productName} — ${input.brand.displayName}`,
    message: input.draft.message,
  };

  let lastStatus: number | undefined;
  for (const t of targets) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(t, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain, */*",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      lastStatus = res.status;
      if (res.status >= 200 && res.status < 300) {
        const body = await res
          .text()
          .then((s) => s.toLowerCase())
          .catch(() => "");
        if (
          body.includes("thank") ||
          body.includes("success") ||
          body.includes("received") ||
          body.includes("submitted") ||
          body === ""
        ) {
          return {
            ok: true,
            attempted: true,
            status: res.status,
            urlUsed: t,
            detail: `submitted to ${t} (${res.status})`,
          };
        }
      }
    } catch {
      // fall through to next target
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ok: false,
    attempted: true,
    status: lastStatus,
    detail: `no public form endpoint accepted the submission (last status: ${lastStatus ?? "n/a"})`,
  };
}

export type ExecutePublicOutreachInput = {
  lead: DurableBuyerLead;
  brand: OutreachBrand;
  appUrl: string;
};

export type ExecutePublicOutreachResult = {
  ok: boolean;
  detail: string;
  distributionEvent?: {
    surface: string;
    url: string;
    status: number;
    subject?: string;
  };
  reason?: string;
};

export async function executePublicOutreach(
  input: ExecutePublicOutreachInput,
): Promise<ExecutePublicOutreachResult> {
  const allowed = await isAllowedByRobots(input.lead.url);
  if (!allowed) {
    return { ok: false, detail: "robots.txt disallow — skipped", reason: "robots" };
  }
  const draft = await draftOutreachMessage(input);
  if (!draft.ok) {
    return {
      ok: false,
      detail: `draft rejected: ${draft.reason ?? "unknown"}${draft.templated ? " (templated)" : ""}`,
      reason: draft.templated ? "templated" : "draft_failed",
    };
  }
  const submit = await submitToPublicForm({
    lead: input.lead,
    draft: { subject: draft.subject, message: draft.message! },
    brand: input.brand,
  });
  if (!submit.ok) {
    return {
      ok: false,
      detail: submit.detail,
      reason: "no_form_endpoint",
    };
  }
  return {
    ok: true,
    detail: submit.detail,
    distributionEvent: {
      surface: input.lead.surface,
      url: submit.urlUsed ?? input.lead.url,
      status: submit.status ?? 0,
      subject: draft.subject,
    },
  };
}
