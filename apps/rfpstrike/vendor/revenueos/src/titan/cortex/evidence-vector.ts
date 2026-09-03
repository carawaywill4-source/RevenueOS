/**
 * Multidimensional evidence scoring — not a fixed rank table.
 * Avoid fake precision on weak qualitative evidence.
 */

import type { EpistemicClass, EvidenceVector, SourceRecord } from "./types";

export function scoreEvidenceVector(input: {
  source: SourceRecord;
  classification: EpistemicClass;
  sample_size?: number;
  recency_days?: number;
  applicability?: number;
  causal_status_hint?: number;
  possible_manipulation?: number;
  scope?: string;
}): EvidenceVector {
  const sample = input.sample_size ?? 0;
  const recency =
    input.recency_days === undefined
      ? 0.7
      : Math.max(0, Math.min(1, 1 - input.recency_days / 365));

  const integrityByClass: Partial<Record<EpistemicClass, number>> = {
    FACT: 0.95,
    MEASUREMENT: 0.9,
    OBSERVATION: 0.75,
    FORECAST: 0.4,
    HYPOTHESIS: 0.35,
    BELIEF: 0.4,
    INFERENCE: 0.45,
    HEURISTIC: 0.35,
    UNKNOWN: 0.05,
    SIMULATION: 0.3,
    COMPETITOR_CLAIM: 0.35,
    EXPERT_OPINION: 0.45,
  };

  const measurement = integrityByClass[input.classification] ?? 0.5;
  const sampleScore = sample <= 0 ? 0.1 : sample < 20 ? 0.25 : sample < 100 ? 0.55 : 0.8;

  // Coarse confidence range — no 6-decimal fake precision.
  const uncertainty = Number(
    (
      1 -
      (input.source.authority_level * 0.35 +
        measurement * 0.25 +
        sampleScore * 0.25 +
        recency * 0.15)
    ).toFixed(2),
  );

  return {
    source_authority: round2(input.source.authority_level),
    directness: input.source.primary_or_secondary === "primary" ? 0.85 : 0.45,
    measurement_integrity: round2(measurement),
    independence: round2(1 - input.source.commercial_incentive),
    sample_size: sample,
    recency: round2(recency),
    applicability: round2(input.applicability ?? 0.6),
    causal_strength: round2(input.causal_status_hint ?? 0.3),
    replicability: sample >= 100 ? 0.6 : sample >= 20 ? 0.35 : 0.15,
    conflict_of_interest: round2(input.source.commercial_incentive),
    possible_bias: round2(Math.max(input.source.commercial_incentive, 1 - measurement)),
    possible_manipulation: round2(input.possible_manipulation ?? 0.1),
    uncertainty: Math.max(0, Math.min(1, uncertainty)),
    scope: input.scope ?? "unspecified",
    transferability: round2(input.applicability ?? 0.5),
  };
}

/** Composite weight for ranking — still multidimensional under the hood. */
export function evidenceWeight(v: EvidenceVector): number {
  const positive =
    v.source_authority * 0.2 +
    v.directness * 0.15 +
    v.measurement_integrity * 0.2 +
    Math.min(1, Math.log10(v.sample_size + 1) / 3) * 0.15 +
    v.recency * 0.1 +
    v.applicability * 0.1 +
    v.causal_strength * 0.1;
  const penalties =
    v.conflict_of_interest * 0.15 +
    v.possible_manipulation * 0.2 +
    v.uncertainty * 0.15;
  return Number(Math.max(0, positive - penalties).toFixed(3));
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/** Coarse confidence — refuse fake precision. */
export function coarseConfidence(weight: number, sampleSize: number): {
  confidence: number;
  interval?: { low: number; high: number };
} {
  if (sampleSize < 5) {
    return { confidence: Number(Math.min(0.35, weight).toFixed(2)) };
  }
  const c = Number(Math.min(0.9, weight).toFixed(2));
  const spread = sampleSize < 50 ? 0.15 : 0.08;
  return {
    confidence: c,
    interval: {
      low: Number(Math.max(0, c - spread).toFixed(2)),
      high: Number(Math.min(1, c + spread).toFixed(2)),
    },
  };
}
