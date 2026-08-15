/**
 * RevenueOS capability inventory — the real constraint on company creation.
 * Not a business-type menu: what can we operate end-to-end today?
 */

import type {
  DerivedEconomicShape,
  OperationalFitResult,
  RosCapability,
  RosCapabilityId,
} from "./enterprise-types";

/** Current honest inventory. Unavailable capabilities block FIT. */
export function currentRosCapabilities(): RosCapability[] {
  return [
    { id: "stripe_checkout", status: "available", notes: "one-time Checkout Sessions proven" },
    {
      id: "stripe_subscriptions",
      status: "partial",
      notes: "Stripe Billing available in stack; not yet proven as autonomous FORGE path",
    },
    { id: "digital_file_delivery", status: "available", notes: "download after purchase verified (ScopeGuard)" },
    { id: "email_delivery", status: "partial", notes: "routes exist; deliverability ops not fully autonomous" },
    { id: "content_publishing", status: "available", notes: "storefront + discovery doors" },
    { id: "webhook_automation", status: "available", notes: "Stripe webhooks + beacon" },
    { id: "scheduled_jobs", status: "available", notes: "cron / Core operator loop" },
    { id: "analytics_beacon", status: "available", notes: "APEX commercial events" },
    { id: "owner_dialog", status: "available", notes: "Needs You / owner surfaces" },
    {
      id: "saas_account_provisioning",
      status: "partial",
      notes: "can scaffold apps; multi-tenant auth/ops not yet a certified FORGE limb",
    },
    { id: "usage_metering", status: "unavailable", notes: "no durable metering plane yet" },
    { id: "api_key_issuance", status: "partial", notes: "possible in product code; not portfolio-standard" },
    {
      id: "human_service_delivery",
      status: "owner_gated",
      notes: "cannot autonomously sell owner labor without explicit authority",
    },
    { id: "physical_fulfillment", status: "unavailable", notes: "no warehouse/shipping limb" },
    { id: "marketplace_escrow", status: "unavailable", notes: "Connect/escrow not certified" },
    { id: "multi_party_payouts", status: "unavailable", notes: "Connect payouts not certified" },
    {
      id: "regulated_advice",
      status: "unavailable",
      notes: "cannot practice law/medicine/finance; informational products only with disclaimers",
    },
    { id: "identity_kyc", status: "unavailable", notes: "no KYC limb" },
    { id: "paid_ads", status: "unavailable", notes: "constitution: no paid ads" },
    { id: "autonomous_spend", status: "unavailable", notes: "constitution: no autonomous spend" },
  ];
}

export function capabilityMap(
  caps = currentRosCapabilities(),
): Map<RosCapabilityId, RosCapability> {
  return new Map(caps.map((c) => [c.id, c]));
}

/**
 * Assess whether RevenueOS can operate a derived economic shape end-to-end.
 */
export function assessOperationalFit(
  shape: DerivedEconomicShape,
  caps = currentRosCapabilities(),
): OperationalFitResult {
  const map = capabilityMap(caps);
  const missing: RosCapabilityId[] = [];
  const owner_gated: RosCapabilityId[] = [];
  let availableCount = 0;

  for (const id of shape.required_capabilities) {
    const c = map.get(id);
    if (!c || c.status === "unavailable") missing.push(id);
    else if (c.status === "owner_gated") owner_gated.push(id);
    else if (c.status === "available" || c.status === "partial") availableCount += 1;
  }

  const legal_ethical_ok =
    shape.regulatory_burden !== "prohibited" &&
    !shape.required_capabilities.includes("regulated_advice") &&
    !shape.required_capabilities.includes("paid_ads") &&
    !shape.required_capabilities.includes("autonomous_spend");

  const blockers: string[] = [];
  if (!legal_ethical_ok) blockers.push("legal_ethical_or_constitution_block");
  for (const m of missing) blockers.push(`missing_capability:${m}`);
  for (const g of owner_gated) blockers.push(`owner_gated:${g}`);
  if (shape.fulfillment_automation_pct < 70) {
    blockers.push("fulfillment_automation_below_70pct");
  }
  if (shape.support_intensity === "high") {
    blockers.push("support_intensity_too_high_for_autonomous_ops");
  }

  const req = shape.required_capabilities.length || 1;
  const score = Math.max(
    0,
    Math.min(
      1,
      (availableCount / req) *
        (shape.fulfillment_automation_pct / 100) *
        (legal_ethical_ok ? 1 : 0) *
        (missing.length ? 0.3 : 1) *
        (owner_gated.length ? 0.5 : 1),
    ),
  );

  let fit: OperationalFitResult["fit"] = "FIT";
  if (missing.length || !legal_ethical_ok || shape.fulfillment_automation_pct < 70) {
    fit = "UNFIT";
  } else if (owner_gated.length || score < 0.75 || shape.required_capabilities.some((id) => map.get(id)?.status === "partial")) {
    fit = "PARTIAL";
  }

  return {
    fit,
    score: Number(score.toFixed(3)),
    required: shape.required_capabilities,
    missing,
    owner_gated,
    autonomous_fulfillment_pct: shape.fulfillment_automation_pct,
    legal_ethical_ok,
    statement:
      fit === "FIT"
        ? "RevenueOS can legally/ethically/reliably operate this end-to-end with current limbs."
        : fit === "PARTIAL"
          ? "Partial fit — some limbs partial/owner-gated; do not force a PDF storefront; investigate model carefully."
          : "UNFIT — do not build until capabilities, automation, or legality allow genuine end-to-end operation.",
    blockers,
  };
}
