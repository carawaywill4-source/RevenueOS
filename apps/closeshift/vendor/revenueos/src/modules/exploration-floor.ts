/**
 * Exploration floor invariants — hard rules the planner MUST honor per cycle.
 *
 * The previous planner could return a cycle of pure `publish_*` +
 * `distribute_owned_urls` + `indexnow_submit` in FIRST_CUSTOMER_MODE (FCM),
 * despite external pursuit limbs (Reddit, HN, email, Product Hunt, YouTube,
 * IndieHackers, GSC, buyer_discovery) being fully wired. That is the exact
 * "IndexNow alone is not pursuit" failure mode: content creation on the owned
 * domain is not customer pursuit.
 *
 * These invariants enforce, in order:
 *
 *   A. External-mechanism floor — in FCM with zero purchases, at least one
 *      opportunity from {external_placement, community_participation,
 *      direct_outreach} must appear in the top-N enqueue set. If the top-N
 *      contains none, promote the highest-scoring external-class candidate.
 *
 *   B. Channel-registry cold-start floor — force `channel_discover` this cycle
 *      whenever the durable channel registry has fewer than 5 *usable* entries
 *      (i.e., not enough surfaces for Thompson sampling to explore external
 *      arms). Bandits cannot allocate across arms that don't exist.
 *
 *   C. `buyer_discovery` FCM guarantee — in FCM with zero durable buyer leads,
 *      force `buyer_discovery` this cycle. `email_cold_outreach` and Reddit
 *      reply drafts have nothing to work with until at least one lead exists.
 *
 *   D. Per-cycle action-type cap — no action type may be enqueued more than
 *      MAX_PER_TYPE_PER_CYCLE (default 2) times per business per cycle. Once
 *      the cap is hit, the planner MUST swap for a different mechanism class.
 *      This kills the "publish_intent_tool ×8 in one cycle" pattern.
 *
 * These are laws, not preferences. Regression tests in `tests/revenueos.test.ts`
 * pin them.
 */

import type { Opportunity, PursuitEvent } from "../types";
import { classifyMechanism, type MechanismClass } from "./action-class";

/** Mechanism classes that count as "customer pursuit" (not owned production). */
export const EXTERNAL_MECHANISM_CLASSES = new Set<MechanismClass>([
  "external_placement",
  "community_participation",
  "direct_outreach",
]);

/** Default cap for identical action_type occurrences per business per cycle. */
export const MAX_PER_TYPE_PER_CYCLE = 2;

/** Minimum active channels required before we stop forcing `channel_discover`. */
export const CHANNEL_REGISTRY_COLD_START_FLOOR = 5;

export type ExplorationFloorInput = {
  opportunities: Opportunity[];
  firstCustomerModeActive: boolean;
  purchases: number;
  /** Estimate of durable buyer-lead count for THIS site. */
  buyerLeadCount: number;
  /** Estimate of active channels in this site's registry. */
  activeChannelCount: number;
  /** Recent pursuit events (12h window) — used to detect prior discovery runs. */
  recentEvents: PursuitEvent[];
  /** Site identifier for stable opportunity ids. */
  siteId: string;
  /** How many actions the planner intends to enqueue this cycle. */
  topN: number;
  /** Deterministic clock for tests. */
  now?: Date;
};

export type ExplorationFloorReport = {
  opportunities: Opportunity[];
  forcedExternal: boolean;
  forcedChannelDiscover: boolean;
  forcedBuyerDiscovery: boolean;
  cappedActionTypes: string[];
  externalMechanismInTopN: MechanismClass | null;
};

/**
 * Is any opportunity in the top-N slice an external-mechanism action?
 * Returns the mechanism class of the first hit, or null.
 */
export function firstExternalMechanismInTopN(
  opportunities: Opportunity[],
  topN: number,
): MechanismClass | null {
  const slice = opportunities.slice(0, Math.max(topN, 1));
  for (const opp of slice) {
    const mech = classifyMechanism({
      actionType: opp.safeActionType,
      patternKey: opp.patternKey,
      category: opp.category,
    });
    if (EXTERNAL_MECHANISM_CLASSES.has(mech)) return mech;
  }
  return null;
}

