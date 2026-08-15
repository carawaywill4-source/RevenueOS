/**
 * NEXUS organism cycle — coordinates TITAN / CORTEX / APEX / FORGE without
 * replacing their intelligence. Records ownership, emits coordination events,
 * and exposes tonight's portfolio objective.
 */

import type { ApexCycleResult } from "../apex/types";
import type { SiteAdapter } from "../adapters/types";
import type { TitanCycleResult } from "../titan/types";
import {
  appendEvent,
  createEventLedger,
  makeRevenueEvent,
  type EventLedger,
} from "./event-ledger";
import { createKillSwitchState, type KillSwitchState } from "./kill-switches";
import { createLockStore, type LockStore } from "./locks";
import type {
  BusinessLifecycleState,
  HealthState,
  NexusMode,
  SubsystemHealth,
} from "./types";

export type NexusRuntimeState = {
  mode: NexusMode;
  ledger: EventLedger;
  locks: LockStore;
  kills: KillSwitchState;
  lifecycle: Record<string, BusinessLifecycleState>;
  world_version: Record<string, string>;
  health: SubsystemHealth[];
};

export type NexusCycleResult = {
  business_id: string;
  mode: NexusMode;
  portfolio_objective: string;
  binding_constraint: string;
  resource_favor: string;
  apex_authorized: boolean | null;
  apex_action: string | null;
  titan_decision: string | null;
  cortex_note: string | null;
  ownership: {
    strategy: "TITAN";
    knowledge: "CORTEX";
    acquisition: "APEX";
    company: "FORGE";
    coordination: "NEXUS";
    capital: "CAPITAL_GOVERNOR";
  };
  events_emitted: number;
  health: SubsystemHealth[];
  hourly_check: {
    revenue_usd: number;
    visitors: number;
  };
};

const runtimeSingleton: { state: NexusRuntimeState | null } = { state: null };

export function getNexusRuntime(): NexusRuntimeState {
  if (!runtimeSingleton.state) {
    runtimeSingleton.state = {
      mode: (process.env.REVENUEOS_MODE as NexusMode) || "STAGING",
      ledger: createEventLedger(),
      locks: createLockStore(),
      kills: createKillSwitchState(),
      lifecycle: {},
      world_version: {},
      health: [],
    };
  }
  return runtimeSingleton.state;
}

export function resetNexusRuntimeForTests(): void {
  runtimeSingleton.state = null;
}

function healthOf(
  subsystem: SubsystemHealth["subsystem"],
  state: HealthState,
  objective: string | null,
  action: string | null,
): SubsystemHealth {
  return {
    subsystem,
    state,
    last_success_at: state === "HEALTHY" ? new Date().toISOString() : null,
    last_failure_at: state === "OFFLINE" ? new Date().toISOString() : null,
    current_objective: objective,
    current_action: action,
    errors: 0,
    workload: 1,
    degraded_capabilities: [],
  };
}

/**
 * Run NEXUS coordination after APEX + TITAN ticks.
 * Does not invent strategy — consolidates organism state.
 */
