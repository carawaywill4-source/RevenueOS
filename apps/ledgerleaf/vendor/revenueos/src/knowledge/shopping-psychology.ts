import type { FunnelStepStat, Observation } from "../types";

/**
 * Transferable shopper-behavior patterns. These describe *why* buyers hesitate
 * and how to reduce friction ethically — no dark patterns, no fake scarcity.
 */

export type FrictionKind =
  | "trust"
  | "clarity"
  | "price"
  | "effort"
  | "discovery"
  | "none";

/** Map a funnel step name to the friction it most often represents. */
export function frictionForStep(step: string): FrictionKind {
  const s = step.toLowerCase();
  if (s.includes("landing") || s.includes("view")) return "discovery";
  if (s.includes("start") || s.includes("builder") || s.includes("signup")) {
    return "clarity";
  }
  if (s.includes("draft") || s.includes("generate") || s.includes("preview")) {
    return "effort";
  }
  if (s.includes("checkout")) return "price";
  if (s.includes("purchase")) return "trust";
  return "none";
}

/** Ethical friction-reduction moves keyed by the friction they address. */
export const FRICTION_PLAYBOOK: Record<FrictionKind, string[]> = {
  trust: [
    "Show real guarantees, secure-checkout signals, and truthful proof of delivery.",
    "Make refund and support terms visible before the buyer commits.",
  ],
  clarity: [
    "State exactly what the buyer gets and the next step in one glance.",
    "Place the primary call to action beside a concrete sample of the output.",
  ],
  price: [
    "Show price, deliverables, and value anchor together at the decision point.",
    "Remove surprise costs; surface total before the buyer clicks pay.",
  ],
  effort: [
    "Cut steps and typing; pre-fill and preview before asking for commitment.",
    "Let the buyer experience value (a free draft/preview) before paying.",
  ],
  discovery: [
    "Meet high-intent queries with a page that matches the exact job to be done.",
    "Earn indexed inbound references so strangers can find the offer at all.",
  ],
  none: [],
};

/** Infer the dominant friction from where the funnel bleeds. */
export function inferPrimaryFriction(observation: Observation): FrictionKind {
  const drop: FunnelStepStat | null = observation.funnel.largestDrop;
  if (observation.funnel.landingViews < 50) return "discovery";
  if (!drop) return "none";
  return frictionForStep(drop.step);
}
