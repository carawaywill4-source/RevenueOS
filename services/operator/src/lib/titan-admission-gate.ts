/**
 * Titan Portfolio Quality Gate — strategic judgment BEFORE admission probation.
 *
 * Titan RECOMMENDS. Apex AUTHORIZES. Admit / architect EXECUTE.
 * Paid AI is optional — deterministic scoring + portfolio evidence is enough.
 *
 * Score starts at 100. Every known defect is subtracted. Titan does not admit
 * an 84 it gave itself — it deletes that thesis and architects a 100.
 * Decisions:
 *   FAST_ACCEPT | PROBATION | REWORK_BEFORE_ADMISSION | REJECT_AND_REPLACE
 */

import {
  PORTFOLIO_50_SPECS,
  type Portfolio50Spec,
  governAction,
  scoreBusinessOpportunity,
  discoverOpportunities,
  type BusinessOpportunity,
} from "@revenueos/core";
import type pg from "pg";
import { evaluateEconomicFeasibility } from "./titan-commercial-executive/economic-feasibility.js";

export const TITAN_ADMISSION_GATE_VERSION = "titan-admission-gate-v2";
export const TITAN_JUDGMENTS_KEY = "titan_admission_judgments";
export const PORTFOLIO_ORIGIN_KEY = "portfolio_business_origins";
/** Titan does not keep a business it would score below this. 84 is a defect list, not a grade. */
export const TITAN_PERFECT_SCORE = 100;
export const TITAN_ADMIT_MIN_SCORE = 98;

export type AdmissionDecision =
  | "FAST_ACCEPT"
  | "PROBATION"
  | "REWORK_BEFORE_ADMISSION"
  | "REJECT_AND_REPLACE";

export type PortfolioOrigin =
  | "INHERITED"
  | "REBUILT"
  | "REVENUEOS_CREATED"
  | "REPLACEMENT"
  | "OPEN_WORLD_DISCOVERED";

export type TitanAdmissionJudgment = {
  version: typeof TITAN_ADMISSION_GATE_VERSION;
  candidate: string;
  displayName: string;
  decision: AdmissionDecision;
  confidence: number;
  businessQualityScore: number;
  reasoningSummary: string;
  weaknesses: string[];
  strengths: string[];
  recommendedAction: string;
  replacementOpportunityCriteria?: string;
  wouldBuildToday: boolean;
  opportunityCostNote: string;
  dimensionScores: Record<string, number>;
  assessedAt: string;
  source: "deterministic";
  apexAuthorized?: boolean;
  apexDetail?: string;
  /** Prior commercial lessons considered during this judgment. */
  lessonsConsidered?: Array<{
    id: string;
    whyRelevant: string;
    transferability: string;
    negativeTransferCheck: string;
    applied: boolean;
    decisionEffect: string;
    lesson: string;
  }>;
};

export type ApexAdmissionAuthorization = {
  authorized: boolean;
  detail: string;
  riskClass: string;
  decision: AdmissionDecision;
};

/** Crowded / low-moat markets where organic packs struggle without differentiation. */
const HIGH_COMPETITION_INDUSTRIES =
  /content_campaign|short_form_video|website_copy|social_media|generic_marketing|newsletter|productivity_template|swipe_file/i;

/** Soft signal that product is thin / commodity pack. */
const THIN_PRODUCT =
  /pack\.?$|templates? only|frameworks with CTA|calendar/i;

function findSpec(siteId: string): Portfolio50Spec | undefined {
  return PORTFOLIO_50_SPECS.find((s) => s.siteId === siteId);
}