export async function runNexusCycle(input: {
  adapter: SiteAdapter;
  apex?: ApexCycleResult | null;
  titan?: TitanCycleResult | null;
  hourRevenueUsd?: number;
  hourVisitors?: number;
  persist?: boolean;
}): Promise<NexusCycleResult> {
  const runtime = getNexusRuntime();
  const businessId = input.adapter.id;
  const titan = input.titan ?? null;
  const apex = input.apex ?? null;

  const portfolioObjective =
    titan?.objective_tree.primary_objective ??
    "FIRST / NEXT ATTRIBUTED STRANGER SALE";
  const bindingConstraint =
    titan?.constraints.primary ?? apex?.bottleneck ?? "unknown";
  const favor = titan?.decision.resource_allocation ?? "APEX";

  let ledger = runtime.ledger;
  const tickEvt = makeRevenueEvent({
    event_type: "nexus.organism.tick",
    producer: "NEXUS",
    business_id: businessId,
    trace_id: apex?.trace_id ?? titan?.decision.decision_id ?? null,
    decision_id: titan?.decision.decision_id ?? null,
    payload: {
      portfolio_objective: portfolioObjective,
      binding_constraint: bindingConstraint,
      favor,
      apex_bottleneck: apex?.bottleneck ?? null,
      apex_authorized: apex?.decision?.authorized ?? null,
      titan_decision: titan?.decision.decision ?? null,
      mode: runtime.mode,
    },
    data_quality: "HIGH",
  });
  ledger = appendEvent(ledger, tickEvt);

  if (titan) {
    ledger = appendEvent(
      ledger,
      makeRevenueEvent({
        event_type: "titan.allocation.changed",
        producer: "TITAN",
        business_id: businessId,
        decision_id: titan.decision.decision_id,
        payload: {
          favor,
          constraint: bindingConstraint,
          confidence: titan.decision.confidence,
        },
      }),
    );
  }
  if (apex?.decision?.authorized) {
    ledger = appendEvent(
      ledger,
      makeRevenueEvent({
        event_type: "apex.action.proposed",
        producer: "APEX",
        business_id: businessId,
        trace_id: apex.trace_id,
        payload: {
          action: apex.decision.selected_action,
          bottleneck: apex.bottleneck,
        },
      }),
    );
  }

  const health: SubsystemHealth[] = [
    healthOf("NEXUS", "HEALTHY", portfolioObjective, "coordinate"),
    healthOf(
      "TITAN",
      titan ? "HEALTHY" : "DEGRADED",
      portfolioObjective,
      titan?.decision.decision ?? null,
    ),
    healthOf("CORTEX", "HEALTHY", "supply_executive_context", null),
    healthOf(
      "APEX",
      apex ? "HEALTHY" : "DEGRADED",
      "FAST_ACQUISITION",
      apex?.decision?.selected_action ?? null,
    ),
    healthOf("FORGE", "HEALTHY", "maintain_production_quality", null),
  ];

  if (input.persist !== false) {
    runtime.ledger = ledger;
    runtime.health = health;
    if (!runtime.lifecycle[businessId]) {
      runtime.lifecycle[businessId] = "READY";
    }
    runtime.world_version[businessId] =
      runtime.world_version[businessId] ?? "1";
  }

  // Persist a slim coordination receipt — never invent Experiment shape.
  try {
    const store = input.adapter.getExperimentStore();
    if (store.appendPursuitEvent && input.persist !== false) {
      await store.appendPursuitEvent({
        id: tickEvt.event_id,
        pursuitId: "nexus_organism",
        siteId: businessId,
        eventType: "learned",
        detail: {
          nexus: true,
          kind: "organism_tick",
          portfolio_objective: portfolioObjective,
          binding_constraint: bindingConstraint,
          favor,
          mode: runtime.mode,
          hour_revenue_usd: input.hourRevenueUsd ?? 0,
          hour_visitors: input.hourVisitors ?? 0,
        },
        createdAt: tickEvt.occurred_at,
      });
    }
  } catch {
    // Coordination must not break the commercial tick.
  }

  return {
    business_id: businessId,
    mode: runtime.mode,
    portfolio_objective: portfolioObjective,
    binding_constraint: String(bindingConstraint),
    resource_favor: String(favor),
    apex_authorized: apex?.decision?.authorized ?? null,
    apex_action: apex?.decision?.selected_action ?? null,
    titan_decision: titan?.decision.decision ?? null,
    cortex_note: null,
    ownership: {
      strategy: "TITAN",
      knowledge: "CORTEX",
      acquisition: "APEX",
      company: "FORGE",
      coordination: "NEXUS",
      capital: "CAPITAL_GOVERNOR",
    },
    events_emitted: 1 + (titan ? 1 : 0) + (apex?.decision?.authorized ? 1 : 0),
    health,
    hourly_check: {
      revenue_usd: input.hourRevenueUsd ?? 0,
      visitors: input.hourVisitors ?? 0,
    },
  };
}
