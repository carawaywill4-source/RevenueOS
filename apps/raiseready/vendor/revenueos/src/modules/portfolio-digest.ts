/**
 * One portfolio owner email — never N separate business digests.
 */

export type SitePulse = {
  siteId: string;
  displayName: string;
  url: string;
  commerciallyLive: boolean;
  checkoutOpen: boolean;
  purchases: number;
  revenueUsd: number;
  firstCustomerMode: boolean;
  firstCustomerStage?: string;
  actionsCompleted: number;
  exposureNotes: string[];
  blockers: string[];
  error?: string;
};

export type PortfolioDigest = {
  windowStart: string;
  windowEnd: string;
  sites: SitePulse[];
  portfolioRevenueUsd: number;
  portfolioPurchases: number;
  liveCount: number;
  operatingCount: number;
};

export function buildPortfolioDigest(input: {
  windowStart: string;
  windowEnd: string;
  sites: SitePulse[];
}): PortfolioDigest {
  const sites = input.sites;
  return {
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    sites,
    portfolioRevenueUsd: sites.reduce((s, x) => s + (x.revenueUsd || 0), 0),
    portfolioPurchases: sites.reduce((s, x) => s + (x.purchases || 0), 0),
    liveCount: sites.filter((s) => s.commerciallyLive && s.checkoutOpen).length,
    operatingCount: sites.filter((s) => !s.error).length,
  };
}

export function formatPortfolioOwnerEmail(digest: PortfolioDigest): string {
  const lines: string[] = [];
  lines.push("REVENUEOS PORTFOLIO UPDATE");
  lines.push(
    `Window: ${digest.windowStart.slice(0, 16)} → ${digest.windowEnd.slice(0, 16)} UTC`,
  );
  lines.push("");
  lines.push("PORTFOLIO SCOREBOARD");
  lines.push(
    `• Live checkout: ${digest.liveCount}/${digest.sites.length} · Reporting: ${digest.operatingCount}/${digest.sites.length}`,
  );
  lines.push(
    `• Purchases: ${digest.portfolioPurchases} · Revenue: $${digest.portfolioRevenueUsd.toFixed(2)}`,
  );
  lines.push(
    digest.portfolioPurchases === 0
      ? "• Mode: FIRST_CUSTOMER across zeros — buyer exposure is the job"
      : "• Mode: exploit winners + explore the rest",
  );
  lines.push("");
  lines.push("PER BUSINESS (one email, not twelve)");

  const ranked = [...digest.sites].sort((a, b) => {
    if (b.revenueUsd !== a.revenueUsd) return b.revenueUsd - a.revenueUsd;
    if (b.purchases !== a.purchases) return b.purchases - a.purchases;
    return a.displayName.localeCompare(b.displayName);
  });

  for (const s of ranked) {
    const status = s.error
      ? `ERROR: ${s.error}`
      : s.commerciallyLive && s.checkoutOpen
        ? "LIVE"
        : "NOT LIVE";
    lines.push("");
    lines.push(`▸ ${s.displayName} (${s.siteId}) — ${status}`);
    lines.push(`  ${s.url}`);
    lines.push(
      `  $ ${s.revenueUsd.toFixed(2)} · purchases ${s.purchases} · actions ${s.actionsCompleted}` +
        (s.firstCustomerMode
          ? ` · FCM ${s.firstCustomerStage ?? "buyer_exposure"}`
          : ""),
    );
    if (s.exposureNotes.length) {
      lines.push(`  Exposure: ${s.exposureNotes.slice(0, 3).join("; ")}`);
    }
    if (s.blockers.length) {
      lines.push(`  Blockers: ${s.blockers.slice(0, 3).join("; ")}`);
    }
  }

  lines.push("");
  lines.push("WHAT MATTERS NEXT");
  if (digest.portfolioPurchases === 0) {
    lines.push(
      "• First stranger sale with full trace: action → exposure → visit → checkout → pay → fulfill",
    );
    lines.push(
      "• Deepen permissionless buyer exposure; IndexNow alone is not pursuit",
    );
  } else {
    lines.push("• Repeat the winning path; keep exploring zeros");
  }
  lines.push("");
  lines.push(
    "— RevenueOS (single portfolio digest; individual business emails suppressed)",
  );
  return lines.join("\n");
}

export function portfolioDigestSubject(digest: PortfolioDigest): string {
  if (digest.portfolioPurchases > 0) {
    return `RevenueOS: $${digest.portfolioRevenueUsd.toFixed(0)} / ${digest.portfolioPurchases} sale(s) across ${digest.liveCount} live businesses`;
  }
  return `RevenueOS: $0 · ${digest.liveCount} live · pursuing first customer`;
}
