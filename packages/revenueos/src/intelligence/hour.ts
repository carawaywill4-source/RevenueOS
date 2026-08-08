import type {
  HourPlan,
  HourPlanMove,
  HourPulse,
  HourVerdict,
  Lesson,
  Opportunity,
  Observation,
  Scorecard,
  WorldModel,
} from "../types";
import { toPortableLesson } from "../memory/portable";

export function hourVerdictOf(pulse?: HourPulse): HourVerdict {
  if (!pulse) return "thin_hour";
  if (pulse.zeroHour || pulse.revenueUsd <= 0) return "zero_hour";
  if (pulse.purchases < 2) return "thin_hour";
  return "won_hour";
}

/** Overdrive only when the adapter actually measured a $0 clock hour. */
export function isZeroHour(pulse?: HourPulse): boolean {
  return Boolean(pulse) && hourVerdictOf(pulse) === "zero_hour";
}

function priorHourRevenue(history: Scorecard[]): number | null {
  for (const card of history) {
    const prior = card.hourPlan?.lastHourRevenueUsd;
    if (typeof prior === "number") return prior;
  }
  return null;
}

function learnFromLastHour(input: {
  pulse?: HourPulse;
  history: Scorecard[];
  world: WorldModel;
}): string {
  const pulse = input.pulse;
  const prior = priorHourRevenue(input.history);
  const revenue = pulse?.revenueUsd ?? 0;
  const views = pulse?.landingViews ?? 0;
  const checkouts = pulse?.checkouts ?? 0;
  const purchases = pulse?.purchases ?? 0;

  if (!pulse) {
    return "No hour pulse yet — still hunt. Giving up is not a conclusion we are allowed to reach.";
  }

  if (prior != null && revenue > prior) {
    return `Last hour beat the prior hour ($${revenue.toFixed(2)} > $${prior.toFixed(2)}). Keep the winning pattern, raise the bar to $${(revenue + 0.01).toFixed(2)}, and keep learning — better is still required.`;
  }
  if (prior != null && revenue < prior) {
    return `Last hour slipped vs the prior hour ($${revenue.toFixed(2)} < $${prior.toFixed(2)}). That is a lesson, not a reason to stop. Change the playbook this hour.`;
  }
  if (revenue <= 0 && views < 10) {
    return `FAILING hour: ${views} view(s), $0 made. Discovery tool failed. Next hour: buyable research → sellable door → index. Strangers who can buy — money is the only success.`;
  }
  if (revenue <= 0 && views >= 10 && checkouts === 0) {
    return `FAILING hour: ${views} view(s), $0 made (friction=${input.world.shopper.primaryFriction}). Traffic without sales is still failure. Next hour close — do not mint more vanity pages.`;
  }
  if (revenue <= 0 && checkouts > 0 && purchases === 0) {
    return `FAILING hour: ${checkouts} checkout(s), $0 made. Payment is killing money. Close checkout — clicks are not success.`;
  }
  if (revenue <= 0) {
    return "FAILING hour: $0 made for the customer. That outcome is forbidden as a steady state. Different, harder, executable bet next hour until money prints.";
  }
  return `Money printed: $${revenue.toFixed(2)} / ${purchases} sale(s). Still not enough vs the north star. Compound what sold and beat $${(revenue + 0.01).toFixed(2)} next hour.`;
}

/**
 * $0 hour confession + next-hour profit plan. Empty hours are not "quiet" —
 * they are failure. Every hour leaves a lesson. Giving up is not an option.
 */
