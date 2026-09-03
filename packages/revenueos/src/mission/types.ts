/**
 * Public types for the MissionController.
 *
 * A mission is deterministic — status can only transition through
 * MissionController methods. An LLM output is a suggestion, never a status change.
 */

export type MissionStatus =
  | "ACTIVE"
  | "SUCCESS"
  | "DEADLINE_REACHED"
  | "PAUSED_BY_OWNER"
  | "ABANDONED_BY_OWNER";

export type MissionObjective = {
  primary: "REAL_REVENUE";
  firstSaleTargetUsd: number;
  longTermDailyRevenueTargetUsd: number;
};

export type MissionProgress = {
  externalExposures: number;
  verifiedHumans: number;
  engagedHumans: number;
  checkoutStarts: number;
  purchases: number;
  realRevenueUsd: number;
};

export type Mission = {
  id: string;
  status: MissionStatus;
  objective: MissionObjective;
  startedAt: string;
  deadlineAt: string | null;
  currentExperimentId: string | null;
  lastCommercialProgressAt: string | null;
  lastActionAt: string | null;
  progress: MissionProgress;
};

/**
 * Executors are the lanes that can actually run an experiment.
 * A mission-blessed experiment is only picked up by the lane whose
 * name matches `executor`.
 *
 * - CEE_V4: cold email + directory + gumroad marketplace listing
 * - HARDCORE: ros_jobs frontier work (github_repo, product_hunt, seo_answer, community_reply)
 * - TITAN_EXECUTIVE: cross-lane audience bets
 * - AUTONOMOUS_ENGINEERING: code/product changes (why-buy improvements, storefront copy)
 */
export type ExperimentExecutor =
  | "CEE_V4"
  | "HARDCORE"
  | "TITAN_EXECUTIVE"
  | "AUTONOMOUS_ENGINEERING";

/**
 * The channel family is the highest-leverage diversity dimension.
 * Two experiments in the same family are near-duplicates even if
 * the copy or subject line differs.
 */
export type ChannelFamily =
  | "cold_email"
  | "community_reply"
  | "seo_answer"
  | "marketplace_listing"
  | "product_hunt"
  | "github_repo"
  | "direct_dm"
  | "forum_post"
  | "review_site_seed"
  | "storefront_evolution";

export type ExperimentState =
  | "PROPOSED"
  | "ENQUEUED"
  | "CLAIMED"
  | "EXECUTING"
  | "EXTERNAL_ACTION_VERIFIED"
  | "MEASURING"
  | "WIN"
  | "LOSS"
  | "INCONCLUSIVE"
  | "BLOCKED"
  | "FAILED"
  | "ABANDONED_DUPLICATE"
  // Legacy states retained for backward compat with pre-executor-bridge rows.
  | "RUNNING"
  | "COMPLETED";

export const ACTIVE_EXPERIMENT_STATES: ExperimentState[] = [
  "ENQUEUED",
  "CLAIMED",
  "EXECUTING",
  "EXTERNAL_ACTION_VERIFIED",
  "MEASURING",
  "RUNNING",
];

export const TERMINAL_EXPERIMENT_STATES: ExperimentState[] = [
  "WIN",
  "LOSS",
  "INCONCLUSIVE",
  "BLOCKED",
  "FAILED",
  "ABANDONED_DUPLICATE",
  "COMPLETED",
];

export type ExperimentSource = "deterministic" | "openai" | "xai" | "owner";

export type ExperimentFingerprintInput = {
  channelFamily: ChannelFamily;
  audienceKey: string;
  offerKey: string;
  positioningKey: string;
  product: string;
};

export type CommercialExperiment = {
  id: string;
  missionId: string;
  fingerprint: string;
  family: ChannelFamily;
  executor: ExperimentExecutor;
  state: ExperimentState;
  hypothesis: string;
  businessId: string;
  buyer: string;
  offer: string;
  channel: string;
  expectedResult: string;
  measurement: string;
  budgetUsd: number;
  attempts: number;
  externalExposures: number;
  verifiedHumans: number;
  engagedHumans: number;
  clicks: number;
  checkoutStarts: number;
  purchases: number;
  revenueUsd: number;
  source: ExperimentSource;
  startedAt: string | null;
  completedAt: string | null;
  claimedAt: string | null;
  claimedBy: string | null;
  heartbeatAt: string | null;
  measuringStartedAt: string | null;
  externalActionVerifiedAt: string | null;
  terminalReason: string;
  lesson: string;
  nextMutation: string;
  createdAt: string;
  updatedAt: string;
};

export type VerificationMethod =
  | "PUBLIC_HTTP"
  | "PROVIDER_RECEIPT"
  | "PLATFORM_API"
  | "EXTERNAL_BROWSER"
  | "EMAIL_PROVIDER"
  | "NONE";

