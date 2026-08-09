/**
 * Agent executors — the "doing" limb.
 *
 * These are the new-generation executors invoked by the pursuit engine when a
 * safeActionType is proposed by the LLM strategist. Each executor performs a
 * real side effect (writes to ledger, calls an external HTTP endpoint, or
 * updates page content) and returns a structured result the engine records.
 *
 * Every executor is:
 *   - Permissionless: no owner login, no paid ads, no PII scraping.
 *   - Idempotent-ish: records what it did to the ledger with a stable key.
 *   - Safe on failure: returns {ok:false} instead of throwing.
 */

import { newId } from "../ledger/store";
import type { PursuitEvent } from "../types";
import type { ExperimentStore } from "../ledger/store";
import {
  discoverOutreachTargets,
  draftOutreachMessage,
  performWebResearch,
  type OutreachTarget,
} from "./web-intelligence";
import { hasOpenAIKey } from "./openai-client";

export type AgentActionContext = {
  siteId: string;
  displayName: string;
  industry: string;
  productName: string;
  productDescription: string;
  priceUsd: number;
  audience?: string;
  siteUrl: string;
  store: ExperimentStore;
};

export type AgentActionResult = { ok: boolean; detail: string; url?: string };

export const AGENT_SAFE_ACTIONS = [
  "web_research",
  "buyer_discovery",
  "public_form_outreach",
  "directory_submit",
  "syndicate_content",
  "schema_enrichment",
  "llm_hypothesize",
  "deep_content_generate",
  "cross_portfolio_link",
] as const;

export type AgentSafeAction = (typeof AGENT_SAFE_ACTIONS)[number];

export function isAgentSafeAction(type: string): type is AgentSafeAction {
  return (AGENT_SAFE_ACTIONS as readonly string[]).includes(type);
}

async function recordEvent(
  store: ExperimentStore,
  siteId: string,
  eventType: PursuitEvent["eventType"],
  detail: Record<string, unknown>,
) {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("pevt"),
    pursuitId: "agent-executor",
    siteId,
    eventType,
    detail,
    createdAt: new Date().toISOString(),
  });
}

async function execWebResearch(
  ctx: AgentActionContext,
  payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  if (!hasOpenAIKey()) {
    return { ok: false, detail: "web_research skipped: OPENAI_API_KEY missing" };
  }
  const focus =
    (payload.focus as
      | "competitor_pricing"
      | "buyer_language"
      | "distribution_surfaces"
      | "community_signals"
      | "buying_intent"
      | undefined) ?? "buying_intent";
  const res = await performWebResearch({
    productName: ctx.productName,
    productDescription: ctx.productDescription,
    priceUsd: ctx.priceUsd,
    industry: ctx.industry,
    audience: ctx.audience,
    focus,
  });
  if (!res.ok) {
    return { ok: false, detail: `web_research failed: ${res.reason}` };
  }
  await recordEvent(ctx.store, ctx.siteId, "learned", {
    kind: "web_research",
    focus,
    summary: res.summary,
    findings: res.findings.slice(0, 8),
  });
  return {
    ok: true,
    detail: `web_research(${focus}): ${res.findings.length} findings. ${res.summary?.slice(0, 200) ?? ""}`,
  };
}

async function execBuyerDiscovery(
  ctx: AgentActionContext,
  payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  if (!hasOpenAIKey()) {
    return { ok: false, detail: "buyer_discovery skipped: OPENAI_API_KEY missing" };
  }
  const segment =
    (payload.buyerSegment as string) ?? ctx.audience ?? "primary buyer";
  const res = await discoverOutreachTargets({
    productName: ctx.productName,
    productDescription: ctx.productDescription,
    buyerSegment: segment,
    siteUrl: ctx.siteUrl,
    industry: ctx.industry,
  });
  if (!res.ok) {
    return { ok: false, detail: `buyer_discovery failed: ${res.reason}` };
  }
  await recordEvent(ctx.store, ctx.siteId, "learned", {
    kind: "buyer_discovery",
    buyerSegment: segment,
    targets: res.targets.slice(0, 10),
  });
  return {
    ok: true,
    detail: `buyer_discovery: ${res.targets.length} outreach targets recorded for "${segment}"`,
  };
}

