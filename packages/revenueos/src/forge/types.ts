/**
 * FORGE — Foundational Organization, Revenue & Growth Engine.
 * Phase 1: quality constitution, business genome, premium bar, gap analysis.
 *
 * Logical capabilities — not empty LLM wrappers.
 */

export type ForgeSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ForgeGapCategory =
  | "thesis"
  | "product"
  | "value_proposition"
  | "brand"
  | "design"
  | "typography"
  | "copy"
  | "trust"
  | "navigation"
  | "checkout"
  | "fulfillment"
  | "performance"
  | "accessibility"
  | "security"
  | "architecture"
  | "analytics"
  | "reliability"
  | "anti_slop"
  | "jtbd";

export type ForgeGap = {
  id: string;
  category: ForgeGapCategory;
  severity: ForgeSeverity;
  title: string;
  detail: string;
  evidence: string[];
  recommended_fix: string;
  blocks_premium_bar: boolean;
};

export type BusinessMaturityStage =
  | "THESIS"
  | "VALIDATION"
  | "PRODUCT"
  | "FIRST_CUSTOMER"
  | "REPEATABILITY"
  | "PROFITABILITY"
  | "SCALE"
  | "DEFENSIBILITY"
  | "MATURE_OPTIMIZATION";

export type BusinessGenome = {
  version: number;
  business_id: string;
  updated_at: string;
  customer: string;
  problem: string;
  job_to_be_done: string;
  value_proposition: string;
  product: string;
  delivery_model: string;
  business_model: string;
  pricing_model: string;
  channel_model: string;
  brand: string;
  trust_model: string;
  unit_economics: string;
  competitive_position: string;
  growth_model: string;
  retention_model: string;
  expansion_model: string;
  risk_model: string;
  maturity: BusinessMaturityStage;
};

export type PremiumBarCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
  severity: ForgeSeverity;
};

export type PremiumBarResult = {
  business_id: string;
  passed: boolean;
  checks: PremiumBarCheck[];
  blocking_failures: string[];
};

export type ForgeAuditResult = {
  business_id: string;
  audited_at: string;
  genome: BusinessGenome;
  gaps: ForgeGap[];
  premium_bar: PremiumBarResult;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    ready_for_public_launch: boolean;
  };
  directive: string;
};
