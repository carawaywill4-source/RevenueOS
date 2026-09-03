/**
 * Executor bridge — the missing limb between MissionController and the real
 * outside internet.
 *
 * Contract:
 *   1. Every mission-lane tick, take the mission's next ENQUEUED experiment.
 *   2. Atomically CLAIM it (single-primary-experiment invariant is upheld
 *      by MissionController.recoverFromStarvation refusing to enqueue while
 *      an experiment is still active).
 *   3. Dispatch to the correct executor based on channel family.
 *   4. Executors produce ExternalExecutionReceipt-shaped results with
 *      publicly-verifiable external effects (public URL, provider receipt,
 *      etc.). Local file writes never count as success.
 *   5. On verified success: state → EXTERNAL_ACTION_VERIFIED → MEASURING.
 *   6. On failure: state → FAILED (with failed receipt). Cooldown starts.
 *   7. On BLOCKED_NO_EXECUTOR (family without registered executor): state
 *      → BLOCKED, owner-action enqueued if applicable, MissionController
 *      immediately selects another executable experiment on the next tick.
 *
 * The bridge NEVER holds a Postgres transaction across a network call to a
 * third party. It calls the executor first, then transitions atomically
 * with a small transaction inside MissionController.markExternalActionVerified.
 */

import type pg from "pg";
import type {
  CommercialExperiment,
  ExperimentExecutor,
  MissionController,
} from "@revenueos/core";

import { checkExecutability } from "./executor-registry.js";
import { executeGumroadMarketplaceExperiment } from "./executors/gumroad-marketplace.js";
import { executeStorefrontEvolutionExperiment } from "./executors/storefront-evolution.js";

export type ExecutorBridgeLogger = (
  level: "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>,
) => void;

const OPERATOR_NAME = process.env.OPERATOR_NAME || "revenueos-operator";

function appRoot(): string {
  return (
    process.env.REVENUEOS_APP_ROOT ||
    process.env.REVENUEOS_REPO_ROOT ||
    "/opt/revenueos/app"
  );
}

type ExecutorOutcome = {
  ok: boolean;
  externalActionType: string;
  publicUrl?: string;
  externalId?: string;
  verificationMethod:
    | "PUBLIC_HTTP"
    | "PROVIDER_RECEIPT"
    | "PLATFORM_API"
    | "EXTERNAL_BROWSER"
    | "EMAIL_PROVIDER"
    | "NONE";
  verified: boolean;
  evidence: Record<string, unknown>;
  error?: string;
  /**
   * Present ONLY when the executor's outcome also creates a legitimate
   * opportunity for a stranger to encounter the offer. Storefront
   * redeploys deliberately omit this field; marketplace publications on
   * discoverable surfaces set it.
   */
  distribution?: {
    platform: string;
    distributionType:
      | "MARKETPLACE_LISTING"
      | "PUBLIC_POST"
      | "SEARCHABLE_RESOURCE"
      | "QUALIFIED_OUTBOUND"
      | "DIRECTORY_PUBLICATION"
      | "PARTNER_SURFACE";
    externallyAccessible: boolean;
    discoverableOrDelivered: boolean;
    verificationMethod:
      | "PLATFORM_API"
      | "PUBLIC_HTTP"
      | "EXTERNAL_BROWSER"
      | "EMAIL_PROVIDER";
    evidence?: Record<string, unknown>;
    externalId?: string;
    publicUrl?: string;
  };
};

