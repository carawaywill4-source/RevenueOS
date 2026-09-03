/**
 * Data quality is a commercial system.
 * Bad telemetry must not poison APEX.
 */

import type { PursuitEvent } from "../types";
import type { CommercialEvent } from "./types";

export type DataQualityIssue = {
  code: string;
  detail: string;
  severity: "info" | "warn" | "error";
};

export function assessCommercialDataQuality(input: {
  events: CommercialEvent[];
  pursuitEvents?: PursuitEvent[];
  stripePurchaseCount?: number;
  now?: Date;
}): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const now = input.now ?? new Date();

  const purchases = input.events.filter((e) => e.event_type === "PURCHASE");
  const visits = input.events.filter(
    (e) => e.event_type === "VISIT" || e.event_type === "ENGAGEMENT",
  );

  if (
    typeof input.stripePurchaseCount === "number" &&
    purchases.length < input.stripePurchaseCount
  ) {
    issues.push({
      code: "stripe_mismatch",
      detail: `ledger_purchases=${purchases.length} stripe=${input.stripePurchaseCount}`,
      severity: "error",
    });
  }

  for (const e of purchases) {
    if (!e.metadata?.stripeSessionId && !e.metadata?.stripe_payment_id) {
      issues.push({
        code: "purchase_missing_stripe_link",
        detail: e.event_id,
        severity: "warn",
      });
    }
    if (e.attribution_confidence == null) {
      issues.push({
        code: "purchase_unknown_attribution",
        detail: e.event_id,
        severity: "info",
      });
    }
  }

  const seen = new Set<string>();
  for (const e of visits) {
    const key = `${e.anonymous_session_id ?? ""}:${e.event_type}:${e.metadata?.path ?? ""}:${e.timestamp.slice(0, 16)}`;
    if (seen.has(key)) {
      issues.push({
        code: "duplicate_session_event",
        detail: key,
        severity: "warn",
      });
    }
    seen.add(key);
    const ts = Date.parse(e.timestamp);
    if (Number.isFinite(ts) && Math.abs(now.getTime() - ts) > 7 * 86_400_000) {
      issues.push({
        code: "clock_skew_or_stale",
        detail: e.event_id,
        severity: "info",
      });
    }
  }

  const rawShare =
    input.events.length === 0
      ? 0
      : input.events.filter((e) => e.traffic_quality === "RAW").length /
        input.events.length;
  if (rawShare > 0.7 && input.events.length >= 10) {
    issues.push({
      code: "bot_contamination_high",
      detail: `raw_share=${rawShare.toFixed(2)}`,
      severity: "warn",
    });
  }

  const beacons = (input.pursuitEvents ?? []).filter(
    (e) => e.eventType === "beacon",
  );
  if (beacons.length === 0 && input.events.length === 0) {
    issues.push({
      code: "no_telemetry",
      detail: "no beacon or commercial events in window",
      severity: "warn",
    });
  }

  return issues;
}
