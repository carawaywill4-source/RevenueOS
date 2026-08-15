/**
 * MissionController.
 *
 * The one authoritative owner of the commercial mission lifecycle.
 * All status transitions live here. LLM output is advisory — it can PROPOSE
 * experiments, but it cannot terminate the mission, cannot mark liveness,
 * cannot bypass the fingerprint dedup, and cannot silence the watchdog.
 *
 * This lives inside `@revenueos/core` so both the operator process AND the
 * external watchdog service can import it against the same Postgres.
 */

import { createHash, randomUUID } from "node:crypto";
import type pg from "pg";

import { ensureMissionSchema } from "./schema.js";
import { computeProgressClock, minutesSince } from "./progress-clock.js";
import {
  computeFingerprint,
  pickNextDiverseExperiment,
  seedToProposal,
  STARVATION_CATALOG,
  type SeedExperiment,
} from "./fingerprint.js";
import type {
  ChannelFamily,
  CommercialExperiment as Experiment,
  DistributionReceipt,
  DistributionType,
  ExperimentExecutor,
  ExperimentProposal,
  ExperimentState,
  ExternalExecutionReceipt,
  LivenessVerdict,
  Mission,
  MissionObjective,
  MissionProgress,
  MissionStatus,
  OwnerAction,
  ProgressClock,
  VerificationMethod,
} from "./types.js";

export type MissionControllerLogger = (
  level: "info" | "warn" | "error",
  event: string,
  payload?: Record<string, unknown>,
) => void;

const NO_PROGRESS_WARN_MINUTES = 15;
const NO_PROGRESS_WARN2_MINUTES = 30;
const NO_PROGRESS_CRITICAL_MINUTES = 60;

const EXPERIMENT_STARTED_STALE_MINUTES = 90;

/**
 * Cooldown gate — but it now applies ONLY to experiments that reached a real
 * outcome (EXTERNAL_ACTION_VERIFIED or a terminal state). Merely being
 * ENQUEUED or CLAIMED does NOT start the cooldown; otherwise a queue that
 * nothing consumes recreates the very idle bug this system exists to
 * prevent. See docs above `recoverFromStarvation`.
 */
const MIN_RECOVERY_GAP_MINUTES_AFTER_TERMINAL = 5;

/**
 * SLA gates. Any active experiment in one of these states beyond its budget
 * is considered stalled and gets recovered.
 */
const ENQUEUED_SLA_SECONDS = 60;
const CLAIMED_SLA_SECONDS = 120;
const EXECUTING_SLA_SECONDS = 300;
const HEARTBEAT_SLA_SECONDS = 180;

/**
 * Measurement window. After this many minutes with zero commercial signals
 * on a MEASURING experiment, the deterministic scheduler transitions it to
 * LOSS so the next materially-different experiment can be selected. This is
 * the "natural conclusion" path (as opposed to WIN which requires evidence
 * or LOSS which requires enough negative signal).
 */
const MEASURING_WINDOW_MINUTES_DEFAULT = 90;

/**
 * Zero-humans short-circuit. If a conversion-oriented experiment (e.g.
 * storefront_evolution) is MEASURING for longer than this and there are
 * still zero proven humans anywhere on the mission, transition it to
 * INCONCLUSIVE_NO_TRAFFIC. A conversion improvement cannot be measured
 * against traffic that does not exist. Distribution work must take over.
 */
const MEASURING_NO_TRAFFIC_SHORT_CIRCUIT_MINUTES = 5;

/**
 * Channel families that are considered "conversion support" rather than
 * "distribution creation". These are subject to the zero-humans
 * short-circuit above.
 */
const CONVERSION_SUPPORT_FAMILIES: ChannelFamily[] = [
  "storefront_evolution",
];

/**
 * Channel families that DO create distribution opportunities when they
 * execute successfully. Used by the distribution-first ranking when the
 * mission still has zero proven humans.
 */
export const TIER1_DISTRIBUTION_FAMILIES: ChannelFamily[] = [
  "marketplace_listing",
  "cold_email",
  "community_reply",
  "seo_answer",
  "product_hunt",
  "github_repo",
  "direct_dm",
  "forum_post",
];

/**
 * MAX_ACTIVE_PRIMARY_EXPERIMENTS — proof-phase invariant. Exactly one
 * non-terminal experiment may be current at a time so deterministic
 * ownership is provable. Controlled parallelism is a follow-on.
 */
const MAX_ACTIVE_PRIMARY_EXPERIMENTS = 1;

export class MissionController {
  constructor(
    private readonly pool: pg.Pool,
    private readonly logger: MissionControllerLogger = () => {},
  ) {}

  async init(): Promise<void> {
    await ensureMissionSchema(this.pool);
  }

  // ---------------------------------------------------------------------------
  // Mission lifecycle (deterministic)
  // ---------------------------------------------------------------------------

  async loadActiveMission(): Promise<Mission | null> {
    const r = await this.pool.query(
      `select id, status, objective, progress, started_at, deadline_at,
              current_experiment_id, last_commercial_progress_at, last_action_at
         from ros_missions
        where status='ACTIVE'
        order by started_at desc
        limit 1`,
    );
    if (r.rowCount === 0) return null;
    return rowToMission(r.rows[0]);
  }

  async ensureActiveMission(objective: MissionObjective, deadline?: Date | null): Promise<Mission> {
    const existing = await this.loadActiveMission();
    if (existing) return existing;
    return this.createMission(objective, deadline ?? null);
  }

  async createMission(
    objective: MissionObjective,
    deadlineAt: Date | null,
  ): Promise<Mission> {
    const id = `mission_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_${
      randomUUID().slice(0, 8)
    }`;
    const initialProgress: MissionProgress = {
      externalExposures: 0,
      verifiedHumans: 0,
      engagedHumans: 0,
      checkoutStarts: 0,
      purchases: 0,
      realRevenueUsd: 0,
    };
    await this.pool.query(
      `insert into ros_missions (
         id, status, objective_primary,
         first_sale_target_usd, long_term_daily_revenue_target_usd,
         started_at, deadline_at,
         objective, progress
       ) values ($1, 'ACTIVE', $2, $3, $4, now(), $5, $6::jsonb, $7::jsonb)`,
      [
        id,
        objective.primary,
        objective.firstSaleTargetUsd,
        objective.longTermDailyRevenueTargetUsd,
        deadlineAt,
        JSON.stringify(objective),
        JSON.stringify(initialProgress),
      ],
    );
    this.logger("info", "mission.created", { missionId: id, deadlineAt });
    return {
      id,
      status: "ACTIVE",
      objective,
      startedAt: new Date().toISOString(),
      deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
      currentExperimentId: null,
      lastCommercialProgressAt: null,
      lastActionAt: null,
      progress: initialProgress,
    };
  }

