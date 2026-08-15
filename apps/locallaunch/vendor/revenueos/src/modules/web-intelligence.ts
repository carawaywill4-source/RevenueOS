/**
 * Web intelligence — the perception layer.
 *
 * Uses OpenAI's web-search tool to pull real, current information from the
 * public internet: buyer language, competitor pricing, community discussions,
 * distribution surfaces, market conditions. Every response is recorded to the
 * durable ledger so the strategist can reference it on the next cycle.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";

export type WebFinding = {
  claim: string;
  source_url: string;
  buyer_language?: string;
  price_signal?: string;
  distribution_surface?: string;
  actionability: "high" | "medium" | "low";
};

const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "source_url", "actionability"],
        properties: {
          claim: { type: "string" },
          source_url: { type: "string" },
          buyer_language: { type: "string" },
          price_signal: { type: "string" },
          distribution_surface: { type: "string" },
          actionability: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

export async function performWebResearch(input: {
  productName: string;
  productDescription: string;
  priceUsd: number;
  industry: string;
  audience?: string;
  focus:
    | "competitor_pricing"
    | "buyer_language"
    | "distribution_surfaces"
    | "community_signals"
    | "buying_intent";
}): Promise<{
  ok: boolean;
  summary?: string;
  findings: WebFinding[];
  reason?: string;
}> {
  if (!hasOpenAIKey()) {
    return { ok: false, findings: [], reason: "no OPENAI_API_KEY" };
  }
  const focusPrompt: Record<typeof input.focus, string> = {
    competitor_pricing: `Find 3-8 direct or near competitors for "${input.productName}" (${input.productDescription}). For each, note the exact price and offer shape. Are they cheaper, more expensive, or bundled?`,
    buyer_language: `Find real posts (Reddit, HN, Twitter/X, product forums, review sites) where people describe the problem "${input.productName}" solves. Quote their exact language. Note where they hang out.`,
    distribution_surfaces: `Find 3-8 public distribution surfaces (directories, aggregators, comparison sites, product listing pages, community wikis) that accept anonymous or public form submissions relevant to "${input.productName}". Give exact URLs.`,
    community_signals: `Find 3-8 current community threads / posts / discussions where people are actively expressing intent to buy something like "${input.productName}". Include the exact URL and who is asking.`,
    buying_intent: `Search the public internet for current expressions of buying intent for "${input.productName}" in the ${input.industry} industry${input.audience ? " targeting " + input.audience : ""}. Return specific URLs where a potential buyer has said they need this or similar.`,
  };
  const res = await callOpenAI<{ summary: string; findings: WebFinding[] }>({
    messages: [
      {
        role: "system",
        content:
          "You are a market intelligence agent for a fully autonomous revenue system. Return only factual claims backed by a real source URL retrieved via web search. If a claim cannot be sourced, omit it. Prefer high-actionability findings (contactable surfaces, buyable intent, price anchors).",
      },
      {
        role: "user",
        content: `Product: ${input.productName} at $${input.priceUsd}\nDescription: ${input.productDescription}\nIndustry: ${input.industry}${input.audience ? "\nAudience: " + input.audience : ""}\n\nTask: ${focusPrompt[input.focus]}`,
      },
    ],
    webSearch: true,
    jsonSchema: FINDINGS_SCHEMA,
    temperature: 0.4,
    maxOutputTokens: 1400,
    timeoutMs: 40_000,
  });
  if (!res.ok) return { ok: false, findings: [], reason: res.reason };
  return {
    ok: true,
    summary: res.data.summary,
    findings: res.data.findings ?? [],
  };
}

/**
 * Discover concrete outreach targets: public URLs where a specific buyer
 * persona is currently active and where RevenueOS may reach them via HTTP.
 */
export type OutreachTarget = {
  surface_type:
    | "public_contact_form"
    | "community_thread"
    | "blog_post"
    | "directory_submission"
    | "aggregator_submit"
    | "podcast_pitch_form"
    | "newsletter_submit";
  url: string;
  audience_match: string;
  posting_policy_notes: string;
  suggested_action:
    | "public_form_outreach"
    | "directory_submit"
    | "syndicate_content"
    | "buyer_discovery"
    | "web_research";
  confidence: number;
};

