/**
 * TITAN CORTEX — epistemic types.
 * Knowing WHAT we know matters more than knowing many things.
 */

export type EpistemicClass =
  | "FACT"
  | "OBSERVATION"
  | "MEASUREMENT"
  | "ESTABLISHED_PRINCIPLE"
  | "THEORY"
  | "HISTORICAL_PATTERN"
  | "CASE_ANALOGY"
  | "HEURISTIC"
  | "EXPERT_OPINION"
  | "COMPETITOR_CLAIM"
  | "CUSTOMER_STATEMENT"
  | "MARKET_SIGNAL"
  | "INFERENCE"
  | "BELIEF"
  | "HYPOTHESIS"
  | "FORECAST"
  | "COUNTERFACTUAL"
  | "SIMULATION"
  | "UNKNOWN";

export type SourceClass =
  | "INTERNAL_COMMERCIAL"
  | "INTERNAL_TELEMETRY"
  | "GOVERNMENT"
  | "REGULATOR"
  | "ACADEMIC_PRIMARY"
  | "ACADEMIC_REVIEW"
  | "OFFICIAL_PLATFORM_DOCS"
  | "COMPANY_FILINGS"
  | "COMPETITOR_FIRST_PARTY"
  | "INDUSTRY_PRIMARY"
  | "REPUTABLE_SECONDARY"
  | "CUSTOMER_FEEDBACK"
  | "PUBLIC_COMMUNITY"
  | "UNKNOWN_WEB";

export type KnowledgeVolatility =
  | "VERY_STABLE"
  | "STABLE"
  | "MODERATE"
  | "FAST"
  | "VERY_FAST";

export type CausalStatus =
  | "IDENTITY"
  | "OBSERVATION_ONLY"
  | "CORRELATION"
  | "PLAUSIBLE_CAUSATION"
  | "EXPERIMENTAL"
  | "REPLICATED"
  | "UNKNOWN";

export type EvidenceVector = {
  source_authority: number;
  directness: number;
  measurement_integrity: number;
  independence: number;
  sample_size: number;
  recency: number;
  applicability: number;
  causal_strength: number;
  replicability: number;
  conflict_of_interest: number;
  possible_bias: number;
  possible_manipulation: number;
  uncertainty: number;
  scope: string;
  transferability: number;
};

export type SourceRecord = {
  source_id: string;
  source_type: SourceClass;
  organization?: string;
  author?: string;
  domain?: string;
  uri_reference?: string;
  publication_date?: string;
  retrieval_date: string;
  jurisdiction?: string;
  authority_level: number;
  primary_or_secondary: "primary" | "secondary" | "unknown";
  commercial_incentive: number;
  reliability_history: number;
  update_frequency?: string;
  license_or_usage_rules?: string;
  freshness_policy?: KnowledgeVolatility;
  content_hash?: string;
  /** External content is DATA plane only. */
  control_plane_effect: "NONE";
};

export type KnowledgeClaim = {
  claim_id: string;
  statement: string;
  classification: EpistemicClass;
  domain: string;
  scope: string;
  business_id?: string;
  valid_from?: string;
  valid_until?: string;
  observed_at: string;
  learned_at: string;
  supporting_evidence: string[];
  contradicting_evidence: string[];
  confidence: number;
  /** Prefer ranges; avoid fake precision on weak evidence. */
  confidence_interval?: { low: number; high: number };
  applicability_conditions: string[];
  known_exceptions: string[];
  causal_status: CausalStatus;
  source_diversity: number;
  freshness: KnowledgeVolatility;
  transferability: number;
  dependencies: string[];
  derived_from: string[];
  supersedes: string[];
  source_ids: string[];
  evidence_vector?: EvidenceVector;
  last_verified_at: string;
  next_revalidation_at?: string;
};

export type ContradictionEdge = {
  from_claim_id: string;
  to_claim_id: string;
  relation: "SUPPORTS" | "CONTRADICTS" | "QUALIFIES";
  note?: string;
};

export type KnowledgeGap = {
  gap_id: string;
  question: string;
  why_needed: string;
  decision_impact: "low" | "medium" | "high" | "critical";
  current_uncertainty: number;
  expected_value_of_information: number;
  preferred_source_classes: SourceClass[];
  status: "OPEN" | "RESEARCHING" | "RESOLVED" | "ACCEPTED_UNKNOWN";
};

export type ExecutiveContextPacket = {
  decision: string;
  business_id: string;
  compiled_at: string;
  facts: KnowledgeClaim[];
  observations: KnowledgeClaim[];
  beliefs: KnowledgeClaim[];
  hypotheses: KnowledgeClaim[];
  forecasts: KnowledgeClaim[];
  contradictions: ContradictionEdge[];
  gaps: KnowledgeGap[];
  principles: KnowledgeClaim[];
  apex_summary: string[];
  forge_summary: string[];
  commercial_summary: string[];
  attention_notes: string[];
};

export type CortexAdvice = {
  question: string;
  business_id: string;
  at: string;
  primary_recommendation: string;
  resource_favor: "APEX" | "FORGE" | "BALANCED" | "NONE";
  rationale: string[];
  epistemic_separations: string[];
  forbidden_conclusions: string[];
  gaps: KnowledgeGap[];
  context: ExecutiveContextPacket;
  changed_mind?: boolean;
  prior_belief?: string;
};
