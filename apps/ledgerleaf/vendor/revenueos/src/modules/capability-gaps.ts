import { newId } from "../ledger/store";
import { classifyActionType } from "../policy";
import type {
  CapabilityGap,
  CapabilityGapSummary,
  CapabilityImportance,
  Opportunity,
  SafeAction,
} from "../types";

export const KNOWN_CAPABILITY_GAPS = {
  search_console_analytics: {
    desiredAction: "Read Indexed / Impressions / Clicks for discovery doors",
    reason:
      "Governor scores doors with on-site proxies only. Real SERP Indexed→Impressions→Clicks requires Search Console / Bing Webmaster APIs.",
    expectedValueUsd: 400,
    importance: "high" as CapabilityImportance,
  },
  outreach_executor: {
    desiredAction: "Run consented organic outreach / directory placement",
    reason:
      "High-EV acquisition plays repeatedly require outreach the brain cannot execute autonomously.",
    expectedValueUsd: 600,
    importance: "high" as CapabilityImportance,
  },
  paid_ads: {
    desiredAction: "Run paid acquisition tests under a spend cap",
    reason: "Policy keeps spend_ads owner-gated; EV pressure accumulates as a gap, not an auto-spend.",
    expectedValueUsd: 800,
    importance: "medium" as CapabilityImportance,
  },
  discovery_publish: {
    desiredAction: "Publish intent topics from research",
    reason: "Site adapter has no publish_intent_page limb.",
    expectedValueUsd: 350,
    importance: "high" as CapabilityImportance,
  },
} as const;

export function importanceFromEv(
  expectedValueUsd: number,
  timesBlocked: number,
): CapabilityImportance {
  const pressure = expectedValueUsd * Math.log2(timesBlocked + 1);
  if (pressure >= 2500 || timesBlocked >= 14) return "critical";
  if (pressure >= 800 || timesBlocked >= 7) return "high";
  if (pressure >= 200 || timesBlocked >= 3) return "medium";
  return "low";
}

/**
 * Strip safeActionType when the adapter cannot execute it so ranking, money
 * plan, and hunting stop treating missing limbs as executable.
 */
export function demoteUnavailableSafeActions(
  opportunities: Opportunity[],
  availableActionTypes: Set<string>,
): Opportunity[] {
  return opportunities.map((opportunity) => {
    if (
      !opportunity.safeActionType ||
      availableActionTypes.has(opportunity.safeActionType)
    ) {
      return opportunity;
    }
    const { safeActionType: _removed, ...rest } = opportunity;
    return rest;
  });
}

export function capabilityForBlockedOpportunity(input: {
  opportunity: Opportunity;
  availableActionTypes: Set<string>;
}): { missingCapability: string; desiredAction: string; reason: string } | null {
  const opp = input.opportunity;
  if (!opp.safeActionType) {
    if (
      opp.patternKey?.includes("search-console") ||
      opp.id.includes("gsc") ||
      opp.title.toLowerCase().includes("search console")
    ) {
      return {
        missingCapability: "search_console_analytics",
        desiredAction: opp.action,
        reason: "Opportunity requires Search Console / Bing analytics the adapter cannot read.",
      };
    }
    if (
      opp.patternKey?.includes("outreach") ||
      opp.patternKey?.includes("directories") ||
      opp.title.toLowerCase().includes("outreach")
    ) {
      return {
        missingCapability: "outreach_executor",
        desiredAction: opp.action,
        reason: "Opportunity needs an outreach executor limb.",
      };
    }
    if (opp.category === "acquisition") {
      return {
        missingCapability: "unmapped_acquisition_executor",
        desiredAction: opp.action,
        reason: `Acquisition opportunity "${opp.title}" has no safeActionType — advisory only.`,
      };
    }
    return {
      missingCapability: "owner_or_unmapped_executor",
      desiredAction: opp.action,
      reason: `Opportunity "${opp.title}" is not executable by the current adapter.`,
    };
  }

  const risk = classifyActionType(opp.safeActionType);
  if (risk === "owner_gate") {
    return {
      missingCapability:
        opp.safeActionType === "spend_ads" ? "paid_ads" : opp.safeActionType,
      desiredAction: opp.action,
      reason: `Action ${opp.safeActionType} is owner-gated by policy.`,
    };
  }
  if (!input.availableActionTypes.has(opp.safeActionType)) {
    return {
      missingCapability: opp.safeActionType,
      desiredAction: opp.action,
      reason: `Adapter does not implement safe action ${opp.safeActionType}.`,
    };
  }
  return null;
}

