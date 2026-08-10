/**
 * FORGE Universal Enterprise Engine — core types.
 *
 * Constraint is not "what kind of business" (no template enum).
 * Constraint: Can RevenueOS legally, ethically, reliably, substantially
 * operate the business end-to-end with capabilities it actually has?
 */

export type EpistemicGrade =
  | "FACT"
  | "OBSERVATION"
  | "BELIEF"
  | "HYPOTHESIS"
  | "FORECAST";

/** Atomic capabilities RevenueOS may or may not possess. */
export type RosCapabilityId =
  | "stripe_checkout"
  | "stripe_subscriptions"
  | "digital_file_delivery"
  | "email_delivery"
  | "content_publishing"
  | "webhook_automation"
  | "scheduled_jobs"
  | "analytics_beacon"
  | "owner_dialog"
  | "saas_account_provisioning"
  | "usage_metering"
  | "api_key_issuance"
  | "human_service_delivery"
  | "physical_fulfillment"
  | "marketplace_escrow"
  | "multi_party_payouts"
  | "regulated_advice"
  | "identity_kyc"
  | "paid_ads"
  | "autonomous_spend";

export type RosLimbStatus = "available" | "partial" | "unavailable" | "owner_gated";

export type RosCapability = {
  id: RosCapabilityId;
  status: RosLimbStatus;
  notes: string;
};

/**
 * Economic shape derived from opportunity economics — not a business-type picker.
 * Free-text mechanisms + recurrence + required capabilities.
 */
export type DerivedEconomicShape = {
  /** Narrative of how money is earned (derived, not selected from a menu). */
  revenue_mechanism: string;
  recurrence: "one_time" | "recurring" | "usage" | "hybrid" | "take_rate" | "unknown";
  /** What the customer receives when value is delivered. */
  customer_receives: string;
  fulfillment_automation_pct: number;
  required_capabilities: RosCapabilityId[];
  estimated_contribution_margin: number;
  support_intensity: "minimal" | "low" | "medium" | "high";
  regulatory_burden: "low" | "medium" | "high" | "prohibited";
  why_this_shape: string[];
};

export type MarketGraphNodeKind =
  | "problem"
  | "buyer"
  | "job"
  | "alternative"
  | "competitor"
  | "demand"
  | "channel"
  | "offer"
  | "business_model"
  | "economics"
  | "operational_requirement"
  | "opportunity";

export type MarketGraphNode = {
  id: string;
  kind: MarketGraphNodeKind;
  label: string;
  evidence: string[];
  confidence: number;
  epistemic: EpistemicGrade;
  business_id?: string;
  meta?: Record<string, unknown>;
};

export type MarketGraphEdge = {
  from: string;
  to: string;
  relation: string;
  weight: number;
};

export type MarketGraph = {
  graph_id: string;
  updated_at: string;
  nodes: MarketGraphNode[];
  edges: MarketGraphEdge[];
};

export type CompetitorProfile = {
  competitor_id: string;
  name: string;
  sells: string;
  buyers: string;
  why_customers_choose: string[];
  why_customers_leave: string[];
  pricing: string;
  positioning: string;
  distribution: string[];
  seo_footprint: string;
  features: string[];
  trust_signals: string[];
  brand_quality: string;
  onboarding: string;
  sales_process: string;
  retention: string[];
  reviews_summary: string;
  complaints: string[];
  missing_capabilities: string[];
  switching_costs: string;
  moat: string;
  weaknesses: string[];
  recent_changes: string[];
  evidence: string[];
  confidence: number;
};

export type DeserveToExistVerdict = {
  deserves: boolean;
  answer: string;
  evidence: string[];
  disqualifiers: string[];
  /** Branding-only / AI-copy / lower-price / superficial feature diffs are invalid. */
  differentiation_quality:
    | "none"
    | "superficial"
    | "meaningful"
    | "structural";
};

export type CategoryDesignInference = {
  category: string;
  buyer_psychology: string;
  trust_means: string[];
  premium_means: string[];
  anti_patterns: string[];
  typography_direction: string;
  visual_hierarchy: string;
  /** Explicitly not a template id. */
  not_a_template: true;
  reference_feeling: string;
};

