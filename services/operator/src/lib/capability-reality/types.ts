/**
 * FEATURE ≠ CAPABILITY doctrine.
 * CODE EXISTS / TEST PASSES / JOB EXECUTED ≠ DONE.
 * EXTERNAL RESULT + VERIFICATION + LEARNING = DONE.
 */

export type CapabilityState =
  | "CLAIMED_ONLY"
  | "IMPLEMENTED_NOT_EXECUTING"
  | "EXECUTING_NO_EFFECT"
  | "PARTIAL_CAPABILITY"
  | "PROVEN_CAPABILITY"
  | "BROKEN_CAPABILITY"
  | "OWNER_AUTHORITY_REQUIRED";

export type CapabilityDomain =
  | "TITAN"
  | "APEX"
  | "FORGE"
  | "SELF_EVOLUTION"
  | "COMMERCIAL_MEMORY"
  | "DISTRIBUTION"
  | "TELEMETRY"
  | "BUSINESS_OPERATIONS"
  | "IDENTITY"
  | "COMMUNICATION";

export type PlatformRuleClass =
  | "PERMITTED"
  | "PERMITTED_WITH_LIMITS"
  | "HUMAN_OWNER_AUTHORITY_REQUIRED"
  | "AUTOMATION_PROHIBITED"
  | "AI_CONTENT_PROHIBITED"
  | "COMMERCIAL_ACTIVITY_PROHIBITED"
  | "UNKNOWN_NEEDS_RESEARCH";

export type CapabilityRecord = {
  id: string;
  domain: CapabilityDomain;
  name: string;
  state: CapabilityState;
  chainBreak?: string;
  liveEvidence: string;
  failurePoint: string;
  action: string;
  autonomous: boolean;
  authenticated: boolean;
  ownerAuthority: boolean;
  updatedAt: string;
};

export type DistributionCapability = {
  id: string;
  channel: string;
  platform: string;
  accountId?: string;
  authState:
    | "NONE"
    | "CREDENTIAL_PRESENT"
    | "SESSION_PRESENT"
    | "VERIFIED"
    | "EXPIRED"
    | "MISSING";
  ruleClass: PlatformRuleClass;
  audience: string;
  publicationMethod: string;
  autonomousEligibility: boolean;
  ownerRequirement: string | null;
  acceptanceVerification: boolean;
  publicationVerification: boolean;
  referralAttribution: boolean;
  confidence: number;
  suppressed: boolean;
  historicalRoi: number;
  state: CapabilityState;
  evidence: string;
};

export const FEATURE_THEATER_DOCTRINE = {
  version: "feature-theater-doctrine-v1",
  rules: [
    "CODE_EXISTS_NE_DONE",
    "TEST_PASSES_NE_DONE",
    "JOB_EXECUTED_NE_DONE",
    "HTTP_200_NE_DONE",
    "EXTERNAL_RESULT_PLUS_VERIFICATION_PLUS_LEARNING_EQ_DONE",
  ],
} as const;

export const OPEN_WORLD_BUSINESS_DOCTRINE = {
  version: "open-world-business-doctrine-v1",
  standardUsdPerDay: 10_000,
  models: [
    "saas",
    "digital_products",
    "ecommerce",
    "physical_products",
    "services",
    "subscriptions",
    "media",
    "creator_content",
    "marketplaces",
    "lead_generation",
    "software_tools",
    "data_products",
    "education",
    "affiliate",
    "advertising_supported_media",
    "communities",
    "licensing",
    "transaction_businesses",
    "other_legitimate_internet",
  ],
  decisionQuestion:
    "Can RevenueOS legitimately operate this business end-to-end with little or no recurring owner involvement?",
  regulatedNote:
    "Do not globally blacklist industries. Determine real license/registration/disclosure/human-supervision requirements; if unmet autonomously, that operating model is not autonomously eligible.",
  portfolioFreezeNote:
    "While customer acquisition is unproven, portfolio creation stays frozen. Doctrine still applies when admissions resume.",
} as const;
