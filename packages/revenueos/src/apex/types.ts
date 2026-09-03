/**
 * APEX — Autonomous Prospecting & Exchange Intelligence.
 * Core schemas for Phase A (truth) + thin Phase B/C decision records.
 *
 * Marketing is not the unit of intelligence. Decisions are:
 * CONTEXT → BELIEF → ACTIONS → SELECTED → EXPECTED → OBSERVED → ATTRIBUTION → UPDATE
 */

export type ApexRiskClass = "R0" | "R1" | "R2" | "R3" | "R4";

export type TrafficQuality = "RAW" | "LIKELY_HUMAN" | "QUALIFIED";

export type CommercialEventType =
  | "IMPRESSION"
  | "DISCOVERY"
  | "VISIT"
  | "ENGAGEMENT"
  | "CTA"
  | "LEAD"
  | "CHECKOUT"
  | "PURCHASE"
  | "REFUND"
  | "REPEAT_PURCHASE"
  | "REFERRAL"
  | "DECISION"
  | "CHANNEL_ACTION"
  | "BELIEF_UPDATE";

export type EvidenceType =
  | "OBSERVATION"
  | "EXPERIMENT"
  | "TRANSACTION"
  | "SESSION"
  | "SEARCH_SIGNAL"
  | "PUBLIC_MARKET_SIGNAL"
  | "CUSTOMER_FEEDBACK"
  | "CHANNEL_RESULT"
  | "COMPETITOR_OBSERVATION"
  | "PLATFORM_DATA"
  | "INFERRED_SIGNAL"
  | "SYNTHETIC";

export type BottleneckKind =
  | "NO_EXPOSURE"
  | "NO_IMPRESSIONS"
  | "IMPRESSIONS_NO_CLICKS"
  | "CLICKS_NO_ENGAGEMENT"
  | "ENGAGEMENT_NO_INTENT"
  | "INTENT_NO_CHECKOUT"
  | "CHECKOUT_NO_PURCHASE"
  | "PURCHASE_NO_PROFIT"
  | "PROFIT_NO_SCALE"
  | "UNKNOWN_MEASUREMENT"
  | "UNKNOWN";

export type IntentState =
  | "UNAWARE"
  | "PROBLEM_AWARE"
  | "EXPLORING"
  | "SOLUTION_AWARE"
  | "COMPARING"
  | "HIGH_INTENT"
  | "TRANSACTIONAL"
  | "CUSTOMER"
  | "REPEAT"
  | "ADVOCATE";

/** How much commercial evidence APEX actually has — not a vanity count. */
export type EvidenceLevel =
  | "NO_EVIDENCE"
  | "WEAK_SIGNAL"
  | "EMERGING_SIGNAL"
  | "ACTIONABLE_SIGNAL"
  | "STRONG_EVIDENCE";

/** Two independent learning clocks. */
export type LearningClock = "FAST_ACQUISITION" | "SLOW_PRODUCT_CONVERSION";

export type DiagnosisEvidence = {
  sample_size: number;
  qualified_sample_size: number;
  observation_window: string;
  source_mix: Record<string, number>;
  buyer_intent_quality: number;
  event_completeness: number;
  confidence: number;
  minimum_evidence_required: EvidenceLevel;
  contradictory_evidence: string[];
  decision_reversibility: "high" | "medium" | "low";
  evidence_level: EvidenceLevel;
  strongest_truth_tier: CommercialTruthTier;
  statement: string;
};

export type CommercialTruthTier =
  | "PURCHASE"
  | "CHECKOUT"
  | "HIGH_INTENT"
  | "PRODUCT_ENGAGEMENT"
  | "QUALIFIED_VISIT"
  | "VISIT"
  | "IMPRESSION"
  | "INDEXATION"
  | "PUBLISHED_CONTENT"
  | "THEORY";

