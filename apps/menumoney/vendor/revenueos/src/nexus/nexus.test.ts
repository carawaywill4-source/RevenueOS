import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acknowledgeExternalEvent,
  appendEvent,
  createEventLedger,
  makeRevenueEvent,
  markIdempotencyCommitted,
  rebuildDerivedCounts,
  wasIdempotencyCommitted,
} from "./event-ledger";
import { evaluateConflict } from "./conflict-matrix";
import { createKillSwitchState, setKillSwitch } from "./kill-switches";
import { claimWork, createLockStore, releaseWork, resourceKey } from "./locks";
import { evaluatePolicy, policyForCommand } from "./policy-gate";
import {
  canTransition,
  lifecycleBlocksAcquisition,
  transitionBusiness,
} from "./lifecycle";
import { detectExperimentCollision } from "./experiment-collision";
import { makeCommand, runActionPipeline } from "./action-pipeline";
import { formatHourlyCheck, hourlyCheckSubject } from "./hourly-check";

test("events are append-only facts; corrections do not rewrite", () => {
  let ledger = createEventLedger();
  const a = makeRevenueEvent({
    event_type: "purchase.completed",
    producer: "STRIPE",
    business_id: "scopeguard",
    payload: { amount: 49 },
  });
  ledger = appendEvent(ledger, a);
  const correction = makeRevenueEvent({
    event_type: "refund.completed",
    producer: "STRIPE",
    business_id: "scopeguard",
    causation_id: a.event_id,
    payload: { corrects: a.event_id },
  });
  ledger = appendEvent(ledger, correction);
  assert.equal(ledger.events[0]?.payload.amount, 49);
  assert.equal(rebuildDerivedCounts(ledger).purchases, 1);
  assert.equal(rebuildDerivedCounts(ledger).refunds, 1);
});

test("duplicate external events ack without reprocessing", () => {
  let ledger = createEventLedger();
  const first = acknowledgeExternalEvent(ledger, "evt_stripe_1");
  assert.equal(first.duplicate, false);
  ledger = first.ledger;
  const second = acknowledgeExternalEvent(ledger, "evt_stripe_1");
  assert.equal(second.duplicate, true);
});

test("idempotency prevents double commercial mutation", async () => {
  let state = {
    ledger: createEventLedger(),
    locks: createLockStore(),
    kills: createKillSwitchState(),
    active_domains: [] as import("./types").MutationDomain[],
    active_surfaces: [],
    world_version: "1",
  };
  const command = makeCommand({
    issuer: "APEX",
    business_id: "scopeguard",
    reason: "test",
    requested_action: "publish_intent_page",
    expected_effect: "exposure",
    risk_class: "R2",
    domain: "ACQUISITION",
    idempotency_key: "apex:publish:scopeguard:1",
    authorized_against_version: "1",
  });
  let executions = 0;
  const exec = async () => {
    executions += 1;
    return { ok: true, effect: { published: true }, detail: "ok" };
  };
  const first = await runActionPipeline({ state, command, execute: exec });
  assert.equal(first.result.ok, true);
  assert.equal(executions, 1);
  const second = await runActionPipeline({
    state: first.state,
    command,
    execute: exec,
  });
  assert.equal(second.result.duplicate, true);
  assert.equal(executions, 1);
});

test("conflict matrix: landing experiment vs homepage redesign", () => {
  const r = evaluateConflict({
    proposed_domain: "PRODUCT",
    proposed_variables: ["homepage"],
    active_domains: ["LANDING"],
    active_surfaces: [
      {
        experiment_id: "exp1",
        business_id: "scopeguard",
        variables: ["homepage"],
        audience: "all",
        channel: "site",
        start: new Date().toISOString(),
        expected_end: new Date().toISOString(),
        domain: "LANDING",
        owner: "APEX",
      },
    ],
  });
  assert.equal(r.verdict, "CONFLICT");
});

test("conflict matrix: apex message + forge db repair allowed", () => {
  const r = evaluateConflict({
    proposed_domain: "INFRASTRUCTURE",
    active_domains: ["ACQUISITION"],
    active_surfaces: [],
  });
  assert.equal(r.verdict, "ALLOWED");
});

test("retirement blocks commercial mutations", () => {
  const r = evaluateConflict({
    proposed_domain: "ACQUISITION",
    active_domains: [],
    business_retiring: true,
  });
  assert.equal(r.verdict, "BLOCK");
});

