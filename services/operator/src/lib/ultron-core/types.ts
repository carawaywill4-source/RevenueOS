/**
 * ULTRON ECONOMIC CORE — shared types.
 */

export const ULTRON_VERSION = "ultron-economic-core-v1";

export const CAPABILITY_PROOF_LEVELS = [
  "C0_DISCOVERED",
  "C1_IMPLEMENTED",
  "C2_TESTED",
  "C3_PRODUCTION_AVAILABLE",
  "C4_EXTERNAL_ACTION_PROVEN",
  "C5_EXTERNAL_EFFECT_PROVEN",
  "C6_COMMERCIAL_EFFECT_PROVEN",
] as const;
export type CapabilityProofLevel = (typeof CAPABILITY_PROOF_LEVELS)[number];

export const ECONOMIC_PROOF_LEVELS = [
  "E0_KNOWLEDGE",
  "E1_PLAN",
  "E2_CAPABILITY",
  "E3_EXECUTION",
  "E4_EXTERNAL_EFFECT",
  "E5_AUDIENCE_EXPOSURE",
  "E6_HUMAN",
  "E7_ENGAGEMENT",
  "E8_INTENT",
  "E9_CUSTOMER",
  "E10_PROFIT",
  "E11_REPEATABLE_PROFIT",
  "E12_SCALABLE_PROFIT",
] as const;
export type EconomicProofLevel = (typeof ECONOMIC_PROOF_LEVELS)[number];

export const REASONING_TIERS = ["DETERMINISTIC", "CHEAP", "STRONG"] as const;
export type ReasoningTier = (typeof REASONING_TIERS)[number];

export type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

export type WorldFact = {
  factId: string;
  entityKind: string;
  entityId: string;
  predicate: string;
  value: Record<string, unknown>;
  source: string;
  observedAt: string;
  lastVerifiedAt: string;
  expiresAt: string | null;
  confidence: number;
  contradictedBy: string | null;
  consumedBy: string[];
};

export type Capability = {
  id: string;
  name: string;
  domain: string;
  description: string;
  proofLevel: CapabilityProofLevel;
  ownerDependency: boolean;
  successRate: number;
  lastVerifiedAt: string | null;
  registryRef: string | null;
};

export type Skill = {
  id: string;
  purpose: string;
  capabilitiesUsed: string[];
  proofLevel: CapabilityProofLevel;
  successCount: number;
  failureCount: number;
  whenToUse: string;
  whenNotToUse: string;
};

export type ExternalEvent = {
  eventId: string;
  kind: string;
  source: string;
  businessId?: string;
  projectId?: string;
  actionId?: string;
  payload: Record<string, unknown>;
  confidence: number;
  evidence: string;
  consumers: string[];
  createdAt: string;
};

export type ClosedLoopDefect = {
  defectId: string;
  kind:
    | "RESEARCH_WITHOUT_CONSUMER"
    | "CAPABILITY_WITHOUT_EXECUTION"
    | "ACCOUNT_WITHOUT_USE"
    | "ASSET_WITHOUT_DISTRIBUTION"
    | "ACTION_WITHOUT_VERIFICATION"
    | "EXTERNAL_EVENT_WITHOUT_INTERPRETATION"
    | "LESSON_WITHOUT_BEHAVIOR_CHANGE"
    | "APEX_DECISION_WITHOUT_EXECUTOR"
    | "CAPABILITY_GAP_WITHOUT_ENGINEERING"
    | "ENGINEERING_WITHOUT_EXTERNAL_PROOF";
  subject: string;
  detail: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "RESOLVED";
};

export type ProofClaim = {
  claimId: string;
  claim: string;
  subject: string;
  proofLevel: CapabilityProofLevel;
  evidence: Array<Record<string, unknown>>;
  lastVerifiedAt: string;
};

export type GapMapClassification =
  | "ALREADY_REAL"
  | "PARTIAL"
  | "FEATURE_THEATER"
  | "MISSING"
  | "DUPLICATED"
  | "DISCONNECTED";

export type GapMapEntry = {
  concept: string;
  organ: 1 | 2 | 3 | 4 | 5;
  existingComponent: string | null;
  status: GapMapClassification;
  missingLink: string | null;
  evidence?: Record<string, unknown>;
};

export type CurriculumMilestone = {
  id: string;
  description: string;
  status: "PENDING" | "ACHIEVED" | "IN_PROGRESS";
  achievedAt: string | null;
};
