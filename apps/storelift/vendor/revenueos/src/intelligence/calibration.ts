import type {
  Attribution,
  CalibrationCell,
  CalibrationModel,
  Experiment,
  OpportunityCategory,
} from "../types";

/**
 * Meta-learning: the brain scores its own past predictions against reality. If a
 * category (say acquisition) systematically over-promises, its future expected
 * value is scaled down. Calibration is how the brain gets *smarter with age*
 * rather than repeating the same optimistic mistakes.
 */

const EMPTY_CELL: CalibrationCell = {
  samples: 0,
  predictedWinRate: 0,
  actualWinRate: 0,
  brier: 0,
  factor: 1,
};

function buildCell(
  rows: Array<{ predicted: number; actual: number }>,
): CalibrationCell {
  if (rows.length === 0) return { ...EMPTY_CELL };
  const n = rows.length;
  const predictedWinRate = rows.reduce((s, r) => s + r.predicted, 0) / n;
  const actualWinRate = rows.reduce((s, r) => s + r.actual, 0) / n;
  const brier = rows.reduce((s, r) => s + (r.predicted - r.actual) ** 2, 0) / n;

  // Evidence-weighted factor: with few samples stay near 1; with more, pull EV
  // toward observed reality. Weak prior of 3 "neutral" samples at parity.
  const priorSamples = 3;
  const factorRaw =
    (actualWinRate * n + 0.5 * priorSamples) /
    (predictedWinRate * n + 0.5 * priorSamples || 1);
  const factor = Number(Math.max(0.5, Math.min(1.5, factorRaw)).toFixed(3));

  return {
    samples: n,
    predictedWinRate: Number(predictedWinRate.toFixed(3)),
    actualWinRate: Number(actualWinRate.toFixed(3)),
    brier: Number(brier.toFixed(3)),
    factor,
  };
}

export function buildCalibration(
  experiments: Experiment[],
  attributions: Attribution[],
): CalibrationModel {
  const byExpId = new Map(attributions.map((a) => [a.experimentId, a]));
  const rowsByCategory = new Map<
    OpportunityCategory,
    Array<{ predicted: number; actual: number }>
  >();
  const overallRows: Array<{ predicted: number; actual: number }> = [];

  for (const exp of experiments) {
    const attribution = byExpId.get(exp.id);
    if (!attribution) continue;
    if (attribution.verdict === "inconclusive") continue;
    // Predicted probability of winning ≈ the hypothesis confidence used at bet time.
    const predicted = clamp01(exp.hypothesis.confidence);
    const actual = attribution.verdict === "won" ? 1 : 0;
    overallRows.push({ predicted, actual });
    const category = exp.category ?? exp.hypothesis.category;
    if (category) {
      const list = rowsByCategory.get(category) ?? [];
      list.push({ predicted, actual });
      rowsByCategory.set(category, list);
    }
  }

  const byCategory: CalibrationModel["byCategory"] = {};
  for (const [category, rows] of rowsByCategory) {
    byCategory[category] = buildCell(rows);
  }

  return { byCategory, overall: buildCell(overallRows) };
}

/** EV multiplier for a category from the calibration model (defaults to 1). */
export function calibrationFactor(
  model: CalibrationModel,
  category?: OpportunityCategory,
): number {
  if (category && model.byCategory[category]?.samples) {
    return model.byCategory[category]!.factor;
  }
  return model.overall.samples ? model.overall.factor : 1;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
