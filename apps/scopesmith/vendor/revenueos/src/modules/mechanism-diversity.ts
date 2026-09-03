/**
 * Mechanism diversity enforcement.
 *
 * When we enqueue a wave of pursuits, we cap the number of jobs sharing the
 * same acquisition mechanism (owned_content, owned_distribution, direct_outreach,
 * community_participation, external_placement, conversion_optimization). This
 * prevents the "publish 6 pages every hour" collapse where every business tries
 * the same family regardless of market.
 *
 * If mechanisms have been banned by pattern posteriors, the enqueue prefers the
 * unbanned mechanism classes so a failed strategy is not merely re-tried under
 * a different pattern name.
 */

import type { Opportunity } from "../types";
import { classifyMechanism, type MechanismClass } from "./action-class";

export type DiversityInput = {
  opportunities: Opportunity[];
  maxPerMechanism?: number;
  bannedMechanisms?: Set<MechanismClass>;
  requireUnbannedFirst?: boolean;
};

const DEFAULT_MAX_PER_MECHANISM = 3;

export function enforceMechanismDiversity(input: DiversityInput): Opportunity[] {
  const cap = input.maxPerMechanism ?? DEFAULT_MAX_PER_MECHANISM;
  const banned = input.bannedMechanisms ?? new Set<MechanismClass>();
  const requireUnbanned = input.requireUnbannedFirst ?? banned.size > 0;

  const counts = new Map<MechanismClass, number>();
  const sorted = [...input.opportunities].sort((a, b) => b.score - a.score);

  const unbanned: Opportunity[] = [];
  const bannedList: Opportunity[] = [];
  for (const opp of sorted) {
    const mechanism = classifyMechanism({
      actionType: opp.safeActionType,
      patternKey: opp.patternKey,
      category: opp.category,
    });
    (banned.has(mechanism) ? bannedList : unbanned).push({
      ...opp,
      // Attach mechanism as a tag on the opportunity for downstream inspection.
      // We piggy-back on notes/patternKey; leave scores untouched here.
    });
  }

  const output: Opportunity[] = [];
  const consider = (opp: Opportunity) => {
    const mechanism = classifyMechanism({
      actionType: opp.safeActionType,
      patternKey: opp.patternKey,
      category: opp.category,
    });
    const used = counts.get(mechanism) ?? 0;
    if (used >= cap) return false;
    counts.set(mechanism, used + 1);
    output.push(opp);
    return true;
  };

  const orderedGroups = requireUnbanned ? [unbanned, bannedList] : [unbanned];
  for (const group of orderedGroups) for (const opp of group) consider(opp);
  if (!requireUnbanned) for (const opp of bannedList) consider(opp);

  return output;
}

/**
 * Given a list of banned mechanisms, describe the next legally-available
 * mechanism classes RevenueOS should be attempting. Used by capability-gaps
 * to surface owner-asks when the system has run out of executors.
 */
export function nextExecutableMechanisms(banned: Set<MechanismClass>): MechanismClass[] {
  const priority: MechanismClass[] = [
    "owned_content",
    "owned_distribution",
    "external_placement",
    "community_participation",
    "direct_outreach",
    "product_iteration",
    "conversion_optimization",
  ];
  return priority.filter((m) => !banned.has(m));
}
