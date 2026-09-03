/**
 * Autonomous Engineering v3 — capability acquisition + external action.
 */

export const AE_V3_VERSION = "autonomous-engineering-v3";
export const NOVEL_PROJECT_EXTERNAL_ACTION =
  "AE_NOVEL_EXTERNAL_ACTION_002";
export const NOVEL_PROJECT_002_KEY = "ae_novel_external_action_002";
export const CAPABILITY_GAPS_KEY = "ae_capability_gaps";
export const DESIGN_MEMORY_KEY = "ae_design_memory";
export const DEAD_INTEL_KEY = "ae_dead_intelligence_events";
export const SQL_REGRESSION_ID = "AE_SQL_COLON_REGRESSION_001";

export type CapabilityGapStatus =
  | "DISCOVERED"
  | "RESEARCHING"
  | "BUILDABLE"
  | "INTEGRATABLE"
  | "ACCOUNT_REQUIRED_AUTONOMOUS"
  | "OWNER_AUTH_REQUIRED"
  | "PROHIBITED"
  | "IMPLEMENTING"
  | "TESTING"
  | "PROVEN"
  | "FAILED";

export type BlockerType =
  | "STRATEGY_FAILURE"
  | "CAPABILITY_FAILURE"
  | "PLATFORM_RULE"
  | "AUTH_MISSING"
  | "ACCOUNT_MISSING"
  | "INBOX_MISSING"
  | "SYNTHESIS_QUALITY"
  | "RUNTIME_CONSTRAINT"
  | "UNKNOWN";

export type CapabilityGap = {
  id: string;
  objective: string;
  requiredCapability: string;
  whyNeeded: string;
  commercialValue: number;
  existingPartial: string | null;
  missingLink: string;
  externalSystem: string;
  allowedExecutionMethods: string[];
  authRequirements: string[];
  accountRequirements: string[];
  legalPlatformRequirements: string[];
  possibleImplementations: string[];
  reusableValue: number;
  cost: number;
  risk: number;
  ownerRequirement: string | null;
  status: CapabilityGapStatus;
  expectedValue: number;
  evidence: string[];
  updatedAt: string;
};

export type DesignAttemptMemory = {
  designId: string;
  attempts: number;
  lastAttemptAt: string;
  observedBlocker: string;
  blockerType: BlockerType;
  blockerChanged: boolean;
  externalCapabilityAvailable: boolean;
  expectedValue: number;
  reasonForReconsideration: string | null;
  materialEvidenceHash: string;
};

export type ExternalActionProject = {
  projectId: string;
  problem: string;
  outcome: string;
  stage: string;
  proofLevel: number;
  authorship: "AUTONOMOUS_ENGINEERING_NOVEL_V3";
  selectedGapId?: string;
  gaps?: CapabilityGap[];
  whyGapWon?: string;
  whyOthersLost?: string[];
  filesChanged?: string[];
  tests?: { ok: boolean; detail: string };
  deploy?: { ok: boolean; detail: string };
  externalAction?: Record<string, unknown>;
  commercial?: Record<string, number>;
  commercialState?: string;
  oscillationDetected?: boolean;
  cursorIntervention?: string[];
  missingCapabilities?: string[];
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
};
