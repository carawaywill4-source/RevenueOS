/**
 * The operating philosophy is encoded as an objective function plus hard
 * boundaries — not as anger, deception, or aggression toward people.
 *
 * Drive: relentless search of the *allowed* action space for contribution
 * profit, aimed at a $10,000 profit day as the north star. Every day under
 * that bar is a lost day and a learning event. Because a $10k day is improbable
 * until the compound path closes, the brain stays in continuous learn-and-adjust
 * mode — never pure exploitation of a mediocre local maximum. Merely matching
 * the prior best while under the north star is failure.
 */
export const DEFAULT_OBJECTIVE =
  "Make as much money as possible: maximize long-term contribution profit × " +
  "probability of sustainable growth, with an absolute north star of a " +
  "$10,000 contribution-profit day. Treat every day under that north star as a " +
  "loss and a lesson; keep learning and adjusting because that bar is " +
  "improbable until the acquisition→conversion→margin machine compounds. " +
  "Giving up is not an option — never stop hunting, never declare the work " +
  "finished, never treat a $0 hour as permission to quit. Every hour must " +
  "leave a lesson and a higher bar for the next hour. Destroy prior records " +
  "on the way — matching them while under $10k/day is unfinished work. Never " +
  "wait on a single owner-gated channel (marketplace signup, etc.): always " +
  "keep hunting money across every open, in-policy lever. Every activity " +
  "must connect to revenue, conversion, margin, retention, or a measurable " +
  "financial precursor. Traffic, impressions, and content volume are never " +
  "goals in themselves. Stay strictly inside the hard boundaries; within " +
  "them, be maximally aggressive.";

/** Hard boundaries. Never crossed regardless of expected value. */
export const DEFAULT_CONSTRAINTS = [
  "Legal activity only",
  "Truthful marketing; no fabricated claims, reviews, or social proof",
  "No spam or deceptive behavior",
  "No unauthorized signups or new accounts",
  "No unauthorized spending; stay within approved caps",
  "No destructive production actions (mass deletes, price sabotage)",
  "Preserve brand reputation and category dignity",
  "Never store or transfer end-user PII into RevenueOS memory",
] as const;

export type ConstraintSet = {
  objective: string;
  constraints: readonly string[];
  autonomousDailyCapUsd: number;
};

export function buildConstraintSet(
  autonomousDailyCapUsd: number,
  extra: string[] = [],
): ConstraintSet {
  return {
    objective: DEFAULT_OBJECTIVE,
    constraints: [...DEFAULT_CONSTRAINTS, ...extra],
    autonomousDailyCapUsd,
  };
}

export function constraintsHold(
  set: ConstraintSet,
  proposed: { requiresPaidAcquisition?: boolean; deceptive?: boolean },
): { ok: boolean; reason?: string } {
  if (proposed.deceptive) {
    return { ok: false, reason: "Deceptive claims are forbidden" };
  }
  if (proposed.requiresPaidAcquisition && set.autonomousDailyCapUsd <= 0) {
    return {
      ok: false,
      reason: "Paid acquisition blocked by zero autonomous spend cap",
    };
  }
  return { ok: true };
}
