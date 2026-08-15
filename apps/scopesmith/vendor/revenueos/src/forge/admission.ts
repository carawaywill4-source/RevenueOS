/**
 * Autonomous Business Admission — 10-gate portfolio entry standard.
 *
 * Not a vibe check. Each gate requires evidence. ADMIT is rare.
 * $10k/day is architecture math (stretch), never assumed fact.
 */

import { TITAN_NORTH_STAR_DAILY_REVENUE_USD } from "../titan/constitution";
import type {
  CompetitorProfile,
  DeserveToExistVerdict,
  DerivedEconomicShape,
  EconomicOpportunity,
  OperationalFitResult,
} from "./enterprise-types";

export type AdmissionGateId =
  | "DEMAND"
  | "WILLINGNESS_TO_PAY"
  | "ECONOMIC_QUALITY"
  | "AUTONOMY_FIT"
  | "COMPETITIVE_RIGHT_TO_WIN"
  | "DISTRIBUTION_ACCESS"
  | "TEN_K_DAY_ARCHITECTURE"
  | "DEFENSIBILITY"
  | "FAILURE_SURFACE"
  | "PORTFOLIO_OPPORTUNITY_COST";

export type GateVerdict = "PASS" | "WEAK" | "FAIL" | "UNKNOWN";

export type AdmissionGateResult = {
  id: AdmissionGateId;
  question: string;
  verdict: GateVerdict;
  score: number;
  evidence: string[];
  gaps: string[];
  detail: string;
};

export type TenKArchitecture = {
  north_star_daily_revenue_usd: number;
  north_star_is_stretch_not_fact: true;
  assumed_price_or_arpu_usd: number;
  customers_per_day: number;
  implied_monthly_customers: number;
  assumed_conversion_rate: number;
  qualified_exposures_per_day: number;
  retention_note: string;
  capacity_note: string;
  market_share_caution: string;
  what_must_become_true: string[];
  structurally_plausible: boolean;
  plausibility_detail: string;
};

export type AdmissionDecision =
  | "ADMIT_BUILD"
  | "ADMIT_OPERATE"
  | "HOLD_INVESTIGATE"
  | "REJECT";

export type AutonomousBusinessAdmission = {
  opportunity_id: string;
  evaluated_at: string;
  gates: AdmissionGateResult[];
  ten_k_architecture: TenKArchitecture;
  blocking_gates: AdmissionGateId[];
  weak_gates: AdmissionGateId[];
  aggregate_score: number;
  decision: AdmissionDecision;
  rationale: string[];
};

export type PortfolioContext = {
  /** Existing businesses with evidence of traction. */
  existing_winners?: Array<{
    business_id: string;
    daily_revenue_usd: number;
    stranger_purchases: number;
    growing?: boolean;
  }>;
  /** Scarce resource note from TITAN/FORGE. */
  scarce_resource_note?: string;
  /** When true, constitution still blocks new admits. */
  stop_new_businesses?: boolean;
  /** Reference lab already launched. */
  already_launched?: boolean;
};

const GATE_QUESTIONS: Record<AdmissionGateId, string> = {
  DEMAND: "Is there credible evidence people have this problem/desire?",
  WILLINGNESS_TO_PAY: "Is there evidence money moves in this category?",
  ECONOMIC_QUALITY:
    "Are margin, recurring potential, CAC tolerance, fulfillment, support, refunds, and scalability acceptable?",
  AUTONOMY_FIT:
    "Can RevenueOS acquire, sell, accept payment, fulfill, support, measure, improve, and operate without routine owner labor?",
  COMPETITIVE_RIGHT_TO_WIN:
    "Why should this company exist? What can RevenueOS make cheaper/faster/easier/more trustworthy/useful/specialized/convenient/intelligent?",
  DISTRIBUTION_ACCESS: "Can APEX actually reach the buyers?",
  TEN_K_DAY_ARCHITECTURE:
    "What must mathematically become true for $10k/day (stretch — not assumed fact)?",
  DEFENSIBILITY: "If this works, how easily can somebody neutralize it?",
  FAILURE_SURFACE: "What could prevent autonomous operation?",
  PORTFOLIO_OPPORTUNITY_COST:
    "Is THIS a better use of RevenueOS resources than scaling an existing winner?",
};

