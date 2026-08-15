/**
 * Titan Commercial Executive v3 — finish solving what was noticed.
 * Gaps close. Submissions get verified. Economics remodel. Soft-retire when EV warrants.
 */

import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import { enqueueOwnerActionsForBusiness } from "../acquisitionos/owner-queue.js";
import { ensureCommercialExecutiveTables } from "./schema.js";
import { syncCommercialMission } from "./mission.js";
import { executeNewAudienceBet } from "./new-audience.js";
import { recordCommercialProgress } from "./progress.js";
import {
  classifyFailureRootCause,
  ensureFailureTables,
  recordCommercialFailure,
  recentFailureLessons,
  strategyRecentlyFailed,
} from "./failure-intelligence.js";
import { runPortfolioTournament } from "./portfolio-tournament.js";
import { runCommercialWatchdog } from "./watchdog.js";
import { advanceCapabilityGaps } from "./capability-gaps.js";
import { runSubmissionFollowups } from "./exposure-verify.js";
import { runEconomicRemodelPass } from "./economic-remodel.js";
import {
  ensureUnattendedMode,
  appendOvernightLog,
  detectExecutiveStagnation,
  openCriticalOvernightIfNeeded,
  isOwnerOfflineMode,
} from "./unattended.js";
import {
  ensureCustomerAcquisitionEvolutionMode,
  runCaeScientistPass,
  CAE_VERSION,
} from "./customer-acquisition-evolution.js";
import {
  ensureZeroTrafficWarRoom,
  runFrontierDistributionBurst,
  ACQUISITION_FRONTIER,
  ZERO_TRAFFIC_VERSION,
} from "./zero-traffic-war-room.js";

export const COMMERCIAL_EXECUTIVE_VERSION =
  "titan-commercial-executive-v5.4-capability-reality";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function eid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

function repoRoot(): string {
  return (
    process.env.REVENUEOS_REPO_ROOT ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  );
}

const FAMILY_ROTATION = [
  "directories",
  "partnerships",
  "creators",
  "marketplaces",
  "communities",
  "earned",
] as const;

async function selectStrikeTeam(
  pool: pg.Pool,
  managed: string[],
  tournamentTop: string[],
): Promise<string[]> {
  // While ZERO_EXTERNAL_HUMANS is CRITICAL, concentrate on frontier 3
  try {
    const zt = await pool.query(
      `select value->>'status' as st from ros_config_meta where key='zero_traffic_war_room'`,
    );
    if (zt.rows[0]?.st === "CRITICAL" || zt.rows[0]?.st == null) {
      const frontier = ACQUISITION_FRONTIER.filter((s) => managed.includes(s));
      if (frontier.length) return frontier.slice(0, 3);
    }
  } catch {
    /* fall through */
  }
  await Promise.all(
    managed.slice(0, 40).map((id) => syncCommercialMission(pool, id)),
  );
  const pressure = await pool.query(
    `select business_id from titan_business_commercial_missions
     where business_id = any($1::text[])
     order by commercial_pressure desc, updated_at asc limit 8`,
    [managed],
  );
  const ids = [
    ...tournamentTop.slice(0, 3),
    ...pressure.rows.map((r) => String(r.business_id)),
  ];
  const uniq = [...new Set(ids)].filter((s) => managed.includes(s));
  const fallback = [...ACQUISITION_FRONTIER].filter((s) => managed.includes(s));
  return [...new Set([...uniq, ...fallback])].slice(0, 5);
}

