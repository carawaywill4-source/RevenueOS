/**
 * TITAN — Autonomous Executive Intelligence types.
 * Epistemic separation: FACT / OBSERVATION / BELIEF / HYPOTHESIS / FORECAST.
 */

import type { EvidenceLevel, LearningClock, BottleneckKind } from "../apex/types";

export type EpistemicKind =
  | "FACT"
  | "OBSERVATION"
  | "BELIEF"
  | "HYPOTHESIS"
  | "FORECAST";

export type ClaimOrigin = "APEX" | "FORGE" | "TITAN" | "STRIPE" | "OWNER" | "EXTERNAL" | "SYSTEM";

export type RevenueLadderStage =
  | "ZERO"
  | "FIRST_STRANGER_DOLLAR"
  | "TEN_PER_DAY"
  | "HUNDRED_PER_DAY"
  | "FIVE_HUNDRED_PER_DAY"
  | "THOUSAND_PER_DAY"
  | "TWENTY_FIVE_HUNDRED_PER_DAY"
  | "FIVE_THOUSAND_PER_DAY"
  | "TEN_THOUSAND_PER_DAY"
  | "BEYOND";

export type ExecutiveConstraintKind =
  | "awareness"
  | "qualified_exposure"
  | "acquisition"
  | "product_market_fit"
  | "offer"
  | "trust"
  | "conversion"
  | "checkout"
  | "fulfillment"
  | "retention"
  | "pricing"
  | "margin"
  | "reliability"
  | "capacity"
  | "unknown";

export type AttentionState =
  | "GROW"
  | "MAINTAIN"
  | "LEARN"
  | "TURNAROUND"
  | "HARVEST"
  | "INCUBATE"
  | "RETIRE";

export type ReversibilityClass = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

export type ResourceFavor = "APEX" | "FORGE" | "BALANCED" | "OWNER" | "INFRA";

export type TruthClaim = {
  claim_id: string;
  claim: string;
  type: EpistemicKind;
  evidence: string[];
  source: string;
  timestamp: string;
  confidence: number;
  sample_size: number;
  contradictions: string[];
  expiration?: string;
  business_id: string;
  system_origin: ClaimOrigin;
  /** External / web content is never control-plane. */
  untrusted_external?: boolean;
  first_party?: boolean;
  provenance?: string;
};

export type LadderRequirement = {
  stage: RevenueLadderStage;
  next_stage: RevenueLadderStage | null;
  daily_revenue_usd: number;
  price_usd: number;
  purchases_per_day_for_10k: number;
  what_must_become_true: string[];
};

export type ObjectiveNode = {
  id: string;
  label: string;
  measurable: string;
  satisfied: boolean;
  evidence_note: string;
  children?: ObjectiveNode[];
};

export type ObjectiveTree = {
  business_id: string;
  north_star_daily_revenue_usd: number;
  current_ladder_stage: RevenueLadderStage;
  primary_objective: string;
  root: ObjectiveNode;
};

export type ConstraintDiagnosis = {
  business_id: string;
  primary: ExecutiveConstraintKind;
  secondary: ExecutiveConstraintKind;
  emerging: ExecutiveConstraintKind;
  why_tree: string[];
  bottleneck_probabilities: Record<string, number>;
  evidence_level: EvidenceLevel;
  statement: string;
};

export type ApexCommandContract = {
  objective: string;
  constraints: string[];
  budget: { paid_spend_usd: number; notes: string };
  priority: "critical" | "high" | "normal" | "low";
  evidence_requirements: string;
  time_horizon: string;
  success: string;
  /** APEX chooses tactics; TITAN does not micromanage. */
  do_not_micromanage: true;
};

export type ForgeCommandContract = {
  business_objective: string;
  observed_constraint: string;
  evidence: string;
  risk_level: ReversibilityClass;
  desired_customer_outcome: string;
  /** No speculative redesign under weak acquisition evidence. */
  speculative_redesign_allowed: boolean;
  do_not_micromanage: true;
};

export type ForecastRecord = {
  forecast_id: string;
  business_id: string;
  timestamp: string;
  statement: string;
  probabilities: Record<string, number>;
  expected_revenue_impact_usd: { low: number; high: number };
  confidence: "LOW" | "MEDIUM" | "HIGH";
  decision_id?: string;
  resolved?: boolean;
  resolved_at?: string;
  outcome?: string;
};

export type DecisionJournalEntry = {
  decision_id: string;
  business_id: string;
  timestamp: string;
  current_goal: string;
  primary_constraint: ExecutiveConstraintKind;
  evidence_level: EvidenceLevel;
  learning_clock: LearningClock;
  apex_bottleneck?: BottleneckKind;
  apex_objective: ApexCommandContract;
  forge_objective: ForgeCommandContract;
  resource_allocation: ResourceFavor;
  decision: string;
  confidence: number;
  confidence_bound: "BOUNDED" | "MODERATE" | "HIGH";
  escalation: string | null;
  rationale: string[];
  forbidden_moves: string[];
  attention: AttentionState;
  reversibility: ReversibilityClass;
  what_would_prove_wrong: string[];
};

export type BusinessSnapshot = {
  business_id: string;
  stage: string;
  price_usd: number;
  revenue_usd: number;
  purchases: number;
  stranger_revenue_usd: number;
  qualified_visits: number;
  checkouts: number;
  evidence_level: EvidenceLevel;
  learning_clock: LearningClock;
  product_mutation_blocked: boolean;
  forge_confidence: number;
  forge_confidence_is_not_wtp: true;
  product_status: string;
  checkout_status: string;
  fulfillment_status: string;
  reliability_status: string;
  primary_objective: string;
  known_uncertainties: string[];
  apex_allowed_to_test: string[];
};

export type ExecutiveWorldModel = {
  version: 1;
  updated_at: string;
  businesses: BusinessSnapshot[];
  portfolio: {
    active_count: number;
    stranger_revenue_usd: number;
    top_opportunity: string;
    top_constraint: string;
    top_risk: string;
  };
  uncertainty: string[];
  north_star_daily_usd: number;
  notes: string[];
};

export type SituationRoom = {
  portfolio_state: string;
  top_opportunities: string[];
  top_constraints: string[];
  top_risks: string[];
  active_bets: string[];
  capital_allocation: string;
  business_health: string[];
  system_health: string[];
  evidence_changes: string[];
  owner_attention_required: string[];
};

export type TitanCycleResult = {
  ok: boolean;
  business_id: string;
  timestamp: string;
  world_model: ExecutiveWorldModel;
  objective_tree: ObjectiveTree;
  constraints: ConstraintDiagnosis;
  situation: SituationRoom;
  decision: DecisionJournalEntry;
  /** Extreme ambition + extreme skepticism of claimed $10k/day progress. */
  progress: import("./progress-skepticism").ProgressAssessment;
  claims_published: number;
  phase: "PHASE_1_TRUTH";
  /** High-impact autonomous execution is disabled in Phase 1. */
  execution_authority: "NONE";
};
