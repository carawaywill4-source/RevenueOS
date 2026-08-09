/**
 * LLM strategist — the thinking layer.
 *
 * Every plan cycle, this feeds the current commercial state (context, banned
 * mechanisms, pattern posteriors, portfolio signal, funnel, prior attempts)
 * into a strategist LLM and asks for genuinely NEW acquisition hypotheses that:
 *
 *   - are legal and permissionless (no ads, no owner logins)
 *   - target a specific buyer segment on a specific external surface
 *   - specify one concrete permissionless action RevenueOS can execute today
 *   - explain the causal path to a purchase
 *
 * Returns Opportunity[] with real safeActionTypes drawn from the executor
 * catalog (buyer_discovery, public_form_outreach, syndicate_content,
 * schema_enrichment, web_research, etc.). Novel angles ride existing executors.
 *
 * Safety envelope is enforced downstream by policy + pattern gate. This layer
 * has no ability to invent forbidden action types (schema validation rejects).
 */

import type { BusinessContext, Observation, Opportunity } from "../types";
import type { MechanismClass } from "./action-class";
import type { PatternPosteriorMap } from "./pattern-posterior";
import type { PortfolioSignal } from "./revenue-priority";
import { callOpenAI, DEFAULT_MODELS, hasOpenAIKey } from "./openai-client";

/**
 * The catalog of action types the LLM is allowed to propose. Every one has an
 * executor. Anything outside this list is dropped.
 */
export const LLM_PROPOSABLE_ACTIONS = [
  "web_research",
  "buyer_discovery",
  "public_form_outreach",
  "directory_submit",
  "syndicate_content",
  "schema_enrichment",
  "publish_free_resource",
  "publish_howto_cluster",
  "publish_comparison_page",
  "publish_intent_page",
  "publish_intent_tool",
  "publish_calculator",
  "channel_discover",
  "rewrite_page_copy",
  "change_default_cta",
  "feature_product",
  "publish_bundle",
  "reddit_helpful_reply",
  "reddit_discover_intent",
  "email_cold_outreach",
  "producthunt_helpful_reply",
  "indiehackers_product_listing_draft",
  "indiehackers_community_post_draft",
  "hackernews_show_hn_draft",
  "hackernews_intent_discovery",
  "gsc_query_import",
  "gsc_indexation_check",
  "youtube_intent_discovery",
  "youtube_community_reply_draft",
  "exit_intent_deploy",
  "order_bump_deploy",
  "gumroad_product_sync",
  "gumroad_sales_import",
] as const;

export type LlmProposableAction = (typeof LLM_PROPOSABLE_ACTIONS)[number];

const LLM_MECHANISMS: MechanismClass[] = [
  "owned_content",
  "owned_distribution",
  "external_placement",
  "community_participation",
  "direct_outreach",
  "product_iteration",
  "conversion_optimization",
];

export type LlmHypothesis = {
  id: string;
  title: string;
  buyerSegment: string;
  externalSurface: string;
  mechanism: MechanismClass;
  safeActionType: LlmProposableAction;
  message: string;
  successPath: string;
  expectedImpact: number;
  confidence: number;
  effort: number;
  patternKey: string;
};

const HYPOTHESIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hypotheses", "portfolio_insight"],
  properties: {
    portfolio_insight: {
      type: "string",
      description: "One sentence on what has been learned about this business's real market so far.",
    },
    hypotheses: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "buyerSegment",
          "externalSurface",
          "mechanism",
          "safeActionType",
          "message",
          "successPath",
          "expectedImpact",
          "confidence",
          "effort",
          "patternKey",
        ],
        properties: {
          title: { type: "string" },
          buyerSegment: { type: "string" },
          externalSurface: { type: "string" },
          mechanism: { type: "string", enum: LLM_MECHANISMS },
          safeActionType: {
            type: "string",
            enum: [...LLM_PROPOSABLE_ACTIONS],
          },
          message: { type: "string" },
          successPath: { type: "string" },
          expectedImpact: { type: "number", minimum: 1, maximum: 10 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          effort: { type: "number", minimum: 1, maximum: 5 },
          patternKey: { type: "string" },
        },
      },
    },
  },
};

export type StrategistInput = {
  context: BusinessContext;
  observation: Observation;
  bannedMechanisms: Set<MechanismClass>;
  bannedPatterns: Set<string>;
  patternPosteriors: PatternPosteriorMap;
  portfolioSignal?: PortfolioSignal;
  now?: Date;
};

export type StrategistOutput = {
  hypotheses: LlmHypothesis[];
  opportunities: Opportunity[];
  portfolioInsight?: string;
  reason?: string;
};

const EMPTY: StrategistOutput = { hypotheses: [], opportunities: [] };

