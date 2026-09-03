/**
 * BusinessCapabilityManifest — shared FORGE ↔ APEX contract.
 *
 * FORGE declares what is READY and what APEX may test without redesigning the company.
 * APEX must not treat FORGE_CONFIDENCE as market validation.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { BusinessMaturityStage } from "./types";

export type CapabilityStatus =
  | "READY"
  | "DEGRADED"
  | "BLOCKED"
  | "UNKNOWN"
  | "VERIFIED"
  | "HEALTHY"
  | "PASS"
  | "FAIL";

export type ApexTestDimension =
  | "channel"
  | "persona"
  | "intent"
  | "message"
  | "acquisition_asset"
  | "landing_entry_path";

export type ApexForgeApprovalArea =
  | "product_redesign"
  | "major_pricing_change"
  | "fulfillment_change";

export type BusinessCapabilityManifest = {
  business_id: string;
  updated_at: string;
  product: {
    status: CapabilityStatus;
    job_to_be_done: string;
    target_customer: string;
    primary_value: string;
  };
  price: {
    current: number;
  };
  delivery: {
    instant: boolean;
  };
  trust: {
    score: CapabilityStatus;
    known_debt: string[];
  };
  ux: {
    desktop: CapabilityStatus;
    mobile: CapabilityStatus;
  };
  checkout: {
    status: CapabilityStatus;
  };
  fulfillment: {
    status: CapabilityStatus;
  };
  reliability: {
    status: CapabilityStatus;
  };
  /** Engineering/product readiness — NOT willingness-to-pay validation. */
  forge_confidence: number;
  known_product_uncertainties: string[];
  apex_allowed_to_test: ApexTestDimension[];
  apex_requires_forge_approval_for: ApexForgeApprovalArea[];
  current_business_stage: BusinessMaturityStage | "FIRST_CUSTOMER";
  primary_objective: string;
};

const MANIFEST_PURSUIT = "forge_capability_manifest";

export function scopeGuardCapabilityManifest(
  now = new Date(),
): BusinessCapabilityManifest {
  return {
    business_id: "scopeguard",
    updated_at: now.toISOString(),
    product: {
      status: "READY",
      job_to_be_done: "protect freelancers from unpaid scope expansion",
      target_customer: "experienced freelancers / small agencies",
      primary_value: "professional boundary-setting + paid change handling",
    },
    price: { current: 45 },
    delivery: { instant: true },
    trust: {
      score: "PASS",
      known_debt: ["custom domain pending"],
    },
    ux: {
      desktop: "PASS",
      mobile: "PASS",
    },
    checkout: { status: "VERIFIED" },
    fulfillment: { status: "VERIFIED" },
    reliability: { status: "HEALTHY" },
    forge_confidence: 0.91,
    known_product_uncertainties: [
      "willingness to pay not validated",
      "preferred deliverable format not validated",
      "agency vs solo-freelancer segment unresolved",
    ],
    apex_allowed_to_test: [
      "channel",
      "persona",
      "intent",
      "message",
      "acquisition_asset",
      "landing_entry_path",
    ],
    apex_requires_forge_approval_for: [
      "product_redesign",
      "major_pricing_change",
      "fulfillment_change",
    ],
    current_business_stage: "FIRST_CUSTOMER",
    primary_objective: "FIRST ATTRIBUTED STRANGER PURCHASE",
  };
}

export function getCapabilityManifest(businessId: string): BusinessCapabilityManifest | null {
  if (businessId === "scopeguard") return scopeGuardCapabilityManifest();
  return null;
}