/**
 * A DistributionReceipt is stronger than an ExternalExecutionReceipt. It
 * asserts RevenueOS created a *legitimate opportunity for a stranger to
 * encounter the offer* — not merely that something happened outside Azure.
 *
 * Deploying to sslip.io is external. Publishing an Etsy listing is
 * distribution. The two must never be conflated.
 */
export type DistributionType =
  | "MARKETPLACE_LISTING"
  | "PUBLIC_POST"
  | "SEARCHABLE_RESOURCE"
  | "QUALIFIED_OUTBOUND"
  | "DIRECTORY_PUBLICATION"
  | "PARTNER_SURFACE";

export type DistributionReceipt = {
  id: string;
  missionId: string;
  experimentId: string;
  externalReceiptId?: string | null;
  platform: string;
  channelFamily: ChannelFamily;
  distributionType: DistributionType;
  externalId?: string | null;
  publicUrl?: string | null;
  externallyAccessible: boolean;
  discoverableOrDelivered: boolean;
  verificationMethod: Extract<
    VerificationMethod,
    "PLATFORM_API" | "PUBLIC_HTTP" | "EXTERNAL_BROWSER" | "EMAIL_PROVIDER"
  >;
  evidence: Record<string, unknown>;
  createdAt: string;
};

/**
 * Human confidence classification. Verified-human milestones require
 * PROVEN_HUMAN. UNKNOWN/LIKELY_HUMAN do NOT count toward the first-human
 * milestone, no matter how convenient it would be to promote them.
 */
export type HumanConfidence =
  | "PROVEN_HUMAN"
  | "LIKELY_HUMAN"
  | "UNKNOWN"
  | "CRAWLER"
  | "BOT"
  | "INTERNAL"
  | "SYNTHETIC";

export type ExternalExecutionReceipt = {
  id: string;
  experimentId: string;
  missionId: string;
  executor: ExperimentExecutor;
  channelFamily: ChannelFamily;
  externalActionType: string;
  externalId?: string | null;
  publicUrl?: string | null;
  verificationMethod: VerificationMethod;
  verified: boolean;
  evidence: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
};

export type OwnerAction = {
  id: string;
  missionId: string;
  experimentId: string | null;
  platform: string;
  exactAction: string;
  whyRequired: string;
  url: string | null;
  followupAfter: string;
  resolvedAt: string | null;
  createdAt: string;
};

export type Executability =
  | { executable: true; executor: string }
  | {
      executable: false;
      reason: string;
      ownerActionRequired?: boolean;
      ownerAction?: {
        platform: string;
        exactAction: string;
        whyRequired: string;
        url?: string;
        followupAfter?: string;
      };
    };

export type ExperimentProposal = {
  hypothesis: string;
  businessId: string;
  buyer: string;
  offer: string;
  channel: string;
  channelFamily: ChannelFamily;
  audienceKey: string;
  offerKey: string;
  positioningKey: string;
  executor: ExperimentExecutor;
  expectedResult: string;
  measurement: string;
  budgetUsd: number;
  source: ExperimentSource;
  meta?: Record<string, unknown>;
};

export type ProgressClock = {
  missionId: string;
  // --- funnel timestamps (do NOT collapse — each has different meaning) ---
  lastExternalActionAt: string | null;              // any external effect (deploy, publish, curl-verified)
  lastDistributionOpportunityAt: string | null;     // legit stranger-facing exposure surface created
  lastExternalExposureAt: string | null;            // legacy loose signal (kept for backcompat)
  lastVerifiedHumanAt: string | null;               // legacy loose signal (kept for backcompat)
  lastProvenHumanVisitAt: string | null;            // strict — passed the new classifier
  lastEngagementAt: string | null;
  lastCheckoutStartAt: string | null;
  lastPurchaseAt: string | null;
  // --- 1h/24h counters ---
  externalActions24h: number;
  distributionOpportunities24h: number;
  externalExposures1h: number;
  provenHumans24h: number;
  legacyUnverifiedHumanSignal1h: number;
  verifiedHumans1h: number;                         // legacy alias; deprecated
  engagements1h: number;
  checkoutStarts1h: number;
  purchasesTotal: number;
  updatedAt: string;
};

/**
 * Deterministic liveness evaluation. No LLM.
 */
export type LivenessVerdict =
  | { ok: true; reason: "ACTIVE_WITH_PROGRESS" | "ACTIVE_WITH_RUNNING_EXPERIMENT" }
  | {
      ok: false;
      reason:
        | "MISSION_INACTIVE"
        | "NO_CURRENT_EXPERIMENT"
        | "NO_EXTERNAL_PROGRESS_15M"
        | "NO_EXTERNAL_PROGRESS_30M"
        | "NO_EXTERNAL_PROGRESS_60M"
        | "OPERATOR_HEARTBEAT_STALE";
      needsRecovery: boolean;
      severity: "INFO" | "WARN" | "CRITICAL";
    };
