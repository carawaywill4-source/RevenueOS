/**
 * Revenue-priority scoring.
 *
 * RevenueOS has one objective: real, collected revenue. Every opportunity is
 * re-scored by evidence it contributes to that objective:
 *
 *   +STRONG  prior commercial (purchase/refund) events on this pattern (this site)
 *   +HIGH    prior intent (checkout_started, cta_click) events on this pattern
 *   +MEDIUM  prior verified_exposure events on this pattern
 *   +TRANSFER prior commercial signal for this pattern on ANY portfolio site
 *   -PENALTY pattern in a banned mechanism family
 *
 * Production activity (page publishes) with no downstream signal history earns
 * ZERO boost — activity is not intrinsically valuable. This flips the previous
 * behavior where "expected impact" was the whole story.
 */

import type { Opportunity } from "../types";
import { classifyMechanism, type MechanismClass } from "./action-class";
import type { PatternPosteriorMap } from "./pattern-posterior";

export type PortfolioSignal = {
  /** patternKey → aggregate positive signal from other portfolio sites. */
  patternSignal: Map<
    string,
    { commercial: number; intent: number; verifiedExposure: number; sitesWithSignal: string[] }
  >;
  /** Mechanism class → aggregate positive signal from other portfolio sites. */
  mechanismSignal: Map<
    MechanismClass,
    { commercial: number; intent: number; verifiedExposure: number }
  >;
};

export const EMPTY_PORTFOLIO_SIGNAL: PortfolioSignal = {
  patternSignal: new Map(),
  mechanismSignal: new Map(),
};

export function buildPortfolioSignal(input: {
  perSitePosteriors: Array<{ siteId: string; posteriors: PatternPosteriorMap }>;
  excludeSiteId?: string;
}): PortfolioSignal {
  const patternSignal = new Map<
    string,
    { commercial: number; intent: number; verifiedExposure: number; sitesWithSignal: string[] }
  >();
  const mechanismSignal = new Map<
    MechanismClass,
    { commercial: number; intent: number; verifiedExposure: number }
  >();
  for (const { siteId, posteriors } of input.perSitePosteriors) {
    if (input.excludeSiteId && siteId === input.excludeSiteId) continue;
    for (const p of Object.values(posteriors)) {
      if (
        p.commercialOutcomes <= 0 &&
        p.intents <= 0 &&
        p.verifiedExposures <= 0
      ) {
        continue;
      }
      const bucket =
        patternSignal.get(p.patternKey) ??
        ({
          commercial: 0,
          intent: 0,
          verifiedExposure: 0,
          sitesWithSignal: [] as string[],
        });
      bucket.commercial += p.commercialOutcomes;
      bucket.intent += p.intents;
      bucket.verifiedExposure += p.verifiedExposures;
      if (!bucket.sitesWithSignal.includes(siteId)) {
        bucket.sitesWithSignal.push(siteId);
      }
      patternSignal.set(p.patternKey, bucket);

      const mech = p.mechanism;
      const mb =
        mechanismSignal.get(mech) ??
        { commercial: 0, intent: 0, verifiedExposure: 0 };
      mb.commercial += p.commercialOutcomes;
      mb.intent += p.intents;
      mb.verifiedExposure += p.verifiedExposures;
      mechanismSignal.set(mech, mb);
    }
  }
  return { patternSignal, mechanismSignal };
}

export type RevenuePriorityInput = {
  opportunities: Opportunity[];
  ownPosteriors: PatternPosteriorMap;
  portfolioSignal?: PortfolioSignal;
  bannedMechanisms?: Set<MechanismClass>;
};

/**
 * Multiplier applied to an opportunity's raw score based on evidence of
 * revenue contribution. Multipliers >1 boost, <1 demote. Combined
 * multiplicatively across signal sources.
 */
