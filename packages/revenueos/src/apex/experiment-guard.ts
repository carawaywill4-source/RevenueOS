/**
 * ExperimentGuard + SmallSampleProtection + collision control.
 * Also enforces BusinessCapabilityManifest FORGE approval boundaries.
 */

import type { ApexDecision } from "./types";
import type { EvidenceLevel } from "./types";
import {
  isAllowedDefectRepair,
  isProductMutationAction,
} from "./learning-clocks";
import { trafficInsufficient } from "./evidence-sufficiency";
import {
  apexMayExecuteAction,
  type BusinessCapabilityManifest,
} from "../forge/capability-manifest";

export type ExperimentGuardVerdict = {
  allowed: boolean;
  reason: string;
  isolation: "isolated" | "partial" | "collided" | "unknown";
  attributionConfidenceMultiplier: number;
};

/** Dimensions that must not all change at once. */
export type ExperimentDimensions = {
  trafficSource?: boolean;
  audience?: boolean;
  headline?: boolean;
  price?: boolean;
  product?: boolean;
  checkout?: boolean;
  cta?: boolean;
  layout?: boolean;
};

export function countChangedDimensions(d: ExperimentDimensions): number {
  return Object.values(d).filter(Boolean).length;
}

/** Same action cannot repeat without a meaningful new signal (default 45m). */
export const ACTION_COOLDOWN_MS = 45 * 60_000;
/** Max identical actions inside the cooldown window. */
export const MAX_SAME_ACTION_IN_COOLDOWN = 1;

export function guardExperiment(input: {
  action: string;
  evidenceLevel: EvidenceLevel;
  recentDecisions?: ApexDecision[];
  dimensions?: ExperimentDimensions;
  capabilityManifest?: BusinessCapabilityManifest | null;
  /** When true (first-customer / insufficient traffic), block product mutations. */
  productMutationBlocked?: boolean;
  /** Current bottleneck — used to detect whether a repeat would learn nothing. */
  bottleneck?: string;
}): ExperimentGuardVerdict {
  const dims = input.dimensions ?? inferDimensions(input.action);
  const changed = countChangedDimensions(dims);
  const recent = input.recentDecisions ?? [];

  if (input.capabilityManifest) {
    const cap = apexMayExecuteAction(input.capabilityManifest, input.action);
    if (!cap.allowed) {
      return {
        allowed: false,
        reason: cap.detail,
        isolation: "unknown",
        attributionConfidenceMultiplier: 0,
      };
    }
  }

  if (
    (input.productMutationBlocked ||
      trafficInsufficient(input.evidenceLevel)) &&
    isProductMutationAction(input.action) &&
    !isAllowedDefectRepair(input.action)
  ) {
    return {
      allowed: false,
      reason:
        "small_sample_protection:block_product_mutation — acquire qualified evidence first",
      isolation: "unknown",
      attributionConfidenceMultiplier: 0,
    };
  }

  // Anti-loop: identical action + same bottleneck without new signal → cooldown.
  const now = Date.now();
  const sameRecent = recent.filter((d) => {
    if (d.selected_action !== input.action) return false;
    const ts = Date.parse(d.timestamp);
    if (!Number.isFinite(ts) || now - ts > ACTION_COOLDOWN_MS) return false;
    if (input.bottleneck && d.bottleneck && d.bottleneck === input.bottleneck) {
      return true;
    }
    return !input.bottleneck || !d.bottleneck;
  });
  if (sameRecent.length >= MAX_SAME_ACTION_IN_COOLDOWN) {
    return {
      allowed: false,
      reason: `action_cooldown:${input.action} — await new funnel signal or diversify limb`,
      isolation: "partial",
      attributionConfidenceMultiplier: 0,
    };
  }

  // Require action diversity: last 3 decisions must not all be the same limb.
  const last3 = recent.slice(0, 3).map((d) => d.selected_action);
  if (
    last3.length >= 3 &&
    last3.every((a) => a === input.action)
  ) {
    return {
      allowed: false,
      reason: `action_diversity:${input.action} — three identical limbs; choose a different acquisition/conversion path`,
      isolation: "partial",
      attributionConfidenceMultiplier: 0,
    };
  }

  // Collision: too many dimensions + recent product mutations
  const recentProduct = recent
    .slice(0, 5)
    .filter((d) => isProductMutationAction(d.selected_action)).length;

  if (changed >= 3) {
    return {
      allowed: true,
      reason:
        "collision_warning:multiple_dimensions_changed — attribution confidence reduced",
      isolation: "collided",
      attributionConfidenceMultiplier: 0.35,
    };
  }

  if (recentProduct >= 2 && isProductMutationAction(input.action)) {
    return {
      allowed: false,
      reason:
        "experiment_guard:too_many_recent_product_mutations — isolate or acquire traffic",
      isolation: "partial",
      attributionConfidenceMultiplier: 0.4,
    };
  }

  if (changed === 1) {
    return {
      allowed: true,
      reason: "isolated_experiment",
      isolation: "isolated",
      attributionConfidenceMultiplier: 1,
    };
  }

  return {
    allowed: true,
    reason: "partial_isolation",
    isolation: changed === 2 ? "partial" : "unknown",
    attributionConfidenceMultiplier: changed === 2 ? 0.7 : 0.85,
  };
}

function inferDimensions(action: string): ExperimentDimensions {
  const a = action.toLowerCase();
  return {
    trafficSource:
      a.includes("distribut") || a.includes("list_") || a.includes("outreach"),
    audience: a.includes("audience") || a.includes("buyer"),
    headline: a.includes("message") || a.includes("clarity") || a.includes("genome"),
    price: a.includes("price") || a.includes("reprice"),
    product: a.includes("product") || a.includes("offer") || a.includes("bundle"),
    checkout: a.includes("checkout"),
    cta: a.includes("cta") || a.includes("conversion_lab"),
    layout: a.includes("layout") || a.includes("redesign"),
  };
}

export function smallSampleProtectionActive(level: EvidenceLevel): boolean {
  return trafficInsufficient(level);
}
