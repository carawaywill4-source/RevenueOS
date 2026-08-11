/**
 * Durable commercial / infrastructure failure taxonomy for autonomous repair.
 */

export type RepairFailureCategory =
  | "WRONG_SITE_IDENTITY"
  | "WRONG_DEPLOYMENT"
  | "WRONG_VERCEL_PROJECT"
  | "WRONG_ALIAS"
  | "MISSING_ALIAS"
  | "DEPLOYMENT_FAILED"
  | "BUILD_FAILED"
  | "NO_CTA"
  | "CTA_BROKEN"
  | "NO_CHECKOUT_PATH"
  | "CHECKOUT_ROUTE_404"
  | "CHECKOUT_CREATION_FAILED"
  | "STRIPE_CONFIG_MISSING"
  | "STRIPE_CONFIG_INVALID"
  | "BROKEN_ANALYTICS"
  | "ANALYTICS_NOT_RECORDING"
  | "NON_INDEXABLE"
  | "ROBOTS_BLOCKING"
  | "SITEMAP_MISSING"
  | "SEO_METADATA_BROKEN"
  | "RUNTIME_ERROR"
  | "API_ERROR"
  | "MISSING_ENV"
  | "INVALID_ENV"
  | "DATABASE_ERROR"
  | "QUEUE_ERROR"
  | "EXECUTOR_ERROR"
  | "JOB_NOT_ENQUEUED"
  | "EXECUTION_AUTHORITY_MISMATCH"
  | "STALE_DEPLOYMENT"
  | "STALE_CONFIGURATION"
  | "UNKNOWN_FAILURE";

export type RepairSeverity = "critical" | "high" | "medium" | "low";

export type StructuredFailure = {
  failureId: string;
  businessId: string;
  category: RepairFailureCategory;
  severity: RepairSeverity;
  detectedAt: string;
  source: string;
  expected: string;
  observed: string;
  url?: string;
  httpStatus?: number | null;
  evidence: Record<string, unknown>;
  relatedDeployment?: string | null;
  repairableAutomatically: boolean;
  repairStrategy: string;
  status:
    | "DETECTED"
    | "DIAGNOSING"
    | "PLANNED"
    | "QUEUED"
    | "REPAIRING"
    | "DEPLOYING"
    | "VERIFYING"
    | "REPAIRED"
    | "FAILED"
    | "RETRY_WAIT"
    | "BLOCKED"
    | "HUMAN_REQUIRED";
};

export type RepairPlan = {
  repairPlanId: string;
  businessId: string;
  failureIds: string[];
  repairType: string;
  steps: string[];
  risk: "low" | "medium" | "high";
  expectedOutcome: string;
  rollbackPlan: string;
  requiresSpend: boolean;
  requiresHuman: boolean;
  createdAt: string;
};

export type RepairLesson = {
  lessonId: string;
  category: RepairFailureCategory;
  architecture: string;
  rootCause: string;
  repairType: string;
  success: boolean;
  recordedAt: string;
  detail: string;
  recurrenceHint?: string;
};

export const REPAIR_LEARNING_KEY = "repair_operational_lessons";
export const REPAIR_FAILURES_KEY = "repair_structured_failures";
export const REPAIR_ATTEMPTS_KEY = "repair_attempt_receipts";

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Map commercial-readiness codes → structured taxonomy. */
export function mapCommercialCode(
  code: string,
): { category: RepairFailureCategory; strategy: string; severity: RepairSeverity } {
  switch (code) {
    case "NO_PUBLIC_STOREFRONT":
      return {
        category: "WRONG_DEPLOYMENT",
        strategy: "RESTORE_PUBLIC_STOREFRONT",
        severity: "critical",
      };
    case "NO_CTA":
      return { category: "NO_CTA", strategy: "ADD_CTA_OR_RESTORE", severity: "high" };
    case "BROKEN_CTA":
      return { category: "CTA_BROKEN", strategy: "FIX_CTA_DESTINATION", severity: "high" };
    case "NO_CHECKOUT_PATH":
      return {
        category: "NO_CHECKOUT_PATH",
        strategy: "ADD_CHECKOUT_PATH_OR_RESTORE",
        severity: "critical",
      };
    case "BROKEN_CHECKOUT":
      return {
        category: "CHECKOUT_ROUTE_404",
        strategy: "FIX_CHECKOUT_PATH",
        severity: "critical",
      };
    case "BROKEN_ANALYTICS":
      return {
        category: "BROKEN_ANALYTICS",
        strategy: "FIX_ANALYTICS_MARKERS",
        severity: "medium",
      };
    case "NON_INDEXABLE":
      return { category: "NON_INDEXABLE", strategy: "FIX_ROBOTS", severity: "medium" };
    case "WRONG_CANONICAL_URL":
    case "STALE_DEPLOYMENT":
      return {
        category: "WRONG_ALIAS",
        strategy: "FIX_CANONICAL_OR_RESTORE",
        severity: "critical",
      };
    case "NO_COMMERCIAL_OFFER":
    case "NO_PRICE_OR_PURCHASE_INSTRUCTIONS":
      return {
        category: "WRONG_SITE_IDENTITY",
        strategy: "RESTORE_PUBLIC_STOREFRONT",
        severity: "critical",
      };
    default:
      return {
        category: "UNKNOWN_FAILURE",
        strategy: "DIAGNOSE_THEN_RESTORE",
        severity: "medium",
      };
  }
}
