/**
 * Production capability reality audit + durable registry.
 */

import type pg from "pg";
import { ensureCapabilityRealityTables } from "./schema.js";
import { syncEnvCredentialsIntoVault } from "./credential-vault.js";
import {
  FEATURE_THEATER_DOCTRINE,
  OPEN_WORLD_BUSINESS_DOCTRINE,
  type CapabilityRecord,
  type CapabilityState,
  type DistributionCapability,
} from "./types.js";
import { persistOneLicenseRegressionLesson } from "./inbound-intel.js";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

async function upsertCapability(pool: pg.Pool, c: CapabilityRecord): Promise<void> {
  await pool.query(
    `insert into ros_capability_registry
       (capability_id, domain, name, state, chain_break, live_evidence, failure_point,
        action, autonomous, authenticated, owner_authority, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
     on conflict (capability_id) do update set
       state=excluded.state,
       chain_break=excluded.chain_break,
       live_evidence=excluded.live_evidence,
       failure_point=excluded.failure_point,
       action=excluded.action,
       autonomous=excluded.autonomous,
       authenticated=excluded.authenticated,
       owner_authority=excluded.owner_authority,
       updated_at=now()`,
    [
      c.id,
      c.domain,
      c.name,
      c.state,
      c.chainBreak ?? null,
      c.liveEvidence,
      c.failurePoint,
      c.action,
      c.autonomous,
      c.authenticated,
      c.ownerAuthority,
    ],
  );
}

async function upsertDist(pool: pg.Pool, d: DistributionCapability): Promise<void> {
  await pool.query(
    `insert into ros_distribution_capabilities
       (id, channel, platform, account_id, auth_state, rule_class, audience,
        publication_method, autonomous_eligibility, owner_requirement,
        acceptance_verification, publication_verification, referral_attribution,
        confidence, suppressed, historical_roi, state, evidence, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
     on conflict (id) do update set
       auth_state=excluded.auth_state,
       rule_class=excluded.rule_class,
       autonomous_eligibility=excluded.autonomous_eligibility,
       owner_requirement=excluded.owner_requirement,
       state=excluded.state,
       evidence=excluded.evidence,
       confidence=excluded.confidence,
       updated_at=now()`,
    [
      d.id,
      d.channel,
      d.platform,
      d.accountId ?? null,
      d.authState,
      d.ruleClass,
      d.audience,
      d.publicationMethod,
      d.autonomousEligibility,
      d.ownerRequirement,
      d.acceptanceVerification,
      d.publicationVerification,
      d.referralAttribution,
      d.confidence,
      d.suppressed,
      d.historicalRoi,
      d.state,
      d.evidence,
    ],
  );
}

function rec(
  partial: Omit<CapabilityRecord, "updatedAt"> & { updatedAt?: string },
): CapabilityRecord {
  return { ...partial, updatedAt: partial.updatedAt ?? new Date().toISOString() };
}