export type CommercialEvent = {
  event_id: string;
  business_id: string;
  anonymous_session_id?: string;
  timestamp: string;
  channel?: string;
  source?: string;
  campaign?: string;
  action_id?: string;
  experiment_id?: string;
  creative_id?: string;
  offer_id?: string;
  landing_version?: string;
  product?: string;
  price?: number;
  event_type: CommercialEventType;
  revenue?: number;
  cost?: number;
  confidence: number;
  traffic_quality?: TrafficQuality;
  trace_id?: string;
  attribution_confidence?: number;
  metadata?: Record<string, unknown>;
};

export type EvidenceRecord = {
  evidence_id: string;
  type: EvidenceType;
  source: string;
  timestamp: string;
  freshness_hours: number;
  reliability: number;
  scope: string;
  confidence: number;
  possible_bias?: string;
  possible_confounders?: string[];
  statement: string;
  business_id: string;
  trace_id?: string;
  /** SYNTHETIC evidence can never become strong commercial evidence. */
  synthetic: boolean;
  payload?: Record<string, unknown>;
};

export type Belief = {
  belief_id: string;
  statement: string;
  scope: string;
  confidence: number;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  source_quality: number;
  sample_size: number;
  created_at: string;
  updated_at: string;
  decay_rate: number;
  business_relevance: number;
  transferability: number;
  next_falsification_test: string;
  business_id: string;
};

export type DemandSignal = {
  problem: string;
  persona: string;
  intent: IntentState;
  urgency: number;
  recency: string;
  volume_estimate: number;
  growth_rate: number;
  commerciality: number;
  competition: number;
  accessibility: number;
  evidence_quality: number;
  cluster_id?: string;
};

export type ApexDecision = {
  decision_id: string;
  business_id: string;
  timestamp: string;
  trace_id: string;
  context_summary: string;
  belief_ids: string[];
  bottleneck: BottleneckKind;
  bottleneck_detail: string;
  learning_clock: LearningClock;
  evidence_level: EvidenceLevel;
  diagnosis_evidence: DiagnosisEvidence;
  primary_objective: string;
  alternatives_considered: Array<{
    action: string;
    expected_value: number;
    information_value: number;
    cost: number;
    risk: ApexRiskClass;
    clock: LearningClock;
  }>;
  selected_action: string;
  expected_outcome: string;
  expected_value: number;
  confidence: number;
  risk_class: ApexRiskClass;
  authorized: boolean;
  authorization_detail: string;
  evidence_ids: string[];
  why_this_action: string;
  why_now: string;
  why_this_business: string;
  why_this_channel: string;
  why_this_audience: string;
  counterfactual_note?: string;
  disconfirming_tests?: string[];
  experiment_isolation?: "isolated" | "partial" | "collided" | "unknown";
};

export type ApexBusinessState = {
  version: 1;
  business_id: string;
  updated_at: string;
  beliefs: Belief[];
  recent_decisions: ApexDecision[];
  last_bottleneck?: BottleneckKind;
  last_trace_id?: string;
  commercial_events_count: number;
  qualified_visits: number;
  checkouts: number;
  purchases: number;
  revenue_usd: number;
  learning_notes: string[];
};

export type ApexCycleResult = {
  ok: boolean;
  business_id: string;
  trace_id: string;
  bottleneck: BottleneckKind;
  bottleneck_detail: string;
  demand_signals: DemandSignal[];
  decision: ApexDecision | null;
  beliefs_updated: Belief[];
  data_quality_issues: string[];
  attribution_ml_applied: boolean;
  constitution_blocks: string[];
  evidence_level: EvidenceLevel;
  learning_clock: LearningClock;
  diagnosis_evidence: DiagnosisEvidence;
  first_customer_mode: boolean;
  product_mutation_blocked: boolean;
  acquisition_urgency: "low" | "normal" | "high" | "critical";
  /** FORGE capability contract when available. */
  capability_manifest?: {
    forge_confidence: number;
    primary_objective: string;
    stage: string;
    apex_allowed_to_test: string[];
    known_product_uncertainties: string[];
  };
};
