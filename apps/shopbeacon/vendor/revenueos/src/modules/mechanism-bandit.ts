/**
 * Thompson-sampling bandit over acquisition mechanism classes.
 *
 * Static ranking sends every business through the same catalog every cycle.
 * With a bandit, each cycle picks a *sample* from a posterior over mechanism
 * classes — a proven mechanism gets exploited most of the time, and untried
 * mechanisms are still explored proportional to their uncertainty.
 *
 * The posterior is Beta(α, β) per mechanism where:
 *   α = 1 + (weight-sum of positive commercial signal for that mechanism)
 *   β = 1 + (attempts that produced no signal)
 * Banned mechanisms are set to zero probability. Sampled ranks are used to
 * boost opportunities from the selected mechanism to the top of the queue.
 */

import type { Opportunity } from "../types";
import { classifyMechanism, type MechanismClass } from "./action-class";
import type { PatternPosteriorMap } from "./pattern-posterior";
import type { PortfolioSignal } from "./revenue-priority";

export type MechanismArm = {
  mechanism: MechanismClass;
  alpha: number;
  beta: number;
  attempts: number;
  positiveSignal: number;
  banned: boolean;
};

const ALL_MECHANISMS: MechanismClass[] = [
  "owned_content",
  "owned_distribution",
  "external_placement",
  "community_participation",
  "direct_outreach",
  "product_iteration",
  "conversion_optimization",
];

/**
 * Build Beta(α, β) arms from own + portfolio posteriors. Signal from any
 * portfolio site counts toward the arm because a mechanism that works on any
 * site is a prior for it working elsewhere.
 */
export function buildMechanismArms(input: {
  ownPosteriors: PatternPosteriorMap;
  portfolioSignal?: PortfolioSignal;
  bannedMechanisms?: Set<MechanismClass>;
}): MechanismArm[] {
  const banned = input.bannedMechanisms ?? new Set<MechanismClass>();
  const arms = new Map<MechanismClass, MechanismArm>();
  for (const m of ALL_MECHANISMS) {
    arms.set(m, {
      mechanism: m,
      alpha: 1,
      beta: 1,
      attempts: 0,
      positiveSignal: 0,
      banned: banned.has(m),
    });
  }
  for (const p of Object.values(input.ownPosteriors)) {
    const arm = arms.get(p.mechanism);
    if (!arm) continue;
    arm.attempts += p.attempts;
    const positive =
      p.commercialOutcomes * 4 + p.intents + p.verifiedExposures * 0.25;
    arm.positiveSignal += positive;
    arm.alpha += positive;
    // Only attempts with zero signal add to β; attempts that earned signal
    // already contributed to α.
    const dry = Math.max(0, p.attempts - positive);
    arm.beta += dry;
  }
  if (input.portfolioSignal) {
    for (const [m, s] of input.portfolioSignal.mechanismSignal) {
      const arm = arms.get(m);
      if (!arm) continue;
      // Portfolio evidence is a weaker prior than own-site — halve weight.
      arm.alpha += (s.commercial * 4 + s.intent + s.verifiedExposure * 0.25) / 2;
    }
  }
  return [...arms.values()];
}

/**
 * Sample a Beta(α, β) via ratio of Gammas — sufficient for arm selection.
 * Reservoir seed is deterministic if `seed` provided (used by tests).
 */
function sampleBeta(alpha: number, beta: number, rand: () => number): number {
  const x = sampleGamma(alpha, rand);
  const y = sampleGamma(beta, rand);
  const sum = x + y;
  return sum > 0 ? x / sum : 0;
}

function sampleGamma(k: number, rand: () => number): number {
  // Marsaglia-Tsang for k >= 1; boost for k < 1.
  if (k < 1) {
    const c = 1 + k;
    const u = rand();
    return sampleGamma(c, rand) * Math.pow(u, 1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x = 0;
    let v = 0;
    do {
      x = normal(rand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function normal(rand: () => number): number {
  // Box-Muller
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export type MechanismSample = {
  ranking: Array<{ mechanism: MechanismClass; sample: number; arm: MechanismArm }>;
  best: MechanismClass | null;
};

export function sampleMechanismRanking(input: {
  arms: MechanismArm[];
  rand?: () => number;
}): MechanismSample {
  const rand = input.rand ?? Math.random;
  const samples = input.arms.map((arm) => {
    if (arm.banned) return { mechanism: arm.mechanism, sample: 0, arm };
    const sample = sampleBeta(arm.alpha, arm.beta, rand);
    return { mechanism: arm.mechanism, sample, arm };
  });
  samples.sort((a, b) => b.sample - a.sample);
  return {
    ranking: samples,
    best: samples[0] && samples[0].sample > 0 ? samples[0].mechanism : null,
  };
}

/**
 * Apply a mechanism-ranking sample to opportunities. Opportunities in the
 * top-ranked mechanism get a large boost, second-ranked a smaller boost, etc.
 * This yields cycle-to-cycle variety even at similar posterior states.
 */
export function applyMechanismBandit(input: {
  opportunities: Opportunity[];
  sample: MechanismSample;
}): Opportunity[] {
  const rankIndex = new Map<MechanismClass, number>();
  input.sample.ranking.forEach((r, i) => rankIndex.set(r.mechanism, i));
  const boosts = [3.5, 2, 1.4, 1.1, 0.9, 0.7, 0.5];
  return input.opportunities
    .map((opp) => {
      const mechanism = classifyMechanism({
        actionType: opp.safeActionType,
        patternKey: opp.patternKey,
        category: opp.category,
      });
      const idx = rankIndex.get(mechanism);
      const factor = idx == null ? 0.8 : (boosts[idx] ?? 0.5);
      return { ...opp, score: Number((opp.score * factor).toFixed(2)) };
    })
    .sort((a, b) => b.score - a.score);
}