export function computeRevenueMultiplier(input: {
  patternKey?: string;
  mechanism: MechanismClass;
  ownPosteriors: PatternPosteriorMap;
  portfolioSignal: PortfolioSignal;
  isBannedMechanism: boolean;
}): {
  multiplier: number;
  notes: string[];
} {
  const notes: string[] = [];
  let multiplier = 1;
  const own = input.patternKey
    ? input.ownPosteriors[input.patternKey]
    : undefined;

  if (own) {
    if (own.commercialOutcomes > 0) {
      // Proven pattern must dominate — evidence of revenue trumps estimation.
      multiplier *= 8 + Math.min(own.commercialOutcomes, 25);
      notes.push(
        `own commercial ${own.commercialOutcomes.toFixed(2)} → dominant boost`,
      );
    } else if (own.intents > 0) {
      multiplier *= 3 + Math.min(own.intents, 40) / 20;
      notes.push(`own intent ${own.intents.toFixed(2)} → high boost`);
    } else if (own.verifiedExposures > 0) {
      multiplier *= 1.6 + Math.min(own.verifiedExposures, 100) / 100;
      notes.push(
        `own verified_exposure ${own.verifiedExposures.toFixed(2)} → medium boost`,
      );
    } else if (own.attempts >= 1 && own.attempts < 3) {
      multiplier *= 0.7;
      notes.push(`${own.attempts} prior attempts, no signal → demote`);
    }
  } else {
    multiplier *= 1.05;
  }

  if (input.patternKey) {
    const portfolio = input.portfolioSignal.patternSignal.get(input.patternKey);
    if (portfolio) {
      if (portfolio.commercial > 0) {
        // Portable commercial transfer — a pattern that produced revenue
        // somewhere in the portfolio is a strong prior everywhere.
        multiplier *= 4 + Math.min(portfolio.commercial, 20) / 5;
        notes.push(
          `portfolio commercial for pattern on ${portfolio.sitesWithSignal.join(",")} → transfer boost`,
        );
      } else if (portfolio.intent > 0) {
        multiplier *= 2 + Math.min(portfolio.intent, 40) / 40;
        notes.push(
          `portfolio intent for pattern on ${portfolio.sitesWithSignal.join(",")} → transfer boost`,
        );
      } else if (portfolio.verifiedExposure > 0) {
        multiplier *= 1.3;
        notes.push(
          `portfolio verified_exposure for pattern on ${portfolio.sitesWithSignal.join(",")}`,
        );
      }
    }
  }

  const mb = input.portfolioSignal.mechanismSignal.get(input.mechanism);
  if (mb && mb.commercial > 0) {
    multiplier *= 1.6;
    notes.push(`portfolio commercial in mechanism ${input.mechanism}`);
  } else if (mb && mb.intent > 0) {
    multiplier *= 1.2;
    notes.push(`portfolio intent in mechanism ${input.mechanism}`);
  }

  if (input.isBannedMechanism) {
    multiplier *= 0.05;
    notes.push(`banned mechanism ${input.mechanism} → 20× demote`);
  }

  return { multiplier: Number(multiplier.toFixed(3)), notes };
}

export function applyRevenuePriority(input: RevenuePriorityInput): Opportunity[] {
  const portfolioSignal = input.portfolioSignal ?? EMPTY_PORTFOLIO_SIGNAL;
  const banned = input.bannedMechanisms ?? new Set<MechanismClass>();
  const scored = input.opportunities.map((opp) => {
    const mechanism = classifyMechanism({
      actionType: opp.safeActionType,
      patternKey: opp.patternKey,
      category: opp.category,
    });
    const { multiplier } = computeRevenueMultiplier({
      patternKey: opp.patternKey,
      mechanism,
      ownPosteriors: input.ownPosteriors,
      portfolioSignal,
      isBannedMechanism: banned.has(mechanism),
    });
    return {
      ...opp,
      score: Number((opp.score * multiplier).toFixed(2)),
    };
  });
  return scored.sort((a, b) => b.score - a.score);
}
