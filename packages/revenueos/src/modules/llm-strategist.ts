/**
 * LLM strategist — the thinking layer.
 *
 * Feeds a *compact* commercial state into a complimentary-eligible model and
 * asks for a few NEW acquisition hypotheses. Prompts are deliberately kept
 * under the complimentary 2000-char preflight cap so billing.payer=openai.
 *
 * Safety envelope is enforced downstream by policy + pattern gate.
 */

import type { BusinessContext, Observation, Opportunity } from "../types";
import type { MechanismClass } from "./action-class";
import type { PatternPosteriorMap } from "./pattern-posterior";
import type { PortfolioSignal } from "./revenue-priority";
import { buildCommercialStateHash } from "./ai-budget-governor";
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
  "gbp_post",
  "gbp_qa_answer",
  "bing_places_post",
  "apple_business_showcase",
  "nextdoor_business_post",
  "yelp_business_post",
  "yelp_review_response",
  "youtube_shorts_publish",
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

/** Compact action shortlist for prompts (full catalog validated client-side). */
const PROMPT_ACTION_SHORTLIST = [
  "buyer_discovery",
  "public_form_outreach",
  "directory_submit",
  "syndicate_content",
  "channel_discover",
  "reddit_discover_intent",
  "email_cold_outreach",
  "publish_intent_page",
  "gsc_indexation_check",
  "change_default_cta",
] as const;

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

const COMPLIMENTARY_PROMPT_BUDGET = 1600;

function clip(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export async function proposeLlmStrategies(
  input: StrategistInput,
): Promise<StrategistOutput> {
  if (!hasOpenAIKey()) {
    return { ...EMPTY, reason: "no OPENAI_API_KEY" };
  }
  const banned = [...input.bannedMechanisms].slice(0, 6);
  const bannedPatterns = [...input.bannedPatterns].slice(0, 8);
  const bottleneck =
    input.observation.bottleneck?.label ??
    (input.observation.funnel.landingViews <= 0
      ? "NO_IMPRESSIONS"
      : "UNKNOWN");
  const hourViews = input.observation.hourPulse?.landingViews ?? 0;

  const state = {
    id: input.context.siteId,
    name: clip(input.context.displayName, 40),
    industry: clip(input.context.industry ?? "", 32),
    bn: bottleneck,
    views: input.observation.funnel.landingViews,
    hourViews,
    checkouts: input.observation.funnel.checkouts,
    purchases: input.observation.money.purchases,
    rev: input.observation.money.revenueUsd,
    banned,
    bannedPatterns,
    actions: PROMPT_ACTION_SHORTLIST,
  };

  // No json_schema tool — structured outputs have been observed as
  // billing.payer=developer even for tiny gpt-5-mini prompts. Plain text JSON
  // stays on the complimentary path.
  const system: { role: "system"; content: string } = {
    role: "system",
    content:
      "Return ONLY compact JSON: {\"portfolio_insight\":\"...\",\"hypotheses\":[{\"title\":\"\",\"buyerSegment\":\"\",\"externalSurface\":\"\",\"mechanism\":\"owned_distribution\",\"safeActionType\":\"buyer_discovery\",\"message\":\"\",\"successPath\":\"\",\"expectedImpact\":5,\"confidence\":0.5,\"effort\":2,\"patternKey\":\"\"}]}. Max 2 hypotheses. No ads/logins.",
  };
  let userContent = `State:${JSON.stringify(state)} Pick next exposure→purchase limb.`;
  const maxUser = Math.max(
    120,
    COMPLIMENTARY_PROMPT_BUDGET - system.content.length,
  );
  userContent = clip(userContent, maxUser);

  const res = await callOpenAI<{ text?: string } & {
    portfolio_insight?: string;
    hypotheses?: Array<Omit<LlmHypothesis, "id">>;
  }>({
    model: DEFAULT_MODELS.strategist,
    messages: [system, { role: "user", content: userContent }],
    temperature: 0.4,
    maxOutputTokens: 350,
    timeoutMs: 25_000,
    justification: {
      businessId: input.context.siteId,
      scope: "business",
      subsystem: "llm-strategist",
      purpose: "acquisition_diagnosis",
      reason: `bottleneck=${bottleneck}; choose next acquisition limb for first stranger purchase`,
      priority: 6,
      tags: [bottleneck, "strategist"],
      stateHash: buildCommercialStateHash({
        siteId: input.context.siteId,
        bottleneck,
        purchases: input.observation.money.purchases,
        revenueUsd: input.observation.money.revenueUsd,
        landingViews: input.observation.funnel.landingViews,
        hourViews,
        bannedPatterns: bannedPatterns.slice(0, 8),
      }),
    },
  });
  if (!res.ok) return { ...EMPTY, reason: res.reason };

  let parsed: {
    portfolio_insight?: string;
    hypotheses?: Array<Omit<LlmHypothesis, "id">>;
  } = res.data as {
    portfolio_insight?: string;
    hypotheses?: Array<Omit<LlmHypothesis, "id">>;
  };
  if (!parsed.hypotheses && typeof (res.data as { text?: string }).text === "string") {
    const raw = (res.data as { text: string }).text.trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1)) as typeof parsed;
      } catch {
        return { ...EMPTY, reason: "strategist_json_parse_failed" };
      }
    } else {
      return { ...EMPTY, reason: "strategist_json_parse_failed" };
    }
  }

  const hypotheses: LlmHypothesis[] = [];
  const opportunities: Opportunity[] = [];
  for (const [i, h] of (parsed.hypotheses ?? []).entries()) {
    if (
      !LLM_PROPOSABLE_ACTIONS.includes(h.safeActionType as LlmProposableAction)
    ) {
      continue;
    }
    if (!LLM_MECHANISMS.includes(h.mechanism as MechanismClass)) continue;
    if (input.bannedPatterns.has(h.patternKey)) continue;
    if (input.bannedMechanisms.has(h.mechanism as MechanismClass)) continue;
    const id = `llm-${Date.now().toString(36)}-${i}`;
    const hypo: LlmHypothesis = { ...h, id, mechanism: h.mechanism as MechanismClass };
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
    portfolioInsight: parsed.portfolio_insight,
  };
}
