/**
 * A business with an owner-side blocker (supplier gate, missing tribute draft,
 * legally-required approval) cannot legally take money right now. Consuming
 * autonomous experimentation budget on it while the blocker is present is
 * waste. Suspend the business — do not enqueue new production actions — until
 * the blocker resolves.
 *
 * Suspension is decided from the site's own SiteContext.constraints (already
 * populated by app adapters, e.g. Mendhaus MENDHAUS_SUPPLIER_READY).
 */

import type { BusinessContext } from "../types";

export const OWNER_BLOCKER_CONSTRAINTS = [
  "OWNER_BLOCKED_FULFILLMENT",
  "OWNER_BLOCKED_CHECKOUT",
  "SUPPLIER_NOT_READY",
  "REQUIRES_TRIBUTE_DRAFT",
];

export type SuspensionVerdict = {
  suspended: boolean;
  reasons: string[];
  blockingConstraints: string[];
};

export function evaluateBusinessSuspension(input: {
  context: BusinessContext;
}): SuspensionVerdict {
  const constraints = input.context.constraints ?? [];
  const blocking = constraints.filter((c: string) =>
    OWNER_BLOCKER_CONSTRAINTS.some((known) => c.toUpperCase().includes(known)),
  );
  return {
    suspended: blocking.length > 0,
    reasons: blocking.map(
      (c: string) =>
        `Blocker "${c}" prevents commercial fulfillment — do not spend autonomous budget here.`,
    ),
    blockingConstraints: blocking,
  };
}
