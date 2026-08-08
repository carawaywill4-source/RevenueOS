import type { OwnerReportSummary } from "@revenueos/core";
import { formatOwnerReport } from "@revenueos/core";
import type { GrowthSnapshot } from "@/lib/growthos";
import type { ContinuousHuntResult } from "@/revenueos/continuous-hunt";

/**
 * Owner Report email — what RevenueOS did / learned / does next.
 * Never a "woke up and decided" checklist.
 */

export function formatHourlyProfitEmail(
  input: ContinuousHuntResult | GrowthSnapshot,
): string {
  if ("ownerReport" in input) {
    const report = formatOwnerReport(input.ownerReport);
    return [
      report,
      "",
      "Dashboard: https://tributeready.org/owner",
    ].join("\n");
  }

  const hour = input.cycle?.hourPlan;
  const revenue = hour?.lastHourRevenueUsd ?? 0;
  const sales = hour?.lastHourPurchases ?? 0;
  const views = hour?.lastHourLandingViews ?? 0;
  return [
    "OWNER REPORT — tributeready (compat)",
    `Sales ${sales} · views ${views} · revenue $${revenue.toFixed(2)}`,
    `Next: ${input.nextAction}`,
    "",
    "Dashboard: https://tributeready.org/owner",
  ].join("\n");
}

export function hourlyEmailSubject(
  input: ContinuousHuntResult | GrowthSnapshot | OwnerReportSummary,
): string {
  if ("ownerReport" in input) {
    const r = input.ownerReport;
    if (r.operationalFailure) return "TributeReady: operational failure this hour";
    if (r.actionsCompleted > 0) {
      return `TributeReady: ${r.actionsCompleted} action(s) · $${r.hourRevenueUsd.toFixed(2)}`;
    }
    if (r.hourPurchases <= 0) return "TributeReady: $0 last hour";
    return `TributeReady: $${r.hourRevenueUsd.toFixed(2)} last hour`;
  }
  if ("hourRevenueUsd" in input && "actionsCompleted" in input) {
    if (input.operationalFailure) return "TributeReady: operational failure this hour";
    return `TributeReady: $${input.hourRevenueUsd.toFixed(2)} last hour`;
  }
  const hour = input.cycle?.hourPlan;
  const rev = hour?.lastHourRevenueUsd ?? 0;
  if (hour?.overdrive || hour?.hourVerdict === "zero_hour") {
    return "TributeReady: $0 last hour";
  }
  return `TributeReady: $${rev.toFixed(2)} last hour`;
}
