/**
 * Probabilistic reasoning primitives. The brain should be honest about how much
 * it actually knows: small samples produce wide intervals and shrunken
 * confidence, so it stops mistaking noise for signal.
 */

/** Wilson score interval for a binomial proportion (successes/trials). */
export function wilsonInterval(
  successes: number,
  trials: number,
  z = 1.96,
): { lower: number; upper: number; mean: number } {
  if (trials <= 0) return { lower: 0, upper: 1, mean: 0 };
  const p = successes / trials;
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denom;
  const margin =
    (z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials)) / denom;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    mean: p,
  };
}

/**
 * Beta-Binomial posterior mean: blend an author's prior confidence with observed
 * evidence. Weak data barely moves the prior; strong data dominates it. This is
 * real Bayesian updating, not a magic number.
 */
export function evidenceConfidence(
  priorConfidence: number,
  successes: number,
  trials: number,
  priorStrength = 20,
): number {
  const prior = clamp01(priorConfidence);
  const a = prior * priorStrength + successes;
  const b = (1 - prior) * priorStrength + Math.max(0, trials - successes);
  const mean = a / (a + b);
  return Number(clamp01(mean).toFixed(4));
}

/** Whether a sample is large enough to trust a rate estimate from it. */
export function sufficientSample(trials: number, min = 30): boolean {
  return trials >= min;
}

/**
 * Shrink a confidence toward 0.5 when the underlying sample is thin. Used to
 * keep the brain from acting certain on almost no data.
 */
export function shrinkForSample(
  confidence: number,
  trials: number,
  min = 30,
): number {
  if (trials >= min) return confidence;
  const weight = Math.max(0, trials) / min;
  return Number((0.5 + (confidence - 0.5) * weight).toFixed(4));
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
