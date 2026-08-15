/**
 * Derive economic operating shape from opportunity signals.
 * Never force an opportunity into a downloadable PDF store.
 */

import type {
  DerivedEconomicShape,
  EconomicOpportunity,
  RosCapabilityId,
} from "./enterprise-types";

function textBlob(opp: EconomicOpportunity): string {
  const s = opp.signals;
  return [
    opp.title,
    opp.problem,
    opp.job_to_be_done,
    ...s.demand,
    ...s.pain,
    ...s.pricing,
    ...s.margins,
    ...s.operational_complexity,
    ...s.existing_spending,
    ...s.ros_operational_fit,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Infer monetization + fulfillment requirements from economics of the opportunity.
 * Output is descriptive; callers must still pass operational fit + deserve-to-exist.
 */
export function deriveEconomicShape(opp: EconomicOpportunity): DerivedEconomicShape {
  const blob = textBlob(opp);
  const why: string[] = [];
  const required: RosCapabilityId[] = ["stripe_checkout", "analytics_beacon", "content_publishing"];

  const wantsRecurring =
    /subscription|monthly|saas|recurring|membership|retainer|mrr/.test(blob);
  const wantsUsage = /api|meter|usage|per.?request|developer\s+tool/.test(blob);
  const wantsMarketplace =
    /marketplace|two.?sided|escrow|multi.?vendor|take.?rate/.test(blob);
  const wantsService =
    /done.?for.?you|agency|human\s+delivery|concierge|labor/.test(blob);
  const wantsPhysical = /ship|inventory|sku|physical\s+good|warehouse/.test(blob);
  const wantsLead = /lead.?gen|qualified\s+lead|appointment/.test(blob);
  const wantsDigitalPack =
    /template|document|pack|download|pdf|kit|checklist|sop/.test(blob) ||
    opp.reference_label === "scopeguard_digital_pack";
  const wantsWorkflowSaas =
    /workflow|onboarding|property\s+manager|automate\s+\d+%|dashboard/.test(blob);

  let recurrence: DerivedEconomicShape["recurrence"] = "one_time";
  let revenue_mechanism = "One-time purchase for a self-serve deliverable";
  let customer_receives = "Digital artifact or access granted immediately after payment";
  let fulfillment = 90;
  let support: DerivedEconomicShape["support_intensity"] = "low";
  let regulatory: DerivedEconomicShape["regulatory_burden"] = "low";
  let margin = 0.85;

  if (wantsPhysical) {
    required.push("physical_fulfillment");
    fulfillment = 20;
    support = "high";
    margin = 0.35;
    revenue_mechanism = "Physical goods sale (requires logistics limbs RevenueOS lacks)";
    customer_receives = "Shipped physical product";
    why.push("Physical fulfillment signals detected — operationally blocked today");
  } else if (wantsMarketplace) {
    required.push("marketplace_escrow", "multi_party_payouts", "identity_kyc");
    recurrence = "take_rate";
    fulfillment = 40;
    support = "high";
    margin = 0.2;
    revenue_mechanism = "Marketplace take-rate on transactions between parties";
    customer_receives = "Matched counterparties + escrowed exchange";
    why.push("Two-sided marketplace economics require escrow/payout limbs");
  } else if (wantsService) {
    required.push("human_service_delivery", "email_delivery");
    recurrence = "hybrid";
    fulfillment = 30;
    support = "high";
    margin = 0.45;
    revenue_mechanism = "Productized service with human delivery (owner-gated)";
    customer_receives = "Human-completed work product";
    why.push("Human fulfillment cannot be autonomous without owner authority");
  } else if (wantsUsage || (/api/.test(blob) && /developer|tool/.test(blob))) {
    required.push("api_key_issuance", "usage_metering", "stripe_subscriptions");
    recurrence = "usage";
    fulfillment = 75;
    support = "medium";
    margin = 0.7;
    revenue_mechanism = "API / developer utility billed on usage or tiered access";
    customer_receives = "API credentials + metered compute/data access";
    why.push("Usage economics fit developer tools; metering limb still incomplete");
  } else if (wantsRecurring || wantsWorkflowSaas) {
    required.push("stripe_subscriptions", "saas_account_provisioning", "email_delivery", "scheduled_jobs");
    recurrence = "recurring";
    fulfillment = 80;
    support = "medium";
    margin = 0.75;
    revenue_mechanism =
      "Recurring SaaS / membership access that automates a repeating buyer workflow";
    customer_receives = "Authenticated product workspace that performs ongoing job-to-be-done";
    why.push(
      "Recurring pain + existing monthly spend signals → do not crush into a one-time PDF",
    );
  } else if (wantsLead) {
    required.push("email_delivery", "webhook_automation");
    recurrence = "hybrid";
    fulfillment = 70;
    support = "medium";
    margin = 0.6;
    revenue_mechanism = "Paid lead or research delivery to a B2B buyer";
    customer_receives = "Qualified leads or research packages";
    why.push("Lead businesses need delivery SLAs; partial fit depending on automation");
  } else if (wantsDigitalPack) {
    required.push("digital_file_delivery", "webhook_automation");
    recurrence = "one_time";
    fulfillment = 95;
    support = "minimal";
    margin = 0.9;
    revenue_mechanism = "One-time digital product (documents/templates/kits) via instant delivery";
    customer_receives = "Downloadable pack after Stripe payment";
    why.push("High automation + instant delivery matches current certified limbs (ScopeGuard path)");
  } else {
    // Unknown — do not default to PDF. Leave honest uncertainty.
    recurrence = "unknown";
    fulfillment = 50;
    support = "medium";
    margin = 0.5;
    revenue_mechanism =
      "Undetermined — economics not yet specific enough to derive a model";
    customer_receives = "Unknown; requires INVESTIGATE before BUILD";
    why.push("Insufficient economic specificity — DO NOT force a storefront template");
  }

  // Practicing regulated advice is blocked. Informational docs/templates are allowed
  // with elevated caution — do not false-positive on competitor names like "LegalZoom".
  const practicesRegulatedAdvice =
    /\b(legal advice|attorney[- ]client|practice of law|medical diagnosis|prescribe|investment advice|securities advice)\b/.test(
      blob,
    );
  const regulatedAdjacentInformational =
    /\b(legal[- ]adjacent|not attorney|informational documents?|disclaimer|template|sow|contract pack)\b/.test(
      blob,
    ) || opp.reference_label === "scopeguard_digital_pack";

  if (practicesRegulatedAdvice) {
    regulatory = "prohibited";
    required.push("regulated_advice");
    why.push("Would require practicing regulated advice — DO NOT BUILD");
  } else if (regulatedAdjacentInformational) {
    regulatory = "medium";
    why.push(
      "Legal-adjacent informational product — allowed with clear disclaimers; not attorney advice",
    );
  }

  // Price signals
  const priceHit = blob.match(/\$\s?(\d+)/);
  if (priceHit && Number(priceHit[1]) >= 100 && recurrence === "one_time" && wantsWorkflowSaas) {
    why.push("High willingness-to-pay + workflow pain → prefer recurring over one-time pack");
  }

  return {
    revenue_mechanism,
    recurrence,
    customer_receives,
    fulfillment_automation_pct: fulfillment,
    required_capabilities: [...new Set(required)],
    estimated_contribution_margin: margin,
    support_intensity: support,
    regulatory_burden: regulatory,
    why_this_shape: why,
  };
}