function extractPriceUsd(opp: EconomicOpportunity, economics: DerivedEconomicShape): number {
  const blob = [...opp.signals.pricing, ...opp.signals.willingness_to_pay, ...opp.signals.existing_spending]
    .join(" ");
  const m = blob.match(/\$\s?(\d+(?:\.\d+)?)/);
  if (m) return Number(m[1]);
  if (economics.recurrence === "recurring") return 99;
  if (economics.recurrence === "usage") return 50;
  return 45;
}

export function buildTenKArchitecture(input: {
  opportunity: EconomicOpportunity;
  economics: DerivedEconomicShape;
  priceUsd?: number;
}): TenKArchitecture {
  const price = Math.max(input.priceUsd ?? extractPriceUsd(input.opportunity, input.economics), 0.01);
  const isRecurring =
    input.economics.recurrence === "recurring" ||
    input.economics.recurrence === "usage" ||
    input.economics.recurrence === "hybrid";

  // For recurring, treat price as ARPU contribution toward daily revenue via active base.
  // Stretch math: daily_revenue ≈ customers_per_day * price for one-time;
  // for recurring, customers_per_day means net new + implied base needed.
  const customersPerDay = Math.ceil(TITAN_NORTH_STAR_DAILY_REVENUE_USD / price);
  const assumedCvr = isRecurring ? 0.03 : 0.02;
  const qualifiedPerDay = Math.ceil(customersPerDay / assumedCvr);

  const marketHints = input.opportunity.signals.market_growth.join(" ").toLowerCase();
  const tinyMarket =
    /niche|tiny|crowded|saturated|small addressable/.test(marketHints) &&
    customersPerDay > 200;

  const structurally_plausible =
    !tinyMarket &&
    input.economics.estimated_contribution_margin >= 0.4 &&
    input.economics.fulfillment_automation_pct >= 70 &&
    customersPerDay <= 2000;

  const what_must_become_true = [
    isRecurring
      ? `~$${price} ARPU path: need economics equivalent to ~${customersPerDay} paying-units/day of revenue contribution (or large retained base × ARPU).`
      : `At ~$${price} AOV: ~${customersPerDay} purchases/day.`,
    `At ~${(assumedCvr * 100).toFixed(1)}% conversion: ~${qualifiedPerDay} qualified exposures/day.`,
    `Retention: ${isRecurring ? "high retention required — churn kills $10k/day architecture" : "repeat/expansion or continuous acquisition required for one-time offers"}.`,
    "Capacity: fulfillment, support, and infra must hold at that volume without owner labor.",
    "Market share: addressable demand must exceed required volume — or model must expand (price, segment, recurring, adjacent).",
    "Never treat $10k/day as a fact or forecast — it is stretch architecture for ambition + skepticism.",
  ];

  return {
    north_star_daily_revenue_usd: TITAN_NORTH_STAR_DAILY_REVENUE_USD,
    north_star_is_stretch_not_fact: true,
    assumed_price_or_arpu_usd: price,
    customers_per_day: customersPerDay,
    implied_monthly_customers: customersPerDay * 30,
    assumed_conversion_rate: assumedCvr,
    qualified_exposures_per_day: qualifiedPerDay,
    retention_note: isRecurring
      ? "Recurring model: retention and expansion dominate long-run $10k/day"
      : "One-time model: continuous qualified acquisition or expansion products required",
    capacity_note: `Automation ${input.economics.fulfillment_automation_pct}%; support=${input.economics.support_intensity}`,
    market_share_caution: tinyMarket
      ? "Market signals suggest structural ceiling risk at $10k/day under current model"
      : "Confront market-size math before declaring architecture impossible or trivial",
    what_must_become_true,
    structurally_plausible,
    plausibility_detail: structurally_plausible
      ? "Architecture is mathematically expressible without immediate absurdity; still stretch, not forecast"
      : "Architecture strains credibility under current price/margin/market signals — expand model or reject honestly",
  };
}