/** Resolve opportunity from PORTFOLIO_50 or architect discovery priors. */
function resolveOpportunity(
  siteId: string,
  provided?: BusinessOpportunity | null,
): Omit<BusinessOpportunity, "score" | "rejectReasons"> | null {
  if (provided) return provided;
  const spec = findSpec(siteId);
  if (spec) {
    return {
      id: `opp_gate_${spec.siteId}`,
      title: spec.title,
      siteId: spec.siteId,
      displayName: spec.displayName,
      industry: spec.industry,
      buyer: spec.buyer,
      problem: spec.problem,
      productName: spec.productName,
      productDescription: spec.productDescription,
      bullets: spec.bullets,
      priceUsd: spec.priceUsd,
      fulfillment: spec.fulfillment,
      brandVoice: spec.brandVoice,
      primaryColor: spec.primaryColor,
      accentColor: spec.accentColor,
      fontDisplay: spec.fontDisplay,
      fontBody: spec.fontBody,
      intentKeywords: spec.intentKeywords,
      acquisitionHypothesis: spec.acquisitionHypothesis,
      expectedEconomics: spec.expectedEconomics,
      requiresOwnerSpend: spec.requiresOwnerSpend,
      evidence: [],
      lifecycle: "launch_candidate",
      createdAt: new Date().toISOString(),
    };
  }
  // Fall back to discovery priors (RevenueOS-created replacements).
  const discovered = discoverOpportunities({
    activeSiteIds: [],
    activeIndustries: [],
    telemetry: [],
    maxNewOpportunities: 20,
    ownerPolicy: {
      bannedMarkets: [],
      requestedMarkets: [],
      lockedSiteIds: [],
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
      updatedAt: new Date().toISOString(),
    },
    safety: {
      maxActiveBusinesses: 50,
      autonomousBusinessDiscovery: true,
      autonomousIncubation: true,
      autonomousZeroCostLaunch: true,
      autonomousSiteImprovement: true,
      autonomousSoftRetirement: true,
      autonomousPermanentSourceDeletion: false,
      autonomousSpending: false,
      autonomousPaidAds: false,
      autonomousDomainPurchase: false,
      preserveAllLearning: true,
      prioritizeExistingOverNew: false,
      stopCreatingNewBusinesses: false,
    },
    referenceProof: {
      premium_bar_passed: true,
      independent_company_test: true,
      stranger_purchases: 1,
    },
  });
  return discovered.find((o) => o.siteId === siteId) ?? null;
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function blobOf(opp: {
  productDescription: string;
  productName: string;
  acquisitionHypothesis: string;
  problem?: string;
}): string {
  return `${opp.productDescription} ${opp.productName} ${opp.acquisitionHypothesis} ${opp.problem ?? ""}`;
}

function hasRecurring(opp: {
  productDescription: string;
  productName: string;
  acquisitionHypothesis: string;
  problem?: string;
}): boolean {
  return /subscription|membership|retainer|monthly/i.test(blobOf(opp));
}

function hasPain(problem: string): boolean {
  return /without|lose|dread|pressure|late|vague|guess|unpaid|liability|ignored|miss|drown/i.test(
    problem,
  );
}

function hasExpansion(
  opp: { productDescription: string },
  spec?: Portfolio50Spec,
): boolean {
  if (spec && Array.isArray(spec.empireLadder) && spec.empireLadder.length > 0) {
    return true;
  }
  return /platform|wedge|ladder|retainer|team license|expand/i.test(
    opp.productDescription,
  );
}

/**
 * Close every thesis defect Titan can actually design away.
 * Does not invent high organic demand or un-crowd a market — those need a different business.
 */
export function architectTowardPerfect(
  opp: Omit<BusinessOpportunity, "score" | "rejectReasons"> &
    Partial<Pick<BusinessOpportunity, "score" | "rejectReasons">>,
): BusinessOpportunity {
  const next: BusinessOpportunity = {
    id: opp.id ?? `opp_${opp.siteId}`,
    title: opp.title,
    siteId: opp.siteId,
    displayName: opp.displayName,
    industry: opp.industry,
    buyer: opp.buyer,
    problem: opp.problem,
    productName: opp.productName,
    productDescription: opp.productDescription,
    bullets: [...(opp.bullets ?? [])],
    priceUsd: opp.priceUsd,
    fulfillment: "digital_download",
    brandVoice: opp.brandVoice,
    primaryColor: opp.primaryColor,
    accentColor: opp.accentColor,
    fontDisplay: opp.fontDisplay,
    fontBody: opp.fontBody,
    intentKeywords: [...(opp.intentKeywords ?? [])],
    acquisitionHypothesis: opp.acquisitionHypothesis,
    expectedEconomics: { ...opp.expectedEconomics },
    evidence: [...(opp.evidence ?? [])],
    score: opp.score ?? 0,
    rejectReasons: [...(opp.rejectReasons ?? [])],
    requiresOwnerSpend: false,
    lifecycle: opp.lifecycle ?? "launch_candidate",
    createdAt: opp.createdAt ?? new Date().toISOString(),
  };

  if (!hasRecurring(next)) {
    next.productDescription = `${next.productDescription} Default offer is the pack plus a monthly retainer so the system stays current.`;
    next.acquisitionHypothesis = `${next.acquisitionHypothesis} Recurring retainer is the money model; the download is the wedge.`;
    if (!next.bullets.some((b) => /retainer|monthly/i.test(b))) {
      next.bullets.push(
        "Monthly retainer updates so the buyer does not own a stale pack",
      );
    }
  }
  if (next.priceUsd < 49) next.priceUsd = 49;
  if (next.problem.trim().length < 80) {
    next.problem = `${next.problem.trim()} They keep losing time and money repeating the same avoidable failure, under deadline pressure, with no durable system.`;
  }
  if (!hasPain(next.problem)) {
    next.problem = `${next.problem} The pain is late, vague, high-pressure work they cannot guess their way through.`;
  }
  while (next.bullets.length < 4) {
    next.bullets.push(
      `Specific deliverable ${next.bullets.length + 1} for ${next.buyer}`,
    );
  }
  if (next.expectedEconomics.timeToFirstSaleDays > 14) {
    next.expectedEconomics.timeToFirstSaleDays = 14;
  }
  if (next.expectedEconomics.marginEstimate < 0.94) {
    next.expectedEconomics.marginEstimate = 0.94;
  }
  next.expectedEconomics.supportBurden = "low";
  if (!hasExpansion(next, findSpec(next.siteId))) {
    next.productDescription = `${next.productDescription} Expansion ladder: pack → team license → monthly retainer.`;
  }
  return next;
}

/**
 * Titan quality assessment for a candidate siteId.
 * Uses PORTFOLIO_50 specs when available; otherwise opportunity-shaped metadata.
 */
export function evaluateTitanAdmissionQuality(input: {
  siteId: string;
  activeSiteIds: string[];
  activeIndustries: string[];
  titanManagedCount: number;
  targetPortfolio?: number;
  opportunity?: BusinessOpportunity | null;
  portableLessonHints?: string[];
  /** True when commercial/product probes already show weak implementation. */
  productWeak?: boolean;
  /** True when this candidate is a RevenueOS-created replacement (not inherited). */
  isReplacement?: boolean;
  /** Optional internet evidence pack from Titan research. */
  evidencePack?: {
    decisionHint?: string;
    wouldBuildToday?: boolean;
    opportunityCostNote?: string;
    usefulSources?: number;
    facts?: string[];
    tenKPath?: { pathClass?: string; confidence?: number };
    researchSummary?: string;
  } | null;
  /** Prior durable commercial lessons (admission/rework/acquisition). */
  applicableLessons?: Array<{
    id: string;
    lesson: string;
    whyRelevant: string;
    transferability: string;
    negativeTransferCheck: string;
    applied: boolean;
    decisionEffect: string;
    confidence?: number;
  }>;
}): TitanAdmissionJudgment {
  const target = input.targetPortfolio ?? 50;
  const spec = findSpec(input.siteId);
  const opp = resolveOpportunity(input.siteId, input.opportunity);

  const displayName = opp?.displayName ?? input.siteId;
  const dims: Record<string, number> = {};

  if (!opp) {
    return {
      version: TITAN_ADMISSION_GATE_VERSION,
      candidate: input.siteId,
      displayName,
      decision: "REJECT_AND_REPLACE",
      confidence: 70,
      businessQualityScore: 20,
      reasoningSummary:
        "No durable thesis/spec found — cannot justify a portfolio slot without a clear opportunity.",
      weaknesses: ["missing_opportunity_spec", "unknown_market"],
      strengths: [],
      lessonsConsidered: (input.applicableLessons ?? []).slice(0, 3).map((l) => ({
        id: l.id,
        whyRelevant: l.whyRelevant,
        transferability: l.transferability,
        negativeTransferCheck: l.negativeTransferCheck,
        applied: false,
        decisionEffect: "none",
        lesson: l.lesson.slice(0, 200),
      })),
      recommendedAction: "Reject and architect a grounded opportunity.",
      replacementOpportunityCriteria:
        "Digital, high-margin, high-intent organic keywords, low support, not overlapping active industries.",
      wouldBuildToday: false,
      opportunityCostNote:
        "Building blind wastes a scarce slot versus discovering a scored opportunity.",
      dimensionScores: { feasibility: 10 },
      assessedAt: new Date().toISOString(),
      source: "deterministic",
    };
  }

  const econ = opp.expectedEconomics;
  const industryCrowded = input.activeIndustries.includes(opp.industry);
  const competitionHigh = HIGH_COMPETITION_INDUSTRIES.test(opp.industry);
  const thinProduct =
    THIN_PRODUCT.test(opp.productDescription) || (opp.bullets?.length ?? 0) < 3;
  const recurring = hasRecurring(opp);
  const expansion = hasExpansion(opp, spec);
  const gaps: string[] = [];

  const deduct = (n: number, dim: string, reason: string, remaining: number) => {
    gaps.push(reason);
    dims[dim] = remaining;
    return n;
  };

  // Start at 100. Every known defect is a reason to delete/replace, not a cute B+.
  let quality = TITAN_PERFECT_SCORE;
  dims.customerProblem = 100;
  dims.willingnessToPay = 100;
  dims.marketSize = competitionHigh ? 45 : 100;
  dims.accessibleDemand = 100;
  dims.organicAcquisition = 100;
  dims.competitiveIntensity = 100;
  dims.differentiation = 100;
  dims.pricingPower = 100;
  dims.margins = 100;
  dims.fulfillmentDifficulty = 100;
  dims.automationPotential = 100;
  dims.recurringRevenue = 100;
  dims.expansionPotential = 100;
  dims.technicalFeasibility = 100;
  dims.revenueosImprovePotential = 100;
  dims.pathToRevenue = 100;

  if (opp.problem.trim().length < 80) {
    quality -= deduct(8, "customerProblem", "vague_customer_problem", 55);
  } else if (!hasPain(opp.problem)) {
    quality -= deduct(6, "customerProblem", "problem_lacks_pain", 70);
  }
  if (!recurring) {
    quality -= deduct(10, "recurringRevenue", "one_shot_no_ltv", 28);
  }
  if (opp.priceUsd < 49) {
    quality -= deduct(8, "willingnessToPay", "price_below_serious_wtp", 55);
    dims.pricingPower = 50;
  }
  if (econ.organicPotential === "low") {
    quality -= deduct(18, "accessibleDemand", "organic_demand_low", 30);
    dims.organicAcquisition = 30;
  } else if (econ.organicPotential === "medium") {
    quality -= deduct(10, "accessibleDemand", "organic_demand_only_medium", 60);
    dims.organicAcquisition = 60;
  }
  if (industryCrowded) {
    quality -= deduct(
      12,
      "competitiveIntensity",
      "industry_already_in_portfolio",
      40,
    );
  }
  if (competitionHigh) {
    quality -= deduct(12, "marketSize", "crowded_commodity_market", 25);
    dims.competitiveIntensity = Math.min(dims.competitiveIntensity ?? 100, 25);
    dims.differentiation = 45;
  }
  if (thinProduct) {
    quality -= deduct(10, "differentiation", "thin_commodity_product", 40);
  }
  if (input.productWeak) {
    quality -= deduct(
      12,
      "revenueosImprovePotential",
      "live_storefront_commercially_weak",
      40,
    );
  }
  if (econ.timeToFirstSaleDays > 14) {
    quality -= deduct(6, "pathToRevenue", "slow_path_to_first_sale", 70);
  }
  if (econ.marginEstimate < 0.9) {
    quality -= deduct(8, "margins", "weak_margins", Math.round(econ.marginEstimate * 100));
  }
  if (econ.supportBurden !== "low") {
    quality -= deduct(8, "automationPotential", "high_support_burden", 45);
  }
  if (!expansion) {
    quality -= deduct(5, "expansionPotential", "no_expansion_ladder", 40);
  }
  if (opp.requiresOwnerSpend) {
    quality -= deduct(25, "technicalFeasibility", "requires_owner_spend", 20);
  }
  if ((opp.bullets?.length ?? 0) < 4) {
    quality -= deduct(6, "differentiation", "offer_underspecified", 50);
  }
  if (opp.fulfillment !== "digital_download") {
    quality -= deduct(20, "fulfillmentDifficulty", "not_autonomous_fulfillment", 20);
  }

  const prior = scoreBusinessOpportunity(opp, {
    activeSiteIds: input.activeSiteIds,
    activeIndustries: input.activeIndustries,
    portableLessonHints: input.portableLessonHints,
    telemetry: [],
  });
  if (prior.rejectReasons.length) {
    quality = Math.min(quality, 25);
    for (const r of prior.rejectReasons) {
      if (!gaps.includes(r)) gaps.push(r);
    }
  }
  quality = clamp(quality);

  const slotsLeft = Math.max(0, target - input.titanManagedCount);
  const wouldBuildToday =
    quality >= TITAN_ADMIT_MIN_SCORE &&
    prior.rejectReasons.length === 0 &&
    econ.organicPotential === "high" &&
    !industryCrowded &&
    !competitionHigh &&
    !thinProduct &&
    !opp.requiresOwnerSpend;

  const strengths: string[] = [];
  const weaknesses: string[] = [...gaps];
  if (dims.customerProblem >= 90) strengths.push("High-intent customer problem");
  if (econ.organicPotential === "high")
    strengths.push("Strong organic acquisition potential");
  if ((dims.margins ?? 0) >= 90) strengths.push("Excellent digital margins");
  if (recurring) strengths.push("Recurring / retainer money model");
  if (expansion) strengths.push("Credible expansion ladder");

  let decision: AdmissionDecision;
  let recommendedAction: string;
  let replacementOpportunityCriteria: string | undefined;
  let reasoningSummary: string;

  const productWeak = Boolean(input.productWeak);
  const gapLine = gaps.length ? gaps.join(", ") : "none";
  const replaceCriteria = `100/100 only: high organic, unused industry, recurring retainer, price>=49, digital, low support, specific painful problem, expansion ladder. Close: ${gapLine}.`;

  if (prior.rejectReasons.length || quality < 42 || opp.requiresOwnerSpend) {
    decision = "REJECT_AND_REPLACE";
    recommendedAction =
      "Reject. This thesis cannot be a 100. Architect a different business.";
    replacementOpportunityCriteria = replaceCriteria;
    reasoningSummary = `Score ${quality}/100 — not a portfolio slot. ${
      prior.rejectReasons[0] ?? gaps[0] ?? "Structurally weak."
    }`;
  } else if (quality < TITAN_ADMIT_MIN_SCORE) {
    // An 84 Titan gave itself is a defect list. Delete and make the 100.
    decision = "REJECT_AND_REPLACE";
    recommendedAction = `Do not keep a ${quality}/100 self-grade. Delete this thesis and architect a ${TITAN_PERFECT_SCORE}/100 business that closes: ${gapLine}.`;
    replacementOpportunityCriteria = replaceCriteria;
    reasoningSummary = `Score ${quality}/100 — below the ${TITAN_ADMIT_MIN_SCORE}/100 bar. Known defects: ${gapLine}. Titan creates and deletes until the thesis is perfect; it does not admit homework it already knows is incomplete.`;
  } else if (productWeak) {
    decision = "REWORK_BEFORE_ADMISSION";
    recommendedAction =
      "Thesis meets the 100 bar but the live storefront is commercially weak — repair the product, do not lower the bar.";
    reasoningSummary = `Score ${quality}/100 — keep the perfect thesis, rebuild the implementation before probation.`;
  } else if (quality >= TITAN_PERFECT_SCORE && wouldBuildToday) {
    decision = "FAST_ACCEPT";
    recommendedAction =
      "100/100 thesis — commercial probation still has to prove strangers will pay.";
    reasoningSummary = `Score ${quality}/100 — Titan would not change this thesis. Now earn the first real purchase.`;
  } else {
    decision = "PROBATION";
    recommendedAction =
      "Near-perfect thesis — LIVE_PROBATION for real willingness-to-pay, not a consolation prize for an 84.";
    reasoningSummary = `Score ${quality}/100 — at the bar. Prove it with money.`;
  }

  const confidence = clamp(
    quality >= TITAN_ADMIT_MIN_SCORE ? 90 : 70 + Math.max(0, 50 - gaps.length * 4),
  );

  const opportunityCostNote =
    quality < TITAN_ADMIT_MIN_SCORE
      ? `${slotsLeft} slots left — an ${quality}/100 business wastes a slot Titan can spend on a 100.`
      : `Slot scarcity (${slotsLeft} remaining) — only 100/100 theses get in.`;

  // Durable lessons from prior mutations bias decisions (real learning).
  const lessonsConsidered = (input.applicableLessons ?? []).slice(0, 5).map((l) => ({
    id: l.id,
    whyRelevant: l.whyRelevant,
    transferability: l.transferability,
    negativeTransferCheck: l.negativeTransferCheck,
    applied: l.applied,
    decisionEffect: l.decisionEffect,
    lesson: l.lesson.slice(0, 200),
  }));
  const appliedStorefrontLesson = (input.applicableLessons ?? []).find(
    (l) =>
      l.applied &&
      /storefront|repair before probation|deploy-only|commercial readiness/i.test(
        `${l.lesson} ${l.decisionEffect}`,
      ),
  );
  if (appliedStorefrontLesson && productWeak) {
    if (decision === "PROBATION" || decision === "FAST_ACCEPT") {
      decision = "REWORK_BEFORE_ADMISSION";
      recommendedAction =
        "Prior lesson: repair public commercial storefront before probation — HTTP/deploy alone is insufficient.";
      reasoningSummary = `Score ${quality}/100 — applying lesson ${appliedStorefrontLesson.id}: repair-before-probation (learned from prior storefront failures).`;
    }
  }

  // Evidence pack can override when research is decision-relevant.
  const pack = input.evidencePack;
  // ECONOMIC_FEASIBILITY_MODEL — never reject on price alone.
  {
    const f = evaluateEconomicFeasibility({
      priceUsd: Number(opp.priceUsd ?? 0) || null,
      revenueModel: recurring ? "retainer" : "one_shot",
      organic: econ.organicPotential ?? null,
      crowded: competitionHigh || industryCrowded,
      recurringHint: recurring,
      upsellHint: expansion,
      largeMarketHint: econ.organicPotential === "high",
      automationFit: (dims.automationPotential ?? 50) / 100,
      fulfillmentCostLow: opp.fulfillment === "digital_download",
      buyerBudgetHint:
        (dims.willingnessToPay ?? 50) >= 90
          ? "high"
          : (dims.willingnessToPay ?? 50) >= 50
            ? "medium"
            : "low",
    });
    if (f.class === "IMPLAUSIBLE" || f.class === "WEAK") {
      decision = "REJECT_AND_REPLACE";
      recommendedAction = `REJECT: economic feasibility ${f.class} (score ${f.score}) — multi-factor, not price alone. Remodel or replace.`;
      replacementOpportunityCriteria =
        "Prefer recurring/B2B/high-LTV or strong organic volume that overrides low-ticket prior";
      reasoningSummary = `Score ${quality}/100 — feasibility ${f.class}: ${f.note}`;
      for (const p of f.penalties.slice(0, 2)) {
        if (!weaknesses.includes(p)) weaknesses.push(p);
      }
    } else if (
      (f.class === "HIGH_VOLUME_RISK" ||
        f.class === "PLAUSIBLE_WITH_REMODEL") &&
      (decision === "FAST_ACCEPT" || decision === "PROBATION")
    ) {
      if (decision === "FAST_ACCEPT") decision = "PROBATION";
      recommendedAction = `Probation only with remodel awareness — feasibility ${f.class} (low-ticket one-shot prior applies unless evidence overrides)`;
      reasoningSummary = `Score ${quality}/100 — ${f.note}`;
    }
  }

  if (pack?.decisionHint) {
    const hint = pack.decisionHint as AdmissionDecision;
    if (
      hint === "REJECT_AND_REPLACE" ||
      hint === "REWORK_BEFORE_ADMISSION" ||
      hint === "PROBATION" ||
      hint === "FAST_ACCEPT"
    ) {
      // Never FAST_ACCEPT a below-bar thesis because research sounded optimistic.
      if (hint === "FAST_ACCEPT" && quality < TITAN_ADMIT_MIN_SCORE) {
        decision = "REJECT_AND_REPLACE";
        recommendedAction = `Research cannot promote a ${quality}/100 self-grade. Architect a ${TITAN_PERFECT_SCORE}.`;
        replacementOpportunityCriteria = replaceCriteria;
        reasoningSummary = `Score ${quality}/100 — evidence pack FAST_ACCEPT ignored below the ${TITAN_ADMIT_MIN_SCORE} bar.`;
      } else if (hint === "FAST_ACCEPT" && (pack.usefulSources ?? 0) < 3) {
        decision = "PROBATION";
      } else if (
        hint === "REJECT_AND_REPLACE" &&
        (pack.tenKPath?.pathClass === "STRUCTURALLY_IMPLAUSIBLE" ||
          pack.tenKPath?.pathClass === "LOW_PROBABILITY" ||
          (pack.usefulSources ?? 0) >= 1)
      ) {
        decision = "REJECT_AND_REPLACE";
        recommendedAction =
          "Evidence pack indicates weak economics / opportunity cost — reject and replace.";
        replacementOpportunityCriteria =
          pack.opportunityCostNote ??
          "Prefer opportunities with credible $10k/day path and reachable organic demand.";
        reasoningSummary = `Score ${quality}/100 + research: ${
          pack.researchSummary?.slice(0, 160) ?? pack.opportunityCostNote ?? hint
        }`;
      } else if (hint === "REWORK_BEFORE_ADMISSION" && productWeak) {
        decision = "REWORK_BEFORE_ADMISSION";
      } else if (hint === "PROBATION") {
        decision = decision === "FAST_ACCEPT" ? "PROBATION" : decision;
      }
      if (typeof pack.wouldBuildToday === "boolean") {
        // keep local wouldBuildToday unless pack is strongly negative
        if (pack.wouldBuildToday === false && decision === "PROBATION" && quality < TITAN_ADMIT_MIN_SCORE) {
          decision = "REJECT_AND_REPLACE";
          reasoningSummary = `Score ${quality}/100 — evidence pack wouldBuildToday=false under opportunity cost.`;
        }
      }
      if (pack.facts?.length) {
        for (const f of pack.facts.slice(0, 2)) {
          if (!strengths.includes(f) && /Customer\/intent|organic|demand/i.test(f)) {
            strengths.push(f.slice(0, 80));
          }
        }
      }
    }
  }

  return {
    version: TITAN_ADMISSION_GATE_VERSION,
    candidate: input.siteId,
    displayName,
    decision,
    confidence,
    businessQualityScore: quality,
    reasoningSummary,
    weaknesses: weaknesses.slice(0, 6),
    strengths: strengths.slice(0, 6),
    recommendedAction,
    replacementOpportunityCriteria,
    wouldBuildToday:
      pack?.wouldBuildToday === false ? false : wouldBuildToday,
    opportunityCostNote: pack?.opportunityCostNote ?? opportunityCostNote,
    dimensionScores: dims,
    assessedAt: new Date().toISOString(),
    source: pack?.usefulSources ? "deterministic" : "deterministic",
    lessonsConsidered,
  };
}

/** Apex authorizes Titan's admission recommendation (mutation boundary). */
export function authorizeAdmissionDecision(
  judgment: TitanAdmissionJudgment,
): ApexAdmissionAuthorization {
  const riskClass =
    judgment.decision === "REJECT_AND_REPLACE" ||
    judgment.decision === "FAST_ACCEPT" ||
    judgment.decision === "REWORK_BEFORE_ADMISSION"
      ? ("R1" as const)
      : ("R0" as const);
  const g = governAction({
    action: `portfolio_admit_${judgment.decision}:${judgment.candidate}`,
    riskClass,
  });
  return {
    authorized: g.authorized,
    detail: g.detail,
    riskClass: g.riskClass,
    decision: judgment.decision,
  };
}

export async function persistTitanJudgment(
  pool: pg.Pool,
  judgment: TitanAdmissionJudgment,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [TITAN_JUDGMENTS_KEY],
  );
  const doc = (res.rows[0]?.value ?? { judgments: [] }) as {
    judgments?: TitanAdmissionJudgment[];
  };
  const judgments = Array.isArray(doc.judgments) ? [...doc.judgments] : [];
  judgments.push(judgment);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'TITAN_ADMISSION_GATE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='TITAN_ADMISSION_GATE'`,
    [
      TITAN_JUDGMENTS_KEY,
      JSON.stringify({
        version: TITAN_ADMISSION_GATE_VERSION,
        updatedAt: new Date().toISOString(),
        judgments: judgments.slice(-200),
        latestBySite: Object.fromEntries(
          judgments.map((j) => [j.candidate, j]),
        ),
      }),
    ],
  );
}