/**
 * If in FCM with zero purchases and no external-mechanism opportunity is in
 * the top-N slice, promote the highest-scoring external-class candidate from
 * the tail into position `topN - 1`. Falls through with no change if no
 * external-class candidate exists (in which case fix B / C will supply one).
 */
export function promoteExternalMechanism(input: {
  opportunities: Opportunity[];
  firstCustomerModeActive: boolean;
  purchases: number;
  topN: number;
}): { opportunities: Opportunity[]; forced: boolean } {
  if (!input.firstCustomerModeActive || input.purchases > 0) {
    return { opportunities: input.opportunities, forced: false };
  }
  if (firstExternalMechanismInTopN(input.opportunities, input.topN)) {
    return { opportunities: input.opportunities, forced: false };
  }
  // Find the best external-mechanism candidate anywhere in the list.
  const candidates = input.opportunities
    .map((opp, idx) => ({
      opp,
      idx,
      mechanism: classifyMechanism({
        actionType: opp.safeActionType,
        patternKey: opp.patternKey,
        category: opp.category,
      }),
    }))
    .filter((row) => EXTERNAL_MECHANISM_CLASSES.has(row.mechanism))
    .sort((a, b) => b.opp.score - a.opp.score);
  if (candidates.length === 0) {
    return { opportunities: input.opportunities, forced: false };
  }
  const winner = candidates[0]!;
  // Boost score so it lands inside the enqueue slice for THIS cycle.
  const rest = input.opportunities.filter((_, i) => i !== winner.idx);
  const topScore = input.opportunities[0]?.score ?? winner.opp.score;
  const promoted: Opportunity = {
    ...winner.opp,
    score: Number((topScore + 1).toFixed(2)),
  };
  return { opportunities: [promoted, ...rest], forced: true };
}

/** Executed action types in a window of pursuit events (ok:true only). */
export function successfullyExecutedTypes(events: PursuitEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    if (e.eventType !== "executed") continue;
    if (e.detail?.ok !== true) continue;
    const t = e.detail?.actionType;
    if (typeof t === "string") out.add(t);
  }
  return out;
}

/**
 * Force `channel_discover` when the site's channel registry has fewer than
 * CHANNEL_REGISTRY_COLD_START_FLOOR usable entries. Idempotent-safe: if the
 * planner already has a channel_discover opportunity we leave it alone (its
 * score may be higher than what we would inject).
 */
export function forceChannelDiscoverIfCold(input: {
  opportunities: Opportunity[];
  activeChannelCount: number;
  siteId: string;
  now?: Date;
}): { opportunities: Opportunity[]; forced: boolean } {
  if (input.activeChannelCount >= CHANNEL_REGISTRY_COLD_START_FLOOR) {
    return { opportunities: input.opportunities, forced: false };
  }
  if (
    input.opportunities.some((o) => o.safeActionType === "channel_discover")
  ) {
    return { opportunities: input.opportunities, forced: false };
  }
  const dayKey = (input.now ?? new Date()).toISOString().slice(0, 10);
  const topScore = input.opportunities[0]?.score ?? 0;
  const forced: Opportunity = {
    id: `floor-channel-discover-${input.siteId}-${dayKey}`,
    title: "Channel Registry cold-start: force channel_discover",
    metric: "landing_views",
    category: "acquisition",
    action:
      "Registry has <5 usable channels — cannot Thompson-sample external arms until we discover them. Run channel_discover this cycle (bandit floor).",
    expectedImpact: 9,
    confidence: 0.6,
    effort: 2,
    // Land above the current leader so this survives every downstream re-score.
    score: Number((Math.max(topScore, 50) + 5).toFixed(2)),
    safeActionType: "channel_discover",
    patternKey: `floor:channel-discover:${input.siteId}`,
    precursorMetric: "landing_views",
  };
  return { opportunities: [forced, ...input.opportunities], forced: true };
}