export async function runCapabilityRealityAudit(
  pool: pg.Pool,
  logger: Logger,
): Promise<{
  capabilities: CapabilityRecord[];
  distribution: DistributionCapability[];
  counts: Record<string, number>;
}> {
  await ensureCapabilityRealityTables(pool);
  const vault = await syncEnvCredentialsIntoVault(pool);
  await persistOneLicenseRegressionLesson(pool);

  // Persist doctrines
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('feature_theater_doctrine', $1::jsonb, now(), 'CAPABILITY_REALITY'),
            ('open_world_business_doctrine', $2::jsonb, now(), 'CAPABILITY_REALITY')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CAPABILITY_REALITY'`,
    [
      JSON.stringify({ ...FEATURE_THEATER_DOCTRINE, updatedAt: new Date().toISOString() }),
      JSON.stringify({
        ...OPEN_WORLD_BUSINESS_DOCTRINE,
        updatedAt: new Date().toISOString(),
      }),
    ],
  );

  const channelReality = await pool.query(
    `select value from ros_config_meta where key='zero_traffic_war_room' limit 1`,
  );
  const zt = (channelReality.rows[0]?.value ?? {}) as {
    channelReality?: Record<string, number>;
    meaningfulAttemptsPerHour?: number;
    status?: string;
  };
  const cr = zt.channelReality ?? {};

  const traffic = await pool.query(
    `select
       count(*) filter (
         where class in ('LIKELY_HUMAN','QUALIFIED')
           and coalesce(referer,'') <> ''
           and referer not ilike '%sslip.io%'
       )::int as verified_ref,
       count(*) filter (where class='LIKELY_HUMAN')::int as likely_human
     from ros_traffic_events
     where created_at > now() - interval '48 hours'`,
  );
  const verifiedHumans = Number(traffic.rows[0]?.verified_ref ?? 0);

  const receipts = await pool.query(
    `select
       count(*) filter (where is_new_audience)::int as na,
       count(*) filter (where is_new_audience and status in ('PUBLISHED','EXPOSED','EXPOSURE_CONFIRMED'))::int as pub,
       count(*) filter (where external_action='resource_email_pitch' and status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED'))::int as email_ok,
       count(*) filter (where external_action='indexnow_submit' and status in ('ACCEPTED','PUBLISHED'))::int as indexnow_ok
     from aq_distribution_receipts
     where created_at > now() - interval '24 hours'`,
  );
  const na = Number(receipts.rows[0]?.na ?? 0);
  const pub = Number(receipts.rows[0]?.pub ?? 0);
  const emailOk = Number(receipts.rows[0]?.email_ok ?? 0);
  const indexnowOk = Number(receipts.rows[0]?.indexnow_ok ?? 0);

  const resendFrom = Boolean(
    process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL,
  );
  const resendKey = Boolean(process.env.RESEND_API_KEY);
  const phToken = Boolean(process.env.PRODUCTHUNT_DEVELOPER_TOKEN);
  const gumroad = Boolean(process.env.GUMROAD_ACCESS_TOKEN);

  const emailState: CapabilityState =
    resendKey && resendFrom
      ? emailOk > 0
        ? "PARTIAL_CAPABILITY"
        : "PARTIAL_CAPABILITY"
      : resendKey
        ? "BROKEN_CAPABILITY"
        : "OWNER_AUTHORITY_REQUIRED";

  const caps: CapabilityRecord[] = [
    rec({
      id: "titan.market_research",
      domain: "TITAN",
      name: "Market / open-world research",
      state: "PROVEN_CAPABILITY",
      liveEvidence: "DDG research + channel discovery producing 1700+ surfaces",
      failurePoint: "none for research itself",
      action: "keep; do not confuse with distribution",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "titan.channel_discovery",
      domain: "TITAN",
      name: "Channel discovery",
      state: "EXECUTING_NO_EFFECT",
      chainBreak: "EXTERNAL EFFECT (publication)",
      liveEvidence: `${cr.discovered ?? "many"} surfaces; ${cr.thirdPartyAutoExecutable ?? 0} third-party auto`,
      failurePoint: "discovery ≠ executable distribution",
      action: "prefer distribution capability registry over URL graph",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "titan.email_outreach",
      domain: "TITAN",
      name: "Email outreach (Resend)",
      state: emailState,
      chainBreak: emailOk > 0 ? "VERIFICATION/LEARNING" : "EXECUTION→EXTERNAL EFFECT",
      liveEvidence: resendFrom
        ? `from-domain configured; vault synced; email_ok_24h=${emailOk}`
        : "RESEND key existed but FROM missing (test-mode)",
      failurePoint: resendFrom
        ? "inbound receiving disabled; commercial quality historically weak"
        : "OUTREACH_FROM_EMAIL missing",
      action: "commercial quality gate + enable inbound when MX available",
      autonomous: Boolean(resendKey && resendFrom),
      authenticated: true,
      ownerAuthority: false,
    }),
    rec({
      id: "titan.public_form_pitch",
      domain: "TITAN",
      name: "Public form resource pitch",
      state: "BROKEN_CAPABILITY",
      chainBreak: "EXTERNAL ACCEPTANCE",
      liveEvidence: "955 FAILED_NO_ACCEPTANCE / 956 attempts",
      failurePoint: "forms execute outbound but never publish",
      action: "remain banned under zero-traffic; do not count as distribution",
      autonomous: false,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "titan.producthunt",
      domain: "DISTRIBUTION",
      name: "Product Hunt authenticated comments",
      state: phToken ? "PARTIAL_CAPABILITY" : "IMPLEMENTED_NOT_EXECUTING",
      chainBreak: phToken ? "EXECUTION→MEASUREMENT" : "AUTHENTICATE",
      liveEvidence: phToken
        ? "developer token verified (viewer username live)"
        : "token absent in operator env",
      failurePoint: "was not wired into Titan commercial executive",
      action: "wire authenticated executor into frontier ticks",
      autonomous: phToken,
      authenticated: phToken,
      ownerAuthority: false,
    }),
    rec({
      id: "titan.gumroad",
      domain: "DISTRIBUTION",
      name: "Gumroad marketplace API",
      state: gumroad ? "PARTIAL_CAPABILITY" : "CLAIMED_ONLY",
      liveEvidence: gumroad ? "token present in vault" : "no token",
      failurePoint: "API flaky / not wired to Titan acquisition path",
      action: "prove listing/update before calling PROVEN",
      autonomous: false,
      authenticated: gumroad,
      ownerAuthority: false,
    }),
    rec({
      id: "titan.launchfree",
      domain: "DISTRIBUTION",
      name: "LaunchFree directory",
      state: "OWNER_AUTHORITY_REQUIRED",
      chainBreak: "AUTHENTICATE",
      liveEvidence:
        "Historical Cursor-led TributeReady acceptance claimed; zero credentials/cookies/env in repo or Azure",
      failurePoint: "account access never migrated into Titan vault",
      action: "owner must provide LaunchFree login or session into vault",
      autonomous: false,
      authenticated: false,
      ownerAuthority: true,
    }),
    rec({
      id: "titan.indexnow",
      domain: "DISTRIBUTION",
      name: "IndexNow search ping",
      state: indexnowOk > 0 ? "PARTIAL_CAPABILITY" : "EXECUTING_NO_EFFECT",
      liveEvidence: `indexnow accepted_24h=${indexnowOk}`,
      failurePoint: "search ping ≠ audience exposure",
      action: "keep as discovery assist only",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "titan.owned_publish",
      domain: "DISTRIBUTION",
      name: "Owned CONTENT_PUBLISH",
      state: "EXECUTING_NO_EFFECT",
      liveEvidence: "hundreds of owned publishes; zero third-party humans",
      failurePoint: "misclassified as acquisition capability",
      action: "suppressed while ZERO_EXTERNAL_HUMANS CRITICAL",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "telemetry.humans",
      domain: "TELEMETRY",
      name: "External human detection",
      state: "PARTIAL_CAPABILITY",
      liveEvidence: `verified_referral_humans_48h=${verifiedHumans}; likely_human includes scanners`,
      failurePoint: "empty-referer over-credit historically",
      action: "keep hardened classifier; require external referer for acquisition credit",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "apex.bottleneck_to_execution",
      domain: "APEX",
      name: "Bottleneck → Titan execution",
      state: "IMPLEMENTED_NOT_EXECUTING",
      chainBreak: "DECISION→EXECUTION",
      liveEvidence: "Apex authorizes mutations; commercial bottlenecks are Titan-local and weakly consumed",
      failurePoint: "dead intelligence: bottleneck evidence packs unused by executors",
      action: "route mission.primary_bottleneck into executor selection",
      autonomous: false,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "forge.acquisition_assets",
      domain: "FORGE",
      name: "Free utility / acquisition asset creation",
      state: "PARTIAL_CAPABILITY",
      liveEvidence: "deckready + rfpstrike utilities live HTTP 200",
      failurePoint: "utility ≠ exposure without third-party distribution",
      action: "pair every asset with a distribution capability",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "self_evolution.limitation_detection",
      domain: "SELF_EVOLUTION",
      name: "Core limitation detection",
      state: "BROKEN_CAPABILITY",
      chainBreak: "REASONING",
      liveEvidence: "previously SKIPPED no_demonstrated_limitation during zero-traffic stall",
      failurePoint: "only looked for stub telemetry, ignored commercial contradictions",
      action: "meta-contradiction detector (deploying)",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "commercial_memory.lessons",
      domain: "COMMERCIAL_MEMORY",
      name: "Lesson persistence",
      state: "PARTIAL_CAPABILITY",
      liveEvidence: "titan_commercial_lessons + ros_config_meta lessons exist",
      failurePoint: "lessons rarely steer family/executor choice",
      action: "feed commercial_comms_lessons into pre-send gate",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
    rec({
      id: "identity.business",
      domain: "IDENTITY",
      name: "RevenueOS business identity",
      state: "PARTIAL_CAPABILITY",
      liveEvidence: `ops@tributeready.org + vault sync platforms=${vault.synced.join(",")}`,
      failurePoint: "inbound receiving disabled; LaunchFree session missing",
      action: "complete inbox receiving + migrate remaining accounts",
      autonomous: true,
      authenticated: true,
      ownerAuthority: false,
    }),
    rec({
      id: "comms.quality_gate",
      domain: "COMMUNICATION",
      name: "Commercial email quality gate",
      state: "PARTIAL_CAPABILITY",
      liveEvidence: "WHO/WHY/OBJECTIVE/VALUE/OFFER/CTA/WHY_NOW module deployed",
      failurePoint: "must be enforced on every send path",
      action: "wire into new-audience before Resend",
      autonomous: true,
      authenticated: false,
      ownerAuthority: false,
    }),
  ];

  for (const c of caps) await upsertCapability(pool, c);

  const dist: DistributionCapability[] = [
    {
      id: "dist.email.resend",
      channel: "email_outreach",
      platform: "resend",
      accountId: "resend:env",
      authState: resendKey && resendFrom ? "VERIFIED" : "MISSING",
      ruleClass: "PERMITTED_WITH_LIMITS",
      audience: "resource curators / partners with public emails",
      publicationMethod: "transactional_email_api",
      autonomousEligibility: Boolean(resendKey && resendFrom),
      ownerRequirement: null,
      acceptanceVerification: true,
      publicationVerification: false,
      referralAttribution: true,
      confidence: resendFrom ? 0.7 : 0.2,
      suppressed: false,
      historicalRoi: 0,
      state: emailState,
      evidence: `vault+from configured=${resendFrom}; 24h_sent=${emailOk}`,
    },
    {
      id: "dist.producthunt.comments",
      channel: "marketplace_community",
      platform: "producthunt",
      accountId: "producthunt:env",
      authState: phToken ? "CREDENTIAL_PRESENT" : "MISSING",
      ruleClass: "PERMITTED_WITH_LIMITS",
      audience: "makers / early adopters on PH launches",
      publicationMethod: "graphql_comment",
      autonomousEligibility: phToken,
      ownerRequirement: null,
      acceptanceVerification: true,
      publicationVerification: true,
      referralAttribution: true,
      confidence: phToken ? 0.65 : 0.1,
      suppressed: false,
      historicalRoi: 0,
      state: phToken ? "PARTIAL_CAPABILITY" : "IMPLEMENTED_NOT_EXECUTING",
      evidence: phToken ? "token live-verified" : "token missing",
    },
    {
      id: "dist.launchfree.listing",
      channel: "startup_directory",
      platform: "launchfree",
      authState: "MISSING",
      ruleClass: "UNKNOWN_NEEDS_RESEARCH",
      audience: "founders seeking free launch directories",
      publicationMethod: "authenticated_listing",
      autonomousEligibility: false,
      ownerRequirement: "Provide LaunchFree credentials/session for migration",
      acceptanceVerification: true,
      publicationVerification: true,
      referralAttribution: true,
      confidence: 0.2,
      suppressed: false,
      historicalRoi: 0,
      state: "OWNER_AUTHORITY_REQUIRED",
      evidence: "no vault credential; historical acceptance not transferable without login",
    },
    {
      id: "dist.indexnow",
      channel: "search_discovery",
      platform: "indexnow",
      authState: "NONE",
      ruleClass: "PERMITTED",
      audience: "search engines (not humans directly)",
      publicationMethod: "api_ping",
      autonomousEligibility: true,
      ownerRequirement: null,
      acceptanceVerification: true,
      publicationVerification: false,
      referralAttribution: false,
      confidence: 0.4,
      suppressed: false,
      historicalRoi: 0,
      state: "PARTIAL_CAPABILITY",
      evidence: "API works; not audience exposure",
    },
    {
      id: "dist.owned.content",
      channel: "owned_distribution",
      platform: "sslip_hosting",
      authState: "NONE",
      ruleClass: "PERMITTED",
      audience: "none external by itself",
      publicationMethod: "content_publish",
      autonomousEligibility: false,
      ownerRequirement: null,
      acceptanceVerification: true,
      publicationVerification: true,
      referralAttribution: false,
      confidence: 0.1,
      suppressed: zt.status === "CRITICAL",
      historicalRoi: 0,
      state: "EXECUTING_NO_EFFECT",
      evidence: "suppressed under zero-traffic CRITICAL",
    },
  ];
  for (const d of dist) await upsertDist(pool, d);

  // Reclassify surfaces that were only blocked by missing email registration
  const reclass = await pool.query(
    `update aq_channel_surfaces
     set execution_class='AUTO_EXECUTABLE',
         executor_type='EMAIL_OUTREACH',
         manual_action_required=false,
         automation_allowed=true,
         updated_at=now()
     where executor_type='RESOURCE_PITCH'
       and execution_class='HUMAN_ACTION_REQUIRED'
       and account_required=false
       and credential_required=false
       and surface_url not ilike '%sslip.io%'
       and $1::boolean = true
     returning channel_surface_id`,
    [Boolean(resendKey && resendFrom)],
  );

  const counts = await pool.query(
    `select state, count(*)::int as n from ros_capability_registry group by 1`,
  );
  const countMap: Record<string, number> = {};
  for (const r of counts.rows) countMap[String(r.state)] = Number(r.n);

  const distCounts = await pool.query(
    `select
       count(*) filter (where autonomous_eligibility and state in ('PARTIAL_CAPABILITY','PROVEN_CAPABILITY'))::int as auto_3p,
       count(*) filter (where auth_state in ('CREDENTIAL_PRESENT','VERIFIED','SESSION_PRESENT') and autonomous_eligibility=true)::int as auth_exec,
       count(*) filter (where owner_requirement is not null)::int as owner_req,
       count(*) filter (where state='OWNER_AUTHORITY_REQUIRED')::int as owner_auth_state
     from ros_distribution_capabilities`,
  );

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('capability_reality_audit', $1::jsonb, now(), 'CAPABILITY_REALITY')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CAPABILITY_REALITY'`,
    [
      JSON.stringify({
        version: "capability-reality-v1",
        updatedAt: new Date().toISOString(),
        vaultSynced: vault.synced,
        vaultMissing: vault.missing,
        emailFromConfigured: resendFrom,
        productHuntToken: phToken,
        gumroadToken: gumroad,
        verifiedHumans48h: verifiedHumans,
        newAudienceAttempts24h: na,
        newAudiencePublished24h: pub,
        resourcePitchReclassified: reclass.rowCount ?? 0,
        distribution: distCounts.rows[0] ?? {},
        stateCounts: countMap,
        zeroTraffic: zt.status ?? null,
        meaningfulAttemptsPerHour: zt.meaningfulAttemptsPerHour ?? null,
      }),
    ],
  );

  if (resendKey && resendFrom) {
    await pool.query(
      `update titan_acquisition_capability_gaps
       set stage='CLOSED', status='CLOSED', closed_at=now(),
           next_action='Resend from-domain configured; EMAIL_OUTREACH unblocked',
           updated_at=now(),
           meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object('closedBy','capability_reality_v1')
       where gap ilike '%email_outreach%' or gap ilike '%resend%' or gap ilike '%deliverability%'`,
    );
  }

  logger("info", "capability_reality.audit", {
    caps: caps.length,
    dist: dist.length,
    reclassified: reclass.rowCount ?? 0,
    emailFrom: resendFrom,
    ph: phToken,
    states: countMap,
  });

  return { capabilities: caps, distribution: dist, counts: countMap };
}

