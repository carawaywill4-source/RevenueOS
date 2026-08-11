import { test } from "node:test";
import assert from "node:assert/strict";
import { governAction } from "./governor";
import { classifyTrafficQuality, shouldLearnFromTraffic } from "./traffic-quality";
import { createEvidence } from "./evidence-ledger";
import { commercialEventFromBeacon } from "./commercial-events";
import { diagnoseBottleneck } from "./bottleneck";
import { defaultEmptyState } from "./beliefs";
import { guardExperiment } from "./experiment-guard";
import { selectActiveClock } from "./learning-clocks";
import {
  buildDiagnosisEvidence,
  decisionConfidence,
} from "./evidence-sufficiency";
import type { Observation } from "../types";

test("constitution blocks paid ads and autonomous spend", () => {
  const paid = governAction({ action: "google_ads_campaign" });
  assert.equal(paid.authorized, false);
  assert.match(paid.detail, /NO_PAID_ADS/);

  const spend = governAction({ action: "purchase_credits_openai" });
  assert.equal(spend.authorized, false);
  assert.match(spend.detail, /NO_AUTONOMOUS_SPEND/);

  const owned = governAction({ action: "publish_discovery_door" });
  assert.equal(owned.authorized, true);
});

test("bot traffic is RAW and not learned from", () => {
  const bot = classifyTrafficQuality({ ua: "Googlebot/2.1" });
  assert.equal(bot.quality, "RAW");
  assert.equal(shouldLearnFromTraffic(bot.quality), false);

  const human = classifyTrafficQuality({
    ua: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120",
    signedAttribution: true,
  });
  assert.equal(human.quality, "QUALIFIED");
  assert.equal(shouldLearnFromTraffic(human.quality), true);
});

test("synthetic evidence cannot be strong", () => {
  const e = createEvidence({
    type: "SYNTHETIC",
    source: "llm",
    statement: "LLM said freelancers will buy",
    businessId: "scopeguard",
    confidence: 0.99,
  });
  assert.equal(e.synthetic, true);
  assert.ok(e.confidence <= 0.15);
});

test("commercial event schema from beacon", () => {
  const ce = commercialEventFromBeacon({
    event: {
      kind: "page_view",
      siteId: "scopeguard",
      url: "https://scopeguard.example/?utm_source=reddit",
      path: "/",
      ua: "Mozilla/5.0",
    },
    trafficQuality: "LIKELY_HUMAN",
    traceId: "atrace_test",
    source: "reddit",
  });
  assert.equal(ce.event_type, "VISIT");
  assert.equal(ce.business_id, "scopeguard");
  assert.equal(ce.trace_id, "atrace_test");
  assert.ok(ce.confidence > 0 && ce.confidence < 1);
});

function emptyObs(landingViews: number): Observation {
  return {
    observedAt: new Date().toISOString(),
    money: {
      revenueUsd: 0,
      purchases: 0,
      awaitingPayment: 0,
      refunded: 0,
      estimatedVariableCostUsd: 0,
      estimatedProfitUsd: 0,
      mrr: 0,
      arr: 0,
    },
    funnel: {
      steps: [],
      largestDrop: null,
      landingViews,
      checkouts: 0,
      fulfillmentFailed: 0,
    },
    bottleneck: {
      level: 1,
      label: "awareness",
      detail: "none",
    },
    openExperimentIds: [],
    errors: [],
  };
}

test("scopeguard with zero visits diagnoses NO_IMPRESSIONS", () => {
  const d = diagnoseBottleneck({
    observation: emptyObs(0),
    state: defaultEmptyState("scopeguard"),
  });
  assert.equal(d.kind, "NO_IMPRESSIONS");
  assert.equal(d.evidence.evidence_level, "NO_EVIDENCE");
});

test("two visits is insufficient — not offer failure", () => {
  const d = diagnoseBottleneck({
    observation: emptyObs(2),
    state: defaultEmptyState("scopeguard"),
  });
  assert.ok(
    d.evidence.evidence_level === "NO_EVIDENCE" ||
      d.evidence.evidence_level === "WEAK_SIGNAL",
  );
  assert.match(
    d.detail,
    /NOT evidence the offer is bad|No engagement observed|acquire more qualified|No qualified visits/i,
  );
  assert.doesNotMatch(d.detail, /offer mismatch likely/i);
});

test("small-sample protection blocks product mutation", () => {
  const blocked = guardExperiment({
    action: "offer_clarity_update",
    evidenceLevel: "WEAK_SIGNAL",
  });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /small_sample_protection/);

  const acquire = guardExperiment({
    action: "publish_discovery_door",
    evidenceLevel: "WEAK_SIGNAL",
  });
  assert.equal(acquire.allowed, true);

  const repair = guardExperiment({
    action: "checkout_friction_audit",
    evidenceLevel: "NO_EVIDENCE",
  });
  assert.equal(repair.allowed, true);
});

test("action cooldown blocks repeated offer_clarity without new signal", () => {
  const recent = [
    {
      decision_id: "d1",
      business_id: "bidforge",
      timestamp: new Date().toISOString(),
      selected_action: "offer_clarity_update",
      bottleneck: "CLICKS_NO_ENGAGEMENT",
    },
  ] as unknown as import("./types").ApexDecision[];
  const blocked = guardExperiment({
    action: "offer_clarity_update",
    evidenceLevel: "ACTIONABLE_SIGNAL",
    recentDecisions: recent,
    bottleneck: "CLICKS_NO_ENGAGEMENT",
  });
  assert.equal(blocked.allowed, false);
  assert.match(blocked.reason, /action_cooldown/);

  const diversify = guardExperiment({
    action: "demand_radar_sweep",
    evidenceLevel: "ACTIONABLE_SIGNAL",
    recentDecisions: recent,
    bottleneck: "CLICKS_NO_ENGAGEMENT",
  });
  assert.equal(diversify.allowed, true);
});

test("stale lifetime views without fresh exposure → NO_IMPRESSIONS", () => {
  const now = new Date().toISOString();
  const d = diagnoseBottleneck({
    observation: {
      ...emptyObs(40),
      hourPulse: {
        windowStart: now,
        windowEnd: now,
        landingViews: 0,
        checkouts: 0,
        purchases: 0,
        revenueUsd: 0,
        zeroHour: true,
      },
    },
    state: {
      ...defaultEmptyState("bidforge"),
      qualified_visits: 40,
    },
  });
  assert.equal(d.kind, "NO_IMPRESSIONS");
  assert.match(d.detail, /fresh exposure|distribution/i);
});

test("FAST clock under first customer + insufficient evidence", () => {
  const sel = selectActiveClock({
    evidenceLevel: "NO_EVIDENCE",
    firstCustomerMode: true,
    purchases: 0,
  });
  assert.equal(sel.clock, "FAST_ACQUISITION");
  assert.equal(sel.productMutationBlocked, true);
  assert.equal(sel.acquisitionUrgency, "critical");
  assert.match(sel.primaryObjective, /FIRST ATTRIBUTED STRANGER/i);
});

test("decision confidence capped by tiny samples", () => {
  const evidence = buildDiagnosisEvidence({
    counts: {
      rawVisits: 0,
      visits: 2,
      qualifiedVisits: 2,
      engagements: 0,
      intents: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
      sourceMix: { unknown: 2 },
    },
  });
  const c = decisionConfidence({ baseConfidence: 0.9, evidence });
  assert.ok(c <= 0.25);
});
