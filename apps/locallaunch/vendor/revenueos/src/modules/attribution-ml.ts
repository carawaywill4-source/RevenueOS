/**
 * Attribution-ML: better credit assignment than the current attempt-share.
 *
 * Model: time-decay exponential. A signal received at time T attributes to
 * pursuits within the last N hours with weight exp(-λ * (T - attempt_time)).
 * λ is derived from a caller-provided half-life so recent pursuits dominate.
 *
 * Referrer chains: when a beacon event carries a referrer that matches a
 * pattern's most recent distribution URL, that pattern receives an extra
 * chain-boost — this closes the loop from `distribute_owned_urls` to actual
 * verified traffic without new instrumentation.
 *
 * Output: an attribution-weighted update on top of the existing pattern
 * posteriors. This module returns the updated posteriors; it deliberately
 * does NOT persist them. The caller (cycle runner) folds the result into the
 * regular posterior write.
 */

import type { PursuitEvent } from "../types";
import type { PatternPosterior, PatternPosteriorMap } from "./pattern-posterior";
import { classifyMechanism } from "./action-class";

export type AttributionWeights = Record<string, number>;

export type AttributedSignalRecord = {
  patternKey: string;
  eventId: string;
  weight: number;
  outcome: "verified_exposure" | "intent" | "commercial";
  chainBoost: boolean;
};

const DEFAULT_HALF_LIFE_MS = 6 * 3_600_000; // 6h
const MAX_LOOKBACK_MS = 72 * 3_600_000; // 3 days
const CHAIN_BOOST = 2.0;

function safeExtract(event: PursuitEvent): {
  patternKey?: string;
  actionType?: string;
  url?: string;
  createdAtMs: number;
} {
  const d = (event.detail ?? {}) as Record<string, unknown>;
  return {
    patternKey: typeof d.patternKey === "string" ? d.patternKey : undefined,
    actionType: typeof d.actionType === "string" ? d.actionType : undefined,
    url: typeof d.url === "string" ? d.url : undefined,
    createdAtMs: Date.parse(event.createdAt),
  };
}

function urlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Assign each signal event to zero or more pursuit patterns with an
 * exponentially-decayed weight. Signal kinds:
 *   - verified_exposure ← beacon page_view / scroll_depth / other
 *   - intent            ← beacon cta_click / checkout_start
 *   - commercial        ← beacon checkout_complete
 *
 * When a signal has a referrer that matches a pattern's most-recent
 * distribution URL, that pattern receives an additional multiplicative boost.
 */
