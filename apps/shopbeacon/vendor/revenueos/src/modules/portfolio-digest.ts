/**
 * One portfolio owner email — never N separate business digests.
 * Email is a receipt of work already performed, not the work itself.
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
  /** native | document | ephemeral — ephemeral means actions cannot be trusted */
  durableLedger?: "native" | "document" | "ephemeral" | boolean;
  cycleStatus?: "ok" | "failed" | "stagnant";
  thisHour?: {
    actionsExecuted: number;
    actionTypes?: string[];
    checkouts?: number;
    landingViews?: number;
    /** Real first-party beacon signal for the reporting window. */
    pageViews?: number;
    ctaClicks?: number;
    checkoutStarts?: number;
    checkoutCompletes?: number;
    learned?: string[];
    killed?: string[];
    next?: string[];
    changed?: string[];
  };
};

export type PortfolioDigest = {
  windowStart: string;
  windowEnd: string;
  sites: SitePulse[];
  portfolioRevenueUsd: number;
  portfolioPurchases: number;
  liveCount: number;
  operatingCount: number;
  cycleStatus: "ok" | "failed" | "stagnant";
  totalActionsCompleted: number;
  /** Aggregate first-party visitor signal across the portfolio this hour. */
  portfolioPageViews: number;
  portfolioCtaClicks: number;
  portfolioCheckoutStarts: number;
  portfolioCheckoutCompletes: number;
};

function ledgerMode(s: SitePulse): "native" | "document" | "ephemeral" {
  if (s.durableLedger === true || s.durableLedger === "native") return "native";
  if (s.durableLedger === "document") return "document";
  if (s.durableLedger === false || s.durableLedger === "ephemeral") {
    return "ephemeral";
  }
  return "document";
}

function siteCycleStatus(s: SitePulse): "ok" | "failed" | "stagnant" {
  if (s.cycleStatus) return s.cycleStatus;
  if (s.error) return "failed";
  if (ledgerMode(s) === "ephemeral") return "failed";
  if (s.firstCustomerMode && s.actionsCompleted <= 0) return "failed";
  return "ok";
}

export function buildPortfolioDigest(input: {
  windowStart: string;
  windowEnd: string;
  sites: SitePulse[];
}): PortfolioDigest {
  const sites = input.sites;
  const totalActionsCompleted = sites.reduce(
    (n, s) => n + (s.actionsCompleted || 0),
    0,
  );
  const statuses = sites.map(siteCycleStatus);
  const cycleStatus: PortfolioDigest["cycleStatus"] = statuses.every(
    (x) => x === "ok",
  )
    ? "ok"
    : statuses.some((x) => x === "stagnant")
      ? "stagnant"
      : statuses.some((x) => x === "failed")
        ? "failed"
        : "ok";

  const sumHour = (k: keyof NonNullable<SitePulse["thisHour"]>) =>
    sites.reduce((n, s) => n + Number((s.thisHour?.[k] as number) || 0), 0);

  return {
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    sites,
    portfolioRevenueUsd: sites.reduce((s, x) => s + (x.revenueUsd || 0), 0),
    portfolioPurchases: sites.reduce((s, x) => s + (x.purchases || 0), 0),
    liveCount: sites.filter((s) => s.commerciallyLive && s.checkoutOpen).length,
    operatingCount: sites.filter((s) => !s.error).length,
    cycleStatus,
    totalActionsCompleted,
    portfolioPageViews: sumHour("pageViews"),
    portfolioCtaClicks: sumHour("ctaClicks"),
    portfolioCheckoutStarts: sumHour("checkoutStarts"),
    portfolioCheckoutCompletes: sumHour("checkoutCompletes"),
  };
}

