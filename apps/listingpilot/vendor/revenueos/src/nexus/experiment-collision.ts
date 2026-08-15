/**
 * Experiment collision detector — overlapping variables destroy causal learning.
 */

import { evaluateConflict } from "./conflict-matrix";
import type { ExperimentSurface, MutationDomain } from "./types";

export type CollisionDecision =
  | { action: "BEGIN"; reason: string }
  | { action: "MERGE"; reason: string; with: string }
  | { action: "QUEUE"; reason: string };

export function detectExperimentCollision(input: {
  proposed: ExperimentSurface;
  active: ExperimentSurface[];
}): CollisionDecision {
  const sameBiz = input.active.filter(
    (s) => s.business_id === input.proposed.business_id,
  );
  const conflict = evaluateConflict({
    proposed_domain: input.proposed.domain,
    proposed_variables: input.proposed.variables,
    active_domains: sameBiz.map((s) => s.domain),
    active_surfaces: sameBiz,
  });

  if (conflict.verdict === "ALLOWED") {
    return { action: "BEGIN", reason: conflict.reason };
  }
  if (conflict.verdict === "COORDINATE") {
    const peer = sameBiz[0];
    return {
      action: "MERGE",
      reason: conflict.reason,
      with: peer?.experiment_id ?? "unknown",
    };
  }
  return { action: "QUEUE", reason: conflict.reason };
}

export function surfacesFromDomains(
  businessId: string,
  domains: MutationDomain[],
): ExperimentSurface[] {
  const now = new Date().toISOString();
  return domains.map((domain, i) => ({
    experiment_id: `surface-${domain}-${i}`,
    business_id: businessId,
    variables: [domain.toLowerCase()],
    audience: "default",
    channel: "any",
    start: now,
    expected_end: now,
    domain,
    owner: domain === "ACQUISITION" ? "APEX" : "FORGE",
  }));
}
