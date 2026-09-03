/**
 * TITAN Paid Capital Engine — types.
 * Live paid execution is OFF until owner enables PAID_CAPITAL_ENABLED
 * and eligibility + deterministic governor authorize spend.
 */

export type CapitalState =
  | "GROSS_REVENUE"
  | "SETTLED"
  | "RESERVED"
  | "OPERATING"
  | "PROTECTED"
  | "AVAILABLE"
  | "AD_AUTHORIZED"
  | "AD_COMMITTED"
  | "AD_SPENT"
  | "RETURNED";

export type PaidPlatform =
  | "meta"
  | "google"
  | "reddit"
  | "x"
  | "linkedin"
  | "other";

export type OwnerPaidCapitalControls = {
  /** Master switch. Default OFF. */
  paid_capital_enabled: boolean;
  /** Portfolio-wide max daily % of eligible capital. Hard max 5%. */
  max_daily_pct: number;
  /** Absolute USD daily cap (owner). */
  absolute_daily_cap_usd: number;
  /** Cash that must never become ad capital. */
  protected_cash_floor_usd: number;
  /** Immediate kill switch. */
  pause_all_paid_acquisition: boolean;
  /** Per-platform enable. */
  platforms_enabled: Partial<Record<PaidPlatform, boolean>>;
  /** Live API execution — separate from authorization. Default false. */
  live_paid_execution_enabled: boolean;
};

export const DEFAULT_OWNER_PAID_CONTROLS: OwnerPaidCapitalControls = {
  paid_capital_enabled: false,
  max_daily_pct: 0.05,
  absolute_daily_cap_usd: 0,
  protected_cash_floor_usd: 0,
  pause_all_paid_acquisition: false,
  platforms_enabled: {},
  live_paid_execution_enabled: false,
};

/** Hard constitutional ceilings — no component may override. */
export const PAID_CAPITAL_LAW = {
  /** Portfolio-wide (NOT per business). */
  max_daily_pct_of_eligible: 0.05,
  /** Ceiling is maximum, never a spending target. */
  ceiling_is_not_a_target: true as const,
  /** Zero spend is always allowed. */
  may_spend_zero: true as const,
  /** LLM cannot authorize money. */
  llm_cannot_authorize: true as const,
  /** Live execution requires explicit owner flag beyond PAID_CAPITAL_ENABLED. */
  live_execution_requires_separate_owner_flag: true as const,
  /** Organic evidence must precede paid scale. */
  organic_priors_required: true as const,
} as const;

export type TreasurySnapshot = {
  as_of: string;
  /** Gross recorded sales (not spendable). */
  gross_revenue_usd: number;
  /** Settled funds after processor confirmation. */
  settled_usd: number;
  refund_reserve_usd: number;
  dispute_reserve_usd: number;
  payment_fees_usd: number;
  tax_reserve_usd: number;
  operating_liabilities_usd: number;
  infrastructure_obligations_usd: number;
  protected_cash_floor_usd: number;
  already_committed_ad_spend_usd: number;
  /** Computed conservatively — never Stripe gross. */
  eligible_capital_usd: number;
  available_usd: number;
  ad_authorized_today_usd: number;
  ad_committed_today_usd: number;
  ad_spent_today_usd: number;
  daily_ceiling_usd: number;
  remaining_ceiling_usd: number;
  reconciliation: {
    provider_settled_usd: number | null;
    internal_settled_usd: number;
    drift_usd: number;
    ok: boolean;
    note: string;
  };
};

export type LedgerEntry = {
  entry_id: string;
  at: string;
  debit_state: CapitalState;
  credit_state: CapitalState;
  amount_usd: number;
  business_id?: string;
  campaign_id?: string;
  platform?: PaidPlatform;
  memo: string;
  evidence_refs: string[];
};

export type ApexPaidProposal = {
  proposal_id: string;
  business_id: string;
  platform: PaidPlatform;
  campaign_key: string;
  hypothesis: string;
  audience: string;
  message: string;
  creative_lineage_id?: string;
  offer: string;
  landing_path: string;
  /** Organic prior keys: persona×problem×intent×message×… */
  organic_prior_keys: string[];
  organic_evidence_summary: string;
  requested_spend_usd: number;
  expected_incremental_contribution_usd: number;
  expected_cac_usd: number;
  expected_cvr: number;
  expected_aov_usd: number;
  expected_refund_rate: number;
  expected_incremental_roas: number;
  confidence: number;
  evidence_ids: string[];
  ladder_stage: ExperimentLadderStage;
};

export type ExperimentLadderStage =
  | "SMALLEST_USEFUL"
  | "CONFIRM"
  | "EXPAND"
  | "SCALE"
  | "DIMINISHING";

export type AuthorizationRequest = {
  business_id: string;
  platform: PaidPlatform;
  campaign_id: string;
  proposal_id: string;
  requested_spend_usd: number;
  expected_value_usd: number;
  confidence: number;
  evidence: string[];
  authorization_ttl_ms?: number;
};

export type AuthorizationDecision = {
  authorized: boolean;
  authorization_id: string | null;
  authorized_spend_usd: number;
  expires_at: string | null;
  reason: string;
  portfolio_exposure_usd: number;
  business_exposure_usd: number;
  daily_ceiling_usd: number;
  remaining_ceiling_usd: number;
  circuit_breakers_triggered: string[];
  /** LLM proposals never become authority. */
  authorized_by: "DETERMINISTIC_GOVERNOR";
};

export type CircuitBreakerEvent = {
  id: string;
  at: string;
  code: string;
  severity: "freeze_business" | "freeze_portfolio" | "reject_request";
  detail: string;
};

export type PaidExperimentMemory = {
  experiment_id: string;
  business_id: string;
  hypothesis: string;
  audience: string;
  creative_lineage_id?: string;
  offer: string;
  spend_usd: number;
  exposure: number;
  acquisitions: number;
  revenue_usd: number;
  refunds_usd: number;
  contribution_usd: number;
  incrementality: "unknown" | "positive" | "neutral" | "negative";
  conclusion: string;
  created_at: string;
};

export type AttributionReconcile = {
  platform_reported_conversions: number;
  beacon_sessions: number;
  checkouts: number;
  stripe_purchases: number;
  refunds: number;
  realized_contribution_usd: number;
  identity_linked: boolean;
  uncertainty: "low" | "medium" | "high";
  note: string;
};

export type CapitalAllocationPlan = {
  as_of: string;
  daily_ceiling_usd: number;
  total_authorized_usd: number;
  allocations: Array<{
    business_id: string;
    proposal_id: string;
    share: number;
    authorized_usd: number;
    marginal_return_estimate: number;
    reason: string;
  }>;
  zero_allocation_businesses: string[];
  rationale: string[];
};
