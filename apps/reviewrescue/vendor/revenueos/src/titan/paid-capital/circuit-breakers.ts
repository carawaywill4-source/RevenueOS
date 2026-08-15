/**
 * Circuit breakers — default uncertain financial states to NO NEW SPEND.
 */

import { newId } from "../../ledger/store";
import type { CircuitBreakerEvent, OwnerPaidCapitalControls, TreasurySnapshot } from "./types";
import { platformAllowed } from "./policy";

export type CircuitContext = {
  treasury: TreasurySnapshot;
  controls: OwnerPaidCapitalControls;
  requested_spend_usd: number;
  platform: string;
  business_id: string;
  campaign_id: string;
  /** Recent campaign economics deterioration flag from APEX/TITAN. */
  economics_deteriorated?: boolean;
  attribution_unreliable?: boolean;
  spend_acceleration_anomaly?: boolean;
  duplicate_campaign?: boolean;
  credentials_abnormal?: boolean;
  telemetry_stale?: boolean;
  abnormal_charge_refund_dispute?: boolean;
  /** Requested spend would push portfolio past ceiling (pre-check). */
  would_exceed_ceiling?: boolean;
  would_exceed_owner_cap?: boolean;
  /** Provider vs internal disagree. */
  provider_disagrees?: boolean;
};

export function evaluateCircuitBreakers(ctx: CircuitContext): CircuitBreakerEvent[] {
  const events: CircuitBreakerEvent[] = [];
  const at = new Date().toISOString();
  const push = (
    code: string,
    severity: CircuitBreakerEvent["severity"],
    detail: string,
  ) => {
    events.push({ id: newId("tcb"), at, code, severity, detail });
  };

  if (!ctx.controls.paid_capital_enabled) {
    push("PAID_CAPITAL_DISABLED", "freeze_portfolio", "Owner has not enabled PAID_CAPITAL_ENABLED");
  }
  if (ctx.controls.pause_all_paid_acquisition) {
    push("OWNER_PAUSE", "freeze_portfolio", "Owner pause overrides everything immediately");
  }
  if (!platformAllowed(ctx.controls, ctx.platform)) {
    push("PLATFORM_DISABLED", "reject_request", `Platform ${ctx.platform} not enabled by owner`);
  }
  if (!ctx.treasury.reconciliation.ok || ctx.provider_disagrees) {
    push(
      "RECONCILIATION_FAILURE",
      "freeze_portfolio",
      ctx.treasury.reconciliation.note,
    );
  }
  if (ctx.would_exceed_ceiling || ctx.requested_spend_usd > ctx.treasury.remaining_ceiling_usd + 1e-9) {
    push(
      "PORTFOLIO_5PCT_CEILING",
      "reject_request",
      `Request ${ctx.requested_spend_usd} exceeds remaining ceiling ${ctx.treasury.remaining_ceiling_usd}`,
    );
  }
  if (ctx.would_exceed_owner_cap) {
    push("OWNER_ABSOLUTE_CAP", "reject_request", "Would exceed owner absolute daily cap");
  }
  if (ctx.attribution_unreliable) {
    push("ATTRIBUTION_UNRELIABLE", "freeze_business", "Attribution unreliable — no new spend");
  }
  if (ctx.spend_acceleration_anomaly) {
    push("SPEND_ACCELERATION", "freeze_business", "Spend accelerating unexpectedly");
  }
  if (ctx.economics_deteriorated) {
    push("ECONOMICS_DETERIORATED", "freeze_business", "Campaign economics beyond policy");
  }
  if (ctx.duplicate_campaign) {
    push("DUPLICATE_CAMPAIGN", "reject_request", "Duplicate campaign/action detected");
  }
  if (ctx.credentials_abnormal) {
    push("CREDENTIALS_ABNORMAL", "freeze_portfolio", "Ad account credentials/state abnormal");
  }
  if (ctx.telemetry_stale) {
    push("TELEMETRY_STALE", "freeze_portfolio", "Telemetry stale — default NO NEW SPEND");
  }
  if (ctx.abnormal_charge_refund_dispute) {
    push(
      "ABNORMAL_MONEY_EVENTS",
      "freeze_portfolio",
      "Abnormal charge/refund/dispute behavior",
    );
  }
  if (ctx.treasury.eligible_capital_usd <= 0) {
    push("NO_ELIGIBLE_CAPITAL", "freeze_portfolio", "No eligible settled capital after reserves");
  }

  return events;
}

export function shouldFreezeNewSpend(events: CircuitBreakerEvent[]): boolean {
  return events.some(
    (e) => e.severity === "freeze_portfolio" || e.severity === "freeze_business" || e.severity === "reject_request",
  );
}