async function dispatchByFamily(input: {
  experiment: CommercialExperiment;
  pool: pg.Pool;
  logger: ExecutorBridgeLogger;
}): Promise<ExecutorOutcome | { unsupported: true; reason: string }> {
  const { experiment, pool, logger } = input;
  switch (experiment.family) {
    case "marketplace_listing":
      return executeGumroadMarketplaceExperiment({
        experiment,
        appRoot: appRoot(),
        logger,
      });
    case "storefront_evolution":
      return executeStorefrontEvolutionExperiment({
        experiment,
        pool,
        logger,
      });
    // All other families intentionally have no executor in this proof phase.
    // The executability gate should have prevented them from being selected
    // in the first place; if one slips through we surface it as BLOCKED.
    case "github_repo":
    case "cold_email":
    case "community_reply":
    case "product_hunt":
    case "seo_answer":
    case "direct_dm":
    case "forum_post":
    case "review_site_seed":
      return {
        unsupported: true,
        reason: `no_executor_for_${experiment.family}`,
      };
    default:
      return {
        unsupported: true,
        reason: `unknown_family:${(experiment as any).family}`,
      };
  }
}

/**
 * Run a single bridge tick. Called by the mission lane on every slow tick.
 * Returns a summary for logging.
 */
export async function runExecutorBridgeTick(input: {
  controller: MissionController;
  pool: pg.Pool;
  missionId: string;
  logger: ExecutorBridgeLogger;
}): Promise<{
  claimedExperimentId: string | null;
  outcome:
    | "no_enqueued"
    | "not_executable"
    | "unsupported"
    | "verified"
    | "failed"
    | "claim_race_lost";
  detail?: Record<string, unknown>;
}> {
  const enqueued = await input.controller.nextEnqueuedForClaim(input.missionId);
  if (!enqueued) {
    return { claimedExperimentId: null, outcome: "no_enqueued" };
  }
  // Executability gate: even though recoverFromStarvation should filter
  // non-executable families, we re-check here in case credentials rotated
  // out from under us or the row was enqueued by a legacy code path.
  const executability = checkExecutability(enqueued.family);
  if (!executability.executable) {
    await input.controller.markTerminal(
      enqueued.id,
      "BLOCKED",
      `NOT_EXECUTABLE:${executability.reason}`,
    );
    if (executability.ownerActionRequired && executability.ownerAction) {
      await input.controller.enqueueOwnerAction({
        missionId: input.missionId,
        experimentId: enqueued.id,
        platform: executability.ownerAction.platform,
        exactAction: executability.ownerAction.exactAction,
        whyRequired: executability.ownerAction.whyRequired,
        url: executability.ownerAction.url,
        followupAfter: executability.ownerAction.followupAfter,
      });
    }
    input.logger("warn", "executor.bridge.not_executable", {
      experimentId: enqueued.id,
      family: enqueued.family,
      reason: executability.reason,
      ownerActionRequired: executability.ownerActionRequired ?? false,
    });
    return {
      claimedExperimentId: enqueued.id,
      outcome: "not_executable",
      detail: { reason: executability.reason },
    };
  }
  // Claim atomically.
  const claimedBy = `${OPERATOR_NAME}#${process.pid}`;
  const claimed = await input.controller.claimExperiment(enqueued.id, claimedBy);
  if (!claimed) {
    return { claimedExperimentId: enqueued.id, outcome: "claim_race_lost" };
  }
  await input.controller.markExecuting(claimed.id);
  const startedAt = new Date();
  input.logger("info", "executor.bridge.dispatch", {
    experimentId: claimed.id,
    family: claimed.family,
    executor: claimed.executor,
    businessId: claimed.businessId,
    channelFamilyExecutor: executability.executor,
  });
  let outcome: ExecutorOutcome | { unsupported: true; reason: string };
  try {
    outcome = await dispatchByFamily({
      experiment: claimed,
      pool: input.pool,
      logger: input.logger,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await input.controller.writeFailedReceipt({
      experimentId: claimed.id,
      executor: claimed.executor as ExperimentExecutor,
      channelFamily: claimed.family,
      externalActionType: `dispatch_${claimed.family}`,
      error: `executor_threw:${message}`,
      startedAt,
    });
    await input.controller.markTerminal(claimed.id, "FAILED", `executor_threw:${message}`);
    input.logger("error", "executor.bridge.threw", {
      experimentId: claimed.id,
      message,
    });
    return { claimedExperimentId: claimed.id, outcome: "failed", detail: { message } };
  }
  if ("unsupported" in outcome) {
    await input.controller.markTerminal(
      claimed.id,
      "BLOCKED",
      `BLOCKED_NO_EXECUTOR:${outcome.reason}`,
    );
    input.logger("warn", "executor.bridge.unsupported", {
      experimentId: claimed.id,
      reason: outcome.reason,
    });
    return {
      claimedExperimentId: claimed.id,
      outcome: "unsupported",
      detail: { reason: outcome.reason },
    };
  }
  if (!outcome.verified) {
    await input.controller.writeFailedReceipt({
      experimentId: claimed.id,
      executor: claimed.executor as ExperimentExecutor,
      channelFamily: claimed.family,
      externalActionType: outcome.externalActionType,
      verificationMethod: outcome.verificationMethod,
      evidence: outcome.evidence,
      error: outcome.error ?? "unverified",
      startedAt,
    });
    await input.controller.markTerminal(
      claimed.id,
      "FAILED",
      outcome.error ?? "unverified",
    );
    input.logger("warn", "executor.bridge.failed", {
      experimentId: claimed.id,
      error: outcome.error,
      externalActionType: outcome.externalActionType,
    });
    return {
      claimedExperimentId: claimed.id,
      outcome: "failed",
      detail: { error: outcome.error, publicUrl: outcome.publicUrl },
    };
  }
  // Verified external effect. Persist receipt + transition to
  // EXTERNAL_ACTION_VERIFIED, then MEASURING.
  const receipt = await input.controller.markExternalActionVerified({
    experimentId: claimed.id,
    executor: claimed.executor as ExperimentExecutor,
    channelFamily: claimed.family,
    externalActionType: outcome.externalActionType,
    externalId: outcome.externalId,
    publicUrl: outcome.publicUrl,
    verificationMethod: outcome.verificationMethod === "EMAIL_PROVIDER" ? "PROVIDER_RECEIPT" : outcome.verificationMethod,
    evidence: outcome.evidence,
    startedAt,
  });
  // Distribution receipt is written ONLY when the executor's outcome says
  // this action created a real stranger-facing exposure surface. A
  // storefront redeploy is not distribution; a marketplace publication
  // that's discoverable IS.
  let distributionReceiptId: string | null = null;
  if (outcome.distribution) {
    const dist = await input.controller.writeDistributionReceipt({
      experimentId: claimed.id,
      missionId: input.missionId,
      externalReceiptId: receipt?.id ?? null,
      platform: outcome.distribution.platform,
      channelFamily: claimed.family,
      distributionType: outcome.distribution.distributionType,
      externalId: outcome.distribution.externalId ?? outcome.externalId,
      publicUrl: outcome.distribution.publicUrl ?? outcome.publicUrl,
      externallyAccessible: outcome.distribution.externallyAccessible,
      discoverableOrDelivered: outcome.distribution.discoverableOrDelivered,
      verificationMethod: outcome.distribution.verificationMethod,
      evidence: outcome.distribution.evidence ?? outcome.evidence,
    });
    distributionReceiptId = dist.id;
  }
  await input.controller.markMeasuring(claimed.id);
  input.logger("info", "executor.bridge.verified", {
    experimentId: claimed.id,
    family: claimed.family,
    executor: claimed.executor,
    publicUrl: outcome.publicUrl,
    verificationMethod: outcome.verificationMethod,
    receiptId: receipt?.id ?? null,
    distributionReceiptId,
    isDistribution: Boolean(outcome.distribution),
  });
  return {
    claimedExperimentId: claimed.id,
    outcome: "verified",
    detail: {
      publicUrl: outcome.publicUrl,
      receiptId: receipt?.id ?? null,
      distributionReceiptId,
      isDistribution: Boolean(outcome.distribution),
    },
  };
}