async function execPublicFormOutreach(
  ctx: AgentActionContext,
  payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  const targetUrl = payload.targetUrl as string | undefined;
  const buyerSegment =
    (payload.buyerSegment as string | undefined) ??
    ctx.audience ??
    "primary buyer";
  const surfaceType =
    (payload.surfaceType as OutreachTarget["surface_type"] | undefined) ??
    "public_contact_form";

  if (!targetUrl) {
    // Auto-pick the highest-confidence target discovered in a prior cycle.
    if (!ctx.store.listPursuitEvents) {
      return {
        ok: false,
        detail: "public_form_outreach: no targetUrl and no ledger to look up recent buyer_discovery.",
      };
    }
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const events = await ctx.store.listPursuitEvents(ctx.siteId, {
      since,
      limit: 200,
    });
    const targets: OutreachTarget[] = [];
    for (const ev of events) {
      if (
        ev.eventType === "learned" &&
        ev.detail?.kind === "buyer_discovery" &&
        Array.isArray(ev.detail.targets)
      ) {
        for (const t of ev.detail.targets as OutreachTarget[]) targets.push(t);
      }
    }
    targets.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const chosen = targets.find(
      (t) =>
        t.suggested_action === "public_form_outreach" ||
        t.surface_type === "public_contact_form",
    );
    if (!chosen) {
      return {
        ok: false,
        detail: "public_form_outreach: no discovered targets. Enqueue buyer_discovery first.",
      };
    }
    return execPublicFormOutreach(ctx, {
      ...payload,
      targetUrl: chosen.url,
      surfaceType: chosen.surface_type,
      buyerSegment,
      audiencePolicy: chosen.posting_policy_notes,
    });
  }

  const draft = await draftOutreachMessage({
    surfaceType,
    targetUrl,
    buyerSegment,
    productName: ctx.productName,
    productUrl: ctx.siteUrl,
    productDescription: ctx.productDescription,
    priceUsd: ctx.priceUsd,
    audiencePolicy: payload.audiencePolicy as string | undefined,
  });
  if (!draft.ok) {
    return { ok: false, detail: `outreach draft failed: ${draft.reason}` };
  }

  // Attempt to POST to the target URL. Many public forms are AJAX-only or need
  // CSRF; we do a best-effort text/plain POST and treat 2xx/3xx as delivered.
  let posted = false;
  let httpStatus = 0;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const body = new URLSearchParams({
      subject: draft.subject ?? "",
      message: draft.body ?? "",
      email: `contact@${new URL(ctx.siteUrl).hostname}`,
      name: ctx.displayName,
      url: ctx.siteUrl,
    });
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    httpStatus = res.status;
    posted = res.ok || (res.status >= 200 && res.status < 400);
  } catch {
    posted = false;
  }
  await recordEvent(ctx.store, ctx.siteId, "executed", {
    kind: "public_form_outreach",
    targetUrl,
    surfaceType,
    buyerSegment,
    posted,
    httpStatus,
    subject: draft.subject,
    body: draft.body,
  });
  return {
    ok: posted,
    detail: posted
      ? `public_form_outreach → ${targetUrl} (HTTP ${httpStatus})`
      : `public_form_outreach queued (POST failed HTTP ${httpStatus}); message drafted and recorded for owner review`,
    url: targetUrl,
  };
}

async function execDirectorySubmit(
  ctx: AgentActionContext,
  payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  const url = payload.targetUrl as string | undefined;
  if (!url) {
    return {
      ok: false,
      detail: "directory_submit: no targetUrl provided. Enqueue buyer_discovery first.",
    };
  }
  await recordEvent(ctx.store, ctx.siteId, "executed", {
    kind: "directory_submit",
    directoryUrl: url,
    productName: ctx.productName,
    productUrl: ctx.siteUrl,
    priceUsd: ctx.priceUsd,
  });
  return {
    ok: true,
    detail: `directory_submit recorded → ${url}`,
    url,
  };
}

async function execSyndicateContent(
  ctx: AgentActionContext,
  _payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  // Ping public aggregators for our site's RSS/atom feed. Any 2xx is progress.
  const feed = `${ctx.siteUrl.replace(/\/$/, "")}/rss.xml`;
  const targets = [
    `https://blogsearch.google.com/ping?url=${encodeURIComponent(feed)}`,
    `https://pubsubhubbub.appspot.com/?hub.mode=publish&hub.url=${encodeURIComponent(feed)}`,
  ];
  const results: string[] = [];
  let successes = 0;
  for (const t of targets) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(t, { method: "GET", signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) successes++;
      results.push(`${new URL(t).host}:${res.status}`);
    } catch {
      results.push(`${new URL(t).host}:err`);
    }
  }
  await recordEvent(ctx.store, ctx.siteId, "executed", {
    kind: "syndicate_content",
    feed,
    successes,
    results,
  });
  return {
    ok: successes > 0,
    detail: `syndicate_content: ${successes}/${targets.length} aggregators pinged (${results.join(", ")})`,
    url: feed,
  };
}

async function execSchemaEnrichment(
  ctx: AgentActionContext,
  payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  const slug = (payload.slug as string) ?? "root";
  const schemaBlock = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: ctx.productName,
    description: ctx.productDescription,
    offers: {
      "@type": "Offer",
      price: ctx.priceUsd,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: ctx.siteUrl,
    },
    brand: { "@type": "Organization", name: ctx.displayName },
  };
  await recordEvent(ctx.store, ctx.siteId, "executed", {
    kind: "schema_enrichment",
    slug,
    jsonLd: schemaBlock,
  });
  return {
    ok: true,
    detail: `schema_enrichment: Product schema recorded for /${slug}`,
  };
}

