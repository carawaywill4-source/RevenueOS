import {
  formatOwnerReport,
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

export function formatMendhausHourlyEmail(snapshot: HourlySnapshot): string {
  if (snapshot.ownerReport) {
    return [
      formatOwnerReport(snapshot.ownerReport),
      "",
      `Week revenue: $${snapshot.weekRevenueUsd.toFixed(2)}`,
      snapshot.discoverySummary
        ? `Discovery: ${snapshot.discoverySummary}`
        : "",
      `Next: ${snapshot.nextAction}`,
      "",
      "Mendhaus dashboard: https://mendhaus.shop/owner",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const hour = snapshot.hour;
  const revenue = hour.revenueUsd ?? 0;
  const sales = hour.purchases ?? 0;
  const views = hour.landingViews ?? 0;
  const checkouts = hour.checkouts ?? 0;
  const target = BRAND.dailyRevenueTargetUsd;
  const pace = revenue * 24;
  const gap = Math.max(0, target - pace);

  const headline =
    views < 10
      ? `$0 traffic hour (${views} views). Discovery attack required — not another merch email.`
      : hour.zeroHour
        ? `$0 sales last hour with ${views} views. Bottleneck: ${snapshot.bottleneckLabel}.`
        : `Last hour: $${revenue.toFixed(2)} · ${sales} sale(s). Pace ~$${pace.toFixed(0)}/day vs $${target.toLocaleString()} target.`;

  return [
    `Mendhaus RevenueOS brief — ${headline}`,
    "",
    `Funnel: ${views} views · ${checkouts} checkout(s) · ${sales} sale(s)`,
    `Mendhaus revenue this week: $${snapshot.weekRevenueUsd.toFixed(2)}`,
    gap > 0 ? `Gap to $${target.toLocaleString()}/day pace: ~$${gap.toFixed(0)}` : "Pace at or above target.",
    "",
    "WHAT CHANGED THIS CYCLE",
    snapshot.actionsCompleted.length
      ? snapshot.actionsCompleted.map((line) => `- ${line}`).join("\n")
      : "- (no executable action completed)",
    "",
    "INTERNET LEARNING",
    snapshot.discoverySummary
      ? snapshot.discoverySummary
      : "No internet research summary yet — next cycle must research the live web.",
    snapshot.discoveryAttacks?.length
      ? `Attack queries: ${snapshot.discoveryAttacks.join(" · ")}`
      : "Attack queries: none persisted yet",
    snapshot.publishedTopics?.length
      ? `Live intent doors: ${snapshot.publishedTopics.join(" · ")}`
      : "Live intent doors: none published yet",
    "",
    snapshot.learningDelta ? `Learning delta: ${snapshot.learningDelta}` : "",
    `Next Mendhaus move: ${snapshot.nextAction}`,
    snapshot.plannerSource ? `Planner source: ${snapshot.plannerSource}` : "",
    "",
    "Mendhaus dashboard: https://mendhaus.shop/owner",
  ]
    .filter(Boolean)
    .join("\n");
}

export function mendhausHourlySubject(snapshot: HourlySnapshot): string {
  if (snapshot.ownerReport?.operationalFailure) {
    return "Mendhaus: operational failure this hour";
  }
  if (snapshot.ownerReport && snapshot.ownerReport.actionsCompleted > 0) {
    return `Mendhaus: ${snapshot.ownerReport.actionsCompleted} action(s) · $${snapshot.ownerReport.hourRevenueUsd.toFixed(2)}`;
  }
  const views = snapshot.hour.landingViews ?? 0;
  if (views < 10) return `Mendhaus attack: ${views} views — discovery learning`;
  const rev = snapshot.hour.revenueUsd ?? 0;
  if (snapshot.hour.zeroHour) return "Mendhaus attack: $0 last hour";
  return `Mendhaus attack: $${rev.toFixed(2)} last hour`;
}
