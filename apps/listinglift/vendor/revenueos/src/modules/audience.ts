import {
  ACQUISITION_CHANNELS,
  BUYER_ARCHETYPES,
  channelByKey,
  inferArchetypes,
} from "../knowledge/audiences";
import { pickBestArm } from "../intelligence/bandit";
import type {
  AudienceModel,
  AudiencePersona,
  BanditStat,
  BusinessContext,
  ChannelPlay,
  MarketSignals,
  Observation,
  WorldModel,
} from "../types";

/**
 * Model who we sell to, where to reach them, and how hard the sale is.
 *
 * Two philosophies are baked in:
 *  1. Traffic is never the excuse. There is always a ranked plan of zero-spend,
 *     in-policy channels for the relevant personas — the brain's job is to work
 *     them, not to declare "not enough traffic" and stop.
 *  2. A hard sell raises resolve. Difficulty (traffic that won't convert, high
 *     competition, cold intent) does not lower ambition — it multiplies it.
 */
export function buildAudienceModel(input: {
  context: BusinessContext;
  observation: Observation;
  world: Pick<WorldModel, "market" | "shopper" | "business">;
  signals?: MarketSignals;
  /** Learned win/loss per arm, so the plan prioritizes what already sells. */
  banditStats?: Map<string, BanditStat>;
}): AudienceModel {
  const personas = resolvePersonas(input.context);
  const salesDifficulty = scoreSalesDifficulty(input);
  const difficultyReasons = difficultyReasonsFor(input);
  const resolveMultiplier = Number((1 + salesDifficulty).toFixed(2));
  const channelPlan = buildChannelPlan(
    personas,
    input,
    salesDifficulty,
    input.banditStats ?? new Map(),
  );

  const notes: string[] = [];
  notes.push(
    `Selling to ${personas.length} persona(s): ${personas.map((p) => p.label).join(", ")}.`,
  );
  if (salesDifficulty >= 0.5) {
    notes.push(
      `Hard sell (difficulty ${salesDifficulty.toFixed(2)}). Good — push harder, not softer. Resolve ×${resolveMultiplier}.`,
    );
  }
  notes.push(
    `${channelPlan.length} acquisition play(s) queued. Traffic is a solvable problem, never the excuse. Never wait on one owner-gated channel — keep hunting open levers.`,
  );

  return {
    personas,
    channelPlan,
    salesDifficulty,
    difficultyReasons,
    resolveMultiplier,
    notes,
  };
}

/** Normalize site-declared segments, filling gaps from portable archetypes. */
function resolvePersonas(context: BusinessContext): AudiencePersona[] {
  const declared = context.audienceSegments ?? [];
  if (declared.length === 0) return inferArchetypes(context.industry);

  return declared.map((seg, index) => {
    // Match a base archetype by id or fuzzy label to inherit sensible defaults.
    const base =
      BUYER_ARCHETYPES.find((a) => a.id === seg.id) ??
      BUYER_ARCHETYPES.find((a) =>
        seg.label.toLowerCase().includes(a.label.toLowerCase().split(" ")[0]),
      );
    return {
      id: seg.id ?? `segment-${index + 1}`,
      label: seg.label,
      traits: seg.traits ?? base?.traits ?? [],
      habits: seg.habits ?? base?.habits ?? [],
      channels: seg.channels ?? base?.channels ?? ["organic_search"],
      triggers: seg.triggers ?? base?.triggers ?? [],
      objections: seg.objections ?? base?.objections ?? [],
      messagingAngles: seg.messagingAngles ?? base?.messagingAngles ?? [],
      intentTemperature: seg.intentTemperature ?? base?.intentTemperature ?? "warm",
    };
  });
}

/**
 * 0 (sells itself) .. 1 (brutal). Rises when qualified traffic refuses to
 * convert, competition is high, intent is cold, or the offer is still unproven.
 */
function scoreSalesDifficulty(input: {
  observation: Observation;
  world: Pick<WorldModel, "market" | "shopper" | "business">;
}): number {
  const { observation, world } = input;
  let difficulty = 0.2; // nothing sells itself; start with baseline effort

  const views = observation.funnel.landingViews;
  const purchases = observation.money.purchases;
  // Traffic that will not convert is the clearest "hard sell" signal.
  if (views >= 50 && purchases === 0) difficulty += 0.4;
  else if (views >= 20 && purchases === 0) difficulty += 0.25;

  if (world.market.competitivePressure === "high") difficulty += 0.2;
  else if (world.market.competitivePressure === "moderate") difficulty += 0.1;

  if (world.shopper.intentTemperature === "cold") difficulty += 0.15;
  if (world.shopper.primaryFriction === "trust") difficulty += 0.1;
  if (world.business.monetizationStage === "pre_revenue") difficulty += 0.1;

  return Number(Math.max(0, Math.min(1, difficulty)).toFixed(2));
}

function difficultyReasonsFor(input: {
  observation: Observation;
  world: Pick<WorldModel, "market" | "shopper" | "business">;
}): string[] {
  const { observation, world } = input;
  const reasons: string[] = [];
  if (observation.funnel.landingViews >= 20 && observation.money.purchases === 0) {
    reasons.push("Qualified traffic is arriving but not converting yet.");
  }
  if (world.market.competitivePressure === "high") {
    reasons.push("Competitive pressure is high.");
  }
  if (world.shopper.intentTemperature === "cold") {
    reasons.push("Buyer intent skews cold — demand must be created, not just captured.");
  }
  if (world.shopper.primaryFriction === "trust") {
    reasons.push("Trust is the primary friction at the decision point.");
  }
  if (reasons.length === 0) reasons.push("No acute resistance detected — press the advantage.");
  return reasons;
}

