/**
 * Attribution truth — do not blindly trust ad-platform ROAS.
 * Reconcile platform → click/session → beacon → checkout → Stripe → refund → contribution.
 */

import type { AttributionReconcile } from "./types";

export function reconcilePaidAttribution(input: {
  platform_reported_conversions: number;
  beacon_sessions: number;
  checkouts: number;
  stripe_purchases: number;
  refunds: number;
  realized_contribution_usd: number;
  identity_linked: boolean;
}): AttributionReconcile {
  const drift =
    input.platform_reported_conversions - input.stripe_purchases;
  let uncertainty: AttributionReconcile["uncertainty"] = "low";
  if (!input.identity_linked) uncertainty = "high";
  else if (Math.abs(drift) >= 2 || input.refunds > 0) uncertainty = "medium";

  const note = !input.identity_linked
    ? "Identity not established — preserve uncertainty; do not treat platform ROAS as truth"
    : drift > 0
      ? "Platform over-reports vs Stripe — use Stripe realized contribution"
      : "Platform and Stripe roughly aligned; still prefer incremental tests when volume permits";

  return {
    platform_reported_conversions: input.platform_reported_conversions,
    beacon_sessions: input.beacon_sessions,
    checkouts: input.checkouts,
    stripe_purchases: input.stripe_purchases,
    refunds: input.refunds,
    realized_contribution_usd: input.realized_contribution_usd,
    identity_linked: input.identity_linked,
    uncertainty,
    note,
  };
}

/** Optimize for incremental contribution profit — not CTR/platform ROAS alone. */
export function scorePaidOutcome(input: {
  spend_usd: number;
  realized_contribution_usd: number;
  attribution: AttributionReconcile;
}): {
  incremental_profit_per_dollar: number;
  reliable: boolean;
  primary_metric: "incremental_contribution_profit";
} {
  const spend = Math.max(input.spend_usd, 0.01);
  const unreliable =
    input.attribution.uncertainty === "high" || !input.attribution.identity_linked;
  return {
    incremental_profit_per_dollar: Number(
      (input.realized_contribution_usd / spend).toFixed(4),
    ),
    reliable: !unreliable,
    primary_metric: "incremental_contribution_profit",
  };
}
