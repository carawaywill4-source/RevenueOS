import { newId } from "../ledger/store";
import { toPortableLesson } from "../memory/portable";
import { isMoneySuccessMetric } from "./success";
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
  if (experiment.status !== "running") {
    return false;
  }
  // A metric moving after an adapter failed or skipped an action is not
  // evidence for the proposed hypothesis.
  if (!experiment.actions.some((action) => action.result?.ok)) return false;
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
  const moneyWin = won && isMoneySuccessMetric(attribution.metric);
  const toolWin = won && !moneyWin;
  const cooldownDays = attribution.verdict === "lost" ? 21 : 0;
  const cooldownUntil =
    cooldownDays > 0
      ? new Date(now.getTime() + cooldownDays * 86_400_000).toISOString()
      : undefined;

  const summary = moneyWin
    ? `SUCCESS (money): "${experiment.hypothesis.title}" moved ${attribution.metric} by ${attribution.delta}. Prefer this lever — it printed toward customer revenue.`
    : toolWin
      ? `TOOL ONLY (not success): "${experiment.hypothesis.title}" moved ${attribution.metric} by ${attribution.delta}. Useful instrument — still failing until purchases/profit move. Do not celebrate vanity.`
      : attribution.verdict === "lost"
        ? `FAILURE: "${experiment.hypothesis.title}" moved ${attribution.metric} by ${attribution.delta}. Downrank and cool down. Money made is the only success — try a different approach.`
        : `Inconclusive: "${experiment.hypothesis.title}" on ${attribution.metric} (${attribution.delta}). No clear money. Cleaner test required.`;

  // Money wins/losses and clear tool failures travel to the next business.
  // Pure vanity tool-wins stay site-local so we do not teach traffic theater.
  const transferable = moneyWin || attribution.verdict === "lost";
  return toPortableLesson({
    siteId: experiment.siteId,
    industry: input.industry,
    now,
    lesson: {
      patternKey,
      summary,
      evidenceCount: 1,
      transferable,
      sentiment: moneyWin
        ? "positive"
        : attribution.verdict === "lost" || toolWin
          ? "negative"
          : "neutral",
      rankingWeight: moneyWin
        ? 1.55
        : toolWin
          ? 1.1
          : attribution.verdict === "lost"
            ? 0.45
            : 1,
      cooldownUntil,
    },
  });
}