function scoreDemand(opp: EconomicOpportunity): AdmissionGateResult {
  const evidence = [...opp.signals.demand, ...opp.signals.pain, ...opp.signals.search_behavior];
  const gaps: string[] = [];
  if (opp.signals.pain.length === 0) gaps.push("no_pain_evidence");
  if (opp.signals.demand.length === 0 && opp.signals.search_behavior.length === 0) {
    gaps.push("no_demand_or_search_evidence");
  }
  const score = Math.min(1, evidence.length * 0.12 + opp.confidence * 0.4);
  const verdict: GateVerdict =
    gaps.length >= 2 ? "FAIL" : gaps.length === 1 || score < 0.45 ? "WEAK" : score >= 0.6 ? "PASS" : "WEAK";
  return {
    id: "DEMAND",
    question: GATE_QUESTIONS.DEMAND,
    verdict,
    score: Number(score.toFixed(3)),
    evidence: evidence.slice(0, 6),
    gaps,
    detail: verdict === "PASS" ? "Credible problem/desire signals present" : "Demand evidence incomplete",
  };
}

function scoreWtp(opp: EconomicOpportunity): AdmissionGateResult {
  const evidence = [
    ...opp.signals.willingness_to_pay,
    ...opp.signals.existing_spending,
    ...opp.signals.pricing,
  ];
  const gaps: string[] = [];
  if (opp.signals.existing_spending.length === 0 && opp.signals.willingness_to_pay.length === 0) {
    gaps.push("no_money_movement_evidence");
  }
  const score = Math.min(1, evidence.length * 0.15 + (opp.signals.existing_spending.length ? 0.25 : 0));
  const verdict: GateVerdict =
    gaps.length ? (evidence.length ? "WEAK" : "FAIL") : score >= 0.55 ? "PASS" : "WEAK";
  return {
    id: "WILLINGNESS_TO_PAY",
    question: GATE_QUESTIONS.WILLINGNESS_TO_PAY,
    verdict,
    score: Number(score.toFixed(3)),
    evidence: evidence.slice(0, 6),
    gaps,
    detail:
      verdict === "FAIL"
        ? "No evidence money moves in category"
        : "Category spend / pricing signals observed (not validated WTP for THIS offer)",
  };
}

function scoreEconomicQuality(economics: DerivedEconomicShape): AdmissionGateResult {
  const gaps: string[] = [];
  const evidence: string[] = [
    `margin≈${economics.estimated_contribution_margin}`,
    `recurrence=${economics.recurrence}`,
    `fulfillment_automation=${economics.fulfillment_automation_pct}%`,
    `support=${economics.support_intensity}`,
    `regulatory=${economics.regulatory_burden}`,
  ];
  if (economics.estimated_contribution_margin < 0.35) gaps.push("margin_too_low");
  if (economics.support_intensity === "high") gaps.push("support_burden_high");
  if (economics.fulfillment_automation_pct < 70) gaps.push("fulfillment_cost_or_automation_weak");
  if (economics.regulatory_burden === "prohibited") gaps.push("regulatory_prohibited");

  const recurringBonus =
    economics.recurrence === "recurring" || economics.recurrence === "usage" ? 0.15 : 0;
  const score = Math.max(
    0,
    Math.min(
      1,
      economics.estimated_contribution_margin * 0.5 +
        (economics.fulfillment_automation_pct / 100) * 0.25 +
        recurringBonus +
        (economics.support_intensity === "minimal" || economics.support_intensity === "low"
          ? 0.15
          : 0),
    ),
  );
  const verdict: GateVerdict =
    gaps.includes("regulatory_prohibited") || gaps.includes("margin_too_low")
      ? "FAIL"
      : gaps.length
        ? "WEAK"
        : score >= 0.6
          ? "PASS"
          : "WEAK";
  return {
    id: "ECONOMIC_QUALITY",
    question: GATE_QUESTIONS.ECONOMIC_QUALITY,
    verdict,
    score: Number(score.toFixed(3)),
    evidence,
    gaps,
    detail: `CAC tolerance implied by margin=${economics.estimated_contribution_margin}; refund exposure rises with weak trust/product fit`,
  };
}

