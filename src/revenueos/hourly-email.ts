import type { GrowthSnapshot } from "@/lib/growthos";

/**
 * Short hourly owner email. Numbers + 3 next moves. Details live on /owner.
 */
export function formatHourlyProfitEmail(snapshot: GrowthSnapshot): string {
  const hour = snapshot.cycle?.hourPlan;
  const zero = hour?.overdrive || hour?.hourVerdict === "zero_hour";
  const revenue = hour?.lastHourRevenueUsd ?? 0;
  const sales = hour?.lastHourPurchases ?? 0;
  const views = hour?.lastHourLandingViews ?? 0;
  const checkouts = hour?.lastHourCheckouts ?? 0;
  const bar = hour?.nextHourBarUsd ?? 0.01;
  const week = snapshot.money.revenueUsd;

  const headline = zero
    ? `TributeReady cycle: $0 last hour; next target $${bar.toFixed(2)}.`
    : `TributeReady cycle: $${revenue.toFixed(2)} last hour; next target $${bar.toFixed(2)}.`;

  return [
    headline,
    "",
    `Sales ${sales} · views ${views} · checkouts ${checkouts}`,
    `Week so far: $${week.toFixed(2)}`,
    "",
    "Dashboard: https://tributeready.org/owner",
  ].join("\n");
}

export function hourlyEmailSubject(snapshot: GrowthSnapshot): string {
  const hour = snapshot.cycle?.hourPlan;
  const rev = hour?.lastHourRevenueUsd ?? 0;
  if (hour?.overdrive || hour?.hourVerdict === "zero_hour") {
    return "TributeReady: $0 last hour";
  }
  return `TributeReady: $${rev.toFixed(2)} last hour`;
}