/**
 * Force `buyer_discovery` when the site is in FCM with zero durable buyer
 * leads. Downstream external actions (`email_cold_outreach`,
 * `public_form_outreach`, `reddit_helpful_reply`) all short-circuit with
 * "no lead" guards when the durable lead list is empty; without leads there
 * is nothing to pursue.
 *
 * Also fires when leads exist but no buyer_discovery has succeeded in the
 * recent event window and no leads have been consumed — that is a stagnant
 * pipeline and re-running discovery is cheap.
 */
export function forceBuyerDiscoveryIfMissing(input: {
  opportunities: Opportunity[];
  firstCustomerModeActive: boolean;
  buyerLeadCount: number;
  recentEvents: PursuitEvent[];
  siteId: string;
  now?: Date;
}): { opportunities: Opportunity[]; forced: boolean } {
  if (!input.firstCustomerModeActive) {
    return { opportunities: input.opportunities, forced: false };
  }
  if (input.buyerLeadCount > 0) {
    return { opportunities: input.opportunities, forced: false };
  }
  if (
    input.opportunities.some((o) => o.safeActionType === "buyer_discovery")
  ) {
    return { opportunities: input.opportunities, forced: false };
  }
  const executed = successfullyExecutedTypes(input.recentEvents);
  if (executed.has("buyer_discovery")) {
    // Discovery ran but produced no leads — do not enqueue another one this
    // cycle; the LLM path will re-run naturally on the next window.
    return { opportunities: input.opportunities, forced: false };
  }
  const dayKey = (input.now ?? new Date()).toISOString().slice(0, 10);
  const topScore = input.opportunities[0]?.score ?? 0;
  const forced: Opportunity = {
    id: `floor-buyer-discovery-${input.siteId}-${dayKey}`,
    title: "FCM floor: force buyer_discovery (no durable leads yet)",
    metric: "landing_views",
    category: "acquisition",
    action:
      "FIRST_CUSTOMER_MODE with zero buyer leads — external pursuit limbs have nothing to work with. Discover public surfaces + emails this cycle.",
    expectedImpact: 10,
    confidence: 0.6,
    effort: 2,
    score: Number((Math.max(topScore, 50) + 4).toFixed(2)),
    safeActionType: "buyer_discovery",
    patternKey: `floor:buyer-discovery:${input.siteId}`,
    precursorMetric: "landing_views",
  };
  return { opportunities: [forced, ...input.opportunities], forced: true };
}

/**
 * Cap identical action_types per cycle. If the ordered opportunity list
 * would enqueue more than MAX_PER_TYPE_PER_CYCLE of the same type in its
 * top-N slice, drop the excess and pull in the next unbanned/uncapped
 * candidate from the tail. This kills the "publish_intent_tool ×8"
 * pattern that dominated resumeforge cycles.
 */
