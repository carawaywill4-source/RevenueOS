/**
 * Extreme ambition + extreme skepticism of claimed progress.
 * $10k/day/business is a STRETCH TARGET, never an assumed achievable fact.
 * TITAN must be the hardest component to convince that progress occurred.
 */

import { TITAN_NORTH_STAR_DAILY_REVENUE_USD } from "./constitution";

export type ProgressClaim = {
  claim: string;
  metric: string;
  value: number;
  sample_size: number;
  attributed: boolean;
  first_party: boolean;
};

export type ProgressAssessment = {
  north_star_usd: number;
  north_star_is_stretch_not_fact: true;
  claimed_progress_toward_north_star: number;
  accepted_progress_toward_north_star: number;
  skepticism_notes: string[];
  conviction: "UNCONVINCED" | "WEAKLY_CONVINCED" | "CONVINCED";
  /** Internal score optimization that "pleases the goal" is rejected. */
  rejects_vanity_optimization: true;
};

/**
 * Assess claimed commercial progress with adversarial skepticism.
 * Ambition stays extreme; acceptance of progress stays stingy.
 */
export function assessProgressTowardNorthStar(input: {
  daily_revenue_usd: number;
  daily_contribution_profit_usd?: number;
  claims?: ProgressClaim[];
  stranger_purchases?: number;
}): ProgressAssessment {
  const notes: string[] = [
    `$${TITAN_NORTH_STAR_DAILY_REVENUE_USD}/day/business is stretch ambition — never treat as forecast or permission to fabricate`,
  ];

  const revenue = Math.max(0, input.daily_revenue_usd);
  const claimed = Math.min(1, revenue / TITAN_NORTH_STAR_DAILY_REVENUE_USD);

  // Accept only first-party attributed commerce; ignore vibes.
  let acceptedRevenue = 0;
  for (const c of input.claims ?? []) {
    if (!c.first_party || !c.attributed) {
      notes.push(`rejected_unattributed_or_non_first_party:${c.claim}`);
      continue;
    }
    if (c.sample_size < 1 && c.metric === "revenue") {
      notes.push(`rejected_zero_sample:${c.claim}`);
      continue;
    }
    if (c.metric === "revenue") acceptedRevenue += Math.max(0, c.value);
  }

  if (!(input.claims ?? []).length) {
    // Fall back to observed daily revenue only if stranger purchases exist.
    if ((input.stranger_purchases ?? 0) > 0) {
      acceptedRevenue = revenue;
    } else {
      notes.push("no_stranger_purchases — progress toward north star remains $0 regardless of traffic vanity");
      acceptedRevenue = 0;
    }
  }

  const accepted = Math.min(1, acceptedRevenue / TITAN_NORTH_STAR_DAILY_REVENUE_USD);

  if (claimed > accepted + 0.01) {
    notes.push(
      `ambition_gap: claimed_ratio=${claimed.toFixed(4)} accepted_ratio=${accepted.toFixed(4)} — TITAN refuses self-congratulation`,
    );
  }

  if ((input.daily_contribution_profit_usd ?? 0) < 0) {
    notes.push("negative_contribution_profit — revenue without profit is incomplete");
  }

  let conviction: ProgressAssessment["conviction"] = "UNCONVINCED";
  if (accepted >= 0.1 && (input.stranger_purchases ?? 0) >= 10) {
    conviction = "WEAKLY_CONVINCED";
  }
  if (accepted >= 0.5 && (input.stranger_purchases ?? 0) >= 50) {
    conviction = "CONVINCED";
  }

  if (conviction === "UNCONVINCED") {
    notes.push("UNCONVINCED — continue hunting reality; do not optimize internal scores to please $10k/day");
  }

  return {
    north_star_usd: TITAN_NORTH_STAR_DAILY_REVENUE_USD,
    north_star_is_stretch_not_fact: true,
    claimed_progress_toward_north_star: Number(claimed.toFixed(6)),
    accepted_progress_toward_north_star: Number(accepted.toFixed(6)),
    skepticism_notes: notes,
    conviction,
    rejects_vanity_optimization: true,
  };
}
