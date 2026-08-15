/**
 * Explicit cross-subsystem conflict rules.
 * NEXUS coordinates — it does not invent strategy.
 */

import type { ConflictVerdict, ExperimentSurface, MutationDomain } from "./types";

export type ConflictQuery = {
  proposed_domain: MutationDomain;
  proposed_variables?: string[];
  active_domains: MutationDomain[];
  active_surfaces?: ExperimentSurface[];
  business_retiring?: boolean;
  capital_reservation?: boolean;
};

const HARD_BLOCKS: Array<[MutationDomain, MutationDomain]> = [
  ["LANDING", "LANDING"],
  ["PRICING", "PRICING"],
  ["CHECKOUT", "CHECKOUT"],
  ["BUSINESS_LIFECYCLE", "ACQUISITION"],
  ["BUSINESS_LIFECYCLE", "PRODUCT"],
  ["BUSINESS_LIFECYCLE", "PRICING"],
  ["BUSINESS_LIFECYCLE", "LANDING"],
  ["BUSINESS_LIFECYCLE", "CHECKOUT"],
];

const COORDINATE_PAIRS: Array<[MutationDomain, MutationDomain]> = [
  ["PRICING", "ACQUISITION"],
  ["LANDING", "ACQUISITION"],
  ["LANDING", "PRODUCT"],
  ["PRODUCT", "ACQUISITION"],
];

function pairMatch(
  a: MutationDomain,
  b: MutationDomain,
  table: Array<[MutationDomain, MutationDomain]>,
): boolean {
  return table.some(
    ([x, y]) => (x === a && y === b) || (x === b && y === a) || (x === a && y === a && a === b),
  );
}

export function evaluateConflict(q: ConflictQuery): {
  verdict: ConflictVerdict;
  reason: string;
} {
  if (q.business_retiring) {
    return {
      verdict: "BLOCK",
      reason: "business_retirement_blocks_commercial_mutations",
    };
  }
  if (q.capital_reservation && q.active_domains.includes("CAPITAL")) {
    return {
      verdict: "BLOCK",
      reason: "capital_reservations_serialize",
    };
  }

  for (const active of q.active_domains) {
    if (
      pairMatch(q.proposed_domain, active, HARD_BLOCKS) &&
      q.proposed_domain === active
    ) {
      return {
        verdict: "CONFLICT",
        reason: `same_domain_conflict:${active}`,
      };
    }
    if (
      q.proposed_domain === "BUSINESS_LIFECYCLE" ||
      active === "BUSINESS_LIFECYCLE"
    ) {
      if (q.proposed_domain !== active) {
        return {
          verdict: "BLOCK",
          reason: "lifecycle_blocks_other_domains",
        };
      }
    }
  }

  const proposedVars = new Set(q.proposed_variables ?? []);
  for (const surface of q.active_surfaces ?? []) {
    const overlap = surface.variables.filter((v) => proposedVars.has(v));
    if (overlap.length > 0) {
      return {
        verdict: "CONFLICT",
        reason: `experiment_variable_overlap:${overlap.join(",")}`,
      };
    }
    if (
      pairMatch(q.proposed_domain, surface.domain, COORDINATE_PAIRS) ||
      pairMatch(q.proposed_domain, surface.domain, HARD_BLOCKS)
    ) {
      if (
        q.proposed_domain === "LANDING" &&
        surface.domain === "LANDING"
      ) {
        return {
          verdict: "CONFLICT",
          reason: "apex_landing_vs_forge_landing",
        };
      }
      if (
        (q.proposed_domain === "PRICING" && surface.domain === "ACQUISITION") ||
        (q.proposed_domain === "ACQUISITION" && surface.domain === "PRICING")
      ) {
        return {
          verdict: "COORDINATE",
          reason: "price_message_vs_price_change",
        };
      }
      if (
        (q.proposed_domain === "LANDING" && surface.domain === "PRODUCT") ||
        (q.proposed_domain === "PRODUCT" && surface.domain === "LANDING")
      ) {
        return {
          verdict: "CONFLICT",
          reason: "landing_experiment_vs_homepage_redesign",
        };
      }
    }
  }

  for (const active of q.active_domains) {
    if (pairMatch(q.proposed_domain, active, COORDINATE_PAIRS)) {
      return {
        verdict: "COORDINATE",
        reason: `coordinate:${q.proposed_domain}+${active}`,
      };
    }
  }

  // APEX message test + FORGE DB repair = allowed (different domains).
  return { verdict: "ALLOWED", reason: "no_conflict" };
}
