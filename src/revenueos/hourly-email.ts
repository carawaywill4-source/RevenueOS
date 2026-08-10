import type { OwnerReportSummary } from "@revenueos/core";
import { formatHourlyCheck, hourlyCheckSubject } from "@revenueos/core";
import type { GrowthSnapshot } from "@/lib/growthos";
import type { ContinuousHuntResult } from "@/revenueos/continuous-hunt";

/**
 * Hourly owner check — amount made + visitors only.
 */

export function formatHourlyProfitEmail(
  input: ContinuousHuntResult | GrowthSnapshot,
): string {
  if ("ownerReport" in input) {
    const r = input.ownerReport;
    return formatHourlyCheck({
      siteId: r.siteId,
      revenueUsd: r.hourRevenueUsd,
      visitors: r.hourLandingViews,
    });
  }

  const hour = input.cycle?.hourPlan;
  const revenue = hour?.lastHourRevenueUsd ?? 0;
  const views = hour?.lastHourLandingViews ?? 0;
  return formatHourlyCheck({
    siteId: "tributeready",
    revenueUsd: revenue,
    visitors: views,
  });
}

export function hourlyEmailSubject(
  input: ContinuousHuntResult | GrowthSnapshot | OwnerReportSummary,
): string {
  if ("ownerReport" in input) {
    const r = input.ownerReport;
    return hourlyCheckSubject({
      siteId: r.siteId,
      revenueUsd: r.hourRevenueUsd,
      visitors: r.hourLandingViews,
    });
  }
  if ("hourRevenueUsd" in input && "hourLandingViews" in input) {
    return hourlyCheckSubject({
      siteId: "siteId" in input ? String(input.siteId) : "RevenueOS",
      revenueUsd: input.hourRevenueUsd,
      visitors: input.hourLandingViews,
    });
  }
  const hour = input.cycle?.hourPlan;
  return hourlyCheckSubject({
    siteId: "tributeready",
    revenueUsd: hour?.lastHourRevenueUsd ?? 0,
    visitors: hour?.lastHourLandingViews ?? 0,
  });
}
