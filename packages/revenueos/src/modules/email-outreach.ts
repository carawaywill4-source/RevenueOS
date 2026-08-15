/**
 * Email outreach executor (Resend REST).
 *
 * Sends 1:1 personalized outreach authored by the LLM. Never bulk. Never
 * templated. Every send:
 *   - includes physical address + unsubscribe link (CAN-SPAM)
 *   - honest subject (LLM prompt forbids clickbait / misleading claims)
 *   - references a specific reason to reach THIS recipient (why we found them)
 *   - is rate-limited per recipient domain
 *
 * Gracefully returns `{ ok: false, reason: "creds missing" }` when RESEND_API_KEY
 * isn't configured, so the planner can propose it as a capability_gap instead.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";

export type EmailOutreachInput = {
  toEmail: string;
  toName?: string;
  productName: string;
  productPriceUsd: number;
  productUrl: string;
  audienceDescription: string;
  reasonToReach: string;
  brandVoice: string;
  senderName: string;
  senderEmail: string;
  senderCompany: string;
  senderPhysicalAddress: string;
  unsubscribeUrl: string;
  timeoutMs?: number;
};

export type EmailOutreachResult =
  | { ok: true; id: string; subject: string; classification: "outreach" }
  | { ok: false; reason: string };

export function hasResendKey(): boolean {
  return typeof process.env.RESEND_API_KEY === "string" &&
    process.env.RESEND_API_KEY.length > 20;
}

const OUTREACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: { type: "string", minLength: 6, maxLength: 90 },
    body: { type: "string", minLength: 60, maxLength: 1400 },
  },
};

async function draftMessage(
  input: EmailOutreachInput,
): Promise<{ subject: string; body: string } | { error: string }> {
  if (!hasOpenAIKey()) {
    return { error: "no OPENAI_API_KEY for message drafting" };
  }
  const res = await callOpenAI<{ subject: string; body: string }>({
    messages: [
      {
        role: "system",
        content:
          "You draft brief, respectful, human 1:1 outreach emails. Never spam, never clickbait. Explicitly reference WHY you are contacting THIS specific recipient (specific detail from their public profile or company). Offer a concrete useful thing before any ask. If your subject line contains 'you won', 'guaranteed', 'act now', or ALL CAPS words, you must rewrite it. Include a plain-English unsubscribe line at the end. Keep it under 130 words.",
      },
      {
        role: "user",
        content: JSON.stringify({
          recipient: {
            email: input.toEmail,
            name: input.toName ?? null,
            audience: input.audienceDescription,
            reasonToReach: input.reasonToReach,
          },
          product: {
            name: input.productName,
            priceUsd: input.productPriceUsd,
            url: input.productUrl,
          },
          sender: {
            name: input.senderName,
            company: input.senderCompany,
            voice: input.brandVoice,
          },
          unsubscribeUrl: input.unsubscribeUrl,
          physicalAddress: input.senderPhysicalAddress,
          rules: [
            "Subject must be honest and specific.",
            "Never claim endorsements or credentials the sender doesn't have.",
            "One clear CTA — either reply or view URL.",
            "Include the sender's physical address in the footer.",
            "Include a one-line unsubscribe: 'Reply STOP or use: <unsubscribeUrl>.'",
          ],
        }),
      },
    ],
    jsonSchema: OUTREACH_SCHEMA,
    temperature: 0.7,
    maxOutputTokens: 700,
    timeoutMs: 20_000,
    justification: {
      businessId: null,
      scope: "business",
      subsystem: "email-outreach",
      purpose: "messaging_variant",
      reason: "high-intent buyer outreach draft with recipient-specific public context",
      priority: 3,
      stateHash: `${input.toEmail}|${input.reasonToReach}|${input.productName}`,
    },
  });
  if (!res.ok) return { error: res.reason };
  return res.data;
}

export async function executeEmailOutreach(
  input: EmailOutreachInput,
): Promise<EmailOutreachResult> {
  if (!hasResendKey()) {
    return { ok: false, reason: "RESEND_API_KEY missing" };
  }
  const drafted = await draftMessage(input);
  if ("error" in drafted) return { ok: false, reason: drafted.error };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 15_000,
  );
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: `${input.senderName} <${input.senderEmail}>`,
        to: [input.toEmail],
        subject: drafted.subject,
        text: `${drafted.body}\n\n—\n${input.senderName}\n${input.senderCompany}\n${input.senderPhysicalAddress}\n\nUnsubscribe: ${input.unsubscribeUrl}`,
        headers: {
          "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `resend ${res.status}: ${text.slice(0, 160)}`,
      };
    }
    const data = (await res.json()) as { id?: string };
    return {
      ok: true,
      id: data.id ?? "unknown",
      subject: drafted.subject,
      classification: "outreach",
    };
  } catch (err) {
    return { ok: false, reason: `fetch: ${(err as Error).message.slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Simple in-memory rate limiter — one outreach per recipient domain per 24h.
 * The planner/executor should also consult a durable sent-log to be safe.
 */
const domainSentAt = new Map<string, number>();
const DOMAIN_COOLDOWN_MS = 24 * 3_600_000;

export function rateLimitCheck(email: string): {
  allowed: boolean;
  reason?: string;
} {
  const at = email.indexOf("@");
  if (at < 0) return { allowed: false, reason: "invalid email" };
  const domain = email.slice(at + 1).toLowerCase();
  const last = domainSentAt.get(domain);
  const now = Date.now();
  if (last && now - last < DOMAIN_COOLDOWN_MS) {
    return { allowed: false, reason: `${domain} contacted within 24h` };
  }
  domainSentAt.set(domain, now);
  return { allowed: true };
}
