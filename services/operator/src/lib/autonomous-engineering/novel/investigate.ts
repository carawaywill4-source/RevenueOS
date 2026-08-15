/**
 * Production + static investigation for novel engineering (no prescribed solution).
 */

import type pg from "pg";
import { buildDependencySummary, impactIfChanged } from "./ast-intelligence.js";
import { gitIntelligenceSummary, ensureGitWorktreeHint } from "./git-intelligence.js";
import { searchCode, findEnvReferences } from "../code-intelligence.js";

export type Investigation = {
  at: string;
  commercial: {
    verifiedHumans48h: number;
    newAudienceAttempts24h: number;
    newAudiencePublished24h: number;
    formFailures24h: number;
    emailSent24h: number;
    emailFailed24h: number;
    phComments24h: number;
    ownedPublished24h: number;
  };
  channels: {
    discovered: number;
    thirdPartyAuto: number;
    ownedAuto: number;
    humanRequired: number;
  };
  credentials: {
    resendFrom: boolean;
    resendKey: boolean;
    productHunt: boolean;
    gumroad: boolean;
    launchfree: boolean;
  };
  deadIntelligence: string[];
  staticRuntimeGaps: string[];
  code: Record<string, unknown>;
  git: Record<string, unknown>;
  gitHint: string;
};

export async function investigateDistributionBottleneck(
  pool: pg.Pool,
  appRoot: string,
): Promise<Investigation> {
  const traffic = await pool.query(
    `select count(*)::int as n from ros_traffic_events
     where created_at > now() - interval '48 hours'
       and class in ('LIKELY_HUMAN','QUALIFIED')
       and coalesce(referer,'') <> ''
       and referer not ilike '%sslip.io%'`,
  );
  const receipts = await pool.query(
    `select
       count(*) filter (where is_new_audience)::int as na,
       count(*) filter (where is_new_audience and status in ('PUBLISHED','EXPOSED','EXPOSURE_CONFIRMED'))::int as pub,
       count(*) filter (where external_action='public_form_resource_pitch' and status='FAILED_NO_ACCEPTANCE')::int as form_fail,
       count(*) filter (where external_action='resource_email_pitch' and status in ('SENT','ACCEPTED'))::int as email_ok,
       count(*) filter (where external_action='resource_email_pitch' and status='FAILED')::int as email_fail,
       count(*) filter (where external_action='producthunt_helpful_comment' and status='PUBLISHED')::int as ph,
       count(*) filter (where external_action='publish_owned_intent_page' and status='PUBLISHED')::int as owned
     from aq_distribution_receipts
     where created_at > now() - interval '24 hours'`,
  );
  const zt = await pool.query(
    `select value from ros_config_meta where key='zero_traffic_war_room' limit 1`,
  );
  const ztDoc = (zt.rows[0]?.value ?? {}) as {
    channelReality?: Record<string, number>;
  };
  const cr = ztDoc.channelReality ?? {};
  const surfaces = await pool.query(
    `select
       count(*)::int as discovered,
       count(*) filter (
         where execution_class='AUTO_EXECUTABLE'
           and surface_url not ilike '%sslip.io%'
           and channel_family not in ('programmatic_organic','owned_distribution')
       )::int as third_auto,
       count(*) filter (
         where execution_class='AUTO_EXECUTABLE'
           and (surface_url ilike '%sslip.io%' or channel_family in ('programmatic_organic','owned_distribution'))
       )::int as owned_auto,
       count(*) filter (where execution_class='HUMAN_ACTION_REQUIRED')::int as human_req
     from aq_channel_surfaces`,
  );

  const resendFrom = Boolean(
    process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL,
  );
  const resendKey = Boolean(process.env.RESEND_API_KEY);
  const ph = Boolean(process.env.PRODUCTHUNT_DEVELOPER_TOKEN);
  const gumroad = Boolean(process.env.GUMROAD_ACCESS_TOKEN);
  const launchfree = Boolean(
    process.env.LAUNCHFREE_SESSION_COOKIE ||
      (process.env.LAUNCHFREE_EMAIL && process.env.LAUNCHFREE_PASSWORD),
  );

  // Dead intelligence: bottleneck mentioned but not consumed
  const bottleneckHits = searchCode(appRoot, /primary_bottleneck|preferFamily/, {
    maxHits: 20,
  });
  const executorConsume = searchCode(
    appRoot,
    /primary_bottleneck.*(preferFamily|executor)|bottleneckToFamily/,
    { maxHits: 10 },
  );
  const deadIntelligence: string[] = [];
  if (bottleneckHits.length && executorConsume.length === 0) {
    deadIntelligence.push(
      "STATIC mentions primary_bottleneck/preferFamily but no bottleneck→executor bridge found",
    );
  }
  if (Number(surfaces.rows[0]?.discovered ?? 0) > 500 && Number(surfaces.rows[0]?.third_auto ?? 0) < 10) {
    deadIntelligence.push(
      "Channel discovery volume ≫ third-party AUTO_EXECUTABLE (feature theater)",
    );
  }
  if (Number(receipts.rows[0]?.form_fail ?? 0) > 50) {
    deadIntelligence.push(
      "Form pitches execute outbound but FAIL_NO_ACCEPTANCE at scale",
    );
  }
  if (resendFrom && Number(receipts.rows[0]?.email_ok ?? 0) === 0) {
    deadIntelligence.push(
      "Email sender configured but 24h SENT/ACCEPTED email_pitch count is 0",
    );
  }
  if (ph && Number(receipts.rows[0]?.ph ?? 0) === 0) {
    deadIntelligence.push(
      "Product Hunt token present but no PUBLISHED helpful comments in 24h",
    );
  }

  const staticRuntimeGaps = [
    ...deadIntelligence,
    Number(traffic.rows[0]?.n ?? 0) === 0
      ? "RUNTIME: verified referral humans = 0"
      : "RUNTIME: some verified referral humans exist",
  ];

  const r = receipts.rows[0] ?? {};
  const s = surfaces.rows[0] ?? {};

  return {
    at: new Date().toISOString(),
    commercial: {
      verifiedHumans48h: Number(traffic.rows[0]?.n ?? 0),
      newAudienceAttempts24h: Number(r.na ?? 0),
      newAudiencePublished24h: Number(r.pub ?? 0),
      formFailures24h: Number(r.form_fail ?? 0),
      emailSent24h: Number(r.email_ok ?? 0),
      emailFailed24h: Number(r.email_fail ?? 0),
      phComments24h: Number(r.ph ?? 0),
      ownedPublished24h: Number(r.owned ?? 0),
    },
    channels: {
      discovered: Number(s.discovered ?? cr.discovered ?? 0),
      thirdPartyAuto: Number(s.third_auto ?? cr.thirdPartyAutoExecutable ?? 0),
      ownedAuto: Number(s.owned_auto ?? cr.ownedAutoExecutable ?? 0),
      humanRequired: Number(s.human_req ?? cr.humanActionRequired ?? 0),
    },
    credentials: {
      resendFrom,
      resendKey,
      productHunt: ph,
      gumroad,
      launchfree,
    },
    deadIntelligence,
    staticRuntimeGaps,
    code: {
      deps: buildDependencySummary(appRoot),
      resendRefs: findEnvReferences(appRoot, "RESEND_API_KEY").slice(0, 8),
      phImpact: impactIfChanged(
        appRoot,
        "services/operator/src/lib/capability-reality/producthunt-adapter.ts",
      ),
      newAudienceImpact: impactIfChanged(
        appRoot,
        "services/operator/src/lib/titan-commercial-executive/new-audience.ts",
      ),
      channelReality: cr,
    },
    git: gitIntelligenceSummary(appRoot),
    gitHint: ensureGitWorktreeHint(appRoot),
  };
}

