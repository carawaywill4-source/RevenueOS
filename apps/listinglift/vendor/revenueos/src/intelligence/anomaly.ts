import type { Anomaly, Observation, Scorecard } from "../types";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Vigilance: catch sudden regressions in money precursors before they bleed.
 * Compares the current observation against the recent scorecard history and
 * flags material drops (and any fulfillment failure outright).
 */
export function detectAnomalies(
  observation: Observation,
  history: Scorecard[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  // Fulfillment failing is always an anomaly, regardless of history.
  if (observation.funnel.fulfillmentFailed > 0) {
    anomalies.push({
      metric: "fulfillment",
      previous: 0,
      current: observation.funnel.fulfillmentFailed,
      dropPct: 1,
      severity: "high",
      note: "Fulfillment is failing on orders. Halt growth and fix delivery now.",
    });
  }

  const recent = history.slice(0, 5);
  if (recent.length >= 2) {
    const checks: Array<{ metric: string; current: number; past: number[] }> = [
      {
        metric: "revenue",
        current: observation.money.revenueUsd,
        past: recent.map((s) => s.revenueUsd),
      },
      {
        metric: "landing_views",
        current: observation.funnel.landingViews,
        past: recent.map((s) => s.landingViews ?? 0),
      },
      {
        metric: "purchases",
        current: observation.money.purchases,
        past: recent.map((s) => s.purchases),
      },
    ];
    for (const check of checks) {
      const baseline = median(check.past);
      if (baseline <= 0) continue;
      const dropPct = (baseline - check.current) / baseline;
      if (dropPct >= 0.4) {
        anomalies.push({
          metric: check.metric,
          previous: Number(baseline.toFixed(2)),
          current: Number(check.current.toFixed(2)),
          dropPct: Number(dropPct.toFixed(2)),
          severity: dropPct >= 0.6 ? "high" : "medium",
          note: `${check.metric} dropped ${(dropPct * 100).toFixed(0)}% vs recent median — investigate before spending effort elsewhere.`,
        });
      }
    }
  }

  return anomalies;
}
