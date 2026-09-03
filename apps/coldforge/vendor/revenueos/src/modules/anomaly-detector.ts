/**
 * Stream-anomaly detector.
 *
 * Runs over the durable pursuit-event stream to catch unusual signal that the
 * existing money-precursor anomaly detector (intelligence/anomaly.ts) cannot
 * see:
 *
 *   1. Traffic spike vs a 7-day rolling baseline of beacon page_views.
 *   2. New referrer domain (never seen in the trailing 7d).
 *   3. Review-sentiment shift (beacon events tagged `kind: "review"` with a
 *      sentiment score in detail).
 *   4. Price / competitor movement (beacon events tagged
 *      `kind: "competitor_price"` with a price in detail).
 *
 * Anomalies are intentionally shallow — they're a nudge for the strategist,
 * not a decision. Severity is bounded and reasons are human-readable so the
 * next planner cycle can act on them without a schema migration.
 */

import type { PursuitEvent } from "../types";

export type StreamAnomalyKind =
  | "traffic_spike"
  | "new_referrer"
  | "sentiment_shift"
  | "competitor_price_move";

export type StreamAnomaly = {
  kind: StreamAnomalyKind;
  siteId: string;
  severity: "low" | "medium" | "high";
  detectedAt: string;
  metric?: string;
  current?: number;
  baseline?: number;
  note: string;
  detail?: Record<string, string | number | boolean>;
};

const DAY_MS = 24 * 3_600_000;

function toMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function domain(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Detect anomalies over an event window. `now` must be provided in tests to
 * make comparisons deterministic; in production the caller passes `new Date()`.
 */
export function detectAnomalies(input: {
  events: PursuitEvent[];
  now: Date;
  /** Days of trailing baseline. Default 7. */
  baselineDays?: number;
  /** Current-window hours. Default 24. */
  currentWindowHours?: number;
  /** Traffic spike ratio threshold. Default 3× baseline daily avg. */
  spikeRatio?: number;
}): StreamAnomaly[] {
  const now = input.now;
  const nowMs = now.getTime();
  const baselineDays = input.baselineDays ?? 7;
  const currentWindowMs = (input.currentWindowHours ?? 24) * 3_600_000;
  const spikeRatio = input.spikeRatio ?? 3;
  const currentStartMs = nowMs - currentWindowMs;
  const baselineStartMs = currentStartMs - baselineDays * DAY_MS;

  const anomalies: StreamAnomaly[] = [];

  // Group events by siteId first so a portfolio-wide detector can run once.
  const bySite = new Map<string, PursuitEvent[]>();
  for (const e of input.events) {
    const arr = bySite.get(e.siteId) ?? [];
    arr.push(e);
    bySite.set(e.siteId, arr);
  }

  for (const [siteId, events] of bySite) {
    // 1) Traffic spike (beacon page_view/scroll_depth) vs baseline daily avg.
    let currentViews = 0;
    let baselineViews = 0;
    const currentReferrers = new Set<string>();
    const baselineReferrers = new Set<string>();
    let currentSentiment: number[] = [];
    let baselineSentiment: number[] = [];
    let currentPrice: number[] = [];
    let baselinePrice: number[] = [];

    for (const e of events) {
      if (e.eventType !== "beacon") continue;
      const ts = toMs(e.createdAt);
      if (ts < baselineStartMs) continue;
      const d = (e.detail ?? {}) as Record<string, unknown>;
      const kind = String(d.kind ?? "");
      const inCurrent = ts >= currentStartMs;
      const inBaseline = ts >= baselineStartMs && ts < currentStartMs;

      if (kind === "page_view" || kind === "scroll_depth") {
        if (inCurrent) currentViews += 1;
        if (inBaseline) baselineViews += 1;
        const ref = typeof d.referrer === "string" ? domain(d.referrer) : null;
        if (ref) {
          if (inCurrent) currentReferrers.add(ref);
          if (inBaseline) baselineReferrers.add(ref);
        }
      }
      if (kind === "review") {
        const s = Number(d.sentiment);
        if (Number.isFinite(s)) {
          if (inCurrent) currentSentiment.push(s);
          if (inBaseline) baselineSentiment.push(s);
        }
      }
      if (kind === "competitor_price") {
        const p = Number(d.priceUsd);
        if (Number.isFinite(p) && p > 0) {
          if (inCurrent) currentPrice.push(p);
          if (inBaseline) baselinePrice.push(p);
        }
      }
    }

    const baselineDailyAvg = baselineViews / Math.max(1, baselineDays);
    const currentDailyAvg =
      currentViews / Math.max(1, input.currentWindowHours ?? 24) * 24;
    if (baselineDailyAvg > 0 && currentDailyAvg >= baselineDailyAvg * spikeRatio) {
      const ratio = currentDailyAvg / baselineDailyAvg;
      anomalies.push({
        kind: "traffic_spike",
        siteId,
        severity: ratio >= 6 ? "high" : ratio >= 4 ? "medium" : "low",
        detectedAt: now.toISOString(),
        metric: "page_views",
        current: Number(currentDailyAvg.toFixed(2)),
        baseline: Number(baselineDailyAvg.toFixed(2)),
        note: `Traffic ${ratio.toFixed(1)}× baseline — investigate source before spend spikes bail.`,
        detail: { ratio: Number(ratio.toFixed(2)) },
      });
    } else if (currentDailyAvg > 0 && baselineDailyAvg === 0 && currentViews >= 20) {
      anomalies.push({
        kind: "traffic_spike",
        siteId,
        severity: "medium",
        detectedAt: now.toISOString(),
        metric: "page_views",
        current: currentViews,
        baseline: 0,
        note: `First measurable traffic (${currentViews} views) — attribute now while attribution window is fresh.`,
      });
    }

    // 2) New referrer domain: any referrer in the current window that was
    // never seen in baseline.
    for (const ref of currentReferrers) {
      if (baselineReferrers.has(ref)) continue;
      anomalies.push({
        kind: "new_referrer",
        siteId,
        severity: "low",
        detectedAt: now.toISOString(),
        note: `New referrer domain '${ref}' — double the surface that produced it.`,
        detail: { referrer: ref },
      });
    }

    // 3) Sentiment shift.
    if (currentSentiment.length >= 3 && baselineSentiment.length >= 3) {
      const cur = avg(currentSentiment);
      const base = avg(baselineSentiment);
      const delta = cur - base;
      if (Math.abs(delta) >= 0.25) {
        anomalies.push({
          kind: "sentiment_shift",
          siteId,
          severity: Math.abs(delta) >= 0.5 ? "high" : "medium",
          detectedAt: now.toISOString(),
          metric: "review_sentiment",
          current: Number(cur.toFixed(3)),
          baseline: Number(base.toFixed(3)),
          note:
            delta >= 0
              ? `Review sentiment up +${delta.toFixed(2)} — press this while it's true.`
              : `Review sentiment down ${delta.toFixed(2)} — fix root cause before next launch.`,
          detail: { delta: Number(delta.toFixed(3)) },
        });
      }
    }

    // 4) Competitor price movement.
    if (currentPrice.length >= 1 && baselinePrice.length >= 1) {
      const cur = avg(currentPrice);
      const base = avg(baselinePrice);
      if (base > 0) {
        const move = (cur - base) / base;
        if (Math.abs(move) >= 0.1) {
          anomalies.push({
            kind: "competitor_price_move",
            siteId,
            severity: Math.abs(move) >= 0.25 ? "high" : "medium",
            detectedAt: now.toISOString(),
            metric: "competitor_price",
            current: Number(cur.toFixed(2)),
            baseline: Number(base.toFixed(2)),
            note:
              move < 0
                ? `Competitor cut price ${(move * 100).toFixed(0)}% — re-check price ceiling before churn spikes.`
                : `Competitor raised price ${(move * 100).toFixed(0)}% — room to lift our own price or hold and win on value.`,
            detail: { move: Number(move.toFixed(3)) },
          });
        }
      }
    }
  }

  return anomalies;
}

function avg(v: number[]): number {
  if (!v.length) return 0;
  return v.reduce((s, x) => s + x, 0) / v.length;
}