async function openStagnationIfNeeded(
  pool: pg.Pool,
  businessId: string,
  mission: Record<string, unknown>,
  logger: Logger,
): Promise<boolean> {
  if (mission.acquisitionState !== "STALLED") return false;
  const open = await pool.query(
    `select id from titan_commercial_stagnation_incidents
     where business_id=$1 and status='OPEN'
       and created_at > now() - interval '4 hours' limit 1`,
    [businessId],
  );
  if (open.rows[0]) return true;

  const id = eid("csi");
  const escalation =
    "Zero-exposure escalation: diversify channel families; verify submissions; remodel economics if path implausible";
  await pool.query(
    `insert into titan_commercial_stagnation_incidents
     (id, business_id, kind, diagnosis, escalation, status)
     values ($1,$2,'COMMERCIAL_STAGNATION',$3::jsonb,$4,'OPEN')`,
    [
      id,
      businessId,
      JSON.stringify({
        detectedBy: "titan_commercial_executive_v3",
        withoutOwnerPrompt: true,
        primary: mission.primary,
        pressure: mission.pressure,
      }),
      escalation,
    ],
  );
  await recordCommercialProgress(pool, {
    businessId,
    eventKind: "strategy_escalation",
    detail: escalation,
    meta: { incidentId: id },
  });
  logger("warn", "commercial.executive.stagnation", {
    businessId,
    incidentId: id,
    primary: mission.primary,
  });
  return true;
}

async function openCriticalZeroExposure(
  pool: pg.Pool,
  businessId: string,
  logger: Logger,
): Promise<boolean> {
  const na = await pool.query(
    `select count(*)::int as n,
            count(*) filter (where status in ('EXPOSED','PUBLISHED'))::int as exp,
            count(distinct external_action)::int as kinds
     from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true
       and created_at > now() - interval '72 hours'`,
    [businessId],
  );
  const n = Number(na.rows[0]?.n ?? 0);
  const exp = Number(na.rows[0]?.exp ?? 0);
  const kinds = Number(na.rows[0]?.kinds ?? 0);
  if (n < 3 || exp > 0) return false;

  const open = await pool.query(
    `select 1 from titan_commercial_stagnation_incidents
     where business_id=$1 and kind='CRITICAL_ZERO_EXPOSURE' and status='OPEN'
       and created_at > now() - interval '12 hours' limit 1`,
    [businessId],
  );
  if (open.rows[0]) return false;

  await pool.query(
    `insert into titan_commercial_stagnation_incidents
     (id, business_id, kind, diagnosis, escalation, status)
     values ($1,$2,'CRITICAL_ZERO_EXPOSURE',$3::jsonb,$4,'OPEN')`,
    [
      eid("cze"),
      businessId,
      JSON.stringify({ attempts: n, exposed: exp, distinctActions: kinds }),
      "Rotate channel families; abandon dead surfaces; consider free acquisition asset or buyer habitat change",
    ],
  );
  logger("warn", "commercial.executive.critical_zero_exposure", {
    businessId,
    attempts: n,
    kinds,
  });
  return true;
}

async function pruneOwnerQueue(pool: pg.Pool): Promise<number> {
  const res = await pool.query(
    `with ranked as (
       select id, row_number() over (order by priority desc, created_at desc) as rn
       from aq_owner_actions
       where status='PENDING'
         and coalesce(meta->>'kind','') <> 'resend_domain_verify'
     )
     update aq_owner_actions a set status='DEFERRED', updated_at=now()
     from ranked r where a.id=r.id and r.rn > 7
     returning a.id`,
  );
  return res.rowCount ?? 0;
}

