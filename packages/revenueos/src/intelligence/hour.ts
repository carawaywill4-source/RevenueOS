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
import { newId } from "../ledger/store";

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
    return `Learned: ${views} view(s) last hour — discovery failed. Next hour must produce strangers, not excuses.`;
  }
  if (revenue <= 0 && views >= 10 && checkouts === 0) {
    return `Learned: ${views} view(s) arrived and none started checkout (friction=${input.world.shopper.primaryFriction}). Next hour attack conversion, not more empty traffic alone.`;
  }
  if (revenue <= 0 && checkouts > 0 && purchases === 0) {
    return `Learned: ${checkouts} checkout(s) and $0. Demand is dying at payment. Next hour close checkout, don't celebrate the click.`;
  }
  if (revenue <= 0) {
    return "Learned: a $0 hour teaches what not to repeat. Next hour a different, harder, executable bet. Quitting is forbidden.";
  }
  return `Learned: $${revenue.toFixed(2)} / ${purchases} sale(s) last hour. Not enough. Compound what worked and test one new lever so the next hour is strictly better.`;
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
      ? `ZERO HOUR. $${revenue.toFixed(2)} in the last 60 minutes is a stain, not a lull. We do not excuse it, baptize it as "brand building," wait, or quit. Repentance is overdrive + learning from that hour so the next one is not barren. Giving up is not an option.`
      : verdict === "thin_hour"
        ? `Thin hour: $${revenue.toFixed(2)} / ${purchases} sale(s). Better than empty, still not enough. Want more. Learn from it. Beat $${nextHourBarUsd.toFixed(2)} next hour.`
        : `Hour produced $${revenue.toFixed(2)}. Do not coast — want better. Next hour bar is $${nextHourBarUsd.toFixed(2)}. A later $0 hour would still be failure.`;

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
      title: "Overdrive discovery: get strangers in the door this hour",
      why: `${views} landing view(s) last hour. Without traffic there is no sale. IndexNow, high-intent pages, directories — all at once, no waiting, no quitting.`,
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

/** Every hour, including non-zero hours, becomes a durable lesson. */
export function lessonFromHour(input: {
  siteId: string;
  industry: string;
  hourPlan: HourPlan;
  now?: Date;
}): Lesson {
  const now = input.now ?? new Date();
  const zero = input.hourPlan.overdrive;
  return {
    id: newId("lesson"),
    scope: "site",
    siteId: input.siteId,
    industry: input.industry,
    patternKey: zero ? "zero-hour:overdrive" : `hour:${input.hourPlan.hourVerdict}`,
    summary: `${input.hourPlan.learnedFromLastHour} Next-hour bar: $${input.hourPlan.nextHourBarUsd.toFixed(2)}. Never give up.`,
    evidenceCount: 1,
    transferable: true,
    sentiment: zero ? "negative" : input.hourPlan.hourVerdict === "won_hour" ? "positive" : "neutral",
    rankingWeight: zero ? 1.4 : 1.15,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
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
