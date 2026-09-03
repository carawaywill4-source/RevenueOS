/**
 * Continuous company lifecycle under FORGE management.
 * DISCOVER → INVESTIGATE → CHALLENGE → MODEL → BUILD → CERTIFY →
 * LAUNCH → OPERATE → LEARN → IMPROVE → EXPAND / PIVOT / RETIRE
 */

import type {
  CompanyLifecycleStage,
  DeserveToExistVerdict,
  LifecycleDecision,
  OperationalFitResult,
} from "./enterprise-types";

export const FORGE_LIFECYCLE_ORDER: CompanyLifecycleStage[] = [
  "DISCOVER",
  "INVESTIGATE",
  "CHALLENGE",
  "MODEL",
  "BUILD",
  "CERTIFY",
  "LAUNCH",
  "OPERATE",
  "LEARN",
  "IMPROVE",
  "EXPAND",
  "PIVOT",
  "RETIRE",
];

export function decideLifecycle(input: {
  stage: CompanyLifecycleStage;
  deserve: DeserveToExistVerdict;
  operational_fit: OperationalFitResult;
  evidence_confidence: number;
  /** Substantial qualified exposure + failed economics after iterations */
  exhausted_economics?: boolean;
  corporate_reality_passed?: boolean;
  launched?: boolean;
  /** Creation halted until reference proof (ScopeGuard). */
  stop_new_builds?: boolean;
}): { stage: CompanyLifecycleStage; decision: LifecycleDecision; rationale: string[] } {
  const rationale: string[] = [];

  if (input.exhausted_economics && input.launched) {
    rationale.push("Substantial exposure + repeated experiments with terrible economics");
    return { stage: "RETIRE", decision: "LIQUIDATE", rationale };
  }

  // Capability/legality UNFIT always wins — do not "investigate" forever into impossible ops.
  if (input.operational_fit.fit === "UNFIT") {
    rationale.push(input.operational_fit.statement);
    return { stage: "CHALLENGE", decision: "DO_NOT_BUILD", rationale };
  }

  if (!input.deserve.deserves) {
    rationale.push(input.deserve.answer);
    if (input.evidence_confidence < 0.45) {
      return { stage: "INVESTIGATE", decision: "INVESTIGATE_MORE", rationale };
    }
    return { stage: "CHALLENGE", decision: "DO_NOT_BUILD", rationale };
  }

  if (input.operational_fit.fit === "PARTIAL" && input.evidence_confidence < 0.6) {
    rationale.push("Partial operational fit — model carefully; do not force PDF storefront");
    return { stage: "MODEL", decision: "INVESTIGATE_MORE", rationale };
  }

  if (input.stop_new_builds && !input.launched) {
    rationale.push("Constitution: stop new businesses until reference proof (ScopeGuard)");
    return { stage: "MODEL", decision: "DO_NOT_BUILD", rationale };
  }

  if (!input.launched) {
    if (!input.corporate_reality_passed) {
      rationale.push("Corporate Reality Standard not yet passed — BUILD/CERTIFY");
      return { stage: "BUILD", decision: "BUILD", rationale };
    }
    rationale.push("Deserves existence + fit + corporate reality — CERTIFY then LAUNCH");
    return { stage: "CERTIFY", decision: "CERTIFY", rationale };
  }

  rationale.push("Post-launch: OPERATE → LEARN → IMPROVE; APEX acquires, FORGE evolves product");
  return { stage: "OPERATE", decision: "OPERATE", rationale };
}

/** Kill discipline: never kill from tiny samples. */
export function mayRecommendRetirement(input: {
  qualified_visits: number;
  experiments_run: number;
  pricing_tests: number;
  product_iterations: number;
  contribution_margin: number;
  purchases: number;
}): { allowed: boolean; reason: string } {
  if (input.qualified_visits < 200) {
    return {
      allowed: false,
      reason: "insufficient_qualified_exposure — never liquidate from tiny traffic",
    };
  }
  if (input.experiments_run < 3 || input.product_iterations < 2) {
    return {
      allowed: false,
      reason: "turnaround_incomplete — require experiments + product iterations first",
    };
  }
  if (input.purchases > 0 && input.contribution_margin > 0.3) {
    return {
      allowed: false,
      reason: "positive_unit_economics — prefer IMPROVE/EXPAND over RETIRE",
    };
  }
  return {
    allowed: true,
    reason:
      "Eligible for LIQUIDATE/ARCHIVE/PIVOT recommendation after substantial evidence of poor economics",
  };
}