export function upsertCapabilityGap(input: {
  existing: CapabilityGap | undefined;
  siteId: string;
  missingCapability: string;
  desiredAction: string;
  reason: string;
  expectedValueUsd: number;
  patternKey?: string;
  now?: Date;
}): CapabilityGap {
  const now = (input.now ?? new Date()).toISOString();
  if (input.existing) {
    const timesBlocked = input.existing.timesBlocked + 1;
    const businesses = new Set([
      ...input.existing.businessesAffected,
      input.siteId,
    ]);
    const expectedValueUsd = Math.max(
      input.existing.expectedValueUsd,
      input.expectedValueUsd,
    );
    return {
      ...input.existing,
      reason: input.reason,
      expectedValueUsd,
      timesBlocked,
      businessesAffected: [...businesses],
      importance: importanceFromEv(expectedValueUsd, timesBlocked),
      lastSeenAt: now,
      patternKey: input.patternKey ?? input.existing.patternKey,
    };
  }
  return {
    id: newId("capgap"),
    siteId: input.siteId,
    desiredAction: input.desiredAction.slice(0, 400),
    reason: input.reason.slice(0, 400),
    expectedValueUsd: input.expectedValueUsd,
    missingCapability: input.missingCapability,
    timesBlocked: 1,
    businessesAffected: [input.siteId],
    importance: importanceFromEv(input.expectedValueUsd, 1),
    firstSeenAt: now,
    lastSeenAt: now,
    patternKey: input.patternKey,
  };
}

export function recordGapsFromOpportunities(input: {
  siteId: string;
  opportunities: Opportunity[];
  safeActions: SafeAction[];
  existingGaps: CapabilityGap[];
  declaredUnavailable?: Array<{ capability: string; reason: string }>;
  topN?: number;
  now?: Date;
}): CapabilityGap[] {
  const available = new Set(input.safeActions.map((a) => a.type));
  const byKey = new Map(
    input.existingGaps.map((g) => [
      `${g.siteId}|${g.missingCapability}|${g.desiredAction}`,
      g,
    ]),
  );
  const updated: CapabilityGap[] = [];
  const top = input.opportunities.slice(0, input.topN ?? 8);

  for (const opp of top) {
    const blocked = capabilityForBlockedOpportunity({
      opportunity: opp,
      availableActionTypes: available,
    });
    if (!blocked) continue;
    const ev = opp.predicted?.expectedProfitUsd ?? opp.expectedImpact * 40;
    const key = `${input.siteId}|${blocked.missingCapability}|${blocked.desiredAction}`;
    const gap = upsertCapabilityGap({
      existing: byKey.get(key),
      siteId: input.siteId,
      missingCapability: blocked.missingCapability,
      desiredAction: blocked.desiredAction,
      reason: blocked.reason,
      expectedValueUsd: Number(ev.toFixed(2)),
      patternKey: opp.patternKey,
      now: input.now,
    });
    byKey.set(key, gap);
    updated.push(gap);
  }

  for (const declared of input.declaredUnavailable ?? []) {
    const known =
      KNOWN_CAPABILITY_GAPS[
        declared.capability as keyof typeof KNOWN_CAPABILITY_GAPS
      ];
    const desiredAction = known?.desiredAction ?? declared.capability;
    const key = `${input.siteId}|${declared.capability}|${desiredAction}`;
    const gap = upsertCapabilityGap({
      existing: byKey.get(key),
      siteId: input.siteId,
      missingCapability: declared.capability,
      desiredAction,
      reason: declared.reason,
      expectedValueUsd: known?.expectedValueUsd ?? 200,
      now: input.now,
    });
    byKey.set(key, gap);
    updated.push(gap);
  }

  return updated;
}

export function summarizeCapabilityGaps(
  gaps: CapabilityGap[],
): CapabilityGapSummary[] {
  const byCap = new Map<string, CapabilityGap[]>();
  for (const gap of gaps) {
    const list = byCap.get(gap.missingCapability) ?? [];
    list.push(gap);
    byCap.set(gap.missingCapability, list);
  }
  return [...byCap.entries()]
    .map(([missingCapability, items]) => {
      const timesBlocked = items.reduce((s, g) => s + g.timesBlocked, 0);
      const expectedValueUsd = items.reduce(
        (s, g) => s + g.expectedValueUsd * g.timesBlocked,
        0,
      );
      const businessesAffected = [
        ...new Set(items.flatMap((g) => g.businessesAffected)),
      ];
      const importance = importanceFromEv(expectedValueUsd / Math.max(1, timesBlocked), timesBlocked);
      return {
        missingCapability,
        timesBlocked,
        expectedValueUsd: Number(expectedValueUsd.toFixed(2)),
        importance,
        businessesAffected,
        desiredActions: [...new Set(items.map((g) => g.desiredAction))].slice(0, 5),
        recommendation: `Recommended RevenueOS capability: ${missingCapability.replace(/_/g, " ")} executor.`,
      };
    })
    .sort((a, b) => b.timesBlocked - a.timesBlocked || b.expectedValueUsd - a.expectedValueUsd);
}