/** Map an APEX action string onto a test dimension or FORGE-gated area. */
export function classifyActionAgainstManifest(action: string): {
  kind: "apex_allowed" | "forge_approval_required" | "unspecified";
  dimension?: ApexTestDimension;
  approval?: ApexForgeApprovalArea;
} {
  const a = action.toLowerCase();
  if (
    a.includes("redesign") ||
    a.includes("offer_clarity") ||
    a.includes("conversion_lab") ||
    a.includes("trust_signal_pack") ||
    (a.includes("product") && a.includes("mutat"))
  ) {
    return { kind: "forge_approval_required", approval: "product_redesign" };
  }
  if (a.includes("reprice") || a.includes("pricing") || a.includes("price_change")) {
    return { kind: "forge_approval_required", approval: "major_pricing_change" };
  }
  if (a.includes("fulfillment") || a.includes("delivery_change")) {
    return { kind: "forge_approval_required", approval: "fulfillment_change" };
  }
  if (
    a.includes("message") ||
    a.includes("genome") ||
    a.includes("headline") ||
    a.includes("copy_test")
  ) {
    return { kind: "apex_allowed", dimension: "message" };
  }
  if (a.includes("door") || a.includes("landing") || a.includes("entry")) {
    return { kind: "apex_allowed", dimension: "landing_entry_path" };
  }
  if (
    a.includes("distribut") ||
    a.includes("list_") ||
    a.includes("gumroad") ||
    a.includes("reddit") ||
    a.includes("outreach") ||
    a.includes("hn_") ||
    a.includes("producthunt") ||
    a.includes("indiehackers") ||
    a.includes("index")
  ) {
    return { kind: "apex_allowed", dimension: "channel" };
  }
  if (a.includes("buyer") || a.includes("persona") || a.includes("audience")) {
    return { kind: "apex_allowed", dimension: "persona" };
  }
  if (a.includes("demand_radar") || a.includes("intent")) {
    return { kind: "apex_allowed", dimension: "intent" };
  }
  if (a.includes("publish") || a.includes("acquisition")) {
    return { kind: "apex_allowed", dimension: "acquisition_asset" };
  }
  return { kind: "unspecified" };
}

export function apexMayExecuteAction(
  manifest: BusinessCapabilityManifest,
  action: string,
): { allowed: boolean; detail: string } {
  const cls = classifyActionAgainstManifest(action);
  if (cls.kind === "forge_approval_required") {
    const area = cls.approval!;
    if (manifest.apex_requires_forge_approval_for.includes(area)) {
      return {
        allowed: false,
        detail: `forge_approval_required:${area} — FORGE owns product/pricing/fulfillment; APEX acquires customers`,
      };
    }
  }
  if (cls.kind === "apex_allowed" && cls.dimension) {
    if (!manifest.apex_allowed_to_test.includes(cls.dimension)) {
      return {
        allowed: false,
        detail: `apex_dimension_not_listed:${cls.dimension}`,
      };
    }
    return {
      allowed: true,
      detail: `apex_allowed:${cls.dimension}`,
    };
  }
  // Unspecified acquisition-ish actions: allow if product READY and stage is FIRST_CUSTOMER
  if (
    manifest.product.status === "READY" &&
    manifest.current_business_stage === "FIRST_CUSTOMER"
  ) {
    return {
      allowed: true,
      detail: "apex_allowed:unspecified_under_first_customer_ready_product",
    };
  }
  return { allowed: true, detail: "apex_allowed:default" };
}

export async function persistCapabilityManifest(
  store: ExperimentStore,
  manifest: BusinessCapabilityManifest,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("pevt"),
    pursuitId: MANIFEST_PURSUIT,
    siteId: manifest.business_id,
    eventType: "learned",
    detail: {
      forge: true,
      kind: "capability_manifest",
      manifest,
    },
    createdAt: manifest.updated_at,
  });
}

export async function loadCapabilityManifest(
  store: ExperimentStore,
  businessId: string,
): Promise<BusinessCapabilityManifest | null> {
  if (store.listPursuitEvents) {
    const events = await store.listPursuitEvents(businessId, { limit: 40 });
    for (const e of events) {
      if (e.pursuitId === MANIFEST_PURSUIT && e.detail?.manifest) {
        return e.detail.manifest as BusinessCapabilityManifest;
      }
    }
  }
  return getCapabilityManifest(businessId);
}
