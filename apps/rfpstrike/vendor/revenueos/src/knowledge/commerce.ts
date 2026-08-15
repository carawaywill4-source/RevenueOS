import type { Bottleneck, PrecursorMetric } from "../types";

/**
 * Portable, evergreen commerce and unit-economics knowledge the brain consults
 * when modeling and ranking. This is global transferable memory — not copy, not
 * scraped data, not tenant-specific. Update deliberately and version by review.
 */

/** Rough baseline visitor→purchase conversion by demand temperature. */
export const CONVERSION_BASELINES = {
  cold: 0.004,
  warm: 0.02,
  hot: 0.06,
  unknown: 0.01,
} as const;

/** Days until a lever produces a trustworthy signal, by category. */
export const SIGNAL_WINDOW_DAYS: Record<string, number> = {
  acquisition: 21,
  conversion: 10,
  pricing: 7,
  retention: 30,
  operations: 3,
};

/**
 * Which precursor a bottleneck level most directly unblocks. Chains every
 * bottleneck back to a measurable money lever.
 */
export function precursorForBottleneck(b: Bottleneck): PrecursorMetric {
  switch (b.level) {
    case 2:
      return "fulfillment_reliability";
    case 3:
      return "checkout_started";
    case 4:
      return "landing_views";
    case 5:
      return "repeat_rate";
    default:
      return "purchases";
  }
}

/**
 * Zero-spend channel playbook. The brain only *recommends* owner-gated channels;
 * it never signs up or spends autonomously.
 */
export const ZERO_SPEND_CHANNELS = [
  {
    channel: "organic_search",
    note: "Compound, slow; strengthen high-intent hubs rather than mass-produce thin pages.",
  },
  {
    channel: "directories",
    note: "Account-free listings and structured submissions (e.g. IndexNow) are safe autonomous actions.",
  },
  {
    channel: "editorial",
    note: "Earn non-commercial mentions/links; never fabricate or pay for coverage.",
  },
  {
    channel: "marketplace",
    note: "Category marketplaces carry real buyer intent but usually require an owner-created account.",
  },
] as const;

/** Guardrails that repeatedly separate durable growth from vanity. */
export const COMMERCE_PRINCIPLES = [
  "Fix conversion and fulfillment before scaling traffic.",
  "Contribution margin funds growth; protect it before chasing volume.",
  "A lever without a measurement plan is a guess, not an experiment.",
  "Retention and repeat purchase compound faster than one-time acquisition.",
] as const;