  /**
   * Deterministic transition. Called ONLY from the controller — never from
   * an LLM output. Allowed transitions:
   *   ACTIVE -> SUCCESS            (only when a real purchase lands)
   *   ACTIVE -> DEADLINE_REACHED   (only when now() >= deadline_at)
   *   ACTIVE -> PAUSED_BY_OWNER    (owner CLI/API only)
   *   ACTIVE -> ABANDONED_BY_OWNER (owner CLI/API only)
   */
  async transitionStatus(
    missionId: string,
    to: MissionStatus,
    reason: string,
  ): Promise<Mission | null> {
    if (to === "ACTIVE") throw new Error("mission_status_illegal_transition_to_active");
    const current = await this.pool.query(
      `select status from ros_missions where id=$1`,
      [missionId],
    );
    if (current.rowCount === 0) return null;
    const currentStatus = current.rows[0].status as MissionStatus;
    if (currentStatus !== "ACTIVE") {
      this.logger("warn", "mission.transition.noop", {
        missionId,
        from: currentStatus,
        to,
        reason,
      });
      return null;
    }
    if (to === "SUCCESS") {
      const purchases = await this.pool.query(
        `select count(*)::int as n from ros_purchases
          where stripe_session_id not like 'cs_test_%'
            and coalesce(meta->>'payment_status','paid') <> 'unpaid'`,
      );
      const n = Number(purchases.rows[0]?.n ?? 0);
      if (n < 1) {
        this.logger("error", "mission.transition.refused", {
          missionId,
          to: "SUCCESS",
          reason: "no_real_purchase",
        });
        return null;
      }
    }
    if (to === "DEADLINE_REACHED") {
      const r = await this.pool.query(
        `select deadline_at from ros_missions where id=$1`,
        [missionId],
      );
      const deadline = r.rows[0]?.deadline_at as Date | null;
      if (!deadline || deadline.getTime() > Date.now()) {
        this.logger("error", "mission.transition.refused", {
          missionId,
          to: "DEADLINE_REACHED",
          reason: "deadline_not_reached",
        });
        return null;
      }
    }
    await this.pool.query(
      `update ros_missions set status=$1, updated_at=now(),
              meta = coalesce(meta, '{}'::jsonb)
                   || jsonb_build_object('lastTransitionReason', $2::text,
                                          'lastTransitionAt', now()::text)
         where id=$3 and status='ACTIVE'`,
      [to, reason, missionId],
    );
    this.logger("info", "mission.transitioned", { missionId, to, reason });
    return this.loadMission(missionId);
  }

  async loadMission(missionId: string): Promise<Mission | null> {
    const r = await this.pool.query(
      `select id, status, objective, progress, started_at, deadline_at,
              current_experiment_id, last_commercial_progress_at, last_action_at
         from ros_missions where id=$1`,
      [missionId],
    );
    if (r.rowCount === 0) return null;
    return rowToMission(r.rows[0]);
  }

  // ---------------------------------------------------------------------------
  // Progress clock
  // ---------------------------------------------------------------------------

  async refreshProgressClock(missionId: string): Promise<ProgressClock> {
    const clock = await computeProgressClock(this.pool, missionId);
    // Cache summary progress on the mission row too, for cheap reads.
    const progress: MissionProgress = {
      externalExposures: clock.externalExposures1h,
      verifiedHumans: clock.verifiedHumans1h,
      engagedHumans: clock.engagements1h,
      checkoutStarts: clock.checkoutStarts1h,
      purchases: clock.purchasesTotal,
      realRevenueUsd: 0,
    };
    const lastCommercialProgressAt =
      clock.lastPurchaseAt ??
      clock.lastCheckoutStartAt ??
      clock.lastEngagementAt ??
      clock.lastVerifiedHumanAt ??
      null;
    await this.pool.query(
      `update ros_missions set
         progress=$1::jsonb,
         last_commercial_progress_at=$2,
         updated_at=now()
       where id=$3`,
      [JSON.stringify(progress), lastCommercialProgressAt, missionId],
    );
    return clock;
  }

  // ---------------------------------------------------------------------------
  // Experiments: proposal, dedup, enqueue, currentByExecutor
  // ---------------------------------------------------------------------------

  /**
   * Insert an experiment in PROPOSED state. If the fingerprint already exists
   * for this mission, refuses with `duplicate` and does NOT count as a new
   * experiment. LLMs cannot rename their way past this.
   */
  async proposeExperiment(
    missionId: string,
    proposal: ExperimentProposal,
  ): Promise<
    | { ok: true; experiment: Experiment }
    | { ok: false; reason: "duplicate"; existing: Experiment }
  > {
    const fp = computeFingerprint({
      channelFamily: proposal.channelFamily,
      audienceKey: proposal.audienceKey,
      offerKey: proposal.offerKey,
      positioningKey: proposal.positioningKey,
      product: proposal.businessId,
    });
    const existing = await this.pool.query(
      `select * from ros_commercial_experiments
        where mission_id=$1 and fingerprint=$2`,
      [missionId, fp],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return { ok: false, reason: "duplicate", existing: rowToExperiment(existing.rows[0]) };
    }
    const id = `exp_${fp}_${randomUUID().slice(0, 6)}`;
    const inserted = await this.pool.query(
      `insert into ros_commercial_experiments (
         id, mission_id, fingerprint, family, executor, state,
         hypothesis, business_id, buyer, offer, channel,
         expected_result, measurement, budget_usd,
         source, meta
       ) values (
         $1, $2, $3, $4, $5, 'PROPOSED',
         $6, $7, $8, $9, $10,
         $11, $12, $13,
         $14, $15::jsonb
       )
       returning *`,
      [
        id,
        missionId,
        fp,
        proposal.channelFamily,
        proposal.executor,
        proposal.hypothesis,
        proposal.businessId,
        proposal.buyer,
        proposal.offer,
        proposal.channel,
        proposal.expectedResult,
        proposal.measurement,
        proposal.budgetUsd,
        proposal.source,
        JSON.stringify(proposal.meta ?? {}),
      ],
    );
    return { ok: true, experiment: rowToExperiment(inserted.rows[0]) };
  }

  async enqueueExperiment(experimentId: string): Promise<Experiment | null> {
    const r = await this.pool.query(
      `update ros_commercial_experiments
          set state='ENQUEUED', updated_at=now()
        where id=$1 and state in ('PROPOSED')
      returning *`,
      [experimentId],
    );
    if (r.rowCount === 0) return null;
    const exp = rowToExperiment(r.rows[0]);
    await this.pool.query(
      `update ros_missions set current_experiment_id=$1, last_action_at=now(), updated_at=now()
        where id=$2`,
      [exp.id, exp.missionId],
    );
    this.logger("info", "mission.experiment.enqueued", {
      missionId: exp.missionId,
      experimentId: exp.id,
      family: exp.family,
      executor: exp.executor,
      businessId: exp.businessId,
      fingerprint: exp.fingerprint,
    });
    return exp;
  }

  /**
   * Atomically claim an ENQUEUED experiment. Uses a WHERE clause so two
   * competing executors cannot both claim the same row.
   */
  async claimExperiment(
    experimentId: string,
    claimedBy: string,
  ): Promise<Experiment | null> {
    const r = await this.pool.query(
      `update ros_commercial_experiments
          set state='CLAIMED',
              claimed_at=now(),
              claimed_by=$2,
              heartbeat_at=now(),
              attempts=attempts+1,
              updated_at=now()
        where id=$1 and state='ENQUEUED'
      returning *`,
      [experimentId, claimedBy],
    );
    if (r.rowCount === 0) return null;
    const exp = rowToExperiment(r.rows[0]);
    this.logger("info", "mission.experiment.claimed", {
      missionId: exp.missionId,
      experimentId: exp.id,
      claimedBy,
      family: exp.family,
    });
    return exp;
  }