function scoreAutonomyFit(fit: OperationalFitResult): AdmissionGateResult {
  const limbs = [
    "acquire",
    "sell",
    "accept_payment",
    "fulfill",
    "support",
    "measure",
    "improve",
    "operate",
  ];
  const gaps = [...fit.blockers];
  if (fit.fit === "UNFIT") gaps.push("cannot_operate_end_to_end");
  if (fit.owner_gated.length) gaps.push(...fit.owner_gated.map((g) => `owner_labor:${g}`));
  const score = fit.score;
  const verdict: GateVerdict =
    fit.fit === "UNFIT" ? "FAIL" : fit.fit === "PARTIAL" ? "WEAK" : score >= 0.75 ? "PASS" : "WEAK";
  return {
    id: "AUTONOMY_FIT",
    question: GATE_QUESTIONS.AUTONOMY_FIT,
    verdict,
    score: Number(score.toFixed(3)),
    evidence: [
      fit.statement,
      `limbs_considered=${limbs.join(",")}`,
      `automation=${fit.autonomous_fulfillment_pct}%`,
    ],
    gaps,
    detail:
      verdict === "PASS"
        ? "End-to-end autonomy plausible with current limbs"
        : "Autonomy gaps remain — routine owner labor would be required or limbs missing",
  };
}

function scoreRightToWin(
  deserve: DeserveToExistVerdict,
  competitors: CompetitorProfile[],
): AdmissionGateResult {
  const dimensions = [
    "cheaper",
    "faster",
    "easier",
    "more trustworthy",
    "more useful",
    "more specialized",
    "more convenient",
    "more intelligent",
  ];
  const blob = `${deserve.answer} ${deserve.evidence.join(" ")}`.toLowerCase();
  const hits = dimensions.filter((d) => blob.includes(d.split(" ").pop()!));
  const gaps: string[] = [...deserve.disqualifiers];
  if (!deserve.deserves) gaps.push("no_right_to_win");
  if (deserve.differentiation_quality === "superficial" || deserve.differentiation_quality === "none") {
    gaps.push("differentiation_not_structural");
  }
  const score =
    deserve.deserves
      ? deserve.differentiation_quality === "structural"
        ? 0.85
        : deserve.differentiation_quality === "meaningful"
          ? 0.7
          : 0.35
      : 0.15;
  const verdict: GateVerdict = !deserve.deserves
    ? "FAIL"
    : deserve.differentiation_quality === "structural" ||
        deserve.differentiation_quality === "meaningful"
      ? "PASS"
      : "WEAK";
  return {
    id: "COMPETITIVE_RIGHT_TO_WIN",
    question: GATE_QUESTIONS.COMPETITIVE_RIGHT_TO_WIN,
    verdict,
    score,
    evidence: [
      deserve.answer,
      ...deserve.evidence.slice(0, 4),
      `competitors_modeled=${competitors.length}`,
      `advantage_hints=${hits.join(",") || "specialized/useful via JTBD focus"}`,
    ],
    gaps,
    detail: "Branding-only / AI-copy / lower-price-only are invalid right-to-win answers",
  };
}

function scoreDistribution(opp: EconomicOpportunity): AdmissionGateResult {
  const evidence = [
    ...opp.signals.communities,
    ...opp.signals.distribution_difficulty,
    ...opp.signals.search_behavior,
  ];
  const hard =
    /ads?-heavy|paid only|cold outreach only|enterprise sales|impossible/i.test(
      opp.signals.distribution_difficulty.join(" "),
    );
  const gaps: string[] = [];
  if (evidence.length === 0) gaps.push("no_distribution_path");
  if (hard) gaps.push("distribution_likely_requires_paid_or_owner_sales");
  const organic =
    /organic|community|seo|content|permissionless|apex/i.test(evidence.join(" "));
  const score = Math.min(1, (organic ? 0.45 : 0.15) + evidence.length * 0.1 - (hard ? 0.4 : 0));
  const verdict: GateVerdict = hard || gaps.includes("no_distribution_path")
    ? gaps.includes("no_distribution_path")
      ? "FAIL"
      : "WEAK"
    : score >= 0.55
      ? "PASS"
      : "WEAK";
  return {
    id: "DISTRIBUTION_ACCESS",
    question: GATE_QUESTIONS.DISTRIBUTION_ACCESS,
    verdict,
    score: Number(Math.max(0, score).toFixed(3)),
    evidence: evidence.slice(0, 6),
    gaps,
    detail: "APEX must have a realistic zero-paid-spend path to buyers",
  };
}

