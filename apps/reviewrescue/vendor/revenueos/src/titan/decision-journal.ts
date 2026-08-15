/**
 * DecisionJournal — records executive decisions with epistemic hygiene.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { ApexCycleResult } from "../apex/types";
import { buildApexCommand, buildForgeCommand } from "./contracts";
import type {
  AttentionState,
  BusinessSnapshot,
  ConstraintDiagnosis,
  DecisionJournalEntry,
  ResourceFavor,
} from "./types";

const DECISION_PURSUIT = "titan_decision";

export function selectResourceFavor(
  constraints: ConstraintDiagnosis,
): ResourceFavor {
  if (
    constraints.primary === "qualified_exposure" ||
    constraints.primary === "acquisition" ||
    constraints.primary === "awareness"
  ) {
    return "APEX";
  }
  if (
    constraints.primary === "conversion" ||
    constraints.primary === "offer" ||
    constraints.primary === "pricing" ||
    constraints.primary === "trust" ||
    constraints.primary === "checkout" ||
    constraints.primary === "fulfillment" ||
    constraints.primary === "reliability"
  ) {
    return "FORGE";
  }
  return "BALANCED";
}

export function boundConfidence(evidenceLevel: string, base: number): {
  confidence: number;
  confidence_bound: DecisionJournalEntry["confidence_bound"];
} {
  if (evidenceLevel === "NO_EVIDENCE" || evidenceLevel === "WEAK_SIGNAL") {
    return {
      confidence: Math.min(base, 0.35),
      confidence_bound: "BOUNDED",
    };
  }
  if (evidenceLevel === "EMERGING_SIGNAL") {
    return {
      confidence: Math.min(base, 0.55),
      confidence_bound: "BOUNDED",
    };
  }
  if (evidenceLevel === "ACTIONABLE_SIGNAL") {
    return {
      confidence: Math.min(base, 0.75),
      confidence_bound: "MODERATE",
    };
  }
  return { confidence: Math.min(base, 0.9), confidence_bound: "HIGH" };
}

export function formExecutiveDecision(input: {
  snapshot: BusinessSnapshot;
  constraints: ConstraintDiagnosis;
  apex?: ApexCycleResult | null;
  now?: Date;
}): DecisionJournalEntry {
  const favor = selectResourceFavor(input.constraints);
  const apexCmd = buildApexCommand({
    snapshot: input.snapshot,
    constraints: input.constraints,
  });
  const forgeCmd = buildForgeCommand({
    snapshot: input.snapshot,
    constraints: input.constraints,
  });
  const { confidence, confidence_bound } = boundConfidence(
    input.constraints.evidence_level,
    0.55,
  );

  const attention: AttentionState =
    input.snapshot.purchases === 0 ? "INCUBATE" : "GROW";

  const continueAcquisition =
    favor === "APEX" && input.snapshot.purchases === 0;

  const decision = continueAcquisition
    ? "continue acquisition — favor APEX qualified exposure; no product redesign"
    : favor === "FORGE"
      ? "shift priority to FORGE conversion/offer investigation under demonstrated demand"
      : "balanced execution under measured constraints";

  return {
    decision_id: newId("tdec"),
    business_id: input.snapshot.business_id,
    timestamp: (input.now ?? new Date()).toISOString(),
    current_goal:
      input.snapshot.purchases === 0
        ? "first stranger customer / FIRST ATTRIBUTED STRANGER PURCHASE"
        : input.snapshot.primary_objective,
    primary_constraint: input.constraints.primary,
    evidence_level: input.constraints.evidence_level,
    learning_clock: input.snapshot.learning_clock,
    apex_bottleneck: input.apex?.bottleneck,
    apex_objective: apexCmd,
    forge_objective: forgeCmd,
    resource_allocation: favor,
    decision,
    confidence,
    confidence_bound,
    escalation: null,
    rationale: [
      input.constraints.statement,
      ...input.constraints.why_tree,
      `forge_confidence=${input.snapshot.forge_confidence} is product readiness, not WTP`,
      `learning_clock=${input.snapshot.learning_clock}; product_mutation_blocked=${input.snapshot.product_mutation_blocked}`,
    ],
    forbidden_moves: [
      "redesign product from tiny traffic",
      "major pricing change without FORGE approval + evidence",
      "create new businesses to escape first-customer work",
      "claim success without attributed stranger purchase",
      "idle / report-only loop",
      "fabricate progress toward $10k/day",
    ],
    attention,
    reversibility: "R0",
    what_would_prove_wrong: continueAcquisition
      ? [
          "qualified_visits ≥ 50 with high engagement and many checkouts but 0 purchases → conversion/offer becomes primary",
          "attributed stranger purchase → advance ladder and reallocate",
        ]
      : [
          "checkout/fulfillment actually broken → reliability first",
          "traffic quality collapses → return priority to APEX",
        ],
  };
}

export async function appendDecision(
  store: ExperimentStore,
  entry: DecisionJournalEntry,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("tevt"),
    pursuitId: DECISION_PURSUIT,
    siteId: entry.business_id,
    eventType: "learned",
    detail: { titan: true, kind: "titan_decision", decision: entry },
    createdAt: entry.timestamp,
  });
}
