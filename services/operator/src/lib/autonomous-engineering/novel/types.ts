/**
 * Novel Engineering Mode — PROBLEM+OUTCOME, not PROBLEM+IMPLEMENTATION PLAN.
 * Authorship provenance: AUTONOMOUS_ENGINEERING_NOVEL (not Cursor-authored solution).
 */

export type NovelStage =
  | "PROBLEM"
  | "INVESTIGATION"
  | "REQUIREMENTS"
  | "DESIGN_OPTIONS"
  | "DESIGN_REVIEW"
  | "IMPLEMENTATION_PLAN"
  | "CODE"
  | "TEST"
  | "CANARY"
  | "DEPLOY"
  | "EXTERNAL_PROOF"
  | "COMMERCIAL_MEASUREMENT"
  | "TECHNICALLY_RETAINED_PENDING_COMMERCIAL_PROOF"
  | "COMMERCIALLY_VALIDATED"
  | "COMMERCIALLY_INEFFECTIVE"
  | "INCONCLUSIVE"
  | "ROLLED_BACK"
  | "FAILED"
  | "BLOCKED";

export type ProofLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type DesignOption = {
  id: string;
  title: string;
  summary: string;
  scores: {
    commercialLeverage: number;
    executionProbability: number;
    autonomy: number;
    generality: number;
    complexity: number; // higher = harder
    operationalCost: number;
    securityRisk: number;
    ownerDependency: number;
    testability: number;
    timeToSignal: number;
    rollbackDifficulty: number;
  };
  totalScore: number;
  whyViable: string[];
  whyNot: string[];
  componentsTouched: string[];
};

export type NovelProject = {
  projectId: string;
  problem: string;
  outcome: string;
  stage: NovelStage;
  proofLevel: ProofLevel;
  authorship: "AUTONOMOUS_ENGINEERING_NOVEL";
  investigation?: Record<string, unknown>;
  requirements?: string[];
  designs?: DesignOption[];
  selectedDesignId?: string | null;
  whyWon?: string;
  whyOthersLost?: string[];
  plan?: Record<string, unknown>;
  filesChanged?: string[];
  tests?: { ok: boolean; detail: string };
  deploy?: { ok: boolean; detail: string };
  externalProof?: Record<string, unknown>;
  commercial?: {
    exposure: number;
    humans: number;
    engagement: number;
    intent: number;
    checkout: number;
    customers: number;
    revenue: number;
  };
  technicalRetain?: boolean;
  commercialState?:
    | "PENDING"
    | "VALIDATED"
    | "INEFFECTIVE"
    | "INCONCLUSIVE";
  cursorIntervention?: string[];
  missingCapabilities?: string[];
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
};

export const NOVEL_PROJECT_DISTRIBUTION =
  "AE_NOVEL_DISTRIBUTION_BREAKTHROUGH_001";

export const NOVEL_VERSION = "autonomous-engineering-novel-v2";
export const NOVEL_PROJECT_KEY = "ae_novel_project_state";
export const NOVEL_METRICS_KEY = "ae_novel_engineering_metrics";