export function synthesizeRequirements(inv: Investigation): string[] {
  const reqs = [
    "Actual third-party exposure must be possible (not owned sslip.io theater)",
    "External effect must be verifiable (acceptance/publication receipt)",
    "Buyer relevance must be considered (frontier habitats)",
    "Attribution path back to business via tracked URLs",
    "Actions must be legitimate; no spam/CAPTCHA bypass/fake accounts",
    "Owner intervention minimized; account needs are engineering inputs when lawful",
    "Capability should be reusable across frontier businesses where fit",
    "Failure must produce durable lessons",
    "Authentication/account requirements represented honestly in capability registry",
    "Execution must not depend on Cursor being online",
  ];
  if (inv.credentials.resendFrom) {
    reqs.push(
      "Email path is available — prefer quality-gated outreach with acceptance follow-up over forms",
    );
  }
  if (inv.commercial.formFailures24h > 20) {
    reqs.push("Do not rely on public form flood strategies");
  }
  if (inv.credentials.productHunt && inv.commercial.phComments24h === 0) {
    reqs.push(
      "Product Hunt auth exists but unused — investigate discoverability/keyword/executor wiring",
    );
  }
  if (inv.channels.thirdPartyAuto < 5) {
    reqs.push(
      "Third-party executable coverage is tiny — architecture must expand real executors, not discovery volume",
    );
  }
  return reqs;
}
