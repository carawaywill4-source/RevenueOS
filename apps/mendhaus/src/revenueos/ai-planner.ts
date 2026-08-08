import OpenAI from "openai";
import type { HourPulse, Observation, Opportunity, PlannerDecision, SafeAction } from "@tributeready/revenueos";

export type MendhausAiBrief = {
  source: "ai" | "deterministic";
  diagnosis: string;
  evidence: string;
  nextMove: string;
  report: string;
  fallbackReason?: string;
};

export async function planMendhausBrief(input: {
  hour: HourPulse;
  bottleneck: string;
  executed: string[];
  nextMove: string;
  discoverySummary?: string;
  attackQueries?: string[];
}): Promise<MendhausAiBrief> {
  const fallback = (reason?: string): MendhausAiBrief => ({
    source: "deterministic",
    diagnosis: input.bottleneck,
    evidence: `${input.hour.landingViews} views, ${input.hour.checkouts} checkouts, ${input.hour.purchases} purchases. Research: ${input.discoverySummary ?? "none"}.`,
    nextMove: input.nextMove,
    report: `Measured funnel: ${input.hour.landingViews} views, ${input.hour.checkouts} checkouts, ${input.hour.purchases} purchases. Completed: ${input.executed.join("; ") || "scorecard recorded"}. Attacks: ${(input.attackQueries ?? []).join(", ") || "none"}.`,
    fallbackReason: reason,
  });
  if (!process.env.OPENAI_API_KEY) return fallback("OPENAI_API_KEY is not configured");
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 12_000, maxRetries: 0 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      store: false,
      instructions:
        "You analyze Mendhaus as a profit maximizer toward $10k contribution-profit/day. Use only supplied facts. Never invent traffic or sales. If views≈0: buyable discovery attack. If views exist without purchases: conversion/merch, not more topics. nextMove must be the highest-dollar move. Return JSON: diagnosis, evidence, nextMove, report; each max 280 chars.",
      input: JSON.stringify(input),
      text: { format: { type: "json_object" } },
    });
    const parsed = JSON.parse(response.output_text) as Partial<MendhausAiBrief>;
    if (!parsed.diagnosis || !parsed.evidence || !parsed.nextMove || !parsed.report) {
      return fallback("AI response did not match the required schema");
    }
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
    rationale: "Deterministic ranker retained for Mendhaus.",
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
        "You are Mendhaus RevenueOS — sole business manager for this store.",
        "SUCCESS = money made for the customer. FAILURE = $0 / under $10k/day. Failure is not an option.",
        "ERA: MASTER ORGANIC LEADS→SALES. Not okay — mastery. Ads locked until organic conversion is lethal.",
        "Never select paid ads. Prefer organic research/publish/index + merch closes.",
        "If visitors exist and purchases≈0: merch/conversion, not more topics.",
        "If the funnel is empty: buyable-demand research and sellable doors only.",
        "Use only supplied facts. Falsifier must be profit or purchases.",
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
      evidence: Array.isArray(parsed.evidence)
        ? parsed.evidence.filter((value): value is string => typeof value === "string").slice(0, 5)
        : [],
      selectedOpportunityIds: parsed.selectedOpportunityIds.slice(0, 3),
      rejectedOpportunityIds: Array.isArray(parsed.rejectedOpportunityIds)
        ? parsed.rejectedOpportunityIds.filter((value): value is string => typeof value === "string").slice(0, 8)
        : [],
      falsifier:
        typeof parsed.falsifier === "string"
          ? parsed.falsifier.slice(0, 300)
          : "Contribution profit / purchases do not move toward $10k/day.",
    };
  } catch (error) {
    return fallback((error as Error).message);
  }
}