export function capPerCycleActionRepeats(input: {
  opportunities: Opportunity[];
  topN: number;
  cap?: number;
}): { opportunities: Opportunity[]; cappedActionTypes: string[] } {
  const cap = input.cap ?? MAX_PER_TYPE_PER_CYCLE;
  const topN = Math.max(input.topN, 1);
  const counts = new Map<string, number>();
  const mechanismCounts = new Map<MechanismClass, number>();
  const inSlice: Opportunity[] = [];
  const capped = new Set<string>();
  const overflow: Opportunity[] = []; // items whose type hit cap inside top-N
  const tail: Opportunity[] = []; // items past top-N slice (untouched)

  // Pass 1: fill top-N respecting the per-type cap. Anything past top-N is
  // preserved verbatim so downstream stages still see the full option set.
  for (const opp of input.opportunities) {
    const type = opp.safeActionType ?? "";
    if (inSlice.length >= topN) {
      tail.push(opp);
      continue;
    }
    const typeUsed = counts.get(type) ?? 0;
    if (type && typeUsed >= cap) {
      capped.add(type);
      overflow.push(opp);
      continue;
    }
    inSlice.push(opp);
    if (type) counts.set(type, typeUsed + 1);
    const mech = classifyMechanism({
      actionType: opp.safeActionType,
      patternKey: opp.patternKey,
      category: opp.category,
    });
    mechanismCounts.set(mech, (mechanismCounts.get(mech) ?? 0) + 1);
  }

  // Pass 2: if top-N is under-filled, pull DIFFERENT-typed candidates from
  // the tail into top-N to break repetition. Preserve tail order for the rest.
  if (inSlice.length < topN && tail.length) {
    const consumed = new Set<Opportunity>();
    for (const opp of tail) {
      if (inSlice.length >= topN) break;
      const type = opp.safeActionType ?? "";
      const typeUsed = counts.get(type) ?? 0;
      if (type && typeUsed >= cap) continue;
      inSlice.push(opp);
      consumed.add(opp);
      if (type) counts.set(type, typeUsed + 1);
      const mech = classifyMechanism({
        actionType: opp.safeActionType,
        patternKey: opp.patternKey,
        category: opp.category,
      });
      mechanismCounts.set(mech, (mechanismCounts.get(mech) ?? 0) + 1);
    }
    // Remove promoted items from tail in-place.
    for (let i = tail.length - 1; i >= 0; i--) {
      if (consumed.has(tail[i]!)) tail.splice(i, 1);
    }
  }

  // Final layout: top-N first (cap-respecting), then the untouched tail.
  // Overflow items (capped-but-not-promotable) are DROPPED for this cycle —
  // downstream `enqueuePursuitsFromOpportunities` iterates the returned array
  // in order, so leaving them anywhere ahead of `maxEnqueue` would violate
  // the invariant. They can (and will) be re-proposed by the strategist next
  // cycle when the cap window resets.
  return {
    opportunities: [...inSlice, ...tail],
    cappedActionTypes: [...capped],
  };
}

/**
 * Apply the full exploration floor in the invariant order:
 *   1. force `channel_discover` if the registry is cold
 *   2. force `buyer_discovery` if FCM with zero leads
 *   3. promote an external mechanism into the top-N if none present
 *   4. cap per-cycle repeats of the same action_type
 *
 * Returns the mutated opportunity list plus a report used by pursuit-plan
 * to attach diagnostic fields to the emitted enqueue events.
 */
export function applyExplorationFloor(
  input: ExplorationFloorInput,
): ExplorationFloorReport {
  let list = input.opportunities;

  const channelStep = forceChannelDiscoverIfCold({
    opportunities: list,
    activeChannelCount: input.activeChannelCount,
    siteId: input.siteId,
    now: input.now,
  });
  list = channelStep.opportunities;

  const buyerStep = forceBuyerDiscoveryIfMissing({
    opportunities: list,
    firstCustomerModeActive: input.firstCustomerModeActive,
    buyerLeadCount: input.buyerLeadCount,
    recentEvents: input.recentEvents,
    siteId: input.siteId,
    now: input.now,
  });
  list = buyerStep.opportunities;

  const externalStep = promoteExternalMechanism({
    opportunities: list,
    firstCustomerModeActive: input.firstCustomerModeActive,
    purchases: input.purchases,
    topN: input.topN,
  });
  list = externalStep.opportunities;

  const capStep = capPerCycleActionRepeats({
    opportunities: list,
    topN: input.topN,
  });
  list = capStep.opportunities;

  return {
    opportunities: list,
    forcedChannelDiscover: channelStep.forced,
    forcedBuyerDiscovery: buyerStep.forced,
    forcedExternal: externalStep.forced,
    cappedActionTypes: capStep.cappedActionTypes,
    externalMechanismInTopN: firstExternalMechanismInTopN(list, input.topN),
  };
}