function scoreTenK(arch: TenKArchitecture): AdmissionGateResult {
  const gaps: string[] = [];
  if (!arch.structurally_plausible) gaps.push("architecture_strains_credibility");
  // Never FAIL solely because $10k is hard — FAIL only if math is nonsensical under model.
  const verdict: GateVerdict = arch.structurally_plausible ? "PASS" : "WEAK";
  return {
    id: "TEN_K_DAY_ARCHITECTURE",
    question: GATE_QUESTIONS.TEN_K_DAY_ARCHITECTURE,
    verdict,
    score: arch.structurally_plausible ? 0.7 : 0.35,
    evidence: arch.what_must_become_true,
    gaps,
    detail: arch.plausibility_detail,
  };
}

function scoreDefensibility(opp: EconomicOpportunity): AdmissionGateResult {
  const evidence = [...opp.signals.defensibility];
  const weak = /none|easy to copy|no moat|commodity/i.test(evidence.join(" "));
  const gaps: string[] = [];
  if (evidence.length === 0) gaps.push("defensibility_unspecified");
  if (weak) gaps.push("easily_neutralized");
  const score = weak ? 0.25 : evidence.length ? 0.65 : 0.4;
  const verdict: GateVerdict = weak ? "WEAK" : evidence.length ? "PASS" : "UNKNOWN";
  return {
    id: "DEFENSIBILITY",
    question: GATE_QUESTIONS.DEFENSIBILITY,
    verdict,
    score,
    evidence: evidence.length ? evidence : ["defensibility not yet evidenced"],
    gaps,
    detail: "If copyable overnight with no switching costs, treat as weak",
  };
}

function scoreFailureSurface(
  fit: OperationalFitResult,
  economics: DerivedEconomicShape,
  opp: EconomicOpportunity,
): AdmissionGateResult {
  const surfaces = [
    ...fit.blockers,
    ...opp.signals.operational_complexity,
    ...opp.signals.regulatory,
    economics.support_intensity === "high" ? "support_overload" : "",
    economics.regulatory_burden === "high" || economics.regulatory_burden === "prohibited"
      ? `regulatory_${economics.regulatory_burden}`
      : "",
  ].filter(Boolean);
  const critical = surfaces.some((s) =>
    /missing_capability|owner_gated|prohibited|physical|escrow|human_service/i.test(s),
  );
  const verdict: GateVerdict = critical ? "FAIL" : surfaces.length > 3 ? "WEAK" : "PASS";
  return {
    id: "FAILURE_SURFACE",
    question: GATE_QUESTIONS.FAILURE_SURFACE,
    verdict,
    score: critical ? 0.2 : surfaces.length > 3 ? 0.45 : 0.75,
    evidence: surfaces.slice(0, 8),
    gaps: critical ? ["critical_autonomy_failure_surface"] : [],
    detail: critical
      ? "Critical failure surfaces block autonomous operation"
      : "Failure surfaces identified and bounded",
  };
}

function scoreOpportunityCost(
  portfolio: PortfolioContext | undefined,
  aggregateOther: number,
): AdmissionGateResult {
  const winners = portfolio?.existing_winners ?? [];
  const strongWinner = winners.find(
    (w) => w.stranger_purchases >= 5 && w.daily_revenue_usd >= 50 && w.growing,
  );
  const gaps: string[] = [];
  const evidence: string[] = [];
  if (strongWinner) {
    evidence.push(
      `existing_winner=${strongWinner.business_id} daily≈$${strongWinner.daily_revenue_usd} purchases=${strongWinner.stranger_purchases}`,
    );
    gaps.push("scaling_winner_may_dominate_marginal_resource");
  }
  if (portfolio?.scarce_resource_note) evidence.push(portfolio.scarce_resource_note);
  if (portfolio?.stop_new_businesses) {
    gaps.push("constitution_stop_new_businesses");
    evidence.push("Reference proof incomplete — new admits blocked");
  }

  // Without a proven winner, incubating a strong admit can be rational.
  let score = 0.7;
  let verdict: GateVerdict = "PASS";
  if (portfolio?.stop_new_businesses && !portfolio.already_launched) {
    score = 0.2;
    verdict = "FAIL";
  } else if (strongWinner && aggregateOther < 0.75) {
    score = 0.35;
    verdict = "WEAK";
    evidence.push("Marginal resources likely better on winner until this opportunity is clearly superior");
  } else if (!winners.length) {
    evidence.push("No proven portfolio winner yet — opportunity cost of exploration is acceptable if gates pass");
  }

  return {
    id: "PORTFOLIO_OPPORTUNITY_COST",
    question: GATE_QUESTIONS.PORTFOLIO_OPPORTUNITY_COST,
    verdict,
    score,
    evidence,
    gaps,
    detail: "Maximize valuable businesses, not headcount of experiments",
  };
}