/**
 * Rank persona × channel plays by fit. Always returns a non-empty plan so the
 * brain always has traffic moves to make. When discovery is thin, high-intent
 * channels are boosted; when the sale is hard, more variety is surfaced.
 */
function buildChannelPlan(
  personas: AudiencePersona[],
  input: {
    world: Pick<WorldModel, "market">;
    observation: Observation;
  },
  salesDifficulty: number,
  stats: Map<string, BanditStat>,
): ChannelPlay[] {
  const discoveryGap =
    input.world.market.discoveryCoverage === "none" ||
    input.world.market.discoveryCoverage === "thin";

  const plays: ChannelPlay[] = [];
  for (const persona of personas) {
    for (const channelKey of persona.channels) {
      const channel = channelByKey(channelKey);
      if (!channel) continue;
      const intentBoost =
        channel.intent === "high" ? 0.3 : channel.intent === "medium" ? 0.15 : 0;
      const discoveryBoost = discoveryGap && channel.intent !== "low" ? 0.15 : 0;
      const tempBoost = persona.intentTemperature === "hot" ? 0.1 : 0;
      const fit = Number(
        Math.max(0, Math.min(1, 0.4 + intentBoost + discoveryBoost + tempBoost)).toFixed(2),
      );

      // Message optimization: treat each persona's messaging angles as arms and
      // let the bandit choose the one that has made (or promises) the most money
      // on THIS channel. Attribution is angle-level, so the machine learns which
      // message on which channel for which persona actually converts.
      const angles =
        persona.messagingAngles.length > 0
          ? persona.messagingAngles
          : [`Reach ${persona.label} where they already are`];
      const armKeys = angles.map(
        (_, i) => `acq:${channel.key}:${persona.id}:a${i}`,
      );
      // Angle selection uses UCB (exploration in), so under-tested angles still
      // get rotated in. Plan RANKING, though, is exploitation-weighted: what has
      // actually won floats to the top. Exploration still enters at the scoring
      // layer (strategy bandit), so we don't starve novel arms of a real shot.
      const chosen = pickBestArm(armKeys, stats);
      const patternKey = armKeys[chosen.index];
      const winRate = stats.get(patternKey)?.posteriorWinRate ?? 0.3;
      const learnedFit = Number(
        Math.max(0, Math.min(1, fit * (0.5 + winRate))).toFixed(2),
      );

      plays.push({
        channel: channel.key,
        persona: persona.id,
        intent: channel.intent,
        precursor: channel.precursor,
        angle: angles[chosen.index],
        angleIndex: chosen.index,
        effort: channel.effort,
        needsOwner: channel.needsOwner,
        fit,
        learnedFit,
        patternKey,
        rationale: `${persona.label} → ${channel.label}. ${channel.playbook}`,
      });
    }
  }

  // De-dupe on channel+persona, keep the best-scoring arm, rank by LEARNED fit
  // so what already makes money floats to the top.
  const byPair = new Map<string, ChannelPlay>();
  for (const play of plays) {
    const pair = `${play.channel}:${play.persona}`;
    const existing = byPair.get(pair);
    if (!existing || play.learnedFit > existing.learnedFit) byPair.set(pair, play);
  }
  // Prefer open (no-owner) channels in the ranked plan so the machine never
  // sits idle waiting on a single marketplace/signup. Owner channels still
  // appear — they just cannot monopolize the top of the queue.
  const ranked = [...byPair.values()].sort((a, b) => {
    const score = (p: ChannelPlay) =>
      p.learnedFit * (p.needsOwner ? 0.72 : 1.18);
    return score(b) - score(a);
  });

  // Surface more variety when the sale is hard; always keep a wide hunt open.
  const cap = salesDifficulty >= 0.5 ? 10 : 8;
  let plan = ranked.slice(0, cap);

  // Guarantee at least half the plan is executable without an owner when possible.
  const open = ranked.filter((p) => !p.needsOwner);
  const owned = ranked.filter((p) => p.needsOwner);
  if (open.length > 0) {
    const openSlots = Math.max(Math.ceil(cap * 0.55), Math.min(open.length, 4));
    plan = [
      ...open.slice(0, openSlots),
      ...owned.slice(0, cap - openSlots),
    ].slice(0, cap);
    // Re-sort within the guaranteed mix by learned fit for readability.
    plan.sort((a, b) => b.learnedFit - a.learnedFit);
  }

  // Guarantee a non-empty plan even if personas somehow had no channels.
  if (plan.length === 0) {
    const fallback = ACQUISITION_CHANNELS.filter((c) => c.intent === "high");
    for (const channel of fallback) {
      plan.push({
        channel: channel.key,
        persona: personas[0]?.id ?? "buyer",
        intent: channel.intent,
        precursor: channel.precursor,
        angle: "Reach high-intent buyers where they already are",
        angleIndex: 0,
        effort: channel.effort,
        needsOwner: channel.needsOwner,
        fit: 0.5,
        learnedFit: 0.5,
        patternKey: `acq:${channel.key}:buyer:a0`,
        rationale: channel.playbook,
      });
    }
  }

  return plan;
}