const TARGETS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["targets"],
  properties: {
    targets: {
      type: "array",
      minItems: 0,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "surface_type",
          "url",
          "audience_match",
          "posting_policy_notes",
          "suggested_action",
          "confidence",
        ],
        properties: {
          surface_type: {
            type: "string",
            enum: [
              "public_contact_form",
              "community_thread",
              "blog_post",
              "directory_submission",
              "aggregator_submit",
              "podcast_pitch_form",
              "newsletter_submit",
            ],
          },
          url: { type: "string" },
          audience_match: { type: "string" },
          posting_policy_notes: { type: "string" },
          suggested_action: {
            type: "string",
            enum: [
              "public_form_outreach",
              "directory_submit",
              "syndicate_content",
              "buyer_discovery",
              "web_research",
            ],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

export async function discoverOutreachTargets(input: {
  productName: string;
  productDescription: string;
  buyerSegment: string;
  siteUrl: string;
  industry: string;
}): Promise<{ ok: boolean; targets: OutreachTarget[]; reason?: string }> {
  if (!hasOpenAIKey()) {
    return { ok: false, targets: [], reason: "no OPENAI_API_KEY" };
  }
  const res = await callOpenAI<{ targets: OutreachTarget[] }>({
    messages: [
      {
        role: "system",
        content:
          "You are a distribution scout. Find CURRENT, LIVE, PUBLIC surfaces where the given buyer segment is active and where a submission or message can be posted without account creation or paid ads. Every URL must be a real, accessible URL you found via web search. Skip surfaces requiring login, payment, or intrusive account creation. Skip anything spammy.",
      },
      {
        role: "user",
        content: `Product: ${input.productName}\nBuyer segment: ${input.buyerSegment}\nProduct URL: ${input.siteUrl}\nIndustry: ${input.industry}\nDescription: ${input.productDescription}\n\nFind 5-10 public surfaces where this buyer segment is currently present and where submissions/pitches are accepted without login.`,
      },
    ],
    webSearch: true,
    jsonSchema: TARGETS_SCHEMA,
    temperature: 0.35,
    maxOutputTokens: 1400,
    timeoutMs: 40_000,
  });
  if (!res.ok) return { ok: false, targets: [], reason: res.reason };
  return { ok: true, targets: res.data.targets ?? [] };
}

/**
 * Generate LLM-authored outreach copy tailored to a specific surface + buyer.
 * The copy is genuine, useful, non-spammy — the LLM is prompted to write value
 * first, product mention only when relevant.
 */
export async function draftOutreachMessage(input: {
  surfaceType: OutreachTarget["surface_type"];
  targetUrl: string;
  buyerSegment: string;
  productName: string;
  productUrl: string;
  productDescription: string;
  priceUsd: number;
  audiencePolicy?: string;
}): Promise<{ ok: boolean; subject?: string; body?: string; reason?: string }> {
  if (!hasOpenAIKey()) {
    return { ok: false, reason: "no OPENAI_API_KEY" };
  }
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["subject", "body"],
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
    },
  };
  const res = await callOpenAI<{ subject: string; body: string }>({
    messages: [
      {
        role: "system",
        content:
          "You draft OUTREACH COPY that a fully autonomous revenue system will post to a public surface. Copy MUST be: (1) genuinely useful to the reader FIRST, (2) honest, (3) non-spammy, (4) respectful of the surface's posting policy. Product mention should be soft and only where relevant. Never fabricate testimonials or claims. Match the tone of the surface.",
      },
      {
        role: "user",
        content: `Surface: ${input.surfaceType}\nTarget URL: ${input.targetUrl}\nBuyer segment: ${input.buyerSegment}\nProduct: ${input.productName} — $${input.priceUsd}\nProduct URL: ${input.productUrl}\nProduct description: ${input.productDescription}${input.audiencePolicy ? "\nAudience policy: " + input.audiencePolicy : ""}\n\nDraft a subject line and a body appropriate for this surface.`,
      },
    ],
    jsonSchema: schema,
    temperature: 0.7,
    maxOutputTokens: 500,
    timeoutMs: 25_000,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, subject: res.data.subject, body: res.data.body };
}