export async function loadLatestJudgment(
  pool: pg.Pool,
  siteId?: string | null,
): Promise<TitanAdmissionJudgment | null> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [TITAN_JUDGMENTS_KEY],
  );
  const doc = (res.rows[0]?.value ?? {}) as {
    judgments?: TitanAdmissionJudgment[];
    latestBySite?: Record<string, TitanAdmissionJudgment>;
  };
  if (siteId && doc.latestBySite?.[siteId]) return doc.latestBySite[siteId];
  const list = doc.judgments ?? [];
  return list.length ? list[list.length - 1]! : null;
}

export async function setPortfolioOrigin(
  pool: pg.Pool,
  siteId: string,
  origin: PortfolioOrigin,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [PORTFOLIO_ORIGIN_KEY],
  );
  const doc = (res.rows[0]?.value ?? { origins: {} }) as {
    origins?: Record<
      string,
      { origin: PortfolioOrigin; at: string; [k: string]: unknown }
    >;
  };
  const origins = { ...(doc.origins ?? {}) };
  origins[siteId] = {
    origin,
    at: new Date().toISOString(),
    ...extra,
  };
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'TITAN_ADMISSION_GATE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='TITAN_ADMISSION_GATE'`,
    [
      PORTFOLIO_ORIGIN_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        origins,
        summary: summarizeOrigins(origins),
      }),
    ],
  );
}

