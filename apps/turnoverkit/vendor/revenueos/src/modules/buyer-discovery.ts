/**
 * Buyer discovery executor.
 *
 * Uses web-search.ts + LLM synthesis to identify SPECIFIC external surfaces
 * where target buyers already gather — public forum threads, blog posts asking
 * questions, contact pages of complementary businesses, aggregator/directory
 * pages, etc. Emits DurableBuyerLead[] that downstream `public-outreach.ts` and
 * `directory_submit` executors can act on.
 *
 * Safety: never scrapes wholesale, never proposes surfaces requiring an owner
 * login, and always filters low-score leads before returning.
 */

import { callOpenAI, DEFAULT_MODELS, hasOpenAIKey } from "./openai-client";
import { queryWebForBuyingIntent, type WebSearchResult } from "./web-search";

export type BuyerReachMethod =
  | "public_form"
  | "blog_comment"
  | "newsletter_submit"
  | "directory_submit"
  | "email";

export type DurableBuyerLead = {
  url: string;
  surface: string;
  segment: string;
  whyMatch: string;
  reachMethod: BuyerReachMethod;
  score: number;
  /** Optional public email address (for `email` reach method) */
  email?: string;
  /** Optional recipient name for personalized outreach */
  name?: string;
  /** Optional specific reason to reach THIS recipient */
  reasonToReach?: string;
};

const LEAD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["leads"],
  properties: {
    leads: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "url",
          "surface",
          "segment",
          "whyMatch",
          "reachMethod",
          "score",
        ],
        properties: {
          url: { type: "string" },
          surface: { type: "string" },
          segment: { type: "string" },
          whyMatch: { type: "string" },
          reachMethod: {
            type: "string",
            enum: [
              "public_form",
              "blog_comment",
              "newsletter_submit",
              "directory_submit",
              "email",
            ],
          },
          score: { type: "number", minimum: 0, maximum: 100 },
          email: { type: "string" },
          name: { type: "string" },
          reasonToReach: { type: "string" },
        },
      },
    },
  },
};

export type DiscoverBuyersInput = {
  topic: string;
  industry?: string;
  personas?: string[];
  productName: string;
  productDescription?: string;
  minScore?: number;
  maxLeads?: number;
};

export type DiscoverBuyersOutput = {
  ok: boolean;
  leads: DurableBuyerLead[];
  reason?: string;
  rawSearchResults?: WebSearchResult[];
};

export async function discoverBuyers(
  input: DiscoverBuyersInput,
): Promise<DiscoverBuyersOutput> {
  if (!hasOpenAIKey()) {
    return { ok: false, leads: [], reason: "no OPENAI_API_KEY" };
  }
  const minScore = input.minScore ?? 40;
  const maxLeads = Math.max(1, Math.min(input.maxLeads ?? 8, 12));

  const web = await queryWebForBuyingIntent({
    topic: input.topic,
    industry: input.industry,
    personas: input.personas,
    maxResults: 12,
  });
  if (!web.ok) return { ok: false, leads: [], reason: web.reason };

  const system = {
    role: "system" as const,
    content:
      "You are the buyer-discovery limb of RevenueOS. Given raw web search results, decide which URLs are surfaces where a real buyer for the product can be reached WITHOUT an owner login: public contact forms, public blog comment threads, publicly-listed newsletter or directory submission pages. Reject anything requiring account signup, DM/inbox access, or paid placement. Score 0-100 by how likely engagement here converts to a paying customer.",
  };
  const user = {
    role: "user" as const,
    content: `Product: ${input.productName}\nDescription: ${input.productDescription ?? ""}\nIndustry: ${input.industry ?? "n/a"}\nPersonas: ${(input.personas ?? []).join(", ") || "any"}\n\nRaw web results (JSON):\n${JSON.stringify(web.results.slice(0, 12), null, 2)}\n\nReturn ${maxLeads} best leads.`,
  };

  try {
    const res = await callOpenAI<{ leads: DurableBuyerLead[] }>({
      model: DEFAULT_MODELS.strategist,
      messages: [system, user],
      jsonSchema: LEAD_SCHEMA,
      temperature: 0.35,
      maxOutputTokens: 1600,
      timeoutMs: 30_000,
    });
    if (!res.ok) {
      return {
        ok: false,
        leads: [],
        reason: res.reason,
        rawSearchResults: web.results,
      };
    }
    const leads = (res.data.leads ?? [])
      .filter(
        (l) =>
          typeof l.url === "string" &&
          /^https?:\/\//.test(l.url) &&
          typeof l.score === "number" &&
          l.score >= minScore,
      )
      .slice(0, maxLeads);
    return { ok: true, leads, rawSearchResults: web.results };
  } catch (err) {
    return {
      ok: false,
      leads: [],
      reason: `buyer-discovery failure: ${(err as Error).message.slice(0, 120)}`,
      rawSearchResults: web.results,
    };
  }
}

/**
 * Filter a set of leads by score, deduping by URL. Exposed so callers (tests,
 * pursuit engine) can post-process an already-fetched list without re-hitting
 * the LLM.
 */
export function filterLowScoreLeads(
  leads: DurableBuyerLead[],
  minScore: number,
): DurableBuyerLead[] {
  const seen = new Set<string>();
  const out: DurableBuyerLead[] = [];
  for (const l of leads) {
    if (!l || typeof l.score !== "number") continue;
    if (l.score < minScore) continue;
    if (seen.has(l.url)) continue;
    seen.add(l.url);
    out.push(l);
  }
  return out;
}
