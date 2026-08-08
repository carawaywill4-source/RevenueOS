import {
  rankPortfolioEffort,
  snapshotFromMetrics,
  type PortfolioAllocation,
} from "@revenueos/core";
import { ALL_PORTFOLIO_BRANDS } from "@revenueos/storefront-kit";

/**
 * Owner portfolio view data. Per-business live metrics need each site's ledger;
 * until wired, we surface sequence + commercial context + effort order proxies.
 */
export function buildPortfolioAllocation(input?: {
  metricsBySiteId?: Record<
    string,
    {
      revenueUsd: number;
      contributionProfitUsd: number;
      purchases: number;
      landingViews: number;
      activePursuits: number;
      waitingForEvidence: number;
      claimableBacklog: number;
    }
  >;
}): PortfolioAllocation {
  const metrics = input?.metricsBySiteId ?? {};
  const businesses = ALL_PORTFOLIO_BRANDS.map((brand) => {
    const m = metrics[brand.siteId] ?? {
      revenueUsd: 0,
      contributionProfitUsd: 0,
      purchases: 0,
      landingViews: 0,
      activePursuits: 0,
      waitingForEvidence: 0,
      claimableBacklog: 0,
    };
    return snapshotFromMetrics({
      siteId: brand.siteId,
      displayName: brand.displayName,
      sequenceIndex: brand.sequenceIndex,
      ...m,
    });
  });

  // Include TributeReady + Mendhaus as legacy priors in the portfolio board.
  businesses.push(
    snapshotFromMetrics({
      siteId: "tributeready",
      displayName: "TributeReady",
      sequenceIndex: 0,
      revenueUsd: metrics.tributeready?.revenueUsd ?? 0,
      contributionProfitUsd: metrics.tributeready?.contributionProfitUsd ?? 0,
      purchases: metrics.tributeready?.purchases ?? 0,
      landingViews: metrics.tributeready?.landingViews ?? 0,
      activePursuits: metrics.tributeready?.activePursuits ?? 0,
      waitingForEvidence: metrics.tributeready?.waitingForEvidence ?? 0,
      claimableBacklog: metrics.tributeready?.claimableBacklog ?? 0,
    }),
    snapshotFromMetrics({
      siteId: "mendhaus",
      displayName: "Mendhaus",
      sequenceIndex: 0,
      revenueUsd: metrics.mendhaus?.revenueUsd ?? 0,
      contributionProfitUsd: metrics.mendhaus?.contributionProfitUsd ?? 0,
      purchases: metrics.mendhaus?.purchases ?? 0,
      landingViews: metrics.mendhaus?.landingViews ?? 0,
      activePursuits: metrics.mendhaus?.activePursuits ?? 0,
      waitingForEvidence: metrics.mendhaus?.waitingForEvidence ?? 0,
      claimableBacklog: metrics.mendhaus?.claimableBacklog ?? 0,
    }),
  );

  return rankPortfolioEffort(businesses);
}