export function formatPortfolioOwnerEmail(digest: PortfolioDigest): string {
  const lines: string[] = [];
  const failed =
    digest.cycleStatus === "failed" || digest.cycleStatus === "stagnant";

  lines.push(
    failed
      ? `REVENUEOS PORTFOLIO UPDATE — CYCLE ${digest.cycleStatus.toUpperCase()}`
      : "REVENUEOS PORTFOLIO UPDATE",
  );
  lines.push(
    `Window: ${digest.windowStart.slice(0, 16)} → ${digest.windowEnd.slice(0, 16)} UTC`,
  );
  lines.push("");
  lines.push("THIS HOUR");
  lines.push(
    `• Commercial actions executed: ${digest.totalActionsCompleted}`,
  );
  lines.push(
    `• Purchases: ${digest.portfolioPurchases} · Revenue: $${digest.portfolioRevenueUsd.toFixed(2)}`,
  );
  lines.push(
    `• Live checkout: ${digest.liveCount}/${digest.sites.length} · Reporting: ${digest.operatingCount}/${digest.sites.length}`,
  );
  const totalVisitors =
    digest.portfolioPageViews +
    digest.portfolioCtaClicks +
    digest.portfolioCheckoutStarts +
    digest.portfolioCheckoutCompletes;
  if (totalVisitors > 0) {
    lines.push(
      `• Visitors: ${digest.portfolioPageViews} page views · ${digest.portfolioCtaClicks} CTA clicks · ${digest.portfolioCheckoutStarts} checkout starts · ${digest.portfolioCheckoutCompletes} completes`,
    );
  } else {
    lines.push(
      "• Visitors: 0 — no first-party beacon signal this hour (owned pages are empty of humans)",
    );
  }
  if (failed) {
    lines.push(
      `• Status: ${digest.cycleStatus.toUpperCase()} — generating this email is not commercial success`,
    );
  }
  lines.push("");
  lines.push("DELTAS BY BUSINESS");

  const ranked = [...digest.sites].sort((a, b) => {
    if (b.actionsCompleted !== a.actionsCompleted) {
      return b.actionsCompleted - a.actionsCompleted;
    }
    if (b.revenueUsd !== a.revenueUsd) return b.revenueUsd - a.revenueUsd;
    return a.displayName.localeCompare(b.displayName);
  });

  for (const s of ranked) {
    const status = s.error
      ? `ERROR: ${s.error}`
      : s.commerciallyLive && s.checkoutOpen
        ? "LIVE"
        : "NOT LIVE";
    const cycle = siteCycleStatus(s);
    lines.push("");
    lines.push(
      `▸ ${s.displayName} (${s.siteId}) — ${status}` +
        (cycle !== "ok" ? ` · ${cycle.toUpperCase()}` : ""),
    );
    lines.push(`  ${s.url}`);
    lines.push(
      `  $ ${s.revenueUsd.toFixed(2)} · purchases ${s.purchases} · actions ${s.actionsCompleted}` +
        (s.firstCustomerMode
          ? ` · FCM ${s.firstCustomerStage ?? "buyer_exposure"}`
          : "") +
        ` · ledger ${ledgerMode(s)}`,
    );
    const hour = s.thisHour;
    if (hour) {
      const vTotal =
        (hour.pageViews || 0) +
        (hour.ctaClicks || 0) +
        (hour.checkoutStarts || 0) +
        (hour.checkoutCompletes || 0);
      if (vTotal > 0) {
        lines.push(
          `  Visitors: ${hour.pageViews || 0} views · ${hour.ctaClicks || 0} CTA · ${hour.checkoutStarts || 0} checkout starts · ${hour.checkoutCompletes || 0} completes`,
        );
      }
      if (hour.actionTypes?.length) {
        lines.push(`  Executed: ${hour.actionTypes.slice(0, 6).join(", ")}`);
      }
      if (hour.changed?.length) {
        lines.push(`  Changed: ${hour.changed.slice(0, 3).join("; ")}`);
      }
      if (hour.learned?.length) {
        lines.push(`  Learned: ${hour.learned.slice(0, 3).join("; ")}`);
      }
      if (hour.killed?.length) {
        lines.push(`  Killed: ${hour.killed.slice(0, 3).join("; ")}`);
      }
      if (hour.next?.length) {
        lines.push(`  Next: ${hour.next.slice(0, 3).join("; ")}`);
      }
    }
    if (s.exposureNotes.length && s.actionsCompleted > 0) {
      lines.push(`  Exposure: ${s.exposureNotes.slice(0, 2).join("; ")}`);
    } else if (s.exposureNotes.length && cycle !== "ok") {
      lines.push(
        `  Stale exposure URLs (not new actions): ${s.exposureNotes.slice(0, 2).join("; ")}`,
      );
    }
    if (s.blockers.length) {
      lines.push(`  Owner blockers: ${s.blockers.slice(0, 3).join("; ")}`);
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
    if (failed) {
      lines.push(
        "• This cycle did not clear the execution bar — mutate strategy, do not repeat the report",
      );
    }
  } else {
    lines.push("• Repeat the winning path; keep exploring zeros");
  }
  lines.push("");
  lines.push(
    "— RevenueOS (single portfolio digest; email is a receipt, not the work)",
  );
  return lines.join("\n");
}

export function portfolioDigestSubject(digest: PortfolioDigest): string {
  if (digest.portfolioPurchases > 0) {
    return `RevenueOS: $${digest.portfolioRevenueUsd.toFixed(0)} / ${digest.portfolioPurchases} sale(s) across ${digest.liveCount} live businesses`;
  }
  const v = digest.portfolioPageViews;
  const i = digest.portfolioCtaClicks + digest.portfolioCheckoutStarts;
  const trafficTag = v > 0 || i > 0 ? ` · ${v}v/${i}i` : "";
  if (digest.cycleStatus === "stagnant") {
    return `RevenueOS: STAGNANT · $0${trafficTag} · ${digest.totalActionsCompleted} actions · mutate strategy`;
  }
  if (digest.cycleStatus === "failed") {
    return `RevenueOS: CYCLE FAILED · $0${trafficTag} · actions ${digest.totalActionsCompleted} · not a successful run`;
  }
  return `RevenueOS: $0${trafficTag} · ${digest.totalActionsCompleted} actions · ${digest.liveCount} live · pursuing first customer`;
}
