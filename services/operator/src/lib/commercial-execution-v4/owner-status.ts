/**
 * Owner-facing commercial reality — not internal telemetry.
 */

import type pg from "pg";
import { refreshExposureClock, refreshFunnelTruth } from "./ledger.js";

export type OwnerCommercialStatus = {
  frontier: string | null;
  bottleneck: string;
  lastCommercialAction: string;
  lastResult: string;
  nextAction: string;
  humans: number;
  leads: number;
  checkouts: number;
  revenue: number;
  externalActions: number;
  zeroExposureMode: boolean;
  firstRealCustomerMode: boolean;
  commercialExecutionRatio: number;
  activeBusinesses: number;
  retiredBusinesses: number;
};

export async function ownerCommercialStatus(
  pool: pg.Pool,
  frontierHint?: string | null,
): Promise<OwnerCommercialStatus> {
  const frontierRow = await pool.query(
    `select business_id from ros_frontier_selection order by created_at desc limit 1`,
  ).catch(() => ({ rows: [] as Array<{ business_id: string }> }));
  const frontier =
    frontierHint ||
    (frontierRow.rows[0] ? String(frontierRow.rows[0].business_id) : "buildgrid");

  const funnel = await refreshFunnelTruth(pool, frontier).catch(() => ({
    stage: "EXTERNAL_ACTION" as const,
    counts: {
      externalActions: 0,
      exposures: 0,
      verifiedHumans: 0,
      engagements: 0,
      leads: 0,
      checkouts: 0,
      purchases: 0,
    },
  }));
  const last = await pool.query(
    `select channel, action_type, target, result, executed, created_at, next_action, failure_reason
       from ros_commercial_actions
      where business_id=$1
      order by created_at desc limit 1`,
    [frontier],
  );
  const lastRow = last.rows[0];
  const mode = await pool.query(`select * from ros_cee_mode where id='current'`).catch(
    () => ({ rows: [{}] }),
  );
  const counts = await pool.query(
    `select
       count(*) filter (where lower(status) in ('active','launched','accepted','live','launching','probation'))::int as active,
       count(*) filter (where lower(status) in ('retired','archived'))::int as retired
     from ros_businesses`,
  );
  const lastAction = lastRow
    ? `${lastRow.action_type} ${lastRow.target ? `to ${String(lastRow.target).slice(0, 60)}` : ""} at ${new Date(lastRow.created_at).toISOString().slice(11, 16)} UTC`.trim()
    : "none yet";

  return {
    frontier,
    bottleneck: funnel.stage,
    lastCommercialAction: lastAction,
    lastResult: lastRow ? String(lastRow.result || lastRow.failure_reason || "") : "none",
    nextAction: lastRow ? String(lastRow.next_action || "execute_legitimate_distribution") : "execute_legitimate_distribution",
    humans: funnel.counts.verifiedHumans,
    leads: funnel.counts.leads,
    checkouts: funnel.counts.checkouts,
    revenue: 0,
    externalActions: funnel.counts.externalActions,
    zeroExposureMode: Boolean(mode.rows[0]?.zero_exposure ?? true),
    firstRealCustomerMode: Boolean(mode.rows[0]?.first_real_customer ?? true),
    commercialExecutionRatio: Number(mode.rows[0]?.commercial_execution_ratio ?? 0),
    activeBusinesses: Number(counts.rows[0]?.active ?? 0),
    retiredBusinesses: Number(counts.rows[0]?.retired ?? 0),
  };
}

export function formatOwnerNow(s: OwnerCommercialStatus): string {
  return [
    s.frontier ?? "no-frontier",
    `Current bottleneck: ${s.bottleneck === "EXTERNAL_ACTION" ? "no external audience" : s.bottleneck.toLowerCase().replace(/_/g, " ")}`,
    `Last commercial action: ${s.lastCommercialAction}`,
    `Result: ${s.lastResult || "n/a"}`,
    `Next action: ${s.nextAction}`,
    `Humans: ${s.humans}`,
    `Leads: ${s.leads}`,
    `Checkouts: ${s.checkouts}`,
    `Revenue: $${s.revenue}`,
  ].join("\n");
}

export function isCommercialNowQuestion(message: string): boolean {
  return /what are you doing|right now|bottleneck|humans|revenue|doing now|commercial/i.test(
    message,
  );
}