export type CorporateRealityDimension =
  | "brand_identity"
  | "visual_hierarchy"
  | "typography"
  | "responsive_design"
  | "accessibility"
  | "performance"
  | "copy"
  | "product_depth"
  | "pricing"
  | "policies"
  | "support"
  | "fulfillment"
  | "checkout_billing"
  | "analytics"
  | "security"
  | "seo_structured_data"
  | "monitoring"
  | "error_handling"
  | "backups"
  | "customer_communication"
  | "actual_usefulness"
  | "category_fit";

export type CorporateRealityCheck = {
  dimension: CorporateRealityDimension;
  pass: boolean;
  score: number;
  detail: string;
  evidence: string[];
};

export type CorporateRealityResult = {
  business_id: string;
  passed: boolean;
  category_design: CategoryDesignInference;
  checks: CorporateRealityCheck[];
  /** Would a customer believe this is a professionally funded independent company? */
  independent_company_test: {
    passed: boolean;
    rationale: string;
  };
  blocking: string[];
};

export type CompanyLifecycleStage =
  | "DISCOVER"
  | "INVESTIGATE"
  | "CHALLENGE"
  | "MODEL"
  | "BUILD"
  | "CERTIFY"
  | "LAUNCH"
  | "OPERATE"
  | "LEARN"
  | "IMPROVE"
  | "EXPAND"
  | "PIVOT"
  | "RETIRE";

export type LifecycleDecision =
  | "CONTINUE"
  | "INVESTIGATE_MORE"
  | "BUILD"
  | "DO_NOT_BUILD"
  | "CERTIFY"
  | "LAUNCH"
  | "OPERATE"
  | "IMPROVE"
  | "EXPAND"
  | "PIVOT"
  | "LIQUIDATE"
  | "ARCHIVE";

export type OpportunitySignal = {
  demand: string[];
  pain: string[];
  existing_spending: string[];
  willingness_to_pay: string[];
  market_growth: string[];
  competitors: string[];
  reviews: string[];
  complaints: string[];
  search_behavior: string[];
  communities: string[];
  pricing: string[];
  margins: string[];
  distribution_difficulty: string[];
  operational_complexity: string[];
  regulatory: string[];
  defensibility: string[];
  ros_operational_fit: string[];
};

export type EconomicOpportunity = {
  opportunity_id: string;
  title: string;
  problem: string;
  buyer: string;
  job_to_be_done: string;
  signals: OpportunitySignal;
  evidence_grade: EpistemicGrade;
  confidence: number;
  /** Optional lab/reference tag — not a business-type enum. */
  reference_label?: string;
};

export type OperationalFitResult = {
  fit: "FIT" | "PARTIAL" | "UNFIT";
  score: number;
  required: RosCapabilityId[];
  missing: RosCapabilityId[];
  owner_gated: RosCapabilityId[];
  autonomous_fulfillment_pct: number;
  legal_ethical_ok: boolean;
  statement: string;
  blockers: string[];
};

export type ForgeEvidenceContract = {
  /** Weak APEX traffic must not cause destructive product mutation. */
  weak_apex_blocks_product_mutation: true;
  /** FORGE confidence never overrides strong market evidence. */
  forge_confidence_never_overrides_market: true;
  apex_owns: "acquisition_execution_and_learning";
  forge_owns: "company_product_operations_evolution";
  titan_owns: "resource_arbitration_strategy_portfolio";
};

export type InstitutionalLesson = {
  lesson_id: string;
  kind: "success" | "failure" | "observation" | "competitor" | "objection" | "economic";
  statement: string;
  context: string;
  transferable: boolean;
  confidence: number;
  source_business_id?: string;
  created_at: string;
  evidence: string[];
};

export type OpportunityEvaluation = {
  opportunity: EconomicOpportunity;
  market_graph: MarketGraph;
  competitors: CompetitorProfile[];
  deserve: DeserveToExistVerdict;
  derived_economics: DerivedEconomicShape;
  operational_fit: OperationalFitResult;
  category_design: CategoryDesignInference;
  lifecycle_stage: CompanyLifecycleStage;
  decision: LifecycleDecision;
  rationale: string[];
  lessons_to_preserve: InstitutionalLesson[];
  /** 10-gate Autonomous Business Admission scorecard. */
  admission?: import("./admission").AutonomousBusinessAdmission;
};
