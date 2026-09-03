/**
 * Portfolio evolution tick — PortfolioArchitect on Mac Core.
 * Persists opportunities/launches/retirements in Supabase document memory.
 * Does not erase history. Does not spend money.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ARCHITECT_SAFETY,
  DEFAULT_OWNER_PORTFOLIO_POLICY,
  enrichOpportunitiesWithModel,
  runPortfolioArchitectCycle,
  selectLaunchCandidate,
  type BusinessOpportunity,
  type OwnerPortfolioPolicy,
  type PortfolioArchitectSafety,
  type PortfolioArchitectState,
} from "@revenueos/core";
import { getPortfolio } from "../portfolio.js";

const STATE_ID = "ros:portfolio_architect:state";
const STATE_CATEGORY = "__ros_portfolio_architect__";
const EVENT_CATEGORY = "__ros_portfolio_event__";

export async function loadArchitectState(
  client: SupabaseClient,
): Promise<PortfolioArchitectState> {
  const { data } = await client
    .from("revenueos_experiments")
    .select("document")
    .eq("id", STATE_ID)
    .maybeSingle();
  if (!data?.document || typeof data.document !== "object") {
    return {
      safety: { ...DEFAULT_ARCHITECT_SAFETY },
      ownerPolicy: { ...DEFAULT_OWNER_PORTFOLIO_POLICY },
      opportunities: [],
      fitness: [],
      retirementDecisions: [],
      launches: [],
      events: [],
      updatedAt: new Date(0).toISOString(),
    };
  }
  return data.document as PortfolioArchitectState;
}

export async function saveArchitectState(
  client: SupabaseClient,
  state: PortfolioArchitectState,
): Promise<void> {
  await client.from("revenueos_experiments").upsert(
    {
      id: STATE_ID,
      site_id: "portfolio",
      category: STATE_CATEGORY,
      status: "active",
      document: state,
      updated_at: state.updatedAt,
    },
    { onConflict: "id" },
  );
}

async function appendPortfolioEvent(
  client: SupabaseClient,
  summary: string,
  kind: string,
  siteId?: string,
) {
  const id = `ros:pevt_arch:${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const at = new Date().toISOString();
  await client.from("revenueos_experiments").upsert(
    {
      id,
      site_id: siteId ?? "portfolio",
      category: EVENT_CATEGORY,
      status: "recorded",
      document: { eventType: kind, summary, siteId, createdAt: at },
      updated_at: at,
    },
    { onConflict: "id" },
  );
}

export async function runEvolutionCycle(input: {
  client: SupabaseClient;
  activeSiteIds: string[];
  safetyOverride?: Partial<PortfolioArchitectSafety>;
  /** When true, do not auto-select a launch (proof already done / owner paused creations). */
  suppressLaunchSelection?: boolean;
  /** Sites blocked by autonomous engineering repair — do not commercially retire. */
  engineeringBlockedSiteIds?: string[];
}): Promise<{
  state: PortfolioArchitectState;
  launchCandidate: BusinessOpportunity | null;
  topAlternatives: BusinessOpportunity[];
}> {
  const prev = await loadArchitectState(input.client);
  const safety = {
    ...DEFAULT_ARCHITECT_SAFETY,
    ...prev.safety,
    ...input.safetyOverride,
  };
  const ownerRaisedThroughput =
    prev.ownerPolicy.stopCreatingNewBusinesses === false &&
    (prev.ownerPolicy.maxActiveBusinesses ?? 0) >= 50;
  if (input.suppressLaunchSelection) {
    safety.stopCreatingNewBusinesses = true;
  } else if (ownerRaisedThroughput) {
    // Owner final portfolio reset / throughput raise — keep creating up to cap.
    safety.stopCreatingNewBusinesses = false;
    safety.maxActiveBusinesses = prev.ownerPolicy.maxActiveBusinesses ?? 50;
  } else if (prev.launches.length >= 1) {
    // First-proof gate: after one autonomous launch, stop creating until owner raises throughput.
    safety.stopCreatingNewBusinesses = true;
  }

  const activeIndustries = getPortfolio()
    .filter((b) => input.activeSiteIds.includes(b.siteId))
    .map((b) => b.industry);

  const engBlocked = new Set(input.engineeringBlockedSiteIds ?? []);
  const telemetry = input.activeSiteIds.map((siteId) => ({
    siteId,
    purchases: 0,
    revenueUsd: 0,
    landingViews: 0,
    checkoutStarts: 0,
    ageDays: 30,
    experimentCount: 100,
    ownerLocked: prev.ownerPolicy.lockedSiteIds.includes(siteId),
    engineeringBlocked: engBlocked.has(siteId),
  }));

  const cycle = runPortfolioArchitectCycle({
    activeSiteIds: input.activeSiteIds,
    activeIndustries,
    telemetry,
    safety,
    ownerPolicy: prev.ownerPolicy,
    portableLessonHints: [
      "digital packs with clear buyer intent convert when organic doors exist",
      "high margin instant fulfillment preferred",
      "prefer improving promising businesses over random spawn",
    ],
  });

  const enriched = await enrichOpportunitiesWithModel(
    cycle.statePatch.opportunities ?? [],
  );
  if (enriched.length) {
    cycle.statePatch.opportunities = enriched;
  }
  if (!safety.stopCreatingNewBusinesses) {
    const pool = enriched.length
      ? enriched
      : (cycle.statePatch.opportunities ?? []);
    cycle.launchCandidate = selectLaunchCandidate({
      opportunities: pool,
      activeCount: input.activeSiteIds.length,
      safety,
      ownerPolicy: prev.ownerPolicy,
    });
    cycle.topAlternatives = pool
      .filter((o) => o.siteId !== cycle.launchCandidate?.siteId)
      .slice(0, 10);
  }

  const state: PortfolioArchitectState = {
    ...prev,
    ...cycle.statePatch,
    safety,
    ownerPolicy: prev.ownerPolicy,
    launches: prev.launches,
    events: [...(prev.events ?? []).slice(-80), ...(cycle.statePatch.events ?? [])],
    updatedAt: new Date().toISOString(),
  };

  await saveArchitectState(input.client, state);
  for (const ev of cycle.statePatch.events ?? []) {
    await appendPortfolioEvent(input.client, ev.summary, ev.kind, ev.siteId);
  }

  return {
    state,
    launchCandidate: safety.stopCreatingNewBusinesses
      ? null
      : cycle.launchCandidate,
    topAlternatives: cycle.topAlternatives,
  };
}

