/**
 * Revenue hunter — portfolio-level LLM meta-strategist.
 *
 * Given all portfolio sites' snapshots, asks GPT to identify:
 *   - which business is CLOSEST to a first purchase
 *   - which mechanism to scale
 *   - which businesses to suspend this cycle
 *   - a one-line portfolio insight
 *
 * Downstream: results are surfaced as `RevenueHunterVerdict` — the caller
 * may fold them softly into `rankPortfolioEffort` as opts, NOT by mutating
 * the pure function.
 *
 * All LLM failures degrade gracefully to a deterministic verdict derived
 * from the raw snapshots.
 */

import { callOpenAI, DEFAULT_MODELS, hasOpenAIKey } from "./openai-client";
import type { PortfolioBusinessSnapshot } from "../types";

export type RevenueHunterVerdict = {
  focusSiteId: string | null;
  mechanismToScale: string | null;
  businessesToSuspendThisCycle: string[];
  portfolioInsight: string;
  reason?: string;
};

const HUNTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "focusSiteId",
    "mechanismToScale",
    "businessesToSuspendThisCycle",
    "portfolioInsight",
  ],
  properties: {
    focusSiteId: { type: "string" },
    mechanismToScale: { type: "string" },
    businessesToSuspendThisCycle: {
      type: "array",
      items: { type: "string" },
      maxItems: 10,
    },
    portfolioInsight: { type: "string" },
  },
};

function deterministicVerdict(
  snapshots: PortfolioBusinessSnapshot[],
): RevenueHunterVerdict {
  if (!snapshots.length) {
    return {
      focusSiteId: null,
      mechanismToScale: null,
      businessesToSuspendThisCycle: [],
      portfolioInsight: "No portfolio snapshots.",
    };
  }
  const scored = snapshots
    .filter((s) => !s.suspended)
    .map((s) => ({
      s,
      // Sites with real intent activity but no purchase are "closest" — a
      // buyer landed and moved down the funnel. Break ties by profit per
      // visitor.
      distanceScore:
        (s.landingViews > 0 && s.purchases === 0
          ? Math.min(s.landingViews, 200) / 20
          : s.purchases > 0
            ? 6 + Math.min(s.contributionProfitUsd, 80) / 20
            : 0) +
        s.profitPerVisitor * 40 +
        s.marginalEvProxy * 0.4,
    }))
    .sort((a, b) => b.distanceScore - a.distanceScore);
  const focus = scored[0]?.s.siteId ?? null;
  const suspend = snapshots
    .filter((s) => s.suspended)
    .map((s) => s.siteId);
  const insight = focus
    ? `Deterministic fallback: ${focus} is closest to a first purchase by profit-per-visitor + intent signal.`
    : "Deterministic fallback: no site has commercial signal yet.";
  return {
    focusSiteId: focus,
    mechanismToScale: null,
    businessesToSuspendThisCycle: suspend,
    portfolioInsight: insight,
  };
}

export type HuntPortfolioInput = {
  snapshots: PortfolioBusinessSnapshot[];
  hourlyRevenueUsd?: number;
  targetDailyProfitPerBusinessUsd?: number;
};

export async function huntPortfolioRevenue(
  input: HuntPortfolioInput,
): Promise<RevenueHunterVerdict> {
  if (!hasOpenAIKey()) {
    return {
      ...deterministicVerdict(input.snapshots),
      reason: "no OPENAI_API_KEY (fallback verdict)",
    };
  }
  const system = {
    role: "system" as const,
    content:
      "You are the portfolio meta-strategist for RevenueOS running 10 businesses in parallel. Sole objective: real, collected revenue — $10k/day profit PER business. Given the current snapshot per business, pick ONE `focusSiteId` (closest to a first purchase or already selling and easiest to scale) and ONE `mechanismToScale` (e.g. owned_content, community_participation, external_placement, direct_outreach, conversion_optimization). Suspend businesses that show zero intent and repeatedly banned mechanisms. Portfolio insight is one crisp sentence.",
  };
  const stateJson = JSON.stringify(
    {
      target_daily_profit_per_business_usd:
        input.targetDailyProfitPerBusinessUsd ?? 10_000,
      hourly_revenue_usd: input.hourlyRevenueUsd ?? 0,
      snapshots: input.snapshots.map((s) => ({
        siteId: s.siteId,
        displayName: s.displayName,
        purchases: s.purchases,
        revenueUsd: s.revenueUsd,
        contributionProfitUsd: s.contributionProfitUsd,
        landingViews: s.landingViews,
        profitPerVisitor: s.profitPerVisitor,
        marginalEvProxy: s.marginalEvProxy,
        firstCustomerMode: s.firstCustomerMode,
        suspended: !!s.suspended,
        bannedPatternCount: s.bannedPatternCount ?? 0,
        activePursuits: s.activePursuits,
      })),
    },
    null,
    2,
  );
  const user = {
    role: "user" as const,
    content: `Portfolio state:\n${stateJson}\n\nPick focusSiteId (must be one of the siteIds above), mechanismToScale, businessesToSuspendThisCycle (subset of siteIds), and a one-sentence portfolioInsight.`,
  };

  try {
    const res = await callOpenAI<{
      focusSiteId: string;
      mechanismToScale: string;
      businessesToSuspendThisCycle: string[];
      portfolioInsight: string;
    }>({
      model: DEFAULT_MODELS.strategist,
      messages: [system, user],
      jsonSchema: HUNTER_SCHEMA,
      temperature: 0.5,
      maxOutputTokens: 500,
      timeoutMs: 30_000,
      justification: {
        scope: "portfolio",
        subsystem: "revenue-hunter",
        purpose: "experiment_selection",
        reason: "portfolio focus site + mechanism selection for stranger revenue",
        priority: 4,
        stateHash: input.snapshots
          .map((s) => `${s.siteId}:${s.purchases}:${s.landingViews}`)
          .join("|")
          .slice(0, 200),
      },
    });
    if (!res.ok) {
      return {
        ...deterministicVerdict(input.snapshots),
        reason: res.reason,
      };
    }
    const validIds = new Set(input.snapshots.map((s) => s.siteId));
    const focus = validIds.has(res.data.focusSiteId)
      ? res.data.focusSiteId
      : deterministicVerdict(input.snapshots).focusSiteId;
    const suspend = (res.data.businessesToSuspendThisCycle ?? []).filter((id) =>
      validIds.has(id),
    );
    return {
      focusSiteId: focus,
      mechanismToScale: res.data.mechanismToScale ?? null,
      businessesToSuspendThisCycle: suspend,
      portfolioInsight: res.data.portfolioInsight,
    };
  } catch (err) {
    return {
      ...deterministicVerdict(input.snapshots),
      reason: `revenue-hunter failure: ${(err as Error).message.slice(0, 120)}`,
    };
  }
}