test("kill switches deny acquisition", () => {
  let kills = createKillSwitchState();
  kills = setKillSwitch(kills, "PAUSE_ACQUISITION", true);
  const d = evaluatePolicy({
    actor: "apex",
    subsystem: "APEX",
    action: "publish_intent_page",
    domain: "ACQUISITION",
    business_id: "scopeguard",
    risk_class: "R2",
    kills,
  });
  assert.equal(d.verdict, "DENY");
});

test("CORTEX cannot execute commercial mutations", () => {
  const d = evaluatePolicy({
    actor: "cortex",
    subsystem: "CORTEX",
    action: "change_price",
    domain: "PRICING",
    business_id: "scopeguard",
    risk_class: "R3",
    kills: createKillSwitchState(),
  });
  assert.equal(d.verdict, "DENY");
  assert.match(d.reason, /cortex_no_commercial/);
});

test("stale command returns STATE_CHANGED_REPLAN", () => {
  const command = {
    command_id: "c1",
    issuer: "TITAN" as const,
    target: "RUNTIME" as const,
    business_id: "scopeguard",
    objective_id: null,
    reason: "price",
    requested_action: "update_price",
    expected_effect: "conversion",
    risk_class: "R3" as const,
    permissions_required: [] as string[],
    idempotency_key: "k1",
    deadline: null,
    preconditions: [] as string[],
    rollback_plan: "revert",
    verification_plan: "observe",
    domain: "PRICING" as const,
    authorized_against_version: "14",
    payload: {},
  };
  const d = policyForCommand(command, createKillSwitchState(), {
    world_version: "16",
  });
  assert.equal(d.verdict, "DENY");
  assert.equal(d.reason, "STATE_CHANGED_REPLAN");
});

test("lifecycle rejects illegal transitions", () => {
  assert.equal(canTransition("READY", "CHAMPION"), false);
  assert.equal(transitionBusiness("READY", "FIRST_CUSTOMER").ok, true);
  assert.equal(lifecycleBlocksAcquisition("RETIRED"), true);
});

test("experiment collision queues overlapping variables", () => {
  const now = new Date().toISOString();
  const decision = detectExperimentCollision({
    proposed: {
      experiment_id: "new",
      business_id: "scopeguard",
      variables: ["cta_copy"],
      audience: "all",
      channel: "landing",
      start: now,
      expected_end: now,
      domain: "LANDING",
      owner: "APEX",
    },
    active: [
      {
        experiment_id: "old",
        business_id: "scopeguard",
        variables: ["cta_copy"],
        audience: "all",
        channel: "landing",
        start: now,
        expected_end: now,
        domain: "LANDING",
        owner: "FORGE",
      },
    ],
  });
  assert.equal(decision.action, "QUEUE");
});

test("work claims serialize same resource", () => {
  let store = createLockStore();
  const rk = resourceKey({
    business_id: "scopeguard",
    domain: "INFRASTRUCTURE",
    facet: "deployment",
  });
  const a = claimWork(store, {
    resource_key: rk,
    domain: "INFRASTRUCTURE",
    owner: "worker-a",
  });
  assert.ok(a.claim);
  store = a.store;
  const b = claimWork(store, {
    resource_key: rk,
    domain: "INFRASTRUCTURE",
    owner: "worker-b",
  });
  assert.equal(b.claim, null);
  store = releaseWork(store, rk, "worker-a");
  const c = claimWork(store, {
    resource_key: rk,
    domain: "INFRASTRUCTURE",
    owner: "worker-b",
  });
  assert.ok(c.claim);
});

test("paid ads denied by constitution", () => {
  const d = evaluatePolicy({
    actor: "apex",
    subsystem: "APEX",
    action: "paid_ad_spend",
    domain: "CAPITAL",
    business_id: "scopeguard",
    risk_class: "R4",
    kills: createKillSwitchState(),
    no_paid_ads: true,
  });
  assert.equal(d.verdict, "DENY");
});

test("hourly check is revenue + visitors only", () => {
  const body = formatHourlyCheck({
    siteId: "scopeguard",
    revenueUsd: 12.5,
    visitors: 7,
  });
  assert.equal(body, "scopeguard: $12.50 · 7 visitors");
  assert.equal(
    hourlyCheckSubject({ siteId: "scopeguard", revenueUsd: 0, visitors: 3 }),
    "scopeguard: $0.00 · 3 visitors",
  );
  assert.doesNotMatch(body, /WHAT REVENUEOS DID|NEXT PURSUIT|Actions attempted/);
});

test("idempotency key marking is sticky", () => {
  let ledger = createEventLedger();
  assert.equal(wasIdempotencyCommitted(ledger, "k"), false);
  ledger = markIdempotencyCommitted(ledger, "k");
  assert.equal(wasIdempotencyCommitted(ledger, "k"), true);
});
