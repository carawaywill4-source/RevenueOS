/**
 * REVENUEOS NEXUS — shared envelopes and ownership types.
 * Intelligence proposes. Policy authorizes. NEXUS executes. Reality verifies.
 */

export type NexusSubsystem =
  | "TITAN"
  | "CORTEX"
  | "APEX"
  | "FORGE"
  | "NEXUS"
  | "CAPITAL"
  | "HOSTING"
  | "STRIPE"
  | "OWNER"
  | "SYSTEM";

export type MutationDomain =
  | "ACQUISITION"
  | "PRODUCT"
  | "PRICING"
  | "LANDING"
  | "CHECKOUT"
  | "FULFILLMENT"
  | "INFRASTRUCTURE"
  | "BRAND"
  | "CAPITAL"
  | "BUSINESS_LIFECYCLE";

export type AutonomyRank = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";

export type RiskClass = AutonomyRank;

export type PolicyVerdict = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export type ConflictVerdict = "ALLOWED" | "CONFLICT" | "COORDINATE" | "BLOCK";

export type BusinessLifecycleState =
  | "DISCOVERED"
  | "INVESTIGATING"
  | "ADMISSION_REVIEW"
  | "INCUBATING"
  | "BUILDING"
  | "CERTIFYING"
  | "READY"
  | "FIRST_CUSTOMER"
  | "VALIDATING"
  | "REPEATABLE"
  | "PROFITABLE"
  | "GROWTH"
  | "SCALE"
  | "CHAMPION"
  | "TURNAROUND"
  | "HARVEST"
  | "RETIRING"
  | "RETIRED";

export type KillSwitch =
  | "PAUSE_ACQUISITION"
  | "PAUSE_PRODUCT_CHANGES"
  | "PAUSE_DEPLOYMENTS"
  | "PAUSE_BUSINESS_CREATION"
  | "PAUSE_BUSINESS_RETIREMENT"
  | "PAUSE_PAID_SPEND"
  | "PAUSE_EXTERNAL_WRITES"
  | "EMERGENCY_STOP_AUTONOMY";

export type HealthState =
  | "HEALTHY"
  | "DEGRADED"
  | "BLOCKED"
  | "OFFLINE"
  | "RECOVERING";

export type DataQuality = "HIGH" | "MEDIUM" | "LOW" | "UNTRUSTED" | "SYNTHETIC";

export type RevenueEvent = {
  event_id: string;
  event_type: string;
  event_version: string;
  occurred_at: string;
  received_at: string;
  source: string;
  producer: NexusSubsystem;
  business_id: string | null;
  portfolio_id: string | null;
  correlation_id: string | null;
  causation_id: string | null;
  trace_id: string | null;
  actor: string;
  subsystem: NexusSubsystem;
  objective_id: string | null;
  decision_id: string | null;
  action_id: string | null;
  experiment_id: string | null;
  risk_class: RiskClass;
  payload: Record<string, unknown>;
  data_quality: DataQuality;
  attribution_confidence: number;
  schema_version: string;
};

export type RevenueCommand = {
  command_id: string;
  issuer: NexusSubsystem;
  target: NexusSubsystem | "RUNTIME" | "CHANNEL" | "BUSINESS";
  business_id: string | null;
  objective_id: string | null;
  reason: string;
  requested_action: string;
  expected_effect: string;
  risk_class: RiskClass;
  permissions_required: string[];
  idempotency_key: string;
  deadline: string | null;
  preconditions: string[];
  rollback_plan: string;
  verification_plan: string;
  domain: MutationDomain;
  /** Manifest / world version when authorized — stale if world moved. */
  authorized_against_version: string | null;
  payload: Record<string, unknown>;
};

export type ExperimentSurface = {
  experiment_id: string;
  business_id: string;
  variables: string[];
  audience: string;
  channel: string;
  start: string;
  expected_end: string;
  domain: MutationDomain;
  owner: NexusSubsystem;
};

export type WorkClaim = {
  resource_key: string;
  domain: MutationDomain;
  owner: string;
  lease_until: string;
  command_id: string | null;
  business_id: string | null;
};

export type PipelineStage =
  | "PROPOSE"
  | "VALIDATE"
  | "POLICY"
  | "RESERVE"
  | "LOCK"
  | "EXECUTE"
  | "VERIFY"
  | "COMMIT"
  | "EMIT"
  | "LEARN"
  | "RELEASE"
  | "ROLLBACK"
  | "FAILED";

export type PipelineResult = {
  command_id: string;
  idempotency_key: string;
  stage: PipelineStage;
  policy: PolicyVerdict;
  conflict: ConflictVerdict;
  ok: boolean;
  duplicate: boolean;
  stale: boolean;
  events: RevenueEvent[];
  detail: string;
  executed_effect: Record<string, unknown> | null;
};

export type SubsystemHealth = {
  subsystem: NexusSubsystem;
  state: HealthState;
  last_success_at: string | null;
  last_failure_at: string | null;
  current_objective: string | null;
  current_action: string | null;
  errors: number;
  workload: number;
  degraded_capabilities: string[];
};

export type NexusMode = "SHADOW" | "STAGING" | "LIVE";