export function attributeSignalToPatterns(input: {
  events: PursuitEvent[];
  decayHalfLifeMs?: number;
  now?: Date;
  maxLookbackMs?: number;
}): AttributedSignalRecord[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const halfLifeMs = input.decayHalfLifeMs ?? DEFAULT_HALF_LIFE_MS;
  const lambda = Math.log(2) / Math.max(1, halfLifeMs);
  const lookback = input.maxLookbackMs ?? MAX_LOOKBACK_MS;

  // Bucket 1: executed attempts per pattern, most-recent first.
  const attemptsByPattern = new Map<
    string,
    Array<{ ts: number; url?: string }>
  >();
  // Bucket 2: latest distribution URL → patternKey (for referrer chains).
  const distributionUrlToPattern = new Map<string, string>();

  for (const event of input.events) {
    if (event.eventType !== "executed") continue;
    const d = event.detail as Record<string, unknown> | undefined;
    if (d?.ok !== true) continue;
    const extracted = safeExtract(event);
    if (!extracted.patternKey) continue;
    if (nowMs - extracted.createdAtMs > lookback) continue;
    const arr =
      attemptsByPattern.get(extracted.patternKey) ??
      (attemptsByPattern.set(extracted.patternKey, []).get(extracted.patternKey) as Array<{
        ts: number;
        url?: string;
      }>);
    arr.push({ ts: extracted.createdAtMs, url: extracted.url });
    if (extracted.url) {
      distributionUrlToPattern.set(urlKey(extracted.url), extracted.patternKey);
    }
  }

  const records: AttributedSignalRecord[] = [];

  for (const event of input.events) {
    if (event.eventType !== "beacon") continue;
    const d = (event.detail ?? {}) as Record<string, unknown>;
    // Skip knowledge-graph events which piggy-back on beacon.
    if (d.kind === "knowledge_edge") continue;
    const kind = typeof d.kind === "string" ? d.kind : "";
    let outcome: AttributedSignalRecord["outcome"] | null = null;
    if (kind === "checkout_complete") outcome = "commercial";
    else if (kind === "cta_click" || kind === "checkout_start") outcome = "intent";
    else if (kind === "page_view" || kind === "scroll_depth")
      outcome = "verified_exposure";
    if (!outcome) continue;
    const signalMs = Date.parse(event.createdAt);
    if (Number.isNaN(signalMs)) continue;

    const referrer =
      typeof d.referrer === "string" ? urlKey(d.referrer) : undefined;
    const chainedPattern = referrer
      ? distributionUrlToPattern.get(referrer)
      : undefined;

    // Compute raw weights per pattern.
    const rawWeights = new Map<string, { weight: number; chainBoost: boolean }>();
    let totalRaw = 0;
    for (const [patternKey, attempts] of attemptsByPattern) {
      let bestWeight = 0;
      for (const a of attempts) {
        const dt = signalMs - a.ts;
        if (dt < 0) continue; // signal predates attempt
        if (dt > lookback) continue;
        const w = Math.exp(-lambda * dt);
        if (w > bestWeight) bestWeight = w;
      }
      if (bestWeight <= 0) continue;
      const chain = chainedPattern === patternKey;
      const weight = bestWeight * (chain ? CHAIN_BOOST : 1);
      rawWeights.set(patternKey, { weight, chainBoost: chain });
      totalRaw += weight;
    }
    if (totalRaw <= 0) continue;

    for (const [patternKey, r] of rawWeights) {
      const normalized = r.weight / totalRaw;
      if (normalized < 1e-6) continue;
      records.push({
        patternKey,
        eventId: event.id,
        weight: Number(normalized.toFixed(6)),
        outcome,
        chainBoost: r.chainBoost,
      });
    }
  }

  return records;
}

/**
 * Merge attribution-weighted signal into an existing posterior map. Returns a
 * new map — never mutates the input. The caller may persist or diff as needed.
 */
export function updatePosteriorsWithAttribution(input: {
  posteriors: PatternPosteriorMap;
  attributions: AttributedSignalRecord[];
}): PatternPosteriorMap {
  const next: PatternPosteriorMap = {};
  for (const [k, v] of Object.entries(input.posteriors)) {
    next[k] = { ...v };
  }
  for (const rec of input.attributions) {
    let bucket = next[rec.patternKey];
    if (!bucket) {
      bucket = {
        patternKey: rec.patternKey,
        mechanism: classifyMechanism({ patternKey: rec.patternKey }),
        attempts: 0,
        distributionAttempts: 0,
        productionAttempts: 0,
        verifiedExposures: 0,
        intents: 0,
        commercialOutcomes: 0,
        lastAttemptAt: null,
        firstAttemptAt: null,
        commercialScore: 0,
        banned: false,
      } satisfies PatternPosterior;
      next[rec.patternKey] = bucket;
    }
    if (rec.outcome === "verified_exposure")
      bucket.verifiedExposures += rec.weight;
    else if (rec.outcome === "intent") bucket.intents += rec.weight;
    else if (rec.outcome === "commercial") bucket.commercialOutcomes += rec.weight;
  }
  // Recompute commercialScore under the same weights as pattern-posterior.
  for (const bucket of Object.values(next)) {
    bucket.verifiedExposures = Number(bucket.verifiedExposures.toFixed(3));
    bucket.intents = Number(bucket.intents.toFixed(3));
    bucket.commercialOutcomes = Number(bucket.commercialOutcomes.toFixed(3));
    bucket.commercialScore = Number(
      (
        bucket.verifiedExposures * 1 +
        bucket.intents * 4 +
        bucket.commercialOutcomes * 16 +
        bucket.distributionAttempts * 0.05
      ).toFixed(3),
    );
  }
  return next;
}