export async function proposeLlmStrategies(
  input: StrategistInput,
): Promise<StrategistOutput> {
  if (!hasOpenAIKey()) {
    return { ...EMPTY, reason: "no OPENAI_API_KEY" };
  }
  const banned = [...input.bannedMechanisms];
  const bannedPatterns = [...input.bannedPatterns];
  const priorProven = Object.values(input.patternPosteriors)
    .filter(
      (p) =>
        p.commercialOutcomes > 0 || p.intents > 0 || p.verifiedExposures > 0,
    )
    .map((p) => ({
      patternKey: p.patternKey,
      mechanism: p.mechanism,
      commercial: p.commercialOutcomes,
      intents: p.intents,
      views: p.verifiedExposures,
    }));

  const portfolio =
    input.portfolioSignal &&
    [...input.portfolioSignal.patternSignal.entries()].map(([k, v]) => ({
      patternKey: k,
      commercial: v.commercial,
      intent: v.intent,
      views: v.verifiedExposure,
      sites: v.sitesWithSignal,
    }));

  const state = {
    site: {
      id: input.context.siteId,
      display: input.context.displayName,
      industry: input.context.industry,
      allowedChannels: input.context.allowedChannels,
      constraints: input.context.constraints,
      dailyCapUsd: input.context.autonomousDailyCapUsd,
      products: input.context.products.map((p) => ({
        name: p.name,
        priceUsd: p.priceUsd,
        offer: "",
      })),
    },
    reality: {
      landingViews: input.observation.funnel.landingViews,
      checkouts: input.observation.funnel.checkouts,
      purchases: input.observation.money.purchases,
      revenueUsd: input.observation.money.revenueUsd,
      bottleneck: input.observation.bottleneck.label,
    },
    forbidden: {
      mechanisms: banned,
      patternKeys: bannedPatterns,
      note:
        "Mechanisms and pattern keys listed above have exhausted their attempt budget with zero commercial signal. Do not propose them again unless there is NEW evidence.",
    },
    priorSignal: {
      thisSite: priorProven,
      portfolio: portfolio ?? [],
    },
    rules: [
      "NO paid advertising.",
      "NO owner logins. Every action must run without the owner logging into any external service.",
      "NO scraping copyrighted content wholesale.",
      "Every hypothesis must name a specific external surface (URL, community, aggregator, contact form) that RevenueOS can reach via public HTTP.",
      "Every hypothesis must specify a `safeActionType` from the enum — those are the actions RevenueOS has executors for.",
      "Do not repeat a banned pattern. Do not merely rename a banned pattern.",
      "Optimize for a first paying customer, not for activity metrics.",
    ],
    action_catalog: LLM_PROPOSABLE_ACTIONS,
  };

  const system: ChatMessage = {
    role: "system",
    content:
      "You are the strategist limb of RevenueOS, a fully autonomous commercial operator. Your sole objective is to maximize real, collected revenue for the given business. Every response must be JSON matching the provided schema. Be specific, be aggressive, be legally clean. Do not propose lazy 'publish more content' variants unless you can name a specific surface and buyer segment for the content. Prefer external_placement, community_participation, and direct_outreach mechanisms when own-content has been exhausted. Content is only useful if you name where the reader will come from.",
  };

  const user: ChatMessage = {
    role: "user",
    content: `Current state:\n${JSON.stringify(state, null, 2)}\n\nReturn 3-6 genuinely different acquisition hypotheses. For each, name the buyer segment, the external surface, the mechanism, the action, the exact message/copy angle to use, and the causal success path to a purchase.`,
  };

  const res = await callOpenAI<{
    portfolio_insight: string;
    hypotheses: Array<Omit<LlmHypothesis, "id">>;
  }>({
    model: DEFAULT_MODELS.strategist,
    messages: [system, user],
    jsonSchema: HYPOTHESIS_SCHEMA,
    temperature: 0.85,
    maxOutputTokens: 1600,
    timeoutMs: 30_000,
  });
  if (!res.ok) return { ...EMPTY, reason: res.reason };

  const hypotheses: LlmHypothesis[] = [];
  const opportunities: Opportunity[] = [];
  for (const [i, h] of res.data.hypotheses.entries()) {
    if (
      !LLM_PROPOSABLE_ACTIONS.includes(h.safeActionType as LlmProposableAction)
    ) {
      continue;
    }
    if (input.bannedPatterns.has(h.patternKey)) continue;
    if (input.bannedMechanisms.has(h.mechanism)) continue;
    const id = `llm-${Date.now().toString(36)}-${i}`;
    const hypo: LlmHypothesis = { ...h, id };
    hypotheses.push(hypo);
    opportunities.push({
      id,
      title: h.title,
      metric: "attributed purchases",
      category: "acquisition",
      precursorMetric: "landing_views",
      expectedImpact: h.expectedImpact,
      confidence: h.confidence,
      effort: h.effort,
      action: `${h.message}\n→ ${h.successPath}\nSurface: ${h.externalSurface}\nSegment: ${h.buyerSegment}`,
      safeActionType: h.safeActionType,
      patternKey: h.patternKey,
      score: h.expectedImpact * (0.5 + h.confidence * 0.5) * 10,
    });
  }
  return {
    hypotheses,
    opportunities,
    portfolioInsight: res.data.portfolio_insight,
  };
}

type ChatMessage = { role: "system" | "user"; content: string };
