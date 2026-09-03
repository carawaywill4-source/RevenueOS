/**
 * ZERO_EXTERNAL_HUMANS = CRITICAL system objective.
 * Concentrates compute on 3 frontier businesses until one verified referral human exists.
 */

import type pg from "pg";
import { executeNewAudienceBet } from "./new-audience.js";
import { recordCommercialFailure } from "./failure-intelligence.js";
import { saveCommercialLesson } from "../titan-world-store.js";
import { executeProductHuntFrontierBet } from "../capability-reality/producthunt-adapter.js";
import { buildBuyerHabitat } from "../acquisitionos/buyer-habitat.js";

export const ZERO_TRAFFIC_KEY = "zero_traffic_war_room";
export const ZERO_TRAFFIC_VERSION = "zero-traffic-war-room-v1";

/** Acquisition frontier — prove ONE stranger can arrive. */
export const ACQUISITION_FRONTIER = [
  "deckready", // free utility live + clear founder buyers
  "rfpstrike", // free utility live + high-intent B2B
  "invoicechaser", // urgent pain, searchable buyers
] as const;

export type ChannelReality = {
  discovered: number;
  ready: number;
  ownedAutoExecutable: number;
  thirdPartyAutoExecutable: number;
  humanActionRequired: number;
  ownerAccountOrCredential: number;
  unavailable: number;
  resourcePitchHumanOnly: number;
  attemptedNewAudience24h: number;
  acceptedOrPublishedNewAudience24h: number;
  verifiedExposure24h: number;
};

export type ZeroTrafficDoc = {
  version: string;
  status: "CRITICAL" | "CLEARED";
  objective: "ZERO_EXTERNAL_HUMANS";
  frontier: string[];
  activatedAt: string;
  updatedAt: string;
  channelReality: ChannelReality;
  meaningfulAttemptsLast6h: number;
  meaningfulAttemptsPerHour: number;
  stallDiagnosed: boolean;
  lastStallAt: string | null;
  telemetryNote: string;
};

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

