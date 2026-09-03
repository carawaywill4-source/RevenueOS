/**
 * Reference-proof gate — no Business #12 until ScopeGuard earns continued proof.
 * Quality > quantity.
 */

import { DEFAULT_FORGE_CONSTITUTION } from "./constitution";

export type ReferenceProofState = {
  reference_business_id: string;
  premium_bar_passed: boolean;
  corporate_reality_independent_company_test: boolean;
  first_attributed_stranger_purchase: boolean;
  stop_new_businesses: boolean;
  reason: string;
};

/**
 * Until stranger purchase + corporate reality hold, FORGE must not authorize new builds.
 * Premium bar alone is necessary but not sufficient for portfolio expansion.
 */
export function evaluateReferenceProof(input: {
  premium_bar_passed: boolean;
  independent_company_test: boolean;
  stranger_purchases: number;
  constitution?: { stopNewBusinessesUntilReferenceProof: boolean };
}): ReferenceProofState {
  const stopFlag =
    input.constitution?.stopNewBusinessesUntilReferenceProof ??
    DEFAULT_FORGE_CONSTITUTION.stopNewBusinessesUntilReferenceProof;

  const first = input.stranger_purchases > 0;
  const ready =
    input.premium_bar_passed &&
    input.independent_company_test &&
    first;

  return {
    reference_business_id: "scopeguard",
    premium_bar_passed: input.premium_bar_passed,
    corporate_reality_independent_company_test: input.independent_company_test,
    first_attributed_stranger_purchase: first,
    stop_new_businesses: stopFlag && !ready,
    reason: ready
      ? "Reference proof satisfied — portfolio creation may resume under TITAN/owner policy"
      : stopFlag
        ? "Stop new businesses: ScopeGuard must pass corporate reality and first attributed stranger purchase before Business #12"
        : "Constitution allows creation but quality gates still apply per opportunity",
  };
}

/** Bridge into PortfolioArchitect safety.stopCreatingNewBusinesses */
export function forgeStopCreatingNewBusinesses(proof: ReferenceProofState): boolean {
  return proof.stop_new_businesses;
}
