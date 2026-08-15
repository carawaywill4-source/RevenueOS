/**
 * Titan Evidence Pack — decision-relevant research for admission / acquisition.
 */

import { PORTFOLIO_50_SPECS } from "@revenueos/core";
import type pg from "pg";
import { runTitanResearch } from "./titan-research-engine.js";
import {
  loadLatestEvidencePack,
  queryClaims,
  saveEvidencePack,
  upsertCustomerModel,
  upsertMoneyModel,
} from "./titan-world-store.js";

export const TITAN_EVIDENCE_PACK_VERSION = "titan-evidence-pack-v1";

export type TenKPathClass =
  | "PLAUSIBLE"
  | "POSSIBLE_BUT_UNPROVEN"
  | "LOW_PROBABILITY"
  | "STRUCTURALLY_IMPLAUSIBLE"
  | "UNKNOWN_NEEDS_RESEARCH";

export type EvidencePack = {
  version: string;
  businessId: string;
  purpose: string;
  packId?: string;
  researchRunId?: string;
  existingKnowledgeCount: number;
  knowledgeGaps: string[];
  questionsThatWouldChangeDecision: string[];
  researchSummary: string;
  facts: string[];
  claimIds: string[];
  sourcesInspected: number;
  usefulSources: number;
  customerModel: Record<string, unknown>;
  tenKPath: {
    dailyTargetUsd: number;
    pathClass: TenKPathClass;
    examplePath: string;
    assumptions: string[];
    confidence: number;
  };
  decisionHint?:
    | "FAST_ACCEPT"
    | "PROBATION"
    | "REWORK_BEFORE_ADMISSION"
    | "REJECT_AND_REPLACE";
  wouldBuildToday?: boolean;
  opportunityCostNote?: string;
};

function specFor(siteId: string) {
  return PORTFOLIO_50_SPECS.find((s) => s.siteId === siteId);
}

import { evaluateEconomicFeasibility } from "./titan-commercial-executive/economic-feasibility.js";

function classifyTenKPath(input: {
  priceUsd: number;
  organic: string;
  crowded: boolean;
  facts: string[];
  revenueModel?: string;
}): { pathClass: TenKPathClass; examplePath: string; confidence: number; assumptions: string[] } {
  const f = evaluateEconomicFeasibility({
    priceUsd: input.priceUsd,
    organic: input.organic,
    crowded: input.crowded,
    revenueModel: input.revenueModel ?? "one_shot",
    largeMarketHint: input.organic === "high",
    productLedDistribution: input.facts.some((x) => /tool|calculator|share|viral|embed/i.test(x)),
    upsellHint: input.facts.some((x) => /upsell|bundle|tier/i.test(x)),
  });
  const examplePath = `${f.purchasesPerDay} sales/day × $${f.priceUsd} [${f.class}]`;
  const assumptions = [
    ...f.factors.slice(0, 4),
    ...f.penalties.slice(0, 3),
    ...f.positives.slice(0, 3),
    "Price alone never determines feasibility; low-ticket one-shot is a strong negative prior",
  ];
  let pathClass: TenKPathClass;
  if (f.class === "IMPLAUSIBLE") pathClass = "STRUCTURALLY_IMPLAUSIBLE";
  else if (f.class === "WEAK" || f.class === "HIGH_VOLUME_RISK")
    pathClass = "LOW_PROBABILITY";
  else if (f.class === "CREDIBLE" || f.class === "PLAUSIBLE")
    pathClass = "POSSIBLE_BUT_UNPROVEN";
  else if (f.class === "PLAUSIBLE_WITH_REMODEL") pathClass = "POSSIBLE_BUT_UNPROVEN";
  else pathClass = "UNKNOWN_NEEDS_RESEARCH";

  if (input.facts.length < 1 && pathClass === "POSSIBLE_BUT_UNPROVEN") {
    pathClass = "UNKNOWN_NEEDS_RESEARCH";
  }

  return {
    pathClass,
    examplePath,
    confidence: Math.min(0.85, 0.25 + f.score / 150),
    assumptions,
  };
}

