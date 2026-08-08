import type {
  Experiment,
  Hypothesis,
  Lesson,
  MeasurementPlan,
  Observation,
} from "../types";
import { newId } from "../ledger/store";
import { precursorValueFromObservation } from "./strategy";

/**
 * Create a proposed experiment with an attached measurement plan. A lever
 * without a measurement plan is a guess — so every experiment declares which
 * precursor it moves, the baseline, the target, and when to check.
 */
export function createProposedExperiment(
  siteId: string,
  hypothesis: Hypothesis,
  observation: Observation,
  now = new Date(),
): Experiment {
  const iso = now.toISOString();
  const metric = hypothesis.precursorMetric ?? "purchases";
  const baseline = precursorValueFromObservation(metric, observation);
  const timeToSignalDays =
    hypothesis.category === "conversion"
      ? 3
      : hypothesis.category === "pricing"
        ? 7
        : hypothesis.category === "operations"
          ? 7
          : 14;
  const measurement: MeasurementPlan = {
    metric,
    baselineValue: baseline,
    targetDelta: Math.max(1, hypothesis.expectedImpact * 0.15),
    timeToSignalDays,
    scheduledCheckAt: new Date(
      now.getTime() + timeToSignalDays * 86_400_000,
    ).toISOString(),
  };
  return {
    id: newId("exp"),
    siteId,
    // Execution, not selection, starts an experiment. A proposed action must
    // never be attributed because an adapter may reject or fail it.
    status: "proposed",
    hypothesis,
    actions: [],
    predictedOutcome: hypothesis.predictedDelta,
    category: hypothesis.category,
    measurement,
    createdAt: iso,
    updatedAt: iso,
  };
}

export function lessonFromBlockedAction(
  siteId: string,
  industry: string,
  hypothesis: Hypothesis,
  reason: string,
): Lesson {
  const now = new Date().toISOString();
  return {
    id: newId("lesson"),
    scope: "site",
    siteId,
    industry,
    patternKey: hypothesis.patternKey ?? `blocked_${hypothesis.id}`,
    summary: `Owner-gated "${hypothesis.title}": ${reason}. Escalated as an explicit owner ask.`,
    evidenceCount: 1,
    transferable: false,
    sentiment: "neutral",
    createdAt: now,
    updatedAt: now,
  };
}

export function alreadyTriedRecently(
  experiments: Experiment[],
  hypothesisId: string,
  withinMs = 7 * 24 * 60 * 60 * 1000,
) {
  const cutoff = Date.now() - withinMs;
  return experiments.some(
    (exp) =>
      exp.hypothesis.id === hypothesisId &&
      Date.parse(exp.createdAt) >= cutoff,
  );
}