/**
 * Run the full Autonomous Business Admission scorecard.
 */
export function evaluateAdmission(input: {
  opportunity: EconomicOpportunity;
  economics: DerivedEconomicShape;
  operational_fit: OperationalFitResult;
  deserve: DeserveToExistVerdict;
  competitors: CompetitorProfile[];
  portfolio?: PortfolioContext;
}): AutonomousBusinessAdmission {
  const ten_k_architecture = buildTenKArchitecture({
    opportunity: input.opportunity,
    economics: input.economics,
  });

  const gates: AdmissionGateResult[] = [
    scoreDemand(input.opportunity),
    scoreWtp(input.opportunity),
    scoreEconomicQuality(input.economics),
    scoreAutonomyFit(input.operational_fit),
    scoreRightToWin(input.deserve, input.competitors),
    scoreDistribution(input.opportunity),
    scoreTenK(ten_k_architecture),
    scoreDefensibility(input.opportunity),
    scoreFailureSurface(input.operational_fit, input.economics, input.opportunity),
  ];

  const prelim =
    gates.reduce((a, g) => a + g.score, 0) / Math.max(gates.length, 1);
  const oppCost = scoreOpportunityCost(input.portfolio, prelim);
  gates.push(oppCost);

  const blocking_gates = gates.filter((g) => g.verdict === "FAIL").map((g) => g.id);
  const weak_gates = gates.filter((g) => g.verdict === "WEAK" || g.verdict === "UNKNOWN").map((g) => g.id);
  const aggregate_score = Number(
    (gates.reduce((a, g) => a + g.score, 0) / gates.length).toFixed(3),
  );

  const rationale: string[] = [];
  let decision: AdmissionDecision = "HOLD_INVESTIGATE";

  if (blocking_gates.length) {
    decision = "REJECT";
    rationale.push(`Blocking gates: ${blocking_gates.join(", ")}`);
  } else if (input.portfolio?.already_launched && blocking_gates.length === 0) {
    decision = "ADMIT_OPERATE";
    rationale.push("Already launched reference/lab business — admit to OPERATE under continuous gates");
  } else if (
    !blocking_gates.length &&
    weak_gates.length <= 2 &&
    aggregate_score >= 0.65 &&
    !input.portfolio?.stop_new_businesses
  ) {
    decision = "ADMIT_BUILD";
    rationale.push("Gates clear enough to build under Corporate Reality + lifecycle CERTIFY");
  } else if (!blocking_gates.length && weak_gates.length > 2) {
    decision = "HOLD_INVESTIGATE";
    rationale.push(`Weak/unknown gates need evidence: ${weak_gates.join(", ")}`);
  } else if (input.portfolio?.stop_new_businesses) {
    decision = "REJECT";
    rationale.push("Portfolio stop: reference proof incomplete — no new admits");
  } else {
    decision = "HOLD_INVESTIGATE";
    rationale.push("Insufficient aggregate conviction for ADMIT");
  }

  rationale.push(
    ...ten_k_architecture.what_must_become_true.slice(0, 2),
    `aggregate_score=${aggregate_score}`,
  );

  return {
    opportunity_id: input.opportunity.opportunity_id,
    evaluated_at: new Date().toISOString(),
    gates,
    ten_k_architecture,
    blocking_gates,
    weak_gates,
    aggregate_score,
    decision,
    rationale,
  };
}

/** Map admission decision onto lifecycle-oriented FORGE action. */
export function admissionToLifecycleHint(
  decision: AdmissionDecision,
): "BUILD" | "OPERATE" | "INVESTIGATE_MORE" | "DO_NOT_BUILD" {
  switch (decision) {
    case "ADMIT_BUILD":
      return "BUILD";
    case "ADMIT_OPERATE":
      return "OPERATE";
    case "HOLD_INVESTIGATE":
      return "INVESTIGATE_MORE";
    case "REJECT":
      return "DO_NOT_BUILD";
  }
}