/** Build (or refresh) an evidence pack for a candidate / business. */
export async function buildEvidencePack(input: {
  pool: pg.Pool;
  businessId: string;
  purpose: "ADMISSION" | "ACQUISITION" | "OPPORTUNITY" | "BOTTLENECK";
  forceRefresh?: boolean;
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<EvidencePack> {
  if (!input.forceRefresh) {
    const existing = await loadLatestEvidencePack(
      input.pool,
      input.businessId,
      input.purpose,
    );
    if (existing?.createdAt) {
      const age =
        Date.now() - Date.parse(String(existing.createdAt));
      if (age < 6 * 3_600_000 && existing.version === TITAN_EVIDENCE_PACK_VERSION) {
        return existing as unknown as EvidencePack;
      }
    }
  }

  const spec = specFor(input.businessId);
  const display = spec?.displayName ?? input.businessId;
  const problem = spec?.problem ?? `${display} customer problem`;
  const industry = spec?.industry ?? "unknown";
  const buyer = spec?.buyer ?? "unknown buyer";
  const priceUsd = spec?.priceUsd ?? 49;
  const organic = spec?.expectedEconomics?.organicPotential ?? "medium";

  const prior = await queryClaims(input.pool, {
    businessId: input.businessId,
    limit: 15,
  });
  const gaps: string[] = [];
  const questions: string[] = [
    `Does real demand exist for: ${problem}?`,
    `Who buys ${display} and why?`,
    `What do competitors charge for similar ${industry} solutions?`,
    `What language do buyers use when describing this problem?`,
    `How reachable are buyers organically for ${display}?`,
  ];
  if (prior.length < 3) gaps.push("sparse_prior_claims");
  if (!prior.some((c) => /price|\$/i.test(String(c.claim))))
    gaps.push("missing_pricing_evidence");

  const queries = [
    `${industry} ${problem.split(" ").slice(0, 6).join(" ")}`,
    `${display} alternative OR competitor pricing`,
    `"${buyer.split(" ").slice(0, 4).join(" ")}" looking for OR need OR recommend`,
  ];

  const research = await runTitanResearch({
    pool: input.pool,
    question: `Admission/commercial evidence for ${display} (${input.businessId}): ${problem}`,
    businessId: input.businessId,
    purpose: input.purpose,
    queries,
    budget: { maxSearches: 3, maxPages: 5, maxMs: 22_000 },
    logger: input.logger,
  });

  const crowded =
    /content_campaign|short_form_video|website_copy|marketing|generic/i.test(
      industry,
    );
  const tenK = classifyTenKPath({
    priceUsd,
    organic,
    crowded,
    facts: research.decisionRelevantFacts,
  });

  const customerModel = {
    businessId: input.businessId,
    whoBuys: buyer,
    coreProblem: problem,
    purchaseTrigger: "unknown_needs_measurement",
    majorObjections: research.decisionRelevantFacts
      .filter((f) => /Pain\/objection/i.test(f))
      .slice(0, 5),
    customerLanguage: research.decisionRelevantFacts
      .filter((f) => /Customer\/intent/i.test(f))
      .slice(0, 8),
    acquisitionEnvironments: [
      "high-intent search",
      "community recommendation threads",
      "comparison/alternative pages",
    ],
    updatedAt: new Date().toISOString(),
    evidenceRunId: research.runId,
  };
  await upsertCustomerModel(input.pool, input.businessId, customerModel);

  const moneyDoc = {
    business_id: input.businessId,
    daily_revenue: null as number | null,
    daily_profit: null as number | null,
    daily_target: 10000,
    target_progress: null as number | null,
    note: "Measured revenue only — null means UNKNOWN, not zero",
    current_bottleneck: "qualified_acquisition_or_unproven_demand",
    current_growth_thesis: research.summary.slice(0, 240),
    next_highest_value_action: "validate_buyer_intent_with_zero_cost_distribution",
    confidence: tenK.confidence,
    target_path: tenK.examplePath,
    target_path_class: tenK.pathClass,
    assumptions: tenK.assumptions,
    updatedAt: new Date().toISOString(),
  };
  await upsertMoneyModel(input.pool, input.businessId, moneyDoc);

  let decisionHint: EvidencePack["decisionHint"];
  let wouldBuildToday = false;
  let opportunityCostNote = "";

  if (tenK.pathClass === "STRUCTURALLY_IMPLAUSIBLE") {
    decisionHint = "REJECT_AND_REPLACE";
    wouldBuildToday = false;
    opportunityCostNote =
      "Multi-factor economic feasibility IMPLAUSIBLE/WEAK — not a price-only reject. Prefer remodel or stronger opportunity.";
  } else if (tenK.pathClass === "LOW_PROBABILITY") {
    decisionHint = "REWORK_BEFORE_ADMISSION";
    wouldBuildToday = false;
    opportunityCostNote =
      "HIGH_VOLUME_RISK / weak economics — remodel (recurring/LTV/channels) before probation spend.";
  } else if (crowded && organic !== "high" && research.usefulSources >= 1) {
    decisionHint = "REJECT_AND_REPLACE";
    wouldBuildToday = false;
    opportunityCostNote =
      "Crowded commoditized market with weak organic path — slot capital better elsewhere.";
  } else if (research.usefulSources === 0 && gaps.includes("sparse_prior_claims")) {
    decisionHint = "PROBATION";
    wouldBuildToday = false;
    opportunityCostNote =
      "Insufficient internet evidence — probation for real-world signal, not blind accept.";
  } else if (tenK.pathClass === "POSSIBLE_BUT_UNPROVEN" && organic === "high") {
    decisionHint = "PROBATION";
    wouldBuildToday = true;
    opportunityCostNote = "Credible enough to test; not strong enough for FAST_ACCEPT.";
  } else {
    decisionHint = "PROBATION";
    wouldBuildToday = organic === "high";
  }

  const pack: EvidencePack = {
    version: TITAN_EVIDENCE_PACK_VERSION,
    businessId: input.businessId,
    purpose: input.purpose,
    researchRunId: research.runId,
    existingKnowledgeCount: prior.length,
    knowledgeGaps: [...gaps, ...research.knowledgeGapsRemaining],
    questionsThatWouldChangeDecision: questions,
    researchSummary: research.summary,
    facts: research.decisionRelevantFacts,
    claimIds: research.claimIds,
    sourcesInspected: research.sourcesInspected,
    usefulSources: research.usefulSources,
    customerModel,
    tenKPath: {
      dailyTargetUsd: 10000,
      pathClass: tenK.pathClass,
      examplePath: tenK.examplePath,
      assumptions: tenK.assumptions,
      confidence: tenK.confidence,
    },
    decisionHint,
    wouldBuildToday,
    opportunityCostNote,
  };

  const packId = await saveEvidencePack(input.pool, {
    businessId: input.businessId,
    purpose: input.purpose,
    decisionHint,
    pack: pack as unknown as Record<string, unknown>,
    claimIds: research.claimIds,
    researchRunId: research.runId,
  });
  pack.packId = packId;

  input.logger?.("info", "titan.evidence_pack.built", {
    businessId: input.businessId,
    purpose: input.purpose,
    decisionHint,
    usefulSources: research.usefulSources,
    claims: research.claimIds.length,
    tenK: tenK.pathClass,
    packId,
  });

  return pack;
}
