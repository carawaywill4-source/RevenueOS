/**
 * FORGE CEO / quality constitution — hard rules outrank optimization.
 * FORGE is company-creation and operating intelligence — not an ecommerce generator.
 */

export type ForgeConstitution = {
  maxActiveBusinesses: number;
  noUnauthorizedSpend: boolean;
  noDeceptivePractices: boolean;
  noFakeSocialProof: boolean;
  noBreakingLawsOrPlatformRules: boolean;
  noAbandoningCustomerObligations: boolean;
  noExposingSecrets: boolean;
  noDestructiveIrreversibleWithoutAuthority: boolean;
  qualityOverQuantity: boolean;
  fiftyIsCapNotQuota: boolean;
  stopNewBusinessesUntilReferenceProof: boolean;
  /** Capability-driven: operate end-to-end or DO NOT BUILD. */
  requireEndToEndOperationalFit: boolean;
  /** Competition is mandatory intelligence; branding-only diffs are invalid. */
  requireDeserveToExistEvidence: boolean;
  /** Category-aware Corporate Reality Standard before launch authorization. */
  requireCorporateRealityStandard: boolean;
  /** Not a template/business-type enum factory. */
  forbidBusinessTypeTemplateFactory: boolean;
};

export const DEFAULT_FORGE_CONSTITUTION: ForgeConstitution = {
  maxActiveBusinesses: 50,
  noUnauthorizedSpend: true,
  noDeceptivePractices: true,
  noFakeSocialProof: true,
  noBreakingLawsOrPlatformRules: true,
  noAbandoningCustomerObligations: true,
  noExposingSecrets: true,
  noDestructiveIrreversibleWithoutAuthority: true,
  qualityOverQuantity: true,
  fiftyIsCapNotQuota: true,
  /** First assignment: prove ScopeGuard before Business #12. */
  stopNewBusinessesUntilReferenceProof: true,
  requireEndToEndOperationalFit: true,
  requireDeserveToExistEvidence: true,
  requireCorporateRealityStandard: true,
  forbidBusinessTypeTemplateFactory: true,
};

/**
 * Constraint question for every opportunity:
 * Can RevenueOS legally, ethically, reliably, and substantially operate
 * this business end-to-end with capabilities it actually has?
 */
export const FORGE_OPERATING_CONSTRAINT_QUESTION =
  "Can RevenueOS legally, ethically, reliably, and substantially operate the business end-to-end with the capabilities it actually has?";

export const ANTI_AI_SLOP_MARKERS = [
  "revolutionize your workflow",
  "unlock your potential",
  "ai-powered next-generation",
  "trusted by thousands",
  "cutting-edge solution",
  "seamless experience",
  "game-changing",
  "this page targets:",
  "fake dashboard",
  "as seen in",
] as const;
