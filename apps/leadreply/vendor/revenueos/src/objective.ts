import { SUCCESS_DEFINITION } from "./modules/success";

/**
 * The operating philosophy is encoded as an objective function plus hard
 * boundaries — not as anger, deception, or aggression toward people.
 *
 * SUCCESS = money made for the customer. Everything else is a tool.
 * $0 / under the $10k day = failing software. Learning and competition exist
 * to destroy that failure — never to normalize it.
 */
export { SUCCESS_DEFINITION };

export const DEFAULT_OBJECTIVE =
  `${SUCCESS_DEFINITION} ` +
  "RevenueOS operates 24/7/365 — always trying to make the owner money. " +
  "There is no off switch, no idle shift, no waiting for the owner to wake up. " +
  "If purchases are zero, keep creating permissionless buyer exposure. If there " +
  "is a queue, drain it. If the queue is only waiting on evidence, open new " +
  "executable pursuits anyway. RevenueOS is the sole business manager for the " +
  "attached site — responsible for making it profitable. Absolute north star: " +
  "a $10,000 contribution-profit day. Current era: MASTER ORGANIC LEADS AND " +
  "SALES. Ads come later. Every thought, action, experiment, and lesson must " +
  "answer: did this make money from organic demand, or clearly lead there? " +
  "Hate $0 — product failure. Giving up is forbidden. Stay inside hard " +
  "boundaries; within them, be maximally aggressive every hour of every day.";
/** Hard boundaries. Never crossed regardless of expected value. */
export const DEFAULT_CONSTRAINTS = [
  "Legal activity only",
  "Truthful marketing; no fabricated claims, reviews, or social proof",
  "No spam or deceptive behavior",
  "No creating or logging into third-party accounts (Reddit, directories, social, marketplaces)",
  "Permissionless organic is the default: publish/distribute on owned + public surfaces without waiting for the owner",
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
