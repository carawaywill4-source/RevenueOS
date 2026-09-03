/**
 * Autonomous Engineering Brain — Feature Theater Doctrine applies.
 * CODE WRITTEN ≠ PROVEN. Require: limitation → RCA → patch → tests →
 * deploy without Cursor → production works → target outcome improves.
 */

export type EngRisk = "LOW" | "MEDIUM" | "HIGH";

export type LimitationStatus =
  | "DETECTED"
  | "DIAGNOSING"
  | "DESIGNING"
  | "PATCHING"
  | "TESTING"
  | "CANARY"
  | "DEPLOYING"
  | "OBSERVING"
  | "RETAINED"
  | "ROLLED_BACK"
  | "BLOCKED_OWNER"
  | "DEFERRED";

export type EngineeringLimitation = {
  limitationId: string;
  title: string;
  commercialImpact: number; // 0..1
  evidence: string[];
  rootCauseConfidence: number;
  affectedComponents: string[];
  expectedValueOfFix: number;
  risk: EngRisk;
  complexity: number; // 0..1
  proposedSolutions: Array<{
    id: string;
    summary: string;
    pros: string[];
    cons: string[];
    score: number;
  }>;
  selectedSolutionId: string | null;
  testPlan: string[];
  status: LimitationStatus;
  technicalSuccessCriteria: string;
  commercialSuccessCriteria: string;
  hypothesisConfidence: number;
  implementationConfidence: number;
  testConfidence: number;
  commercialConfidence: number;
  createdAt: string;
  updatedAt: string;
};

export type RootCauseReport = {
  limitationId: string;
  symptom: string;
  expected: string;
  trace: string[];
  rootCause: string;
  systemic: boolean;
  fixOptions: string[];
  bestOption: string;
  whyBest: string;
};

export type ArchitectureComponent = {
  id: string;
  name: string;
  path: string;
  role: string;
  calls: string[];
  stateStores: string[];
  commercialSignals: string[];
};

export type EngineeringWarRoom = {
  version: string;
  activeLimitationId: string | null;
  title: string | null;
  commercialImpact: number | null;
  rootCause: string | null;
  files: string[];
  candidatePatch: string | null;
  testStatus: string;
  deploymentStatus: string;
  productionObservation: string;
  commercialResult: string;
  rollbackState: string;
  cursorDependency: "REQUIRED" | "REDUCED" | "NONE_FOR_ROUTINE";
  updatedAt: string;
};

export type EngineeringReceipt = {
  evolutionId: string;
  limitationId: string;
  startedAt: string;
  completedAt?: string;
  result:
    | "RETAINED"
    | "ROLLED_BACK"
    | "FAILED"
    | "SKIPPED"
    | "BLOCKED"
    | "OBSERVING";
  detail: string;
  filesChanged: string[];
  tests: { ok: boolean; detail: string };
  deploy: { ok: boolean; detail: string };
  commercialEffect: string;
  rollbackAvailable: boolean;
};

export const AE_VERSION = "autonomous-engineering-v3";
export const AE_WAR_ROOM_KEY = "autonomous_engineering_war_room";
export const AE_BACKLOG_KEY = "autonomous_engineering_backlog";
export const AE_ARCH_KEY = "autonomous_engineering_architecture";
export const AE_RECEIPTS_KEY = "autonomous_engineering_receipts";
export const AE_MEMORY_KEY = "autonomous_engineering_memory";
export const AE_CURSOR_COMPARE_KEY = "autonomous_engineering_cursor_compare";
