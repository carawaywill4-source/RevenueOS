/**
 * Owner-facing paid capital controls & scoreboard shape.
 * UI can bind to this without reading internal ledger guts.
 */

import type { OwnerPaidCapitalControls, TreasurySnapshot } from "./types";
import { clampOwnerControls } from "./policy";

export type PaidCapitalOwnerView = {
  paid_capital: "OFF" | "ON";
  max_daily_pct: number;
  hard_maximum_pct: 0.05;
  absolute_daily_cap_usd: number;
  protected_cash_floor_usd: number;
  pause_all_paid_acquisition: boolean;
  platforms: OwnerPaidCapitalControls["platforms_enabled"];
  live_execution: "OFF" | "ON";
  treasury: {
    earned_gross_usd: number;
    settled_usd: number;
    reserved_usd: number;
    available_usd: number;
    authorized_today_usd: number;
    spent_today_usd: number;
    remaining_hard_ceiling_usd: number;
    daily_ceiling_usd: number;
  };
  performance: {
    revenue_attributed_usd: number;
    incremental_profit_estimate_usd: number;
    confidence: number;
  };
  notes: string[];
};

export function buildPaidCapitalOwnerView(input: {
  controls: OwnerPaidCapitalControls;
  treasury: TreasurySnapshot;
  revenue_attributed_usd?: number;
  incremental_profit_estimate_usd?: number;
  confidence?: number;
}): PaidCapitalOwnerView {
  const c = clampOwnerControls(input.controls);
  const t = input.treasury;
  const reserved =
    t.refund_reserve_usd +
    t.dispute_reserve_usd +
    t.tax_reserve_usd +
    t.protected_cash_floor_usd;
  return {
    paid_capital: c.paid_capital_enabled ? "ON" : "OFF",
    max_daily_pct: c.max_daily_pct,
    hard_maximum_pct: 0.05,
    absolute_daily_cap_usd: c.absolute_daily_cap_usd,
    protected_cash_floor_usd: c.protected_cash_floor_usd,
    pause_all_paid_acquisition: c.pause_all_paid_acquisition,
    platforms: c.platforms_enabled,
    live_execution: c.live_paid_execution_enabled ? "ON" : "OFF",
    treasury: {
      earned_gross_usd: t.gross_revenue_usd,
      settled_usd: t.settled_usd,
      reserved_usd: reserved,
      available_usd: t.available_usd,
      authorized_today_usd: t.ad_authorized_today_usd,
      spent_today_usd: t.ad_spent_today_usd,
      remaining_hard_ceiling_usd: t.remaining_ceiling_usd,
      daily_ceiling_usd: t.daily_ceiling_usd,
    },
    performance: {
      revenue_attributed_usd: input.revenue_attributed_usd ?? 0,
      incremental_profit_estimate_usd: input.incremental_profit_estimate_usd ?? 0,
      confidence: input.confidence ?? 0,
    },
    notes: [
      "5% is portfolio-wide ceiling, never a spending target",
      "Stripe is treasury/evidence — not an unlimited ad wallet",
      "Owner pause overrides everything immediately",
      "$10k/day/business remains stretch ambition — not permission to violate capital policy",
    ],
  };
}
