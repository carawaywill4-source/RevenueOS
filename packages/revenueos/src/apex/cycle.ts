/**
 * APEX commercial loop (one tick):
 * perceive → evidence gate → clocks → diagnose → generate → guard → govern → record
 *
 * Small-sample protection: insufficient traffic → FAST acquisition, not product mutation.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { SiteAdapter } from "../adapters/types";
import type { Observation } from "../types";
import { applyAttributionMlTick } from "./attribution-bridge";
import { diagnoseBottleneck } from "./bottleneck";
import {
  defaultEmptyState,
  loadApexState,
  saveApexState,
} from "./beliefs";
import { createEvidence, appendEvidence } from "./evidence-ledger";
import { assessCommercialDataQuality } from "./data-quality";
import { authorizeDecision, governAction } from "./governor";
import { leanDemandSignals, rankActionsForBottleneck } from "./priority";
import { newTraceId } from "./trace";
import {
  decisionConfidence,
} from "./evidence-sufficiency";
import { classifyActionClock, selectActiveClock } from "./learning-clocks";
import { guardExperiment } from "./experiment-guard";
import {
  disconfirmingTestsForBelief,
  rankByLearningValue,
} from "./learning-value";
import { aggregateSourceQuality } from "./qualified-exposure";
import {
  loadCapabilityManifest,
  persistCapabilityManifest,
  scopeGuardCapabilityManifest,
} from "../forge/capability-manifest";
import type {
  ApexCycleResult,
  ApexDecision,
  CommercialEvent,
} from "./types";

export type { ApexCycleResult } from "./types";

export async function runApexCycle(input: {
  adapter: SiteAdapter;
  observation?: Observation;
  commercialEvents?: CommercialEvent[];
}): Promise<ApexCycleResult> {
  const businessId = input.adapter.id;
  const store = input.adapter.getExperimentStore();
  const observation = input.observation ?? (await input.adapter.observe());
  const traceId = newTraceId();

  let state = await loadApexState(store, businessId);
  if (!state.beliefs.length) {
    state = defaultEmptyState(businessId);
  }

  let capability =
    (await loadCapabilityManifest(store, businessId)) ??
    (businessId === "scopeguard" ? scopeGuardCapabilityManifest() : null);
  if (capability && businessId === "scopeguard") {
    // Keep Stage/objective authoritative from FORGE seed while WTP unvalidated.
    capability = {
      ...scopeGuardCapabilityManifest(),
      ...capability,
      product: scopeGuardCapabilityManifest().product,
      apex_allowed_to_test: scopeGuardCapabilityManifest().apex_allowed_to_test,
      apex_requires_forge_approval_for:
        scopeGuardCapabilityManifest().apex_requires_forge_approval_for,
      primary_objective: "FIRST ATTRIBUTED STRANGER PURCHASE",
      current_business_stage: "FIRST_CUSTOMER",
      known_product_uncertainties:
        scopeGuardCapabilityManifest().known_product_uncertainties,
      forge_confidence: scopeGuardCapabilityManifest().forge_confidence,
    };
    await persistCapabilityManifest(store, capability);
  }

  const events = store.listPursuitEvents
    ? await store.listPursuitEvents(businessId, { limit: 300 })
    : [];

  const dq = assessCommercialDataQuality({
    events: input.commercialEvents ?? [],
    pursuitEvents: events,
    stripePurchaseCount: observation.money?.purchases,
  });

  const market = input.adapter.getMarketSignals
    ? await input.adapter.getMarketSignals()
    : undefined;
  const demand = leanDemandSignals({
    businessId,
    demandNotes: market?.demandNotes,
    industry: (await input.adapter.getContext()).industry,
  });

  const bottleneck = diagnoseBottleneck({
    observation,
    state,
    recentEvents: events,
  });
  const evidence = bottleneck.evidence;
  const firstCustomerMode =
    (capability?.current_business_stage === "FIRST_CUSTOMER") ||
    (state.purchases === 0 && state.revenue_usd === 0);
  const clockSel = selectActiveClock({
    evidenceLevel: evidence.evidence_level,
    firstCustomerMode,
    purchases: state.purchases,
    manifestPrimaryObjective: capability?.primary_objective,
    forgeConfidence: capability?.forge_confidence,
  });

  const ranked = rankActionsForBottleneck({
    bottleneck: bottleneck.kind,
    demand,
    evidenceLevel: evidence.evidence_level,
    acquisitionUrgency: clockSel.acquisitionUrgency,
  });

  const byValue = rankByLearningValue({
    actions: ranked.filter((a) => a.score > -50),
    evidenceLevel: evidence.evidence_level,
    firstCustomerMode,
  });

  const constitutionBlocks: string[] = [];
  let productMutationBlocked = clockSel.productMutationBlocked;
  let decision: ApexDecision | null = null;

  // Pick first action that passes experiment guard + governor.
  for (const lv of byValue) {
    const candidate = ranked.find((a) => a.action === lv.action);
    if (!candidate) continue;

    if (
      productMutationBlocked &&
      classifyActionClock(candidate.action) === "SLOW_PRODUCT_CONVERSION" &&
      candidate.action !== "checkout_friction_audit"
    ) {
      constitutionBlocks.push(
        `first_customer_mode:block_${candidate.action} — favor exposure/distribution`,
      );
      continue;
    }

    const expGuard = guardExperiment({
      action: candidate.action,
      evidenceLevel: evidence.evidence_level,
      recentDecisions: state.recent_decisions,
      capabilityManifest: capability,
      productMutationBlocked,
      bottleneck: bottleneck.kind,
    });
    if (!expGuard.allowed) {
      if (
        expGuard.reason.includes("product_mutation") ||
        expGuard.reason.includes("forge_approval_required")
      ) {
        productMutationBlocked = true;
      }
      constitutionBlocks.push(expGuard.reason);
      continue;
    }

    const gate = governAction({ action: candidate.action });
    if (!gate.authorized) {
      constitutionBlocks.push(gate.detail);
      continue;
    }

    const baseConf = Math.min(0.75, 0.35 + candidate.score * 0.2);
    const confidence = decisionConfidence({
      baseConfidence: baseConf * expGuard.attributionConfidenceMultiplier,
      evidence,
      collided: expGuard.isolation === "collided",
    });

    const disconfirm = state.beliefs[0]
      ? disconfirmingTestsForBelief(state.beliefs[0].statement)
      : disconfirmingTestsForBelief("");

    decision = authorizeDecision({
      decision_id: newId("adec"),
      business_id: businessId,
      timestamp: new Date().toISOString(),
      trace_id: traceId,
      context_summary: `clock=${clockSel.clock}; evidence=${evidence.evidence_level}; bottleneck=${bottleneck.kind}; q_visits=${evidence.qualified_sample_size}`,
      belief_ids: state.beliefs.map((b) => b.belief_id),
      bottleneck: bottleneck.kind,
      bottleneck_detail: bottleneck.detail,
      learning_clock: lv.clock,
      evidence_level: evidence.evidence_level,
      diagnosis_evidence: evidence,
      primary_objective: clockSel.primaryObjective,
      alternatives_considered: byValue.slice(0, 5).map((a) => ({
        action: a.action,
        expected_value: a.expected_commercial_value,
        information_value: a.expected_information_gain,
        cost: a.cost,
        risk: gate.riskClass,
        clock: a.clock,
      })),
      selected_action: candidate.action,
      expected_outcome: candidate.hypothesis,
      expected_value: candidate.expected_value,
      confidence,
      risk_class: gate.riskClass,
      authorized: gate.authorized,
      authorization_detail: `${gate.detail}; ${expGuard.reason}`,
      evidence_ids: [],
      why_this_action: candidate.hypothesis,
      why_now: clockSel.primaryObjective,
      why_this_business: businessId,
      why_this_channel: candidate.channel,
      why_this_audience: candidate.audience,
      counterfactual_note: lv.counterfactual_note,
      disconfirming_tests: disconfirm.slice(0, 4),
      experiment_isolation: expGuard.isolation,
    });

    const evidenceRec = createEvidence({
      type: "INFERRED_SIGNAL",
      source: "apex.cycle",
      statement: `Selected ${candidate.action} under ${evidence.evidence_level} / ${lv.clock}`,
      businessId,
      confidence: decision.confidence,
      traceId,
      payload: {
        decision_id: decision.decision_id,
        evidence_level: evidence.evidence_level,
        primary_objective: clockSel.primaryObjective,
      },
    });
    decision.evidence_ids = [evidenceRec.evidence_id];
    await appendEvidence(store, evidenceRec);
    await persistDecision(store, decision);
    break;
  }

  const ml = await applyAttributionMlTick({ store, businessId, events });
  const sourceQuality = aggregateSourceQuality(events, demand[0]);

  state.last_bottleneck = bottleneck.kind;
  state.last_trace_id = traceId;
  if (decision) {
    state.recent_decisions = [decision, ...state.recent_decisions].slice(0, 50);
  }
  state.qualified_visits = Math.max(
    state.qualified_visits,
    evidence.qualified_sample_size,
  );
  state.checkouts = Math.max(state.checkouts, observation.funnel.checkouts ?? 0);
  state.purchases = Math.max(state.purchases, observation.money?.purchases ?? 0);
  state.revenue_usd = Math.max(
    state.revenue_usd,
    observation.money?.revenueUsd ?? 0,
  );
  if (productMutationBlocked) {
    state.learning_notes = [
      `evidence_gate:${evidence.evidence_level}:product_mutation_blocked`,
      ...state.learning_notes,
    ].slice(0, 100);
  }
  if (sourceQuality[0]) {
    state.learning_notes = [
      `best_source_quality:${sourceQuality[0].source}=${sourceQuality[0].score}`,
      ...state.learning_notes,
    ].slice(0, 100);
  }
  await saveApexState(store, state);

  return {
    ok: true,
    business_id: businessId,
    trace_id: traceId,
    bottleneck: bottleneck.kind,
    bottleneck_detail: bottleneck.detail,
    demand_signals: demand,
    decision,
    beliefs_updated: state.beliefs,
    data_quality_issues: dq.map((d) => `${d.severity}:${d.code}:${d.detail}`),
    attribution_ml_applied: ml.applied,
    constitution_blocks: constitutionBlocks,
    evidence_level: evidence.evidence_level,
    learning_clock: clockSel.clock,
    diagnosis_evidence: evidence,
    first_customer_mode: firstCustomerMode,
    product_mutation_blocked: productMutationBlocked,
    acquisition_urgency: clockSel.acquisitionUrgency,
    capability_manifest: capability
      ? {
          forge_confidence: capability.forge_confidence,
          primary_objective: capability.primary_objective,
          stage: capability.current_business_stage,
          apex_allowed_to_test: [...capability.apex_allowed_to_test],
          known_product_uncertainties: [
            ...capability.known_product_uncertainties,
          ],
        }
      : undefined,
  };
}

async function persistDecision(store: ExperimentStore, decision: ApexDecision) {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("pevt"),
    pursuitId: "apex_decision",
    siteId: decision.business_id,
    eventType: "learned",
    detail: {
      apex: true,
      kind: "apex_decision",
      decision,
      trace_id: decision.trace_id,
      evidence_level: decision.evidence_level,
      learning_clock: decision.learning_clock,
      actionClass: "distribution",
    },
    createdAt: decision.timestamp,
  });
}
