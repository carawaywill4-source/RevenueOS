import { createHash } from "node:crypto";
import type {
  Observation,
  Opportunity,
  PlannerDecision,
  PlannerRunRecord,
  SafeAction,
} from "../types";

export const PLANNER_DAILY_CALL_LIMIT = 48;
export const PLANNER_DAILY_SPEND_LIMIT_USD = 0.5;

export function fingerprintPlannerInput(input: {
  observation: Observation;
  opportunities: Opportunity[];
  safeActions: SafeAction[];
}): string {
  const payload = {
    bottleneck: input.observation.bottleneck,
    funnel: input.observation.funnel,
    opportunityIds: input.opportunities.map((item) => item.id),
    safeActionTypes: input.safeActions.map((item) => item.type),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

export function plannerRunsToday(
  runs: PlannerRunRecord[],
  now = new Date(),
): PlannerRunRecord[] {
  const day = now.toISOString().slice(0, 10);
  return runs.filter((run) => run.createdAt.slice(0, 10) === day);
}

export function checkPlannerQuota(
  runs: PlannerRunRecord[],
  now = new Date(),
): { allowed: boolean; reason?: string; callsToday: number; spendToday: number } {
  const today = plannerRunsToday(runs, now);
  const callsToday = today.length;
  const spendToday = today.reduce(
    (sum, run) => sum + (run.decision.usage?.estimatedCostUsd ?? 0),
    0,
  );
  if (callsToday >= PLANNER_DAILY_CALL_LIMIT) {
    return {
      allowed: false,
      reason: `Daily planner call limit reached (${PLANNER_DAILY_CALL_LIMIT}).`,
      callsToday,
      spendToday,
    };
  }
  if (spendToday >= PLANNER_DAILY_SPEND_LIMIT_USD) {
    return {
      allowed: false,
      reason: `Daily planner spend limit reached ($${PLANNER_DAILY_SPEND_LIMIT_USD.toFixed(2)}).`,
      callsToday,
      spendToday,
    };
  }
  return { allowed: true, callsToday, spendToday };
}

/** Reject planner output that references unknown opportunities or unsafe actions. */
export function validatePlannerSelection(
  proposed: PlannerDecision,
  opportunities: Opportunity[],
  safeActions: SafeAction[],
): { decision: PlannerDecision; policyRejected: boolean; policyReason?: string } {
  const knownIds = new Set(opportunities.map((item) => item.id));
  const executableIds = new Set(
    opportunities.filter((item) => item.safeActionType).map((item) => item.id),
  );
  const selected = proposed.selectedOpportunityIds.filter((id) => knownIds.has(id));
  const rejected = [
    ...proposed.rejectedOpportunityIds.filter((id) => knownIds.has(id)),
    ...proposed.selectedOpportunityIds.filter((id) => !knownIds.has(id)),
  ];
  const nonExecutable = selected.filter((id) => !executableIds.has(id));
  if (nonExecutable.length) {
    return {
      decision: {
        ...proposed,
        source: "deterministic",
        selectedOpportunityIds: selected.filter((id) => executableIds.has(id)),
        rejectedOpportunityIds: [...new Set([...rejected, ...nonExecutable])],
        fallbackReason:
          proposed.fallbackReason ??
          `Rejected non-executable opportunities: ${nonExecutable.join(", ")}`,
      },
      policyRejected: true,
      policyReason: `Selected opportunities without safe actions: ${nonExecutable.join(", ")}`,
    };
  }
  const allowedTypes = new Set(safeActions.map((item) => item.type));
  const selectedTypes = selected
    .map((id) => opportunities.find((item) => item.id === id)?.safeActionType)
    .filter((value): value is string => Boolean(value));
  const unknownTypes = selectedTypes.filter((type) => !allowedTypes.has(type));
  if (unknownTypes.length) {
    return {
      decision: {
        ...proposed,
        source: "deterministic",
        selectedOpportunityIds: [],
        rejectedOpportunityIds: [...new Set([...rejected, ...selected])],
        fallbackReason:
          proposed.fallbackReason ??
          `Rejected planner action types not in adapter registry: ${unknownTypes.join(", ")}`,
      },
      policyRejected: true,
      policyReason: `Planner selected disallowed action types: ${unknownTypes.join(", ")}`,
    };
  }
  return {
    decision: {
      ...proposed,
      selectedOpportunityIds: selected.slice(0, 3),
      rejectedOpportunityIds: [...new Set(rejected)].slice(0, 12),
    },
    policyRejected: false,
  };
}