export function buildHourPlan(input: {
  observation: Observation;
  world: WorldModel;
  opportunities: Opportunity[];
  history?: Scorecard[];
}): HourPlan {
  const pulse = input.observation.hourPulse;
  const verdict = hourVerdictOf(pulse);
  const overdrive = verdict === "zero_hour";
  const revenue = pulse?.revenueUsd ?? 0;
  const purchases = pulse?.purchases ?? 0;
  const views = pulse?.landingViews ?? input.observation.funnel.landingViews;
  const checkouts = pulse?.checkouts ?? input.observation.funnel.checkouts;
  const learnedFromLastHour = learnFromLastHour({
    pulse,
    history: input.history ?? [],
    world: input.world,
  });
  const nextHourBarUsd = Number((Math.max(0, revenue) + 0.01).toFixed(2));

  const confession =
    verdict === "zero_hour"
      ? `ZERO HOUR = FAILING. $${revenue.toFixed(2)} made for the customer in 60 minutes. Sales are the only success; everything else is a tool. Do not excuse $0, call it brand building, wait, or quit. Overdrive + learn until money prints. Failure is not an option.`
      : verdict === "thin_hour"
        ? `Thin hour: only $${revenue.toFixed(2)} / ${purchases} sale(s) made. Better than $0, still failing vs the bar. Want more money. Beat $${nextHourBarUsd.toFixed(2)} next hour.`
        : `Hour made $${revenue.toFixed(2)} for the customer. Do not coast — more money. Next bar $${nextHourBarUsd.toFixed(2)}. A later $0 hour is failure.`;

  const moves: HourPlanMove[] = [];
  const seen = new Set<string>();
  for (const opp of input.opportunities) {
    if (moves.length >= 6) break;
    if (seen.has(opp.id)) continue;
    seen.add(opp.id);
    moves.push({
      title: opp.title,
      why: opp.action,
      ownerGated: !opp.safeActionType,
    });
  }

  if (overdrive && views < 10) {
    moves.unshift({
      title: "Overdrive discovery: research the internet, publish, index",
      why: `${views} landing view(s) last hour. Without traffic there is no sale. Run market research on the live web, publish an intent topic, IndexNow + sitemap ping — all at once. Do not rotate promos into silence.`,
    });
  } else if (overdrive && views >= 10 && purchases === 0) {
    moves.unshift({
      title: "Overdrive conversion: close the visitors who already came",
      why: `${views} view(s) and ${checkouts} checkout(s) last hour with $0. Traffic without a close is wasted. Attack the funnel drop immediately.`,
    });
  }

  if (!moves.length) {
    moves.push({
      title: "Invent the next in-policy money lever",
      why: "No ranked lever this cycle is not permission to stop — generate one that moves a revenue precursor before the hour ends.",
    });
  }

  return {
    hourVerdict: verdict,
    lastHourRevenueUsd: Number(revenue.toFixed(2)),
    lastHourPurchases: purchases,
    lastHourLandingViews: views,
    lastHourCheckouts: checkouts,
    overdrive,
    confession,
    nextHourMoves: moves.slice(0, 6),
    learnedFromLastHour,
    nextHourBarUsd,
    neverGiveUp: true,
  };
}

/** Every hour becomes a portable lesson so new businesses inherit the failure signal. */
export function lessonFromHour(input: {
  siteId: string;
  industry: string;
  hourPlan: HourPlan;
  now?: Date;
}): Lesson {
  const now = input.now ?? new Date();
  const zero = input.hourPlan.overdrive;
  return toPortableLesson({
    siteId: input.siteId,
    industry: input.industry,
    now,
    lesson: {
      patternKey: zero ? "zero-hour:overdrive" : `hour:${input.hourPlan.hourVerdict}`,
      summary: `${input.hourPlan.learnedFromLastHour} Next-hour bar: $${input.hourPlan.nextHourBarUsd.toFixed(2)}. Never give up.`,
      evidenceCount: 1,
      transferable: true,
      sentiment: zero
        ? "negative"
        : input.hourPlan.hourVerdict === "won_hour"
          ? "positive"
          : "neutral",
      rankingWeight: zero ? 1.4 : 1.15,
    },
  });
}

/** @deprecated use lessonFromHour — kept so existing imports still typecheck during rollout. */
export function lessonFromZeroHour(input: {
  siteId: string;
  industry: string;
  hourPlan: HourPlan;
  now?: Date;
}): Lesson | null {
  return lessonFromHour(input);
}
