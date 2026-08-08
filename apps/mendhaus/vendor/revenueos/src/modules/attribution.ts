import { newId } from "../ledger/store";
import type {
  Attribution,
  Experiment,
  Lesson,
} from "../types";

/** An experiment is due for a verdict once its signal window has elapsed. */
export function dueForAttribution(
  experiment: Experiment,
  now = Date.now(),
): boolean {
  if (experiment.status !== "running" && experiment.status !== "proposed") {
    return false;
  }
  if (!experiment.measurement) return false;
  return Date.parse(experiment.measurement.scheduledCheckAt) <= now;
}

/**
 * Compare current precursor value against the COUNTERFACTUAL — what the metric
 * would have been anyway — and issue a verdict. This is causal, not naive: a
 * lever only wins if it beats the organic trend, so the brain does not credit
 * itself for growth it did not cause.
 *
 * @param expectedBaseline the projected value absent the lever (trend-adjusted).
 *   When omitted, falls back to the static baseline captured at bet time.
 */
export function attributeExperiment(
  experiment: Experiment,
  currentValue: number,
  now = new Date(),
  expectedBaseline?: number,
): { attribution: Attribution; experiment: Experiment } {
  const plan = experiment.measurement!;
  const counterfactual =
    expectedBaseline !== undefined ? expectedBaseline : plan.baselineValue;
  // Raw movement vs. bet-time baseline (for the record).
  const delta = Number((currentValue - plan.baselineValue).toFixed(4));
  // Causal lift: movement beyond what the trend predicted anyway.
  const causalLift = Number((currentValue - counterfactual).toFixed(4));
  const hitTarget = causalLift >= plan.targetDelta * 0.5;
  const regressed = causalLift < 0;
  const verdict: Attribution["verdict"] = hitTarget
    ? "won"
    : regressed
      ? "lost"
      : "inconclusive";

  // Confidence scales with how decisively the target was beaten or missed,
  // measured against the counterfactual.
  const magnitude =
    plan.targetDelta > 0 ? Math.abs(causalLift) / plan.targetDelta : 0;
  const confidence = Number(Math.max(0.2, Math.min(0.9, magnitude)).toFixed(2));

  const attribution: Attribution = {
    id: newId("attr"),
    experimentId: experiment.id,
    siteId: experiment.siteId,
    metric: plan.metric,
    baselineValue: plan.baselineValue,
    postValue: currentValue,
    delta,
    verdict,
    confidence,
    createdAt: now.toISOString(),
  };

  const updated: Experiment = {
    ...experiment,
    status:
      verdict === "won" ? "won" : verdict === "lost" ? "lost" : "abandoned",
    actualOutcome: `${plan.metric} ${delta >= 0 ? "+" : ""}${delta} vs baseline ${plan.baselineValue}; causal lift ${causalLift >= 0 ? "+" : ""}${causalLift} vs trend ${counterfactual} (${verdict})`,
    attributionId: attribution.id,
    endedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return { attribution, experiment: updated };
}

/**
 * Turn a closed experiment into a lesson that changes future ranking. Wins
 * boost the pattern; losses downrank it and place it on cooldown so the brain
 * tries a *different* informed attempt rather than repeating the failure.
 */
export function lessonFromAttribution(input: {
  experiment: Experiment;
  attribution: Attribution;
  industry: string;
  now?: Date;
}): Lesson {
  const { experiment, attribution } = input;
  const now = input.now ?? new Date();
  const patternKey =
    experiment.hypothesis.patternKey ??
    experiment.category ??
    experiment.hypothesis.id;
  const won = attribution.verdict === "won";
  const cooldownDays = attribution.verdict === "lost" ? 21 : 0;
  const cooldownUntil =
    cooldownDays > 0
      ? new Date(now.getTime() + cooldownDays * 86_400_000).toISOString()
      : undefined;

  return {
    id: newId("lesson"),
    scope: "site",
    siteId: experiment.siteId,
    industry: input.industry,
    patternKey,
    summary:
      `${won ? "Won" : attribution.verdict === "lost" ? "Lost" : "Inconclusive"}: "${experiment.hypothesis.title}" moved ${attribution.metric} by ${attribution.delta}. ` +
      (won
        ? "Prefer this lever again."
        : attribution.verdict === "lost"
          ? "Downrank and cool down; try a different approach."
          : "Signal weak; needs a cleaner test."),
    evidenceCount: 1,
    transferable: won,
    sentiment: won ? "positive" : attribution.verdict === "lost" ? "negative" : "neutral",
    rankingWeight: won ? 1.4 : attribution.verdict === "lost" ? 0.5 : 1,
    cooldownUntil,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}