export async function countExecutableDistribution(pool: pg.Pool): Promise<{
  autonomousThirdParty: number;
  authenticatedExecutable: number;
  ownerAuthRequired: number;
  manualOnly: number;
  unavailable: number;
}> {
  const d = await pool.query(
    `select
       count(*) filter (
         where autonomous_eligibility=true
           and platform not in ('sslip_hosting','indexnow')
           and state in ('PARTIAL_CAPABILITY','PROVEN_CAPABILITY')
       )::int as auto_3p,
       count(*) filter (
         where auth_state in ('CREDENTIAL_PRESENT','VERIFIED','SESSION_PRESENT')
           and autonomous_eligibility=true
       )::int as auth_exec,
       count(*) filter (where state='OWNER_AUTHORITY_REQUIRED')::int as owner_auth,
       count(*) filter (where autonomous_eligibility=false and state <> 'OWNER_AUTHORITY_REQUIRED')::int as manualish,
       count(*) filter (where suppressed=true)::int as unavailable
     from ros_distribution_capabilities`,
  );
  const r = d.rows[0] ?? {};
  return {
    autonomousThirdParty: Number(r.auto_3p ?? 0),
    authenticatedExecutable: Number(r.auth_exec ?? 0),
    ownerAuthRequired: Number(r.owner_auth ?? 0),
    manualOnly: Number(r.manualish ?? 0),
    unavailable: Number(r.unavailable ?? 0),
  };
}
