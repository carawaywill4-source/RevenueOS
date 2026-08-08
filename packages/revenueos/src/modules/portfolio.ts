import type {
  PortfolioAllocation,
  PortfolioBusinessSnapshot,
} from "../types";

/**
 * Portfolio operator: where is the next unit of effort most valuable?
 * Does not kill businesses — reorders attention.
 */
export function rankPortfolioEffort(
  businesses: PortfolioBusinessSnapshot[],
): PortfolioAllocation {
  const notes: string[] = [];
  const scored = businesses.map((b) => {
    // Strong economics + improving backlog → keep feeding.
    const traction = b.purchases > 0 ? 1.4 : 1;
    const firstCustomerBoost = b.firstCustomerMode ? 1.25 : 1;
    // Poor economics with empty backlog still needs replenish, not abandon.
    const starving =
      b.claimableBacklog === 0 && b.contributionProfitUsd < 10 ? 1.15 : 1;
    const score =
      (b.marginalEvProxy * 2 +
        b.learningValue +
        b.profitPerVisitor * 10 +
        (b.contributionProfitUsd > 0 ? 5 : 0)) *
      traction *
      firstCustomerBoost *
      starving;
    return { siteId: b.siteId, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const effortOrder = scored.map((s) => s.siteId);
  if (effortOrder[0]) {
    notes.push(
      `Next effort unit → ${effortOrder[0]} (highest marginal EV proxy).`,
    );
  }
  const zeroCustomer = businesses.filter((b) => b.firstCustomerMode);
  if (zeroCustomer.length) {
    notes.push(
      `${zeroCustomer.length} business(es) in FIRST_CUSTOMER_MODE — buyer exposure first.`,
    );
  }
  return {
    generatedAt: new Date().toISOString(),
    businesses,
    effortOrder,
    notes,
  };
}

export function snapshotFromMetrics(input: {
  siteId: string;
  displayName: string;
  sequenceIndex: number;
  revenueUsd: number;
  contributionProfitUsd: number;
  purchases: number;
  landingViews: number;
  activePursuits: number;
  waitingForEvidence: number;
  claimableBacklog: number;
}): PortfolioBusinessSnapshot {
  const views = Math.max(input.landingViews, 0);
  const profitPerVisitor =
    views > 0 ? input.contributionProfitUsd / views : 0;
  const firstCustomerMode = input.purchases <= 0;
  // Proxy: backlog work + learning when no profit yet + profit when alive.
  const marginalEvProxy =
    (firstCustomerMode ? 8 : 3) +
    input.claimableBacklog * 0.5 +
    (input.contributionProfitUsd > 0
      ? Math.min(input.contributionProfitUsd, 50)
      : 0);
  const learningValue = firstCustomerMode
    ? 10
    : Math.min(5 + input.activePursuits, 12);

  return {
    ...input,
    firstCustomerMode,
    profitPerVisitor: Number(profitPerVisitor.toFixed(4)),
    marginalEvProxy: Number(marginalEvProxy.toFixed(2)),
    learningValue,
  };
}
