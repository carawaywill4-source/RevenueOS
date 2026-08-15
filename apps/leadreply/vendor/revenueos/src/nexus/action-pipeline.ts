/**
 * Action pipeline:
 * PROPOSE → VALIDATE → POLICY → RESERVE → LOCK → EXECUTE → VERIFY → COMMIT → EMIT → LEARN → RELEASE
 *
 * Commands are not events. Failures compensate and emit failure facts.
 */

import { newId } from "../ledger/store";
import { evaluateConflict } from "./conflict-matrix";
import {
  appendEvent,
  makeRevenueEvent,
  markIdempotencyCommitted,
  wasIdempotencyCommitted,
  type EventLedger,
} from "./event-ledger";
import type { KillSwitchState } from "./kill-switches";
import {
  claimWork,
  releaseWork,
  resourceKey,
  type LockStore,
} from "./locks";
import { policyForCommand } from "./policy-gate";
import type {
  ExperimentSurface,
  MutationDomain,
  PipelineResult,
  RevenueCommand,
  RevenueEvent,
} from "./types";

export type PipelineState = {
  ledger: EventLedger;
  locks: LockStore;
  kills: KillSwitchState;
  active_domains: MutationDomain[];
  active_surfaces: ExperimentSurface[];
  world_version: string;
  business_retiring?: boolean;
};

export type ExecuteFn = (command: RevenueCommand) => Promise<{
  ok: boolean;
  effect: Record<string, unknown> | null;
  detail: string;
}>;

export function makeCommand(input: {
  issuer: RevenueCommand["issuer"];
  target?: RevenueCommand["target"];
  business_id?: string | null;
  reason: string;
  requested_action: string;
  expected_effect: string;
  risk_class: RevenueCommand["risk_class"];
  domain: MutationDomain;
  idempotency_key?: string;
  authorized_against_version?: string | null;
  payload?: Record<string, unknown>;
}): RevenueCommand {
  return {
    command_id: newId("rev_cmd"),
    issuer: input.issuer,
    target: input.target ?? "RUNTIME",
    business_id: input.business_id ?? null,
    objective_id: null,
    reason: input.reason,
    requested_action: input.requested_action,
    expected_effect: input.expected_effect,
    risk_class: input.risk_class,
    permissions_required: [],
    idempotency_key:
      input.idempotency_key ??
      `${input.issuer}:${input.requested_action}:${input.business_id ?? "portfolio"}`,
    deadline: null,
    preconditions: [],
    rollback_plan: "compensate_or_noop",
    verification_plan: "observe_effect_or_error",
    domain: input.domain,
    authorized_against_version: input.authorized_against_version ?? null,
    payload: input.payload ?? {},
  };
}