  async markExecuting(experimentId: string): Promise<void> {
    await this.pool.query(
      `update ros_commercial_experiments
          set state='EXECUTING',
              started_at=coalesce(started_at, now()),
              heartbeat_at=now(),
              updated_at=now()
        where id=$1 and state='CLAIMED'`,
      [experimentId],
    );
  }

  async recordExecutorHeartbeat(experimentId: string): Promise<void> {
    await this.pool.query(
      `update ros_commercial_experiments
          set heartbeat_at=now(), updated_at=now()
        where id=$1 and state in ('CLAIMED', 'EXECUTING')`,
      [experimentId],
    );
  }

  /**
   * The executor produced a real external result. Persist the receipt AND
   * transition state atomically.
   */
  async markExternalActionVerified(input: {
    experimentId: string;
    executor: ExperimentExecutor;
    channelFamily: string;
    externalActionType: string;
    externalId?: string | null;
    publicUrl?: string | null;
    verificationMethod: VerificationMethod;
    evidence: Record<string, unknown>;
    startedAt: Date;
  }): Promise<ExternalExecutionReceipt | null> {
    const client = await (this.pool as any).connect?.();
    const q = client
      ? (text: string, values: unknown[]) => client.query(text, values)
      : (text: string, values: unknown[]) => this.pool.query(text, values);
    try {
      if (client) await client.query("begin");
      const expRow = await q(
        `select mission_id, executor, family from ros_commercial_experiments where id=$1`,
        [input.experimentId],
      );
      if (!expRow.rowCount) {
        if (client) await client.query("rollback");
        return null;
      }
      const missionId = expRow.rows[0].mission_id as string;
      const receiptId = `rcpt_${new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .slice(0, 14)}_${randomUUID().slice(0, 6)}`;
      await q(
        `insert into ros_external_execution_receipts (
           id, experiment_id, mission_id, executor, channel_family,
           external_action_type, external_id, public_url,
           verification_method, verified, evidence, started_at, completed_at
         ) values ($1,$2,$3,$4,$5, $6,$7,$8, $9, true, $10::jsonb, $11, now())`,
        [
          receiptId,
          input.experimentId,
          missionId,
          input.executor,
          input.channelFamily,
          input.externalActionType,
          input.externalId ?? null,
          input.publicUrl ?? null,
          input.verificationMethod,
          JSON.stringify(input.evidence ?? {}),
          input.startedAt,
        ],
      );
      const updated = await q(
        `update ros_commercial_experiments
            set state='EXTERNAL_ACTION_VERIFIED',
                external_action_verified_at=now(),
                heartbeat_at=now(),
                updated_at=now()
          where id=$1 and state in ('CLAIMED', 'EXECUTING')
        returning *`,
        [input.experimentId],
      );
      if (!updated.rowCount) {
        if (client) await client.query("rollback");
        return null;
      }
      if (client) await client.query("commit");
      this.logger("info", "mission.experiment.external_action_verified", {
        experimentId: input.experimentId,
        missionId,
        executor: input.executor,
        channelFamily: input.channelFamily,
        publicUrl: input.publicUrl,
        verificationMethod: input.verificationMethod,
      });
      return {
        id: receiptId,
        experimentId: input.experimentId,
        missionId,
        executor: input.executor,
        channelFamily: input.channelFamily as any,
        externalActionType: input.externalActionType,
        externalId: input.externalId ?? null,
        publicUrl: input.publicUrl ?? null,
        verificationMethod: input.verificationMethod,
        verified: true,
        evidence: input.evidence ?? {},
        startedAt: input.startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
    } catch (err) {
      if (client) await client.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      if (client && typeof client.release === "function") client.release();
    }
  }

  async markMeasuring(experimentId: string): Promise<void> {
    await this.pool.query(
      `update ros_commercial_experiments
          set state='MEASURING',
              measuring_started_at=coalesce(measuring_started_at, now()),
              heartbeat_at=now(),
              updated_at=now()
        where id=$1 and state='EXTERNAL_ACTION_VERIFIED'`,
      [experimentId],
    );
  }

  async markTerminal(
    experimentId: string,
    state: Extract<ExperimentState, "WIN" | "LOSS" | "INCONCLUSIVE" | "BLOCKED" | "FAILED">,
    reason: string,
    lesson = "",
    nextMutation = "",
  ): Promise<void> {
    await this.pool.query(
      `update ros_commercial_experiments
          set state=$1,
              terminal_reason=$2,
              lesson=$3,
              next_mutation=$4,
              completed_at=now(),
              updated_at=now()
        where id=$5`,
      [state, reason, lesson, nextMutation, experimentId],
    );
    this.logger(state === "WIN" ? "info" : "warn", "mission.experiment.terminal", {
      experimentId,
      state,
      reason,
      lesson,
    });
  }

  /**
   * Persist a DistributionReceipt. Called by the bridge AFTER
   * markExternalActionVerified if the executor result says the external
   * action also created a legitimate stranger-facing exposure surface.
   *
   * A storefront redeploy is external, not distribution. An Etsy listing
   * publication is external AND distribution. This method is what encodes
   * that difference in DB terms.
   */
  async writeDistributionReceipt(input: {
    experimentId: string;
    missionId: string;
    externalReceiptId?: string | null;
    platform: string;
    channelFamily: ChannelFamily;
    distributionType: DistributionType;
    externalId?: string | null;
    publicUrl?: string | null;
    externallyAccessible: boolean;
    discoverableOrDelivered: boolean;
    verificationMethod: DistributionReceipt["verificationMethod"];
    evidence: Record<string, unknown>;
  }): Promise<DistributionReceipt> {
    const id = `dist_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}_${randomUUID().slice(0, 6)}`;
    await this.pool.query(
      `insert into ros_distribution_receipts (
         id, mission_id, experiment_id, external_receipt_id,
         platform, channel_family, distribution_type,
         external_id, public_url,
         externally_accessible, discoverable_or_delivered,
         verification_method, evidence
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
      [
        id,
        input.missionId,
        input.experimentId,
        input.externalReceiptId ?? null,
        input.platform,
        input.channelFamily,
        input.distributionType,
        input.externalId ?? null,
        input.publicUrl ?? null,
        input.externallyAccessible,
        input.discoverableOrDelivered,
        input.verificationMethod,
        JSON.stringify(input.evidence ?? {}),
      ],
    );
    this.logger("info", "mission.distribution.receipt", {
      missionId: input.missionId,
      experimentId: input.experimentId,
      platform: input.platform,
      distributionType: input.distributionType,
      publicUrl: input.publicUrl ?? null,
      externallyAccessible: input.externallyAccessible,
      discoverableOrDelivered: input.discoverableOrDelivered,
    });
    return {
      id,
      missionId: input.missionId,
      experimentId: input.experimentId,
      externalReceiptId: input.externalReceiptId ?? null,
      platform: input.platform,
      channelFamily: input.channelFamily,
      distributionType: input.distributionType,
      externalId: input.externalId ?? null,
      publicUrl: input.publicUrl ?? null,
      externallyAccessible: input.externallyAccessible,
      discoverableOrDelivered: input.discoverableOrDelivered,
      verificationMethod: input.verificationMethod,
      evidence: input.evidence ?? {},
      createdAt: new Date().toISOString(),
    };
  }

  async listDistributionReceipts(
    missionId: string,
    limit = 20,
  ): Promise<DistributionReceipt[]> {
    const r = await this.pool.query(
      `select * from ros_distribution_receipts
        where mission_id=$1
        order by created_at desc
        limit $2`,
      [missionId, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      missionId: row.mission_id,
      experimentId: row.experiment_id,
      externalReceiptId: row.external_receipt_id ?? null,
      platform: row.platform,
      channelFamily: row.channel_family,
      distributionType: row.distribution_type,
      externalId: row.external_id ?? null,
      publicUrl: row.public_url ?? null,
      externallyAccessible: row.externally_accessible,
      discoverableOrDelivered: row.discoverable_or_delivered,
      verificationMethod: row.verification_method,
      evidence: row.evidence ?? {},
      createdAt: (row.created_at as Date).toISOString(),
    }));
  }

  async writeFailedReceipt(input: {
    experimentId: string;
    executor: ExperimentExecutor;
    channelFamily: string;
    externalActionType: string;
    error: string;
    verificationMethod?: VerificationMethod;
    evidence?: Record<string, unknown>;
    startedAt: Date;
  }): Promise<void> {
    const expRow = await this.pool.query(
      `select mission_id from ros_commercial_experiments where id=$1`,
      [input.experimentId],
    );
    if (!expRow.rowCount) return;
    const missionId = expRow.rows[0].mission_id as string;
    const receiptId = `rcpt_${new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14)}_${randomUUID().slice(0, 6)}`;
    await this.pool.query(
      `insert into ros_external_execution_receipts (
         id, experiment_id, mission_id, executor, channel_family,
         external_action_type, verification_method, verified,
         evidence, error, started_at, completed_at
       ) values ($1,$2,$3,$4,$5, $6, $7, false, $8::jsonb, $9, $10, now())`,
      [
        receiptId,
        input.experimentId,
        missionId,
        input.executor,
        input.channelFamily,
        input.externalActionType,
        input.verificationMethod ?? "NONE",
        JSON.stringify(input.evidence ?? {}),
        input.error,
        input.startedAt,
      ],
    );
  }

  /**
   * Kept for backward compatibility. New code should use markExecuting after
   * a claim; the old markExperimentRunning is a no-op if the experiment is
   * beyond ENQUEUED.
   */
  async markExperimentRunning(experimentId: string): Promise<void> {
    await this.pool.query(
      `update ros_commercial_experiments
          set state='EXECUTING',
              started_at=coalesce(started_at, now()),
              heartbeat_at=now(),
              updated_at=now()
        where id=$1 and state in ('CLAIMED')`,
      [experimentId],
    );
  }

  async recordExperimentSignal(
    experimentId: string,
    signals: Partial<{
      externalExposures: number;
      verifiedHumans: number;
      engagedHumans: number;
      clicks: number;
      checkoutStarts: number;
      purchases: number;
      revenueUsd: number;
    }>,
  ): Promise<void> {
    await this.pool.query(
      `update ros_commercial_experiments
          set external_exposures = external_exposures + coalesce($1, 0),
              verified_humans   = verified_humans   + coalesce($2, 0),
              engaged_humans    = engaged_humans    + coalesce($3, 0),
              clicks            = clicks            + coalesce($4, 0),
              checkout_starts   = checkout_starts   + coalesce($5, 0),
              purchases         = purchases         + coalesce($6, 0),
              revenue_usd       = revenue_usd       + coalesce($7, 0),
              updated_at        = now()
        where id=$8`,
      [
        signals.externalExposures ?? 0,
        signals.verifiedHumans ?? 0,
        signals.engagedHumans ?? 0,
        signals.clicks ?? 0,
        signals.checkoutStarts ?? 0,
        signals.purchases ?? 0,
        signals.revenueUsd ?? 0,
        experimentId,
      ],
    );
  }

  async completeExperiment(
    experimentId: string,
    outcome: {
      state: Extract<ExperimentState, "COMPLETED" | "FAILED">;
      lesson: string;
      nextMutation?: string;
    },
  ): Promise<void> {
    await this.pool.query(
      `update ros_commercial_experiments
          set state=$1, lesson=$2, next_mutation=$3, completed_at=now(), updated_at=now()
        where id=$4`,
      [outcome.state, outcome.lesson, outcome.nextMutation ?? "", experimentId],
    );
    this.logger("info", "mission.experiment.completed", {
      experimentId,
      state: outcome.state,
      lesson: outcome.lesson,
    });
  }

  async currentExperiment(missionId: string): Promise<Experiment | null> {
    const r = await this.pool.query(
      `select * from ros_commercial_experiments
        where mission_id=$1
          and state in (
            'ENQUEUED','CLAIMED','EXECUTING',
            'EXTERNAL_ACTION_VERIFIED','MEASURING','RUNNING'
          )
        order by case state
                   when 'MEASURING' then 0
                   when 'EXTERNAL_ACTION_VERIFIED' then 1
                   when 'EXECUTING' then 2
                   when 'CLAIMED' then 3
                   when 'RUNNING' then 4
                   else 5
                 end,
                 coalesce(started_at, created_at) desc
        limit 1`,
      [missionId],
    );
    if (r.rowCount === 0) return null;
    return rowToExperiment(r.rows[0]);
  }

  async currentExperimentForExecutor(
    missionId: string,
    executor: ExperimentExecutor,
  ): Promise<Experiment | null> {
    const r = await this.pool.query(
      `select * from ros_commercial_experiments
        where mission_id=$1 and executor=$2
          and state in (
            'ENQUEUED','CLAIMED','EXECUTING',
            'EXTERNAL_ACTION_VERIFIED','MEASURING','RUNNING'
          )
        order by coalesce(started_at, created_at) desc
        limit 1`,
      [missionId, executor],
    );
    if (r.rowCount === 0) return null;
    return rowToExperiment(r.rows[0]);
  }

  /**
   * Return the next ENQUEUED experiment ready for an executor to claim. This
   * is the entry point used by the executor-bridge each tick.
   */
  async nextEnqueuedForClaim(missionId: string): Promise<Experiment | null> {
    const r = await this.pool.query(
      `select * from ros_commercial_experiments
        where mission_id=$1 and state='ENQUEUED'
        order by coalesce(started_at, created_at) asc
        limit 1`,
      [missionId],
    );
    if (r.rowCount === 0) return null;
    return rowToExperiment(r.rows[0]);
  }

  async countActivePrimaryExperiments(missionId: string): Promise<number> {
    const r = await this.pool.query(
      `select count(*)::int as n from ros_commercial_experiments
        where mission_id=$1
          and state in (
            'ENQUEUED','CLAIMED','EXECUTING',
            'EXTERNAL_ACTION_VERIFIED','MEASURING','RUNNING'
          )`,
      [missionId],
    );
    return Number(r.rows[0]?.n ?? 0);
  }

  async loadExperiment(experimentId: string): Promise<Experiment | null> {
    const r = await this.pool.query(
      `select * from ros_commercial_experiments where id=$1`,
      [experimentId],
    );
    if (r.rowCount === 0) return null;
    return rowToExperiment(r.rows[0]);
  }

  // ---------------------------------------------------------------------------
  // SLA enforcement — the queue is not allowed to silently stall.
  // ---------------------------------------------------------------------------

  /**
   * Sweep for experiments that have been sitting in an active state longer
   * than their SLA allows. Returns the number of experiments swept so callers
   * can log/incident. Called every tick by both the operator mission lane
   * and the external watchdog.
   *
   *   ENQUEUED  > 60s              → COMMERCIAL_EXECUTION_STALL, mark BLOCKED
   *   CLAIMED   > 120s no heartbeat → EXECUTOR_LEASE_STALE, release to ENQUEUED
   *   EXECUTING > 5m  no heartbeat → EXECUTOR_LEASE_STALE, mark FAILED
   */
  async enforceQueueSlas(missionId: string): Promise<{
    enqueuedStalls: number;
    reclaimed: number;
    executingFailed: number;
  }> {
    let enqueuedStalls = 0;
    let reclaimed = 0;
    let executingFailed = 0;
    const stallCandidates = await this.pool.query(
      `select id, executor, family, updated_at from ros_commercial_experiments
        where mission_id=$1 and state='ENQUEUED'
          and updated_at < now() - ($2::int || ' seconds')::interval`,
      [missionId, ENQUEUED_SLA_SECONDS],
    );
    for (const row of stallCandidates.rows) {
      await this.pool.query(
        `update ros_commercial_experiments
            set state='BLOCKED',
                terminal_reason='COMMERCIAL_EXECUTION_STALL',
                completed_at=now(),
                updated_at=now()
          where id=$1 and state='ENQUEUED'`,
        [row.id],
      );
      await this.openIncident(missionId, {
        kind: "COMMERCIAL_EXECUTION_STALL",
        severity: "WARN",
        detail: `Experiment ${row.id} (${row.family}/${row.executor}) sat ENQUEUED > ${ENQUEUED_SLA_SECONDS}s without being claimed.`,
        meta: { experimentId: row.id },
      });
      enqueuedStalls += 1;
    }
    const staleClaims = await this.pool.query(
      `select id, executor from ros_commercial_experiments
        where mission_id=$1 and state='CLAIMED'
          and coalesce(heartbeat_at, claimed_at, updated_at)
              < now() - ($2::int || ' seconds')::interval`,
      [missionId, CLAIMED_SLA_SECONDS],
    );
    for (const row of staleClaims.rows) {
      await this.pool.query(
        `update ros_commercial_experiments
            set state='ENQUEUED',
                claimed_at=null,
                claimed_by=null,
                heartbeat_at=null,
                updated_at=now()
          where id=$1 and state='CLAIMED'`,
        [row.id],
      );
      await this.openIncident(missionId, {
        kind: "EXECUTOR_LEASE_STALE",
        severity: "WARN",
        detail: `Executor lease for ${row.id} (${row.executor}) expired without heartbeat; released back to ENQUEUED.`,
        meta: { experimentId: row.id },
      });
      reclaimed += 1;
    }
    const staleExecuting = await this.pool.query(
      `select id, executor from ros_commercial_experiments
        where mission_id=$1 and state='EXECUTING'
          and coalesce(heartbeat_at, started_at, updated_at)
              < now() - ($2::int || ' seconds')::interval`,
      [missionId, Math.max(EXECUTING_SLA_SECONDS, HEARTBEAT_SLA_SECONDS)],
    );
    for (const row of staleExecuting.rows) {
      await this.markTerminal(row.id, "FAILED", "EXECUTOR_HEARTBEAT_LOST");
      await this.openIncident(missionId, {
        kind: "EXECUTOR_LEASE_STALE",
        severity: "WARN",
        detail: `Executor for ${row.id} (${row.executor}) stopped heartbeating during EXECUTING; marked FAILED.`,
        meta: { experimentId: row.id },
      });
      executingFailed += 1;
    }
    return { enqueuedStalls, reclaimed, executingFailed };
  }

  /**
   * Natural conclusion path: any MEASURING experiment past its measurement
   * window with zero commercial signals is transitioned to LOSS so the
   * MissionController can select a materially different next experiment.
   */
  async concludeStaleMeasuring(
    missionId: string,
    windowMinutes: number = MEASURING_WINDOW_MINUTES_DEFAULT,
  ): Promise<number> {
    let closed = 0;

    // (A) Fast short-circuit: conversion-support experiments (e.g.
    //     storefront_evolution) that have been MEASURING for a short
    //     window without any proven-human traffic anywhere on the
    //     mission. There is nothing to measure. Return control to
    //     distribution acquisition.
    const provenHumansTotal = await this.pool
      .query<{ n: number }>(
        `select coalesce(proven_humans_24h, 0)::int as n
           from ros_mission_progress_clock where mission_id=$1`,
        [missionId],
      )
      .then((r) => Number(r.rows[0]?.n ?? 0))
      .catch(() => 0);

    if (provenHumansTotal === 0) {
      const shortCircuit = await this.pool.query(
        `select id, family from ros_commercial_experiments
          where mission_id=$1 and state='MEASURING'
            and family = ANY($2::text[])
            and coalesce(measuring_started_at, external_action_verified_at, updated_at)
                < now() - ($3::int || ' minutes')::interval`,
        [
          missionId,
          CONVERSION_SUPPORT_FAMILIES,
          MEASURING_NO_TRAFFIC_SHORT_CIRCUIT_MINUTES,
        ],
      );
      for (const row of shortCircuit.rows) {
        await this.markTerminal(
          row.id,
          "INCONCLUSIVE",
          "INCONCLUSIVE_NO_TRAFFIC",
          "Conversion-support experiment cannot be measured against zero proven humans. Return to distribution acquisition.",
        );
        this.logger("warn", "mission.experiment.inconclusive_no_traffic", {
          missionId,
          experimentId: row.id,
          family: row.family,
        });
        closed += 1;
      }
    }

    // (B) Full-window natural conclusion for everything else.
    const r = await this.pool.query(
      `select id, verified_humans, checkout_starts, purchases
         from ros_commercial_experiments
        where mission_id=$1 and state='MEASURING'
          and coalesce(measuring_started_at, external_action_verified_at, updated_at)
              < now() - ($2::int || ' minutes')::interval`,
      [missionId, windowMinutes],
    );
    for (const row of r.rows) {
      const humans = Number(row.verified_humans ?? 0);
      const checkouts = Number(row.checkout_starts ?? 0);
      const purchases = Number(row.purchases ?? 0);
      if (purchases > 0) {
        await this.markTerminal(row.id, "WIN", "REAL_PURCHASE_ATTRIBUTED");
      } else if (humans === 0 && checkouts === 0) {
        await this.markTerminal(
          row.id,
          "LOSS",
          "MEASURING_WINDOW_EXPIRED_ZERO_SIGNAL",
          "Measurement window closed with no verified humans or checkouts. Try a materially different channel/audience/offer.",
        );
      } else {
        await this.markTerminal(
          row.id,
          "INCONCLUSIVE",
          "MEASURING_WINDOW_EXPIRED_WEAK_SIGNAL",
        );
      }
      closed += 1;
    }
    return closed;
  }

  // ---------------------------------------------------------------------------
  // Owner-action queue (never freezes the mission).
  // ---------------------------------------------------------------------------

  async enqueueOwnerAction(input: {
    missionId: string;
    experimentId?: string | null;
    platform: string;
    exactAction: string;
    whyRequired: string;
    url?: string;
    followupAfter?: string;
  }): Promise<OwnerAction> {
    const id = `own_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}_${randomUUID().slice(0, 6)}`;
    await this.pool.query(
      `insert into ros_owner_action_queue (
         id, mission_id, experiment_id, platform, exact_action,
         why_required, url, followup_after
       ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        input.missionId,
        input.experimentId ?? null,
        input.platform,
        input.exactAction,
        input.whyRequired,
        input.url ?? null,
        input.followupAfter ?? "",
      ],
    );
    this.logger("warn", "mission.owner_action.enqueued", {
      missionId: input.missionId,
      experimentId: input.experimentId ?? null,
      platform: input.platform,
    });
    return {
      id,
      missionId: input.missionId,
      experimentId: input.experimentId ?? null,
      platform: input.platform,
      exactAction: input.exactAction,
      whyRequired: input.whyRequired,
      url: input.url ?? null,
      followupAfter: input.followupAfter ?? "",
      resolvedAt: null,
      createdAt: new Date().toISOString(),
    };
  }

  async listOpenOwnerActions(missionId: string): Promise<OwnerAction[]> {
    const r = await this.pool.query(
      `select * from ros_owner_action_queue
        where mission_id=$1 and resolved_at is null
        order by created_at desc`,
      [missionId],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      missionId: row.mission_id,
      experimentId: row.experiment_id ?? null,
      platform: row.platform,
      exactAction: row.exact_action,
      whyRequired: row.why_required,
      url: row.url ?? null,
      followupAfter: row.followup_after ?? "",
      resolvedAt: row.resolved_at ? (row.resolved_at as Date).toISOString() : null,
      createdAt: (row.created_at as Date).toISOString(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Receipts
  // ---------------------------------------------------------------------------

  async listReceipts(missionId: string, limit = 20): Promise<ExternalExecutionReceipt[]> {
    const r = await this.pool.query(
      `select * from ros_external_execution_receipts
        where mission_id=$1
        order by created_at desc
        limit $2`,
      [missionId, limit],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      experimentId: row.experiment_id,
      missionId: row.mission_id,
      executor: row.executor,
      channelFamily: row.channel_family,
      externalActionType: row.external_action_type,
      externalId: row.external_id ?? null,
      publicUrl: row.public_url ?? null,
      verificationMethod: row.verification_method,
      verified: row.verified,
      evidence: row.evidence ?? {},
      error: row.error ?? "",
      startedAt: (row.started_at as Date).toISOString(),
      completedAt: (row.completed_at as Date).toISOString(),
      createdAt: (row.created_at as Date).toISOString(),
    }));
  }

  async listTriedFingerprints(missionId: string, limit = 100): Promise<string[]> {
    const r = await this.pool.query(
      `select fingerprint from ros_commercial_experiments
        where mission_id=$1
        order by created_at desc
        limit $2`,
      [missionId, limit],
    );
    return r.rows.map((row: { fingerprint: string }) => row.fingerprint);
  }

  async listExperiments(missionId: string, limit = 50): Promise<Experiment[]> {
    const r = await this.pool.query(
      `select * from ros_commercial_experiments
        where mission_id=$1
        order by created_at desc
        limit $2`,
      [missionId, limit],
    );
    return r.rows.map(rowToExperiment);
  }

  // ---------------------------------------------------------------------------
  // Liveness + starvation recovery
  // ---------------------------------------------------------------------------

  async evaluateLiveness(missionId: string): Promise<LivenessVerdict> {
    const mission = await this.loadMission(missionId);
    if (!mission || mission.status !== "ACTIVE") {
      return {
        ok: false,
        reason: "MISSION_INACTIVE",
        needsRecovery: false,
        severity: "INFO",
      };
    }
    const clock = await this.refreshProgressClock(missionId);
    const current = await this.currentExperiment(missionId);
    const now = new Date();

    // Zero proven humans: commercial "progress" means distribution opportunity
    // or a live experiment — NOT storefront curls / commercial_actions noise.
    // Counting lastExternalExposureAt here recreated idle: engineering traffic
    // kept the mission "ok" while the queue was empty.
    const provenHumans = Number(clock.provenHumans24h ?? 0);
    const lastCommercial =
      provenHumans === 0
        ? (clock.lastPurchaseAt ??
            clock.lastCheckoutStartAt ??
            clock.lastProvenHumanVisitAt ??
            clock.lastDistributionOpportunityAt)
        : (clock.lastPurchaseAt ??
            clock.lastCheckoutStartAt ??
            clock.lastEngagementAt ??
            clock.lastProvenHumanVisitAt ??
            clock.lastDistributionOpportunityAt ??
            clock.lastVerifiedHumanAt ??
            clock.lastExternalExposureAt);
    const minutes = minutesSince(lastCommercial, now);

    if (!current) {
      // No primary experiment → recover. Do not treat deployment noise as OK.
      return {
        ok: false,
        reason:
          minutes === null
            ? "NO_CURRENT_EXPERIMENT"
            : minutes >= NO_PROGRESS_CRITICAL_MINUTES
              ? "NO_EXTERNAL_PROGRESS_60M"
              : minutes >= NO_PROGRESS_WARN2_MINUTES
                ? "NO_EXTERNAL_PROGRESS_30M"
                : minutes >= NO_PROGRESS_WARN_MINUTES
                  ? "NO_EXTERNAL_PROGRESS_15M"
                  : "NO_CURRENT_EXPERIMENT",
        needsRecovery: true,
        severity:
          minutes === null || (minutes !== null && minutes >= NO_PROGRESS_CRITICAL_MINUTES)
            ? "CRITICAL"
            : minutes !== null && minutes >= NO_PROGRESS_WARN2_MINUTES
              ? "WARN"
              : "INFO",
      };
    }

    if (minutes === null) {
      const startedMinutes = minutesSince(
        current.startedAt ?? current.claimedAt ?? current.createdAt,
        now,
      );
      if (startedMinutes !== null && startedMinutes > EXPERIMENT_STARTED_STALE_MINUTES) {
        return {
          ok: false,
          reason: "NO_EXTERNAL_PROGRESS_60M",
          needsRecovery: true,
          severity: "CRITICAL",
        };
      }
      return {
        ok: true,
        reason: "ACTIVE_WITH_RUNNING_EXPERIMENT",
      };
    }

    if (minutes < NO_PROGRESS_WARN_MINUTES) {
      return { ok: true, reason: "ACTIVE_WITH_PROGRESS" };
    }
    if (minutes < NO_PROGRESS_WARN2_MINUTES) {
      return {
        ok: false,
        reason: "NO_EXTERNAL_PROGRESS_15M",
        needsRecovery: false,
        severity: "INFO",
      };
    }
    if (minutes < NO_PROGRESS_CRITICAL_MINUTES) {
      return {
        ok: false,
        reason: "NO_EXTERNAL_PROGRESS_30M",
        needsRecovery: true,
        severity: "WARN",
      };
    }
    return {
      ok: false,
      reason: "NO_EXTERNAL_PROGRESS_60M",
      needsRecovery: true,
      severity: "CRITICAL",
    };
  }

  /**
   * Called by the external watchdog OR by any lane that observes it has
   * nothing runnable to do. Enqueues a materially-different next experiment
   * from the seed catalog, respecting fingerprint dedup. If the catalog is
   * exhausted (very unlikely in current form), opens an incident so xAI
   * stuck-state advice can be requested asynchronously.
   */
  async recoverFromStarvation(opts: {
    missionId: string;
    preferredExecutors?: ExperimentExecutor[];
    /**
     * Distribution-first ranking. When the mission still has zero proven
     * humans, prefer families that create legitimate distribution
     * opportunities. See TIER1_DISTRIBUTION_FAMILIES.
     */
    preferredFamilies?: ChannelFamily[];
    catalog?: SeedExperiment[];
    /**
     * Skip the seed if the seed's channel family cannot be executed right
     * now. Injected by the operator process which knows what credentials
     * exist. If omitted, every seed is treated as executable.
     */
    canExecuteFamily?: (family: SeedExperiment["channelFamily"]) => boolean;
    /**
     * Override the post-terminal cooldown for tests. Cooldown only applies
     * after the most recent experiment reached EXTERNAL_ACTION_VERIFIED or
     * a terminal state — NOT for merely ENQUEUED/CLAIMED work.
     */
    minRecoveryGapMinutesAfterTerminal?: number;
  }): Promise<{
    enqueued: Experiment | null;
    exhaustedCatalog: boolean;
    incidentId?: string;
    skippedReason?:
      | "cooldown_active"
      | "primary_experiment_already_active"
      | "no_executable_seed";
    swept?: { enqueuedStalls: number; reclaimed: number; executingFailed: number };
    concludedMeasuring?: number;
  }> {
    // Step 1: enforce SLAs. Stalled queue rows must not silently pretend to
    // be running. This is what stops the "enqueue fake work then cool down"
    // recreation of the idle bug.
    const swept = await this.enforceQueueSlas(opts.missionId);
    // Step 2: naturally conclude MEASURING experiments whose window closed.
    const concludedMeasuring = await this.concludeStaleMeasuring(opts.missionId);

    // Step 3: MAX_ACTIVE_PRIMARY_EXPERIMENTS=1 gate. If a live primary
    // experiment still exists after the sweep, do not enqueue another. The
    // bridge will pick it up. This is the "one authoritative active
    // commercial experiment" invariant.
    const active = await this.countActivePrimaryExperiments(opts.missionId);
    if (active >= MAX_ACTIVE_PRIMARY_EXPERIMENTS) {
      return {
        enqueued: null,
        exhaustedCatalog: false,
        skippedReason: "primary_experiment_already_active",
        swept,
        concludedMeasuring,
      };
    }

    // Step 4: post-terminal cooldown. Only starts after a real outcome,
    // never on merely ENQUEUED/CLAIMED rows.
    const cooldown =
      opts.minRecoveryGapMinutesAfterTerminal ?? MIN_RECOVERY_GAP_MINUTES_AFTER_TERMINAL;
    const recentTerminal = await this.pool.query(
      `select completed_at, external_action_verified_at
         from ros_commercial_experiments
        where mission_id=$1
          and (
            state in ('WIN','LOSS','INCONCLUSIVE','BLOCKED','FAILED','COMPLETED','ABANDONED_DUPLICATE')
            or external_action_verified_at is not null
          )
        order by coalesce(completed_at, external_action_verified_at) desc nulls last
        limit 1`,
      [opts.missionId],
    );
    if (recentTerminal.rowCount) {
      const stamp =
        (recentTerminal.rows[0].completed_at as Date | null) ??
        (recentTerminal.rows[0].external_action_verified_at as Date | null);
      if (stamp) {
        const ageMinutes = (Date.now() - stamp.getTime()) / 60_000;
        if (ageMinutes < cooldown) {
          return {
            enqueued: null,
            exhaustedCatalog: false,
            skippedReason: "cooldown_active",
            swept,
            concludedMeasuring,
          };
        }
      }
    }

    const tried = await this.listTriedFingerprints(opts.missionId, 500);
    const recent = await this.pool.query(
      `select fingerprint, family, business_id from ros_commercial_experiments
        where mission_id=$1
        order by coalesce(started_at, created_at) desc
        limit 1`,
      [opts.missionId],
    );
    let mostRecent = null as null | {
      fingerprint: string;
      input: {
        channelFamily: (typeof recent)["rows"][0]["family"];
        audienceKey: string;
        offerKey: string;
        positioningKey: string;
        product: string;
      };
    };
    if (recent.rowCount) {
      const row = recent.rows[0];
      mostRecent = {
        fingerprint: row.fingerprint,
        input: {
          channelFamily: row.family,
          audienceKey: "",
          offerKey: "",
          positioningKey: "",
          product: row.business_id,
        },
      };
    }

    // Executability gate — we may loop up to 12 times finding a seed whose
    // family we can physically execute right now. Non-executable families
    // are tracked but never selected as the primary experiment.
    const canExec = opts.canExecuteFamily ?? (() => true);
    let enqueued: Experiment | null = null;
    let exhaustedCatalog = false;
    let selectedSeed: SeedExperiment | null = null;
    let skippedForNonExecutability = false;
    let usedExhaustedRetry = false;
    const localTried = new Set(tried);
    const catalog = opts.catalog ?? STARVATION_CATALOG;
    for (let i = 0; i < 12; i += 1) {
      const pick = pickNextDiverseExperiment({
        triedFingerprints: Array.from(localTried),
        mostRecent,
        preferredExecutors: opts.preferredExecutors,
        preferredFamilies: opts.preferredFamilies,
        catalog,
      });
      if (pick.exhaustedCatalog) {
        exhaustedCatalog = true;
        break;
      }
      if (canExec(pick.seed.channelFamily)) {
        selectedSeed = pick.seed;
        break;
      }
      skippedForNonExecutability = true;
      localTried.add(pick.fingerprint);
    }

    // Catalog exhausted or nothing untried executable: still keep working by
    // re-enqueuing the best currently-executable distribution seed.
    if (!selectedSeed) {
      const preferred = opts.preferredFamilies
        ? new Set(opts.preferredFamilies)
        : null;
      const ranked = [...catalog].sort((a, b) => {
        const ap = preferred ? (preferred.has(a.channelFamily) ? 0 : 1) : 0;
        const bp = preferred ? (preferred.has(b.channelFamily) ? 0 : 1) : 0;
        return ap - bp;
      });
      for (const seed of ranked) {
        if (!canExec(seed.channelFamily)) {
          skippedForNonExecutability = true;
          continue;
        }
        selectedSeed = {
          ...seed,
          positioningKey: `${seed.positioningKey}-retry-${Date.now().toString(36).slice(-4)}`,
          hypothesis: `${seed.hypothesis} [catalog-retry]`,
        };
        usedExhaustedRetry = exhaustedCatalog || tried.length >= catalog.length;
        break;
      }
    }

    if (!selectedSeed) {
      const isReallyExhausted =
        exhaustedCatalog && !skippedForNonExecutability;
      const incidentId = await this.openIncident(opts.missionId, {
        kind: isReallyExhausted ? "SEED_CATALOG_EXHAUSTED" : "NO_EXECUTABLE_SEED",
        severity: "CRITICAL",
        detail: isReallyExhausted
          ? "All deterministic seed experiments already tried and none were executable to retry."
          : "No seed in the catalog is executable with current credentials.",
      });
      return {
        enqueued: null,
        exhaustedCatalog: isReallyExhausted,
        incidentId,
        skippedReason: isReallyExhausted ? undefined : "no_executable_seed",
        swept,
        concludedMeasuring,
      };
    }

    if (usedExhaustedRetry) {
      await this.openIncident(opts.missionId, {
        kind: "SEED_CATALOG_EXHAUSTED",
        severity: "WARN",
        detail:
          "Catalog exhausted; re-enqueued best executable distribution seed with retry mutation. Expand seeds after distribution proof.",
      });
    }

    const proposed = await this.proposeExperiment(
      opts.missionId,
      seedToProposal(selectedSeed),
    );
    if (proposed.ok) {
      enqueued = await this.enqueueExperiment(proposed.experiment.id);
    } else {
      this.logger("warn", "mission.recovery.fingerprint_collision", {
        missionId: opts.missionId,
        fingerprint: proposed.existing.fingerprint,
      });
    }
    let incidentId: string | undefined;
    if (!enqueued) {
      incidentId = await this.openIncident(opts.missionId, {
        kind: "RECOVERY_FAILED",
        severity: "CRITICAL",
        detail: "Recovery attempted but no experiment was enqueued.",
      });
    }
    return { enqueued, exhaustedCatalog, incidentId, swept, concludedMeasuring };
  }

  async openIncident(
    missionId: string,
    incident: { kind: string; severity: "INFO" | "WARN" | "CRITICAL"; detail: string; meta?: Record<string, unknown> },
  ): Promise<string> {
    const id = `inc_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}_${randomUUID().slice(0, 6)}`;
    await this.pool.query(
      `insert into ros_mission_incidents (id, mission_id, kind, severity, detail, meta)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [id, missionId, incident.kind, incident.severity, incident.detail, JSON.stringify(incident.meta ?? {})],
    );
    this.logger("warn", "mission.incident.opened", {
      missionId,
      incidentId: id,
      kind: incident.kind,
      severity: incident.severity,
    });
    return id;
  }

  async resolveIncident(id: string, resolution: string): Promise<void> {
    await this.pool.query(
      `update ros_mission_incidents
          set resolved_at=now(),
              meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('resolution', $1::text)
        where id=$2 and resolved_at is null`,
      [resolution, id],
    );
  }

  async openIncidents(missionId: string): Promise<
    { id: string; kind: string; severity: string; openedAt: string; detail: string }[]
  > {
    const r = await this.pool.query(
      `select id, kind, severity, opened_at, detail
         from ros_mission_incidents
        where mission_id=$1 and resolved_at is null
        order by opened_at desc`,
      [missionId],
    );
    return r.rows.map((row: any) => ({
      id: row.id,
      kind: row.kind,
      severity: row.severity,
      openedAt: (row.opened_at as Date).toISOString(),
      detail: row.detail,
    }));
  }

  // ---------------------------------------------------------------------------
  // AI call ledger (recorded from anywhere; MissionController is the librarian).
  // ---------------------------------------------------------------------------

  async recordAiCall(entry: {
    provider: string;
    model: string;
    reason: string;
    missionId?: string;
    experimentId?: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    commercialOutcome?: string;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    const id = `ai_${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}_${
      createHash("sha1").update(`${entry.provider}|${entry.model}|${entry.reason}|${Math.random()}`).digest("hex").slice(0, 6)
    }`;
    await this.pool.query(
      `insert into ros_ai_call_ledger (
         id, provider, model, reason, mission_id, experiment_id,
         input_tokens, output_tokens, estimated_cost_usd, commercial_outcome, meta
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        id,
        entry.provider,
        entry.model,
        entry.reason,
        entry.missionId ?? null,
        entry.experimentId ?? null,
        entry.inputTokens ?? 0,
        entry.outputTokens ?? 0,
        entry.estimatedCostUsd ?? 0,
        entry.commercialOutcome ?? "",
        JSON.stringify(entry.meta ?? {}),
      ],
    );
  }
}

