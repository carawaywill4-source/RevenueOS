/**
 * Explicit business lifecycle state machine.
 * No subsystem invents state independently.
 */

import type { BusinessLifecycleState } from "./types";

const TRANSITIONS: Record<BusinessLifecycleState, BusinessLifecycleState[]> = {
  DISCOVERED: ["INVESTIGATING", "RETIRED"],
  INVESTIGATING: ["ADMISSION_REVIEW", "RETIRED"],
  ADMISSION_REVIEW: ["INCUBATING", "BUILDING", "READY", "RETIRED"],
  INCUBATING: ["BUILDING", "RETIRING"],
  BUILDING: ["CERTIFYING", "RETIRING"],
  CERTIFYING: ["READY", "BUILDING", "RETIRING"],
  READY: ["FIRST_CUSTOMER", "RETIRING"],
  FIRST_CUSTOMER: ["VALIDATING", "TURNAROUND", "RETIRING"],
  VALIDATING: ["REPEATABLE", "TURNAROUND", "FIRST_CUSTOMER"],
  REPEATABLE: ["PROFITABLE", "GROWTH", "TURNAROUND"],
  PROFITABLE: ["GROWTH", "SCALE", "HARVEST", "TURNAROUND"],
  GROWTH: ["SCALE", "CHAMPION", "TURNAROUND", "HARVEST"],
  SCALE: ["CHAMPION", "HARVEST", "TURNAROUND"],
  CHAMPION: ["SCALE", "HARVEST", "TURNAROUND"],
  TURNAROUND: ["VALIDATING", "HARVEST", "RETIRING", "FIRST_CUSTOMER"],
  HARVEST: ["RETIRING", "PROFITABLE"],
  RETIRING: ["RETIRED", "HARVEST"],
  RETIRED: [],
};

export function canTransition(
  from: BusinessLifecycleState,
  to: BusinessLifecycleState,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function transitionBusiness(
  from: BusinessLifecycleState,
  to: BusinessLifecycleState,
): { ok: boolean; state: BusinessLifecycleState; reason: string } {
  if (from === to) {
    return { ok: true, state: from, reason: "noop" };
  }
  if (!canTransition(from, to)) {
    return {
      ok: false,
      state: from,
      reason: `illegal_transition:${from}->${to}`,
    };
  }
  return { ok: true, state: to, reason: `transitioned:${from}->${to}` };
}

export function lifecycleBlocksAcquisition(
  state: BusinessLifecycleState,
): boolean {
  return state === "RETIRING" || state === "RETIRED" || state === "DISCOVERED";
}

export function isChampion(state: BusinessLifecycleState): boolean {
  return state === "CHAMPION";
}