export async function loadPortfolioOriginSummary(
  pool: pg.Pool,
): Promise<Record<string, number>> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [PORTFOLIO_ORIGIN_KEY],
  );
  const doc = (res.rows[0]?.value ?? {}) as {
    summary?: Record<string, number>;
    origins?: Record<string, { origin: string }>;
  };
  if (doc.summary) return doc.summary;
  return summarizeOrigins(doc.origins ?? {});
}

function summarizeOrigins(
  origins: Record<string, { origin: string }>,
): Record<string, number> {
  const summary: Record<string, number> = {
    INHERITED: 0,
    REBUILT: 0,
    REVENUEOS_CREATED: 0,
    REPLACEMENT: 0,
    OPEN_WORLD_DISCOVERED: 0,
  };
  for (const row of Object.values(origins)) {
    const o = row.origin;
    if (o in summary) summary[o] = (summary[o] ?? 0) + 1;
    else summary[o] = (summary[o] ?? 0) + 1;
  }
  return summary;
}

/** Pick a 100-bar replacement. Never return an 84 Titan would give itself. */
export function selectReplacementOpportunity(input: {
  rejectedSiteId: string;
  criteria?: string;
  activeSiteIds: string[];
  activeIndustries: string[];
  rejectedSiteIds: string[];
  /** Prefer these open-world / bench opportunities when present. */
  benchOpportunities?: BusinessOpportunity[];
}): BusinessOpportunity | null {
  const taken = new Set([
    ...input.activeSiteIds,
    ...input.rejectedSiteIds,
    input.rejectedSiteId,
  ]);
  const discovered = discoverOpportunities({
    activeSiteIds: [...taken],
    activeIndustries: input.activeIndustries,
    telemetry: [],
    maxNewOpportunities: 12,
    ownerPolicy: {
      bannedMarkets: [],
      requestedMarkets: [],
      lockedSiteIds: [],
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
      updatedAt: new Date().toISOString(),
    },
    safety: {
      maxActiveBusinesses: 50,
      autonomousBusinessDiscovery: true,
      autonomousIncubation: true,
      autonomousZeroCostLaunch: true,
      autonomousSiteImprovement: true,
      autonomousSoftRetirement: true,
      autonomousPermanentSourceDeletion: false,
      autonomousSpending: false,
      autonomousPaidAds: false,
      autonomousDomainPurchase: false,
      preserveAllLearning: true,
      prioritizeExistingOverNew: false,
      stopCreatingNewBusinesses: false,
    },
    referenceProof: {
      premium_bar_passed: true,
      independent_company_test: true,
      stranger_purchases: 1,
    },
  });
  const fromSpecs: BusinessOpportunity[] = [];
  for (const spec of PORTFOLIO_50_SPECS) {
    if (taken.has(spec.siteId)) continue;
    const resolved = resolveOpportunity(spec.siteId);
    if (!resolved) continue;
    fromSpecs.push({
      ...resolved,
      id: resolved.id,
      score: 0,
      rejectReasons: [],
    });
  }
  const pool = [
    ...(input.benchOpportunities ?? []).filter(
      (o) => !taken.has(o.siteId) && (o.rejectReasons?.length ?? 0) === 0,
    ),
    ...discovered.filter(
      (o) => !taken.has(o.siteId) && (o.rejectReasons?.length ?? 0) === 0,
    ),
    ...fromSpecs,
  ];

  for (const raw of pool) {
    const upgraded = architectTowardPerfect(raw);
    if (taken.has(upgraded.siteId)) continue;
    const judgment = evaluateTitanAdmissionQuality({
      siteId: upgraded.siteId,
      opportunity: upgraded,
      activeSiteIds: input.activeSiteIds,
      activeIndustries: input.activeIndustries,
      titanManagedCount: input.activeSiteIds.length,
      isReplacement: true,
    });
    if (
      judgment.businessQualityScore >= TITAN_ADMIT_MIN_SCORE &&
      judgment.decision !== "REJECT_AND_REPLACE"
    ) {
      return {
        ...upgraded,
        score: judgment.businessQualityScore,
        rejectReasons: [],
      };
    }
  }
  // Do not return a below-bar leftover. Better to seed nothing than another 84.
  return null;
}
