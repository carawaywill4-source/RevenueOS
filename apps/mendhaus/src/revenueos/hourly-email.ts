import {
  formatHourlyCheck,
  hourlyCheckSubject,
  type HourPulse,
  type OwnerReportSummary,
} from "@revenueos/core";
import { BRAND } from "@/lib/brand";

type HourlySnapshot = {
  hour: HourPulse;
  weekRevenueUsd: number;
  nextAction: string;
  bottleneckLabel: string;
  actionsCompleted: string[];
  discoverySummary?: string;
  discoveryAttacks?: string[];
  publishedTopics?: string[];
  learningDelta?: string;
  plannerSource?: string;
  ownerReport?: OwnerReportSummary;
};

/** Hourly check — amount made + visitors only. */
export function formatMendhausHourlyEmail(snapshot: HourlySnapshot): string {
  if (snapshot.ownerReport) {
    return formatHourlyCheck({
      siteId: snapshot.ownerReport.siteId,
      revenueUsd: snapshot.ownerReport.hourRevenueUsd,
      visitors: snapshot.ownerReport.hourLandingViews,
    });
  }

  const hour = snapshot.hour;
  return formatHourlyCheck({
    siteId: BRAND.name,
    revenueUsd: hour.revenueUsd ?? 0,
    visitors: hour.landingViews ?? 0,
  });
}

export function mendhausHourlySubject(snapshot: HourlySnapshot): string {
  if (snapshot.ownerReport) {
    return hourlyCheckSubject({
      siteId: snapshot.ownerReport.siteId,
      revenueUsd: snapshot.ownerReport.hourRevenueUsd,
      visitors: snapshot.ownerReport.hourLandingViews,
    });
  }
  return hourlyCheckSubject({
    siteId: BRAND.name,
    revenueUsd: snapshot.hour.revenueUsd ?? 0,
    visitors: snapshot.hour.landingViews ?? 0,
  });
}
