import type {
  PortfolioAllocation,
  PortfolioBusinessSnapshot,
} from "../types";

/**
 * Portfolio operator: exploit winners, keep controlled exploration on weak/new.
 * Does not kill businesses — reorders attention.
 */
export function rankPortfolioEffort(
  businesses: PortfolioBusinessSnapshot[],
): PortfolioAllocation {
  const notes: string[] = [];
  const scored = businesses.map((b) => {
    const hasRevenue = b.contributionProfitUsd > 0 || b.purchases > 0;
    const traction = hasRevenue ? 1.6 : 1;
    // Keep exploring zero-customer sites, but not more than winners.
    const exploreFloor = b.firstCustomerMode ? 1.1 : 1;
    const intentSignal =
      b.landingViews > 0 && b.purchases === 0
        ? 1 + Math.min(b.landingViews, 100) / 200
        : 1;
    const starving =
      b.claimableBacklog === 0 && b.contributionProfitUsd < 10 ? 1.2 : 1;
    const score =
      (b.marginalEvProxy * 2 +
        b.learningValue +
        b.profitPerVisitor * 12 +
        (hasRevenue ? Math.min(b.contributionProfitUsd, 80) : 0) +
        (b.landingViews > 20 && b.purchases === 0 ? 4 : 0)) *
      traction *
      exploreFloor *
      intentSignal *
      starving;
    return { siteId: b.siteId, score, hasRevenue, firstCustomerMode: b.firstCustomerMode };
  });
  scored.sort((a, b) => b.score - a.score);

  // Controlled exploration: ensure at least 30% of top-N slots are zero-customer
  // businesses when any exist, so winners don't starve discovery.
  const winners = scored.filter((s) => s.hasRevenue);
  const explorers = scored.filter((s) => s.firstCustomerMode);
  const effortOrder: string[] = [];
  let wi = 0;
  let ei = 0;
  while (effortOrder.length < scored.length) {
    const wantExplore =
      explorers.length > 0 &&
      (effortOrder.length === 0
        ? winners.length === 0
        : effortOrder.filter((id) =>
            explorers.some((e) => e.siteId === id),
          ).length /
            Math.max(effortOrder.length, 1) <
          0.3);
    if (wantExplore && ei < explorers.length) {
      const next = explorers[ei++]!;
      if (!effortOrder.includes(next.siteId)) effortOrder.push(next.siteId);
      continue;
    }
    if (wi < winners.length) {
      const next = winners[wi++]!;
      if (!effortOrder.includes(next.siteId)) effortOrder.push(next.siteId);
      continue;
    }
    if (ei < explorers.length) {
      const next = explorers[ei++]!;
      if (!effortOrder.includes(next.siteId)) effortOrder.push(next.siteId);
      continue;
    }
    for (const s of scored) {
      if (!effortOrder.includes(s.siteId)) effortOrder.push(s.siteId);
    }
    break;
  }

  if (effortOrder[0]) {
    notes.push(
      `Next effort unit → ${effortOrder[0]} (exploit+explore ranking).`,
    );
  }
  if (winners.length && explorers.length) {
    notes.push(
      `Exploit ${winners.length} revenue site(s); explore ${explorers.length} FIRST_CUSTOMER site(s) (≥30% effort share).`,
    );
  } else if (explorers.length) {
    notes.push(
      `${explorers.length} business(es) in FIRST_CUSTOMER_MODE — buyer exposure first.`,
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
  const marginalEvProxy =
    (firstCustomerMode ? 8 : 3) +
    input.claimableBacklog * 0.5 +
    (input.contributionProfitUsd > 0
      ? Math.min(input.contributionProfitUsd, 50)
      : 0) +
    (views > 0 && firstCustomerMode ? Math.min(views / 10, 5) : 0);
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