export async function runActionPipeline(input: {
  state: PipelineState;
  command: RevenueCommand;
  execute: ExecuteFn;
  no_paid_ads?: boolean;
}): Promise<{ state: PipelineState; result: PipelineResult }> {
  let { ledger, locks } = input.state;
  const command = input.command;
  const events: RevenueEvent[] = [];

  // Duplicate protection
  if (wasIdempotencyCommitted(ledger, command.idempotency_key)) {
    return {
      state: input.state,
      result: {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        stage: "COMMIT",
        policy: "ALLOW",
        conflict: "ALLOWED",
        ok: true,
        duplicate: true,
        stale: false,
        events: [],
        detail: "idempotent_ack_no_reprocess",
        executed_effect: null,
      },
    };
  }

  // VALIDATE
  if (!command.requested_action || !command.idempotency_key) {
    return {
      state: input.state,
      result: {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        stage: "VALIDATE",
        policy: "DENY",
        conflict: "ALLOWED",
        ok: false,
        duplicate: false,
        stale: false,
        events: [],
        detail: "invalid_command",
        executed_effect: null,
      },
    };
  }

  // POLICY
  const policy = policyForCommand(command, input.state.kills, {
    no_paid_ads: input.no_paid_ads,
    world_version: input.state.world_version,
  });
  if (policy.verdict !== "ALLOW") {
    const stale = policy.reason === "STATE_CHANGED_REPLAN";
    const evt = makeRevenueEvent({
      event_type: "nexus.command.denied",
      producer: "NEXUS",
      business_id: command.business_id,
      risk_class: command.risk_class,
      payload: { reason: policy.reason, command_id: command.command_id },
    });
    ledger = appendEvent(ledger, evt);
    events.push(evt);
    return {
      state: { ...input.state, ledger },
      result: {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        stage: "POLICY",
        policy: policy.verdict,
        conflict: "ALLOWED",
        ok: false,
        duplicate: false,
        stale,
        events,
        detail: policy.reason,
        executed_effect: null,
      },
    };
  }

  // CONFLICT
  const conflict = evaluateConflict({
    proposed_domain: command.domain,
    proposed_variables: Array.isArray(command.payload.variables)
      ? (command.payload.variables as string[])
      : undefined,
    active_domains: input.state.active_domains,
    active_surfaces: input.state.active_surfaces,
    business_retiring: input.state.business_retiring,
    capital_reservation: command.domain === "CAPITAL",
  });
  if (conflict.verdict === "CONFLICT" || conflict.verdict === "BLOCK") {
    const evt = makeRevenueEvent({
      event_type: "nexus.command.conflict",
      producer: "NEXUS",
      business_id: command.business_id,
      payload: { reason: conflict.reason, verdict: conflict.verdict },
    });
    ledger = appendEvent(ledger, evt);
    events.push(evt);
    return {
      state: { ...input.state, ledger },
      result: {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        stage: "VALIDATE",
        policy: "ALLOW",
        conflict: conflict.verdict,
        ok: false,
        duplicate: false,
        stale: false,
        events,
        detail: conflict.reason,
        executed_effect: null,
      },
    };
  }

  // LOCK
  const key = resourceKey({
    business_id: command.business_id,
    domain: command.domain,
    facet: command.domain.toLowerCase(),
  });
  const claimed = claimWork(locks, {
    resource_key: key,
    domain: command.domain,
    owner: `nexus:${command.command_id}`,
    command_id: command.command_id,
    business_id: command.business_id,
  });
  locks = claimed.store;
  if (!claimed.claim) {
    return {
      state: { ...input.state, locks },
      result: {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        stage: "LOCK",
        policy: "ALLOW",
        conflict: "BLOCK",
        ok: false,
        duplicate: false,
        stale: false,
        events,
        detail: claimed.reason,
        executed_effect: null,
      },
    };
  }

  // EXECUTE
  let execOk = false;
  let effect: Record<string, unknown> | null = null;
  let detail = "";
  try {
    const out = await input.execute(command);
    execOk = out.ok;
    effect = out.effect;
    detail = out.detail;
  } catch (err) {
    execOk = false;
    detail = err instanceof Error ? err.message : String(err);
  }

  if (!execOk) {
    const failEvt = makeRevenueEvent({
      event_type: "nexus.command.failed",
      producer: "NEXUS",
      business_id: command.business_id,
      action_id: command.command_id,
      risk_class: command.risk_class,
      payload: { detail, rollback: command.rollback_plan },
    });
    ledger = appendEvent(ledger, failEvt);
    events.push(failEvt);
    locks = releaseWork(locks, key, `nexus:${command.command_id}`);
    return {
      state: { ...input.state, ledger, locks },
      result: {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        stage: "ROLLBACK",
        policy: "ALLOW",
        conflict: conflict.verdict,
        ok: false,
        duplicate: false,
        stale: false,
        events,
        detail,
        executed_effect: null,
      },
    };
  }

  // COMMIT + EMIT
  ledger = markIdempotencyCommitted(ledger, command.idempotency_key);
  const okEvt = makeRevenueEvent({
    event_type: "nexus.command.committed",
    producer: "NEXUS",
    business_id: command.business_id,
    action_id: command.command_id,
    risk_class: command.risk_class,
    payload: {
      action: command.requested_action,
      effect,
      detail,
    },
    data_quality: "HIGH",
  });
  ledger = appendEvent(ledger, okEvt);
  events.push(okEvt);

  // RELEASE
  locks = releaseWork(locks, key, `nexus:${command.command_id}`);

  return {
    state: {
      ...input.state,
      ledger,
      locks,
      active_domains: [...new Set([...input.state.active_domains, command.domain])],
    },
    result: {
      command_id: command.command_id,
      idempotency_key: command.idempotency_key,
      stage: "RELEASE",
      policy: "ALLOW",
      conflict: conflict.verdict,
      ok: true,
      duplicate: false,
      stale: false,
      events,
      detail,
      executed_effect: effect,
    },
  };
}