export async function runCommercialExecutiveCycle(input: {
  pool: pg.Pool;
  logger: Logger;
  managedSiteIds: string[];
}): Promise<Record<string, unknown>> {
  await ensureCommercialExecutiveTables(input.pool);
  await ensureFailureTables(input.pool);
  const cycleId = eid("cec");
  await input.pool.query(
    `insert into titan_commercial_executive_cycles (id, summary) values ($1,'{}'::jsonb)`,
    [cycleId],
  );

  const managed = input.managedSiteIds;
  if (!managed.length) return { cycleId, skipped: true };

  // Close hung cycles (crash / OOM / stall) so overnight evidence stays honest
  await input.pool.query(
    `update titan_commercial_executive_cycles
     set finished_at=now(),
         summary = coalesce(summary,'{}'::jsonb) || '{"aborted":true,"reason":"stale_unfinished_cycle"}'::jsonb
     where finished_at is null
       and started_at < now() - interval '15 minutes'
       and id <> $1`,
    [cycleId],
  );

  await ensureUnattendedMode(input.pool);
  const caeMode = await ensureCustomerAcquisitionEvolutionMode(
    input.pool,
    input.logger,
  );
  const zeroTraffic = await ensureZeroTrafficWarRoom(input.pool, input.logger);
  const frontierBurst =
    zeroTraffic.status === "CRITICAL"
      ? await runFrontierDistributionBurst({
          pool: input.pool,
          logger: input.logger,
        })
      : { attempts: 0, successes: 0, details: [] };
  const ownerOffline = isOwnerOfflineMode();

  const gaps = await advanceCapabilityGaps({
    pool: input.pool,
    logger: input.logger,
  });
  const followups = await runSubmissionFollowups({
    pool: input.pool,
    logger: input.logger,
  });
  const execStag = await detectExecutiveStagnation(input.pool);
  if (execStag.stagnant) {
    input.logger("warn", "commercial.executive.stagnation_theater", {
      detail: execStag.detail,
    });
    await appendOvernightLog(input.pool, {
      kind: "EXECUTIVE_STAGNATION",
      detail: execStag.detail,
    });
  }
  const overnightCritical = await openCriticalOvernightIfNeeded(
    input.pool,
    input.logger,
  );

  for (const id of managed.slice(0, 40)) {
    await syncCommercialMission(input.pool, id);
  }
  const tournament = await runPortfolioTournament(input.pool, managed);
  const watchdog = await runCommercialWatchdog({
    pool: input.pool,
    managed,
  });

  // CAE: upgrade/remodel offers OK; soft-retire/replace FROZEN
  const remodel = await runEconomicRemodelPass({
    pool: input.pool,
    appRoot: repoRoot(),
    replacementCandidates: tournament.replacementCandidates,
    logger: input.logger,
    freezeSoftRetire: caeMode.freezeSoftRetireReplace,
  });

  const warRoom = await selectStrikeTeam(
    input.pool,
    managed,
    tournament.top10,
  );

  const scientist = await runCaeScientistPass({
    pool: input.pool,
    businessIds: warRoom,
    logger: input.logger,
  });

  const interventions: Array<Record<string, unknown>> = [];
  let stagnations = 0;
  let newAudienceOk = 0;
  let strategyChanges = 0;
  let failuresRecorded = 0;
  let repeatPrevented = 0;
  let zeroExposureEscalations = 0;
  const familiesUsed = new Set<string>();

  for (const businessId of warRoom) {
    const mission = await syncCommercialMission(input.pool, businessId);
    const lessons = await recentFailureLessons(input.pool, businessId, 3);

    if (
      await openStagnationIfNeeded(input.pool, businessId, mission, input.logger)
    ) {
      stagnations++;
      strategyChanges++;
    }
    if (await openCriticalZeroExposure(input.pool, businessId, input.logger)) {
      zeroExposureEscalations++;
      strategyChanges++;
    }

    const preferDifferent = lessons[0]?.next ?? null;
    // Ban FORM spam only — overnight form history must NOT zero all distribution.
    // Count only recent CAE-window forms (6h) for flood; older failures still suppress Path B.
    const spam = await input.pool.query(
      `select
         count(*) filter (
           where external_action='public_form_resource_pitch'
             and created_at > now() - interval '6 hours'
         )::int as forms_recent,
         count(*) filter (
           where external_action='public_form_resource_pitch'
             and created_at > now() - interval '24 hours'
         )::int as forms_24h,
         count(*) filter (where status in ('PUBLISHED','EXPOSURE_CONFIRMED','EXPOSED'))::int as pub
       from aq_distribution_receipts
       where business_id=$1 and is_new_audience=true`,
      [businessId],
    );
    const formFlood =
      Number(spam.rows[0]?.forms_24h ?? 0) >= 6 &&
      Number(spam.rows[0]?.pub ?? 0) === 0;
    if (formFlood && Number(spam.rows[0]?.forms_recent ?? 0) > 0) {
      await recordCommercialFailure(input.pool, {
        businessId,
        strategyKey: "public_form_resource_pitch_flood_no_publish",
        rootCauseHypothesis: "STRATEGY_REPEATED_WITHOUT_EVIDENCE",
        evidence: spam.rows[0],
        lesson:
          "Form spam produces DESTINATION_REACHABLE only — ban forms, keep email/directory/utility distribution",
        nextDifferentAction:
          "distribute_free_utility_via_non_form_channels",
      });
      failuresRecorded++;
      strategyChanges++;
      repeatPrevented++;
    }
    // Always keep ≥1 non-form bet while STAGE_0 — form ban must not freeze Titan
    const attempts = Number(mission.pressure ?? 0) >= 0.7 ? 2 : 1;
    const avoided: string[] = [];
    const nonFormFamilies = [
      "directories",
      "partnerships",
      "creators",
      "marketplaces",
      "communities",
      "earned",
    ] as const;

    for (let a = 0; a < attempts; a++) {
      if (
        preferDifferent &&
        (await strategyRecentlyFailed(
          input.pool,
          businessId,
          "ddg_complex_query",
          24,
        ))
      ) {
        repeatPrevented++;
      }

      const family = formFlood
        ? nonFormFamilies[(a + Date.now()) % nonFormFamilies.length]!
        : FAMILY_ROTATION[(a + Date.now()) % FAMILY_ROTATION.length]!;
      const bet = await executeNewAudienceBet({
        pool: input.pool,
        businessId,
        preferFamily: family,
        avoidDestinations: avoided,
        banPublicForms: formFlood,
      });
      if (bet.destination) avoided.push(bet.destination);
      if (bet.channelFamily) familiesUsed.add(bet.channelFamily);
      else familiesUsed.add(family);

      interventions.push({
        businessId,
        bet,
        mission: mission.primary,
        preferDifferent,
        family,
      });

      if (bet.newAudience) {
        newAudienceOk++;
        // Only resolve ordinary stagnation on submit. CRITICAL_ZERO_EXPOSURE
        // requires PUBLISHED or EXPOSURE_CONFIRMED — submission alone is not enough.
        await input.pool.query(
          `update titan_commercial_stagnation_incidents
           set status='RESOLVED', resolved_at=now()
           where business_id=$1 and status='OPEN'
             and kind = 'COMMERCIAL_STAGNATION'`,
          [businessId],
        );
        strategyChanges++;
      } else {
        const classified = classifyFailureRootCause({
          betKind: bet.kind,
          newAudience: bet.newAudience,
          detail: bet.detail,
        });
        if (
          !(await strategyRecentlyFailed(
            input.pool,
            businessId,
            classified.strategyKey,
            6,
          ))
        ) {
          await recordCommercialFailure(input.pool, {
            businessId,
            strategyKey: classified.strategyKey,
            surface: bet.destination,
            rootCauseHypothesis: classified.hypothesis,
            evidence: { bet },
            lesson: classified.lesson,
            nextDifferentAction: classified.next,
          });
          failuresRecorded++;
          strategyChanges++;
        } else {
          repeatPrevented++;
        }
      }
    }

    await enqueueOwnerActionsForBusiness({
      pool: input.pool,
      businessId,
      limit: 2,
    });

    input.logger("info", "commercial.executive.business", {
      businessId,
      bottleneck: mission.primary,
      acquisitionState: mission.acquisitionState,
      pressure: mission.pressure,
      tier:
        tournament.rows.find((r) => r.businessId === businessId)?.tier ?? null,
      newAudienceBatch: newAudienceOk,
      lessons: lessons.map((l) => l.lesson).slice(0, 2),
    });
  }

  const deferred = await pruneOwnerQueue(input.pool);

  const summary = {
    version: COMMERCIAL_EXECUTIVE_VERSION,
    warRoom,
    stagnationsOpened: stagnations,
    strategyChanges,
    newAudienceSuccesses: newAudienceOk,
    interventions: interventions.length,
    failuresRecorded,
    repeatFailuresPrevented: repeatPrevented,
    ownerActionsDeferred: deferred,
    tournamentTop: tournament.top10.slice(0, 5),
    tournamentWeak: tournament.weakest10.slice(0, 5),
    replacementCandidates: tournament.replacementCandidates.slice(0, 8),
    challenged: tournament.challenged.slice(0, 8),
    watchdog,
    capabilityGaps: gaps,
    submissionFollowups: followups,
    economicRemodel: remodel,
    customerAcquisitionEvolution: {
      version: CAE_VERSION,
      freezeNetNew: caeMode.freezeNetNewBusinesses,
      stageCounts: scientist.stageCounts,
      distributionPriority: scientist.distributionPriority,
      experiments: scientist.experiments.map((e) => ({
        businessId: e.businessId,
        stage: e.stage,
        actionKind: e.actionKind,
      })),
    },
    zeroTrafficWarRoom: {
      version: ZERO_TRAFFIC_VERSION,
      status: zeroTraffic.status,
      frontier: zeroTraffic.frontier,
      meaningfulAttemptsPerHour: zeroTraffic.meaningfulAttemptsPerHour,
      stallDiagnosed: zeroTraffic.stallDiagnosed,
      channelReality: zeroTraffic.channelReality,
      frontierBurst,
    },
    zeroExposureEscalations,
    channelFamiliesUsed: [...familiesUsed],
    ownerOffline,
    executiveStagnation: execStag,
    overnightCritical,
    withoutOwnerPrompt: true,
  };

  await appendOvernightLog(input.pool, {
    kind: "executive_cycle",
    version: COMMERCIAL_EXECUTIVE_VERSION,
    warRoom,
    newAudience: newAudienceOk,
    followups,
    gaps,
    remodel: {
      planned: remodel.planned,
      softRetired: remodel.softRetired,
      upgraded: remodel.upgraded,
    },
    strategyChanges,
    zeroExposureEscalations,
    families: [...familiesUsed],
  });

  await input.pool.query(
    `update titan_commercial_executive_cycles
     set finished_at=now(), summary=$2::jsonb where id=$1`,
    [cycleId, JSON.stringify(summary)],
  );

  await input.pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('commercial_war_room', $1::jsonb, now(), 'NATIVE_POSTGRES')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [
      JSON.stringify({
        businesses: warRoom,
        updatedAt: new Date().toISOString(),
        version: COMMERCIAL_EXECUTIVE_VERSION,
        tournamentTop: tournament.top10.slice(0, 10),
      }),
    ],
  );

  input.logger("info", "commercial.executive.cycle", summary);
  void import("../commercial-execution-v4/watchdog.js")
    .then((m) => m.beat(input.pool, "Titan", true, "", { cycleId }))
    .catch(() => undefined);
  return { cycleId, ...summary };
}

export async function runTitanCommercialExecutiveLane(input: {
  pool: pg.Pool;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
  getManagedSiteIds: () => string[];
}): Promise<void> {
  const interval = input.intervalMs ?? 120_000;
  await ensureCommercialExecutiveTables(input.pool);
  await ensureFailureTables(input.pool);
  input.logger("info", "commercial.executive.lane.start", {
    version: COMMERCIAL_EXECUTIVE_VERSION,
  });

  while (!input.signal.aborted) {
    try {
      await runCommercialExecutiveCycle({
        pool: input.pool,
        logger: input.logger,
        managedSiteIds: input.getManagedSiteIds(),
      });
    } catch (e) {
      input.logger("error", "commercial.executive.cycle_error", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
    await sleep(interval, input.signal);
  }
}