function rowToMission(row: any): Mission {
  const objective = (row.objective ?? {}) as MissionObjective;
  const progress = (row.progress ?? {}) as MissionProgress;
  return {
    id: row.id,
    status: row.status,
    objective: {
      primary: objective.primary ?? "REAL_REVENUE",
      firstSaleTargetUsd: Number(objective.firstSaleTargetUsd ?? 1),
      longTermDailyRevenueTargetUsd: Number(objective.longTermDailyRevenueTargetUsd ?? 0),
    },
    startedAt: (row.started_at as Date).toISOString(),
    deadlineAt: row.deadline_at ? (row.deadline_at as Date).toISOString() : null,
    currentExperimentId: row.current_experiment_id ?? null,
    lastCommercialProgressAt: row.last_commercial_progress_at
      ? (row.last_commercial_progress_at as Date).toISOString()
      : null,
    lastActionAt: row.last_action_at ? (row.last_action_at as Date).toISOString() : null,
    progress: {
      externalExposures: Number(progress.externalExposures ?? 0),
      verifiedHumans: Number(progress.verifiedHumans ?? 0),
      engagedHumans: Number(progress.engagedHumans ?? 0),
      checkoutStarts: Number(progress.checkoutStarts ?? 0),
      purchases: Number(progress.purchases ?? 0),
      realRevenueUsd: Number(progress.realRevenueUsd ?? 0),
    },
  };
}

