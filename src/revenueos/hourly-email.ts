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
    ? `$0 last hour. Overdrive on. Next hour must beat $${bar.toFixed(2)}.`
    : `Last hour: $${revenue.toFixed(2)}. Next hour must beat $${bar.toFixed(2)}.`;

  const learned = shortLesson(hour?.learnedFromLastHour, views, checkouts, sales);
  const moves = (hour?.nextHourMoves ?? [])
    .slice(0, 3)
    .map((move, i) => {
      const tag = move.ownerGated ? " (needs you)" : "";
      return `${i + 1}. ${shortTitle(move.title)}${tag}`;
    });
  if (!moves.length) {
    moves.push(`1. ${shortTitle(snapshot.nextAction)}`);
  }

  return [
    headline,
    "",
    `Sales ${sales} · views ${views} · checkouts ${checkouts}`,
    `Week so far: $${week.toFixed(2)}`,
    "",
    `Learned: ${learned}`,
    "",
    "Next hour:",
    ...moves,
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

function shortTitle(title: string): string {
  return title
    .replace(/^Press:\s*/i, "")
    .replace(/^Overdrive discovery:\s*/i, "")
    .replace(/^Overdrive conversion:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function shortLesson(
  learned: string | undefined,
  views: number,
  checkouts: number,
  sales: number,
): string {
  if (sales > 0) return "Something sold. Do more of that, and one new test.";
  if (views < 10) return "Almost no visitors. Get more people to the site.";
  if (checkouts === 0) return "People came, nobody started checkout. Fix the offer/page.";
  return "Checkout started, no sale. Fix payment/checkout.";
}
