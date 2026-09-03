/**
 * Web search executor.
 *
 * Thin wrapper over openai-client.ts with `webSearch: true`. The LLM can then
 * grounds its response with real URLs and snippets.
 *
 * Everything here is defensive: never throw, always return {ok:false, ...} on
 * failure so the planner keeps running under network hiccups or auth issues.
 */

import { callOpenAI, DEFAULT_MODELS, hasOpenAIKey } from "./openai-client";

export type WebSearchResult = {
  url: string;
  snippet: string;
  buyerSignal: "high" | "med" | "low";
  angle: string;
};

export type CompetitorResult = {
  url: string;
  name: string;
  priceUsd?: number;
  positioning: string;
  weakness: string;
};

const BUYING_INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "snippet", "buyerSignal", "angle"],
        properties: {
          url: { type: "string" },
          snippet: { type: "string" },
          buyerSignal: { type: "string", enum: ["high", "med", "low"] },
          angle: { type: "string" },
        },
      },
    },
  },
};

const COMPETITOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["competitors"],
  properties: {
    competitors: {
      type: "array",
      minItems: 0,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "name", "positioning", "weakness"],
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          priceUsd: { type: "number" },
          positioning: { type: "string" },
          weakness: { type: "string" },
        },
      },
    },
  },
};

export type QueryBuyingIntentInput = {
  topic: string;
  industry?: string;
  personas?: string[];
  maxResults?: number;
};

export type QueryBuyingIntentOutput = {
  ok: boolean;
  results: WebSearchResult[];
  reason?: string;
};

export async function queryWebForBuyingIntent(
  input: QueryBuyingIntentInput,
): Promise<QueryBuyingIntentOutput> {
  if (!hasOpenAIKey()) {
    return { ok: false, results: [], reason: "no OPENAI_API_KEY" };
  }
  const maxResults = Math.max(1, Math.min(input.maxResults ?? 6, 12));
  const system = {
    role: "system" as const,
    content:
      "You are a commercial reconnaissance limb of RevenueOS. Your job: find real, currently-live public URLs where buyers of the described product are asking questions, comparing options, or requesting recommendations. Only return URLs you actually observed via the web_search tool. Prefer forums, blog comments, comparison articles, aggregator/directory pages, and business contact pages with real signal. Never invent URLs.",
  };
  const user = {
    role: "user" as const,
    content: `Topic: ${input.topic}\nIndustry: ${input.industry ?? "n/a"}\nPersonas: ${(input.personas ?? []).join(", ") || "any"}\nReturn up to ${maxResults} results. For each, score buyerSignal high/med/low based on how close the poster/reader is to a purchase, and give a one-line angle for how our offer would be relevant.`,
  };

  try {
    const res = await callOpenAI<{ results: WebSearchResult[] }>({
      model: DEFAULT_MODELS.strategist,
      messages: [system, user],
      jsonSchema: BUYING_INTENT_SCHEMA,
      webSearch: true,
      temperature: 0.4,
      maxOutputTokens: 1400,
      timeoutMs: 30_000,
    });
    if (!res.ok) return { ok: false, results: [], reason: res.reason };
    const results = (res.data.results ?? []).slice(0, maxResults).filter(
      (r) => typeof r.url === "string" && /^https?:\/\//.test(r.url),
    );
    return { ok: true, results };
  } catch (err) {
    return {
      ok: false,
      results: [],
      reason: `web-search failure: ${(err as Error).message.slice(0, 120)}`,
    };
  }
}

export type QueryCompetitorsInput = {
  product: string;
  priceUsd?: number;
  industry?: string;
};

export type QueryCompetitorsOutput = {
  ok: boolean;
  competitors: CompetitorResult[];
  reason?: string;
};

export async function queryCompetitors(
  input: QueryCompetitorsInput,
): Promise<QueryCompetitorsOutput> {
  if (!hasOpenAIKey()) {
    return { ok: false, competitors: [], reason: "no OPENAI_API_KEY" };
  }
  const system = {
    role: "system" as const,
    content:
      "You are a competitive-analysis limb of RevenueOS. Return a small list of real, public competitors from live web results. Never invent — only include URLs actually surfaced by web_search. Focus on differentiators an autonomous operator can exploit (weakness, unmet buyer promise, positioning gap).",
  };
  const user = {
    role: "user" as const,
    content: `Product: ${input.product}\nPrice: $${input.priceUsd ?? "?"}\nIndustry: ${input.industry ?? "n/a"}\nReturn 3-8 competitors with positioning + weakness.`,
  };

  try {
    const res = await callOpenAI<{ competitors: CompetitorResult[] }>({
      model: DEFAULT_MODELS.strategist,
      messages: [system, user],
      jsonSchema: COMPETITOR_SCHEMA,
      webSearch: true,
      temperature: 0.3,
      maxOutputTokens: 1400,
      timeoutMs: 30_000,
    });
    if (!res.ok) return { ok: false, competitors: [], reason: res.reason };
    const competitors = (res.data.competitors ?? []).filter(
      (c) => typeof c.url === "string" && /^https?:\/\//.test(c.url),
    );
    return { ok: true, competitors };
  } catch (err) {
    return {
      ok: false,
      competitors: [],
      reason: `web-search failure: ${(err as Error).message.slice(0, 120)}`,
    };
  }
}