export async function recordAutonomousLaunch(
  client: SupabaseClient,
  input: {
    opportunity: BusinessOpportunity;
    productionUrl: string;
    reason: string;
  },
): Promise<PortfolioArchitectState> {
  const prev = await loadArchitectState(client);
  const at = new Date().toISOString();
  const state: PortfolioArchitectState = {
    ...prev,
    safety: {
      ...prev.safety,
      // Keep creating when owner authorized full portfolio throughput.
      stopCreatingNewBusinesses:
        prev.ownerPolicy.stopCreatingNewBusinesses === false &&
        (prev.ownerPolicy.maxActiveBusinesses ?? 0) >= 50
          ? false
          : true,
    },
    launches: [
      ...prev.launches,
      {
        siteId: input.opportunity.siteId,
        opportunityId: input.opportunity.id,
        at,
        productionUrl: input.productionUrl,
        reason: input.reason,
      },
    ],
    opportunities: prev.opportunities.map((o) =>
      o.id === input.opportunity.id
        ? { ...o, lifecycle: "active" as const }
        : o,
    ),
    events: [
      ...prev.events,
      {
        at,
        kind: "business_launched",
        summary: `RevenueOS launched ${input.opportunity.displayName} at ${input.productionUrl}`,
        siteId: input.opportunity.siteId,
      },
    ],
    updatedAt: at,
  };
  await saveArchitectState(client, state);
  await appendPortfolioEvent(
    client,
    state.events[state.events.length - 1]!.summary,
    "business_launched",
    input.opportunity.siteId,
  );
  return state;
}

export async function updateOwnerPortfolioPolicy(
  client: SupabaseClient,
  patch: Partial<OwnerPortfolioPolicy>,
): Promise<OwnerPortfolioPolicy> {
  const prev = await loadArchitectState(client);
  const ownerPolicy: OwnerPortfolioPolicy = {
    ...prev.ownerPolicy,
    ...patch,
    bannedMarkets: patch.bannedMarkets ?? prev.ownerPolicy.bannedMarkets,
    requestedMarkets: patch.requestedMarkets ?? prev.ownerPolicy.requestedMarkets,
    lockedSiteIds: patch.lockedSiteIds ?? prev.ownerPolicy.lockedSiteIds,
    updatedAt: new Date().toISOString(),
  };
  await saveArchitectState(client, { ...prev, ownerPolicy, updatedAt: ownerPolicy.updatedAt });
  return ownerPolicy;
}
