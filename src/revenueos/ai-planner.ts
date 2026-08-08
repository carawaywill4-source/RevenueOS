import OpenAI from "openai";
import type { GrowthSnapshot } from "@/lib/growthos";
import type { Observation, Opportunity, PlannerDecision, SafeAction } from "@revenueos/core";

export type AiRevenueBrief = {
  source: "ai" | "deterministic";
  diagnosis: string;
  evidence: string;
  nextMove: string;
  report: string;
  fallbackReason?: string;
};

export async function planRevenueBrief(snapshot: GrowthSnapshot): Promise<AiRevenueBrief> {
  const hour = snapshot.cycle?.hourPlan;
  const metrics = {
    revenueUsd: hour?.lastHourRevenueUsd ?? 0,
    purchases: hour?.lastHourPurchases ?? 0,
    landingViews: hour?.lastHourLandingViews ?? 0,
    checkouts: hour?.lastHourCheckouts ?? 0,
    bottleneck: snapshot.bottleneck.label,
    nextMoves: (hour?.nextHourMoves ?? []).slice(0, 4).map((move) => ({
      title: move.title,
      ownerGated: Boolean(move.ownerGated),
    })),
  };
  const fallback = (reason?: string): AiRevenueBrief => ({
    source: "deterministic",
    diagnosis: metrics.bottleneck,
    evidence: `${metrics.landingViews} views, ${metrics.checkouts} checkouts, ${metrics.purchases} purchases in the measured hour.`,
    nextMove: metrics.nextMoves[0]?.title ?? snapshot.nextAction,
    report: `Measured funnel: ${metrics.landingViews} views, ${metrics.checkouts} checkouts, ${metrics.purchases} purchases. Bottleneck: ${metrics.bottleneck}.`,
    fallbackReason: reason,
  });
  if (!process.env.OPENAI_API_KEY) return fallback("OPENAI_API_KEY is not configured");
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 12_000, maxRetries: 0 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      instructions:
        "You are RevenueOS: maximize contribution profit toward a $10,000/day north star. Use ONLY supplied aggregate facts. Never invent traffic, customers, tests, or outcomes. Prefer moves that close dollars (purchases/profit) over vanity traffic. Return JSON: diagnosis, evidence, nextMove, report. Each max 280 chars. nextMove must select or refine a supplied non-owner-gated move.",
      input: JSON.stringify(metrics),
      text: { format: { type: "json_object" } },
    });
    const parsed = JSON.parse(response.output_text) as Partial<AiRevenueBrief>;
    if (
      typeof parsed.diagnosis !== "string" ||
      typeof parsed.evidence !== "string" ||
      typeof parsed.nextMove !== "string" ||
      typeof parsed.report !== "string"
    ) return fallback("AI response did not match the required schema");
    return {
      source: "ai",
      diagnosis: parsed.diagnosis.slice(0, 280),
      evidence: parsed.evidence.slice(0, 280),
      nextMove: parsed.nextMove.slice(0, 280),
      report: parsed.report.slice(0, 280),
    };
  } catch (error) {
    return fallback((error as Error).message);
  }
}

export async function planOpportunityDecision(input: {
  observation: Observation;
  opportunities: Opportunity[];
  safeActions: SafeAction[];
  shortfall?: { shortfallUsd: number; dayVerdict: string; pctOfNorthStar: number };
  moneyPlan?: { marginalDollar: string; totalProjectedMonthlyProfitUsd: number; items: Array<{ opportunityId: string; title: string }> };
  profitMandate?: { focus: string; order: string; why: string; falsifier: string; shortfallUsd: number };
  organicMastery?: { level: string; score: number; adsReadiness: string; verdict: string; drills: string[] };
}): Promise<PlannerDecision> {
  const fallback = (reason?: string): PlannerDecision => ({
    source: "deterministic",
    rationale: "The deterministic ranker remains in control.",
    evidence: [input.observation.bottleneck.detail],
    selectedOpportunityIds: [],
    rejectedOpportunityIds: [],
    falsifier: "A validated planner response with supported evidence.",
    fallbackReason: reason,
  });
  if (!process.env.OPENAI_API_KEY) return fallback("OPENAI_API_KEY is not configured");
  const opportunities = input.opportunities.slice(0, 12).map((opportunity) => ({
    id: opportunity.id,
    title: opportunity.title,
    action: opportunity.action,
    safeActionType: opportunity.safeActionType,
    score: opportunity.score,
    category: opportunity.category,
    precursorMetric: opportunity.precursorMetric,
    expectedProfitUsd: opportunity.predicted?.expectedProfitUsd ?? 0,
    timeToSignalDays: opportunity.predicted?.timeToSignalDays ?? null,
  }));
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 12_000, maxRetries: 0 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      instructions: [
        "You are RevenueOS — sole business manager for this site.",
        "SUCCESS = money made for the customer. FAILURE = no money / under $10k/day. Failure is not an option.",
        "ERA: MASTER ORGANIC LEADS AND SALES. Not okay — mastery. Ads are locked until organic conversion is a weapon.",
        "Never select paid ads. Prefer organic research/publish/index + conversion closes.",
        "Traffic/topics are tools only. Prefer purchases/conversion when traffic exists; buyable organic acquisition when empty.",
        "Use only supplied facts. Prefer safeActionType when EV is competitive.",
        "Falsifier must be dollar-denominated (profit/purchases).",
        "Return JSON: rationale, evidence(string[]), selectedOpportunityIds, rejectedOpportunityIds, falsifier.",
      ].join(" "),
      input: JSON.stringify({
        organicMastery: input.organicMastery,
        profitMandate: input.profitMandate,
        shortfall: input.shortfall,
        moneyPlan: input.moneyPlan
          ? {
              marginalDollar: input.moneyPlan.marginalDollar,
              projectedMonthlyUsd: input.moneyPlan.totalProjectedMonthlyProfitUsd,
              funded: input.moneyPlan.items.slice(0, 5),
            }
          : null,
        money: input.observation.money,
        bottleneck: input.observation.bottleneck,
        funnel: input.observation.funnel,
        opportunities,
        safeActionTypes: input.safeActions.map((action) => action.type),
      }),
      text: { format: { type: "json_object" } },
    });
    const parsed = JSON.parse(response.output_text) as Partial<PlannerDecision>;
    if (!Array.isArray(parsed.selectedOpportunityIds) || typeof parsed.rationale !== "string") {
      return fallback("Planner response did not match the required schema");
    }
    return {
      source: "ai",
      rationale: parsed.rationale.slice(0, 500),
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter((value): value is string => typeof value === "string").slice(0, 5) : [],
      selectedOpportunityIds: parsed.selectedOpportunityIds.slice(0, 3),
      rejectedOpportunityIds: Array.isArray(parsed.rejectedOpportunityIds) ? parsed.rejectedOpportunityIds.filter((value): value is string => typeof value === "string").slice(0, 8) : [],
      falsifier: typeof parsed.falsifier === "string" ? parsed.falsifier.slice(0, 300) : "Contribution profit does not increase toward $10k/day in the signal window.",
    };
  } catch (error) {
    return fallback((error as Error).message);
  }
}
