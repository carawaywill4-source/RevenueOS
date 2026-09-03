/**
 * AcquisitionOS shared types.
 * RESEARCH ≠ DISTRIBUTION. IndexNow ≠ impression. Probe ≠ visitor.
 */

export const ACQUISITIONOS_VERSION = "acquisitionos-v1";

export type ChannelFamily =
  | "search_seo"
  | "search_discovery"
  | "content"
  | "directories"
  | "communities"
  | "social_organic"
  | "partnerships"
  | "earned"
  | "outreach"
  | "product_discovery"
  | "marketplaces"
  | "programmatic_organic"
  | "owned_distribution"
  | "creators"
  | "other";

export type SurfaceStatus =
  | "DISCOVERED"
  | "RESEARCHING"
  | "VALIDATED"
  | "READY"
  | "EXECUTING"
  | "MEASURING"
  | "WINNING"
  | "WEAK"
  | "PAUSED"
  | "BLOCKED"
  | "CREDENTIAL_REQUIRED"
  | "HUMAN_ACTION_REQUIRED"
  | "PROHIBITED"
  | "DEAD";

export type ExecutionClass =
  | "AUTO_EXECUTABLE"
  | "HUMAN_ACTION_REQUIRED"
  | "CREDENTIAL_REQUIRED"
  | "OWNER_ACCOUNT_REQUIRED"
  | "API_APPROVAL_REQUIRED"
  | "PAID_ONLY"
  | "PROHIBITED"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type ExecutorType =
  | "HTTP_SUBMISSION"
  | "PUBLIC_FORM_PREP"
  | "API_POST"
  | "DIRECTORY_LISTING"
  | "CONTENT_PUBLISH"
  | "FEED_PUBLISH"
  | "EMAIL_OUTREACH"
  | "PARTNER_OUTREACH"
  | "RESOURCE_PITCH"
  | "COMMUNITY_POST_PREP"
  | "SOCIAL_POST_PREP"
  | "SOCIAL_API_POST"
  | "SEARCH_SUBMISSION"
  | "WEBMASTER_API"
  | "MARKETPLACE_LISTING"
  | "OWNER_ACTION"
  | "PORTFOLIO_CROSSLINK"
  | "WEBSUB_PING";

export type FunnelRung =
  | "RUNG_0_NO_DISTRIBUTION"
  | "RUNG_1_DISTRIBUTED"
  | "RUNG_2_IMPRESSION"
  | "RUNG_3_HUMAN_VISIT"
  | "RUNG_4_QUALIFIED_VISIT"
  | "RUNG_5_ENGAGEMENT"
  | "RUNG_6_CTA"
  | "RUNG_7_CHECKOUT"
  | "RUNG_8_PURCHASE"
  | "RUNG_9_REPEAT_REFERRAL";

/** Actions that must NEVER increment distribution / visit / acquisition success. */
export const NON_DISTRIBUTION_KINDS = new Set([
  "self_http_probe",
  "internal_browser",
  "health_check",
  "deployment_verify",
  "owned_url_probe",
  "indexnow_submit",
  "sitemap_create",
  "robots_check",
  "research_run",
  "hypothesis_generation",
  "asset_generation_unpublished",
  "search_discovery",
]);

export type ChannelSurface = {
  channelSurfaceId: string;
  channelFamily: ChannelFamily;
  platform: string;
  surfaceName: string;
  surfaceUrl: string;
  audience: string;
  buyerRole: string;
  market: string;
  topic: string;
  businessFit: number;
  commercialIntent: number;
  estimatedReach: number;
  estimatedRelevance: number;
  cost: "free" | "paid" | "unknown";
  accountRequired: boolean;
  credentialRequired: boolean;
  apiAvailable: boolean;
  automationAllowed: boolean;
  manualActionRequired: boolean;
  postingAllowed: boolean | null;
  promotionAllowed: boolean | null;
  linkAllowed: boolean | null;
  rateLimits: string;
  platformRules: string;
  risk: "low" | "medium" | "high";
  executionClass: ExecutionClass;
  executorType: ExecutorType;
  status: SurfaceStatus;
  confidence: number;
  businessIds: string[];
  meta?: Record<string, unknown>;
};
