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

export function guardExperiment(input: {
  action: string;
  evidenceLevel: EvidenceLevel;
  recentDecisions?: ApexDecision[];
  dimensions?: ExperimentDimensions;
  capabilityManifest?: BusinessCapabilityManifest | null;
}): ExperimentGuardVerdict {
  const dims = input.dimensions ?? inferDimensions(input.action);
  const changed = countChangedDimensions(dims);

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
    trafficInsufficient(input.evidenceLevel) &&
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

  // Collision: too many dimensions + recent product mutations
  const recentProduct = (input.recentDecisions ?? [])
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