function rowToExperiment(row: any): Experiment {
  return {
    id: row.id,
    missionId: row.mission_id,
    fingerprint: row.fingerprint,
    family: row.family,
    executor: row.executor,
    state: row.state,
    hypothesis: row.hypothesis,
    businessId: row.business_id,
    buyer: row.buyer,
    offer: row.offer,
    channel: row.channel,
    expectedResult: row.expected_result,
    measurement: row.measurement,
    budgetUsd: Number(row.budget_usd ?? 0),
    attempts: Number(row.attempts ?? 0),
    externalExposures: Number(row.external_exposures ?? 0),
    verifiedHumans: Number(row.verified_humans ?? 0),
    engagedHumans: Number(row.engaged_humans ?? 0),
    clicks: Number(row.clicks ?? 0),
    checkoutStarts: Number(row.checkout_starts ?? 0),
    purchases: Number(row.purchases ?? 0),
    revenueUsd: Number(row.revenue_usd ?? 0),
    source: row.source,
    startedAt: row.started_at ? (row.started_at as Date).toISOString() : null,
    completedAt: row.completed_at ? (row.completed_at as Date).toISOString() : null,
    claimedAt: row.claimed_at ? (row.claimed_at as Date).toISOString() : null,
    claimedBy: row.claimed_by ?? null,
    heartbeatAt: row.heartbeat_at ? (row.heartbeat_at as Date).toISOString() : null,
    measuringStartedAt: row.measuring_started_at
      ? (row.measuring_started_at as Date).toISOString()
      : null,
    externalActionVerifiedAt: row.external_action_verified_at
      ? (row.external_action_verified_at as Date).toISOString()
      : null,
    terminalReason: row.terminal_reason ?? "",
    lesson: row.lesson ?? "",
    nextMutation: row.next_mutation ?? "",
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}
