/**
 * TITAN CEO loop (Phase 1 — Executive Truth):
 * OBSERVE → ORIENT → MODEL → DIAGNOSE → FORECAST (record) → DECIDE (recommend)
 *
 * No high-impact autonomous execution. Does not rewrite APEX or FORGE.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { SiteAdapter } from "../adapters/types";
import type { ApexCycleResult } from "../apex/types";
import {
  loadCapabilityManifest,
  scopeGuardCapabilityManifest,
  type BusinessCapabilityManifest,
} from "../forge/capability-manifest";
import { appendTruthClaims, createTruthClaim } from "./truth-ledger";
import { snapshotFromCommercialReality, buildExecutiveWorldModel } from "./world-model";
import { buildObjectiveTree } from "./objective-tree";
import { diagnoseExecutiveConstraints } from "./constraint-solver";
import { formExecutiveDecision, appendDecision } from "./decision-journal";
import { createForecast, appendForecast } from "./forecast-ledger";
import { buildSituationRoom } from "./situation-room";
import { assessProgressTowardNorthStar } from "./progress-skepticism";
import type { TitanCycleResult } from "./types";

const CYCLE_PURSUIT = "titan_cycle";

export async function runTitanCycle(input: {
  adapter: SiteAdapter;
  /** Prefer passing the just-completed APEX result — do not re-run APEX. */
  apex?: ApexCycleResult | null;
  capability?: BusinessCapabilityManifest | null;
  /** Simulated funnel overrides for evals (never invent production facts). */
  simulate?: {
    qualifiedVisits?: number;
    checkouts?: number;
    purchases?: number;
    revenueUsd?: number;
    evidenceLevel?: ApexCycleResult["evidence_level"];
  };
  persist?: boolean;
}): Promise<TitanCycleResult> {
  const businessId = input.adapter.id;
  const store = input.adapter.getExperimentStore();
  const observation = await input.adapter.observe();
  const now = new Date();

  let capability =
    input.capability ??
    (await loadCapabilityManifest(store, businessId)) ??
    (businessId === "scopeguard" ? scopeGuardCapabilityManifest(now) : null);

  const purchases =
    input.simulate?.purchases ?? observation.money.purchases ?? 0;
  const revenueUsd =
    input.simulate?.revenueUsd ?? observation.money.revenueUsd ?? 0;
  const checkouts =
    input.simulate?.checkouts ?? observation.funnel.checkouts ?? 0;

  let apex = input.apex ?? null;
  if (apex && input.simulate?.evidenceLevel) {
    apex = {
      ...apex,
      evidence_level: input.simulate.evidenceLevel,
      diagnosis_evidence: {
        ...apex.diagnosis_evidence,
        evidence_level: input.simulate.evidenceLevel,
        qualified_sample_size:
          input.simulate.qualifiedVisits ??
          apex.diagnosis_evidence.qualified_sample_size,
        sample_size:
          input.simulate.qualifiedVisits ??
          apex.diagnosis_evidence.sample_size,
      },
    };
  } else if (!apex && input.simulate) {
    // Eval-only synthetic apex slice — marked via claims as TITAN simulation.
    apex = {
      ok: true,
      business_id: businessId,
      trace_id: "titan_sim",
      bottleneck: "NO_IMPRESSIONS",
      bottleneck_detail: "simulated for TITAN eval",
      demand_signals: [],
      decision: null,
      beliefs_updated: [],
      data_quality_issues: ["SIMULATED_APEX_SLICE"],
      attribution_ml_applied: false,
      constitution_blocks: [],
      evidence_level: input.simulate.evidenceLevel ?? "WEAK_SIGNAL",
      learning_clock: "FAST_ACQUISITION",
      diagnosis_evidence: {
        sample_size: input.simulate.qualifiedVisits ?? 0,
        qualified_sample_size: input.simulate.qualifiedVisits ?? 0,
        observation_window: "sim",
        source_mix: {},
        buyer_intent_quality: 0.5,
        event_completeness: 0.5,
        confidence: 0.2,
        minimum_evidence_required: "ACTIONABLE_SIGNAL",
        contradictory_evidence: [],
        decision_reversibility: "high",
        evidence_level: input.simulate.evidenceLevel ?? "WEAK_SIGNAL",
        strongest_truth_tier: "THEORY",
        statement: "simulated evidence for TITAN regression",
      },
      first_customer_mode: purchases === 0,
      product_mutation_blocked: true,
      acquisition_urgency: "critical",
    };
  }

  const snapshot = snapshotFromCommercialReality({
    businessId,
    apex,
    capability,
    purchases,
    revenueUsd,
    strangerRevenueUsd: revenueUsd,
    checkouts: typeof checkouts === "number" ? checkouts : 0,
    qualifiedVisitsOverride: input.simulate?.qualifiedVisits,
  });

  const world = buildExecutiveWorldModel({
    businesses: [snapshot],
    now,
    notes: input.simulate
      ? ["simulate overrides active — not production commercial truth"]
      : [],
  });
  const objective_tree = buildObjectiveTree(snapshot);
  const constraints = diagnoseExecutiveConstraints({ snapshot, apex });
  const decision = formExecutiveDecision({ snapshot, constraints, apex, now });
  const situation = buildSituationRoom({ world, constraints, decision });

  const claims = [
    createTruthClaim({
      claim: `Stripe/observation purchases=${purchases}; revenue_usd=${revenueUsd}`,
      type: "FACT",
      source: "adapter.observe.money",
      confidence: 0.95,
      sample_size: purchases,
      business_id: businessId,
      system_origin: "STRIPE",
      first_party: true,
      now,
    }),
    createTruthClaim({
      claim: `APEX evidence_level=${snapshot.evidence_level}; clock=${snapshot.learning_clock}; product_mutation_blocked=${snapshot.product_mutation_blocked}`,
      type: "OBSERVATION",
      source: "apex.cycle",
      confidence: 0.8,
      sample_size: snapshot.qualified_visits,
      business_id: businessId,
      system_origin: "APEX",
      first_party: true,
      now,
    }),
    createTruthClaim({
      claim: `FORGE product READY forge_confidence=${snapshot.forge_confidence} (NOT willingness-to-pay)`,
      type: "FACT",
      source: "forge.capability_manifest",
      confidence: 0.9,
      business_id: businessId,
      system_origin: "FORGE",
      first_party: true,
      now,
    }),
    createTruthClaim({
      claim: constraints.statement,
      type: "BELIEF",
      source: "titan.constraint_solver",
      confidence: decision.confidence,
      sample_size: snapshot.qualified_visits,
      business_id: businessId,
      system_origin: "TITAN",
      now,
    }),
  ];

  const forecast = createForecast({
    business_id: businessId,
    timestamp: now.toISOString(),
    statement:
      decision.resource_allocation === "APEX"
        ? "Continued APEX acquisition raises qualified exposure before conversion can be judged"
        : "FORGE investigation more likely to unlock purchases given demonstrated demand",
    probabilities: {
      ...constraints.bottleneck_probabilities,
      purchase_within_7_days:
        snapshot.purchases > 0 ? 0.4 : snapshot.qualified_visits >= 50 ? 0.25 : 0.08,
    },
    expected_revenue_impact_usd: { low: 0, high: snapshot.price_usd || 45 },
    confidence: "LOW",
    decision_id: decision.decision_id,
  });

  const progress = assessProgressTowardNorthStar({
    daily_revenue_usd: revenueUsd,
    stranger_purchases: purchases,
    claims:
      purchases > 0
        ? [
            {
              claim: `attributed revenue $${revenueUsd}`,
              metric: "revenue",
              value: revenueUsd,
              sample_size: purchases,
              attributed: true,
              first_party: true,
            },
          ]
        : [],
  });

  const result: TitanCycleResult = {
    ok: true,
    business_id: businessId,
    timestamp: now.toISOString(),
    world_model: world,
    objective_tree,
    constraints,
    situation,
    decision,
    progress,
    claims_published: claims.length,
    phase: "PHASE_1_TRUTH",
    execution_authority: "NONE",
  };

  const persist = input.persist !== false;
  if (persist) {
    await appendTruthClaims(store, claims);
    await appendDecision(store, decision);
    await appendForecast(store, forecast);
    await persistTitanCycle(store, businessId, result);
  }

  return result;
}

async function persistTitanCycle(
  store: ExperimentStore,
  businessId: string,
  result: TitanCycleResult,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("tevt"),
    pursuitId: CYCLE_PURSUIT,
    siteId: businessId,
    eventType: "learned",
    detail: { titan: true, kind: "titan_cycle", result },
    createdAt: result.timestamp,
  });
}