async function execCrossPortfolioLink(
  ctx: AgentActionContext,
  _payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  // Cross-portfolio linking: leave a durable record of intent — the render
  // layer picks up recorded intents and materializes actual links via
  // storefront-kit page templates.
  await recordEvent(ctx.store, ctx.siteId, "executed", {
    kind: "cross_portfolio_link",
    from: ctx.siteId,
    note: "Reciprocal portfolio link intent recorded — page renderer materializes on next publish.",
  });
  return {
    ok: true,
    detail: `cross_portfolio_link: reciprocal-link intent recorded for ${ctx.siteId}`,
  };
}

async function execDeepContentGenerate(
  ctx: AgentActionContext,
  payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  if (!hasOpenAIKey()) {
    return {
      ok: false,
      detail: "deep_content_generate skipped: OPENAI_API_KEY missing",
    };
  }
  const query = (payload.intentQuery as string) ?? ctx.productName;
  const { callOpenAI } = await import("./openai-client");
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "body_markdown", "faqs"],
    properties: {
      title: { type: "string" },
      body_markdown: { type: "string" },
      faqs: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["q", "a"],
          properties: { q: { type: "string" }, a: { type: "string" } },
        },
      },
    },
  };
  const res = await callOpenAI<{
    title: string;
    body_markdown: string;
    faqs: Array<{ q: string; a: string }>;
  }>({
    messages: [
      {
        role: "system",
        content:
          "You write genuinely useful, expert-level long-form content that solves the reader's problem BEFORE mentioning any product. 1200-1800 words. Use headings, real examples, and concrete steps. Cite sources by URL when they materially strengthen a claim.",
      },
      {
        role: "user",
        content: `Product: ${ctx.productName} at $${ctx.priceUsd}\nDescription: ${ctx.productDescription}\nBuyer intent query: "${query}"\n\nWrite a comprehensive article that helps a person searching this query, and where the product is a natural next step at the end.`,
      },
    ],
    jsonSchema: schema,
    temperature: 0.6,
    maxOutputTokens: 3200,
    timeoutMs: 55_000,
  });
  if (!res.ok) {
    return { ok: false, detail: `deep_content_generate failed: ${res.reason}` };
  }
  await recordEvent(ctx.store, ctx.siteId, "executed", {
    kind: "deep_content_generate",
    query,
    title: res.data.title,
    wordCount: res.data.body_markdown.split(/\s+/).length,
    faqCount: res.data.faqs.length,
    body_markdown: res.data.body_markdown,
    faqs: res.data.faqs,
  });
  return {
    ok: true,
    detail: `deep_content_generate: ${res.data.title} (~${res.data.body_markdown.split(/\s+/).length} words, ${res.data.faqs.length} FAQs)`,
  };
}

async function execLlmHypothesize(
  ctx: AgentActionContext,
  _payload: Record<string, unknown>,
): Promise<AgentActionResult> {
  // llm_hypothesize is a no-op executor — the strategist runs at plan time.
  // Here we simply record that a hypothesize slot was consumed so the pattern
  // gate doesn't over-penalize it.
  await recordEvent(ctx.store, ctx.siteId, "learned", {
    kind: "llm_hypothesize",
    note: "LLM strategist already ran at plan time; this slot is a marker.",
  });
  return { ok: true, detail: "llm_hypothesize marker recorded" };
}

/**
 * Dispatcher — called from storefront-kit's executePermissionlessAction as a
 * fallback when the action type is not in its static switch.
 */
export async function executeAgentAction(
  ctx: AgentActionContext,
  actionType: string,
  payload: Record<string, unknown> = {},
): Promise<AgentActionResult | null> {
  if (!isAgentSafeAction(actionType)) return null;
  try {
    switch (actionType as AgentSafeAction) {
      case "web_research":
        return await execWebResearch(ctx, payload);
      case "buyer_discovery":
        return await execBuyerDiscovery(ctx, payload);
      case "public_form_outreach":
        return await execPublicFormOutreach(ctx, payload);
      case "directory_submit":
        return await execDirectorySubmit(ctx, payload);
      case "syndicate_content":
        return await execSyndicateContent(ctx, payload);
      case "schema_enrichment":
        return await execSchemaEnrichment(ctx, payload);
      case "cross_portfolio_link":
        return await execCrossPortfolioLink(ctx, payload);
      case "deep_content_generate":
        return await execDeepContentGenerate(ctx, payload);
      case "llm_hypothesize":
        return await execLlmHypothesize(ctx, payload);
    }
  } catch (err) {
    return {
      ok: false,
      detail: `agent executor error: ${(err as Error).message.slice(0, 200)}`,
    };
  }
}

export function listAgentSafeActions() {
  return AGENT_SAFE_ACTIONS.map((type) => ({
    type,
    risk: "safe" as const,
    description: `Agent executor: ${type}`,
  }));
}
