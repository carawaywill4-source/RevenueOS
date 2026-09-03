/**
 * Business genome — versioned structural identity of a company.
 * Persist across experiments; expand from opportunity evaluations when earned.
 */

import type { BusinessGenome, BusinessMaturityStage } from "./types";
import type { OpportunityEvaluation } from "./enterprise-types";

export function scopeGuardGenome(input?: {
  purchases?: number;
  maturity?: BusinessMaturityStage;
}): BusinessGenome {
  const purchases = input?.purchases ?? 0;
  const maturity =
    input?.maturity ??
    (purchases > 0 ? "FIRST_CUSTOMER" : "PRODUCT");
  return {
    version: 1,
    business_id: "scopeguard",
    updated_at: new Date().toISOString(),
    customer: "Solo freelancers and independent professionals losing margin to unpaid scope expansion",
    problem: "Verbal project changes become unpaid work without a clean SOW / change-order habit",
    job_to_be_done:
      "Help independent professionals establish professional boundaries and get paid when project scope expands",
    value_proposition:
      "Ready-to-use SOW, change-order, and kickoff documents that turn fuzzy client asks into billable agreements",
    product: "Freelance SOW & Change-Order Pack (digital download)",
    delivery_model: "Instant download after Stripe payment",
    business_model: "One-time digital product sale",
    pricing_model: "$45 fixed price",
    channel_model: "Organic / owned discovery doors / marketplaces / communities (APEX)",
    brand: "Direct, protective, no-nonsense — document-category professionalism",
    trust_model:
      "Clear product contents, transparent price, refund policy, working checkout, no fake social proof",
    unit_economics: "High digital margin; Stripe fees + hosting + refunds are primary costs",
    competitive_position: "Niche freelancers facing scope creep vs generic contract template sites",
    growth_model: "APEX qualified exposure → conversion → Success DNA transfer",
    retention_model: "One-time purchase; expansion via adjacent packs / agency variants",
    expansion_model: "Agency SOW packs, niche verticals (design/dev/writing)",
    risk_model: "Legal-adjacent clarity risk; not attorney advice; category trust bar elevated",
    maturity,
  };
}

export function genomeDiffSummary(a: BusinessGenome, b: BusinessGenome): string[] {
  const keys = Object.keys(a) as Array<keyof BusinessGenome>;
  const changes: string[] = [];
  for (const k of keys) {
    if (k === "updated_at" || k === "version") continue;
    if (a[k] !== b[k]) changes.push(`${String(k)}: "${String(a[k])}" → "${String(b[k])}"`);
  }
  return changes;
}

/** Materialize a genome from a FORGE opportunity evaluation (no template enum). */
export function genomeFromOpportunityEvaluation(
  evaluation: OpportunityEvaluation,
  businessId: string,
  maturity: BusinessMaturityStage = "THESIS",
): BusinessGenome {
  const o = evaluation.opportunity;
  const e = evaluation.derived_economics;
  return {
    version: 1,
    business_id: businessId,
    updated_at: new Date().toISOString(),
    customer: o.buyer,
    problem: o.problem,
    job_to_be_done: o.job_to_be_done,
    value_proposition: evaluation.deserve.answer,
    product: o.title,
    delivery_model: e.customer_receives,
    business_model: e.revenue_mechanism,
    pricing_model: o.signals.pricing.join("; ") || "undetermined",
    channel_model: o.signals.communities.join("; ") || "undetermined",
    brand: evaluation.category_design.reference_feeling,
    trust_model: evaluation.category_design.trust_means.join("; "),
    unit_economics: `margin≈${e.estimated_contribution_margin}; support=${e.support_intensity}`,
    competitive_position: evaluation.competitors
      .map((c) => `${c.name}: ${c.weaknesses[0] ?? c.positioning}`)
      .join(" | "),
    growth_model: "APEX acquisition + FORGE product evolution under TITAN allocation",
    retention_model:
      e.recurrence === "recurring" || e.recurrence === "usage"
        ? "Retain via ongoing job completion and product quality"
        : "One-time value; expand via adjacent jobs when evidence supports",
    expansion_model: "Evidence-led adjacent segments / editions (never vanity portfolio growth)",
    risk_model: `regulatory=${e.regulatory_burden}; fit=${evaluation.operational_fit.fit}`,
    maturity,
  };
}