export async function countVerifiedReferralHumans(
  pool: pg.Pool,
  sinceHours = 48,
): Promise<number> {
  const res = await pool.query(
    `select count(*)::int as n from ros_traffic_events
     where created_at > now() - ($1 || ' hours')::interval
       and class in ('LIKELY_HUMAN','QUALIFIED')
       and coalesce(referer,'') <> ''
       and referer not ilike '%sslip.io%'
       and referer not ilike '%130.131.15.68%'
       and referer not ilike '%' || business_id || '%'
       and coalesce(meta->>'humanKind','') <> 'TELEMETRY_TEST'`,
    [String(sinceHours)],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function auditChannelReality(pool: pg.Pool): Promise<ChannelReality> {
  const surfaces = await pool.query(
    `select
       count(*)::int as discovered,
       count(*) filter (where status='READY')::int as ready,
       count(*) filter (
         where execution_class='AUTO_EXECUTABLE'
           and (surface_url ilike '%sslip.io%' or channel_family in ('programmatic_organic','owned_distribution'))
       )::int as owned_auto,
       count(*) filter (
         where execution_class='AUTO_EXECUTABLE'
           and surface_url not ilike '%sslip.io%'
           and channel_family not in ('programmatic_organic','owned_distribution')
       )::int as third_auto,
       count(*) filter (where execution_class='HUMAN_ACTION_REQUIRED')::int as human_req,
       count(*) filter (where execution_class in ('OWNER_ACCOUNT_REQUIRED','CREDENTIAL_REQUIRED'))::int as owner_cred,
       count(*) filter (where execution_class='UNAVAILABLE')::int as unavailable,
       count(*) filter (
         where executor_type='RESOURCE_PITCH' and execution_class='HUMAN_ACTION_REQUIRED'
       )::int as resource_human
     from aq_channel_surfaces`,
  );
  const receipts = await pool.query(
    `select
       count(*) filter (where is_new_audience)::int as attempted,
       count(*) filter (
         where is_new_audience
           and status in ('ACCEPTED','SUBMISSION_ACKNOWLEDGED','PUBLISHED','EXPOSURE_CONFIRMED','EXPOSED')
       )::int as accepted_pub,
       count(*) filter (
         where is_new_audience and status in ('PUBLISHED','EXPOSURE_CONFIRMED','EXPOSED')
       )::int as verified
     from aq_distribution_receipts
     where created_at > now() - interval '24 hours'`,
  );
  const s = surfaces.rows[0] ?? {};
  const r = receipts.rows[0] ?? {};
  return {
    discovered: Number(s.discovered ?? 0),
    ready: Number(s.ready ?? 0),
    ownedAutoExecutable: Number(s.owned_auto ?? 0),
    thirdPartyAutoExecutable: Number(s.third_auto ?? 0),
    humanActionRequired: Number(s.human_req ?? 0),
    ownerAccountOrCredential: Number(s.owner_cred ?? 0),
    unavailable: Number(s.unavailable ?? 0),
    resourcePitchHumanOnly: Number(s.resource_human ?? 0),
    attemptedNewAudience24h: Number(r.attempted ?? 0),
    acceptedOrPublishedNewAudience24h: Number(r.accepted_pub ?? 0),
    verifiedExposure24h: Number(r.verified ?? 0),
  };
}

export async function ensureZeroTrafficWarRoom(
  pool: pg.Pool,
  logger?: Logger,
): Promise<ZeroTrafficDoc> {
  const humans = await countVerifiedReferralHumans(pool, 72);
  const reality = await auditChannelReality(pool);
  const attempts = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where is_new_audience=true
       and created_at > now() - interval '6 hours'
       and external_action not in ('publish_owned_intent_page','portfolio_crosslink_publish','websub_publish','feed_publish')`,
  );
  const meaningful6h = Number(attempts.rows[0]?.n ?? 0);
  const perHour = meaningful6h / 6;

  // Self-diagnosis: collapse in third-party attempts while CRITICAL
  let stallDiagnosed = false;
  let lastStallAt: string | null = null;
  if (humans === 0 && perHour < 0.5) {
    stallDiagnosed = true;
    lastStallAt = new Date().toISOString();
    await recordCommercialFailure(pool, {
      businessId: "portfolio",
      strategyKey: "zero_traffic_experiment_velocity_collapse",
      rootCauseHypothesis: "DISTRIBUTION_PIPELINE_STALLED",
      evidence: { reality, meaningful6h, perHour },
      lesson:
        "CRITICAL: meaningful third-party distribution attempts/hour collapsed. Owned AUTO_EXECUTABLE is not acquisition. Force frontier non-form distribution + diagnose executable third-party coverage.",
      nextDifferentAction:
        "frontier_force_distribution_bets_and_reclassify_owned_as_not_third_party",
    }).catch(() => undefined);
    await saveCommercialLesson(pool, {
      scope: "zero_traffic_stall",
      lesson:
        "AUTO_EXECUTABLE channel count is dominated by owned CONTENT_PUBLISH/FEED/CROSSLINK. Third-party AUTO_EXECUTABLE≈0. Titan must not treat owned publishes as acquisition progress while ZERO_EXTERNAL_HUMANS is CRITICAL.",
      businessIds: [...ACQUISITION_FRONTIER],
      confidence: 0.95,
      evidence: [reality],
    }).catch(() => undefined);
  }

  const doc: ZeroTrafficDoc = {
    version: ZERO_TRAFFIC_VERSION,
    status: humans > 0 ? "CLEARED" : "CRITICAL",
    objective: "ZERO_EXTERNAL_HUMANS",
    frontier: [...ACQUISITION_FRONTIER],
    activatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    channelReality: reality,
    meaningfulAttemptsLast6h: meaningful6h,
    meaningfulAttemptsPerHour: Math.round(perHour * 100) / 100,
    stallDiagnosed,
    lastStallAt,
    telemetryNote:
      "VERIFIED_REFERRAL_HUMAN requires external non-self referer. Empty-referer browser UA from datacenter/VPS IPs remains BOT/UNKNOWN — not customer success.",
  };

  // Preserve first activatedAt
  const prior = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [ZERO_TRAFFIC_KEY],
  );
  const prev = prior.rows[0]?.value as ZeroTrafficDoc | undefined;
  if (prev?.activatedAt) doc.activatedAt = prev.activatedAt;

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'ZERO_TRAFFIC')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [ZERO_TRAFFIC_KEY, JSON.stringify(doc)],
  );

  // Permanent honesty: owned surfaces are not third-party acquisition capabilities
  await pool.query(
    `update aq_channel_surfaces set
       meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
         'acquisitionRole','OWNED_INFRASTRUCTURE_NOT_THIRD_PARTY',
         'reclassifiedAt', now()
       )
     where execution_class='AUTO_EXECUTABLE'
       and (
         surface_url ilike '%sslip.io%'
         or channel_family in ('programmatic_organic','owned_distribution')
       )
       and coalesce(meta->>'acquisitionRole','') <> 'OWNED_INFRASTRUCTURE_NOT_THIRD_PARTY'`,
  );

  logger?.("info", "zero_traffic.war_room", {
    status: doc.status,
    frontier: doc.frontier,
    thirdPartyAuto: reality.thirdPartyAutoExecutable,
    ownedAuto: reality.ownedAutoExecutable,
    meaningfulPerHour: doc.meaningfulAttemptsPerHour,
    stallDiagnosed,
    verifiedReferralHumans: humans,
  });

  return doc;
}

/** Force high-velocity non-form distribution for frontier businesses. */
export async function runFrontierDistributionBurst(input: {
  pool: pg.Pool;
  logger: Logger;
  families?: string[];
}): Promise<{
  attempts: number;
  successes: number;
  details: Array<Record<string, unknown>>;
}> {
  const families = input.families ?? [
    "directories",
    "partnerships",
    "creators",
    "communities",
    "earned",
    "marketplaces",
  ];
  let attempts = 0;
  let successes = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const businessId of ACQUISITION_FRONTIER) {
    // Authenticated Product Hunt path when token present (real third-party surface)
    if (process.env.PRODUCTHUNT_DEVELOPER_TOKEN) {
      attempts++;
      const habitat = buildBuyerHabitat(businessId);
      const ph = await executeProductHuntFrontierBet({
        pool: input.pool,
        businessId,
        keywords: [
          ...(habitat.searchQueries ?? []).slice(0, 3),
          businessId,
          habitat.industry?.replace(/_/g, " ") ?? "",
        ].filter(Boolean),
        problem: habitat.problem || businessId,
      });
      if (ph.newAudience) successes++;
      details.push({ businessId, family: "producthunt", ...ph });
      input.logger("info", "zero_traffic.frontier_bet", {
        businessId,
        family: "producthunt",
        ok: ph.ok,
        kind: ph.kind,
        newAudience: ph.newAudience,
        detail: String(ph.detail).slice(0, 160),
      });
    }

    for (let i = 0; i < 2; i++) {
      const family = families[(attempts + i) % families.length]!;
      attempts++;
      const bet = await executeNewAudienceBet({
        pool: input.pool,
        businessId,
        preferFamily: family,
        banPublicForms: true,
      });
      if (bet.newAudience) successes++;
      details.push({ businessId, family, ...bet });
      input.logger("info", "zero_traffic.frontier_bet", {
        businessId,
        family,
        ok: bet.ok,
        kind: bet.kind,
        newAudience: bet.newAudience,
        detail: String(bet.detail).slice(0, 160),
      });
    }
  }
  return { attempts, successes, details };
}
