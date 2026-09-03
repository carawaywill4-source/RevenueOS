/**
 * Admission / REWORK closed loop:
 * decision record → mutation → commercial measurement → durable lesson → reuse.
 *
 * Deployment success ≠ commercial repair success.
 */

import type pg from "pg";
import { assessCommercialReadiness } from "./commercial-readiness.js";
import {
  ensureTitanWorldTables,
  saveCommercialLesson,
} from "./titan-world-store.js";

export const TITAN_DECISION_LIFECYCLE_VERSION = "titan-decision-lifecycle-v1";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

export type ApplicableLesson = {
  id: string;
  scope: string;
  lesson: string;
  confidence: number;
  businessIds: string[];
  evidence: unknown;
  whyRelevant: string;
  transferability: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  negativeTransferCheck: string;
  applied: boolean;
  decisionEffect: string;
};

export async function ensureDecisionLifecycleTables(
  pool: pg.Pool,
): Promise<void> {
  await ensureTitanWorldTables(pool);
  await pool.query(`
    create table if not exists titan_decision_experiments (
      id text primary key,
      business_id text not null,
      candidate_id text not null,
      decision_type text not null,
      evidence_pack_id text,
      research_run_id text,
      gate_score numeric,
      gate_reason text,
      hypothesis text not null,
      mutation_requested text not null,
      mutation_authorization text,
      mutation_started_at timestamptz,
      baseline_state jsonb not null default '{}'::jsonb,
      expected_result text,
      measurement_method text,
      measurement_window_sec int not null default 900,
      status text not null default 'PLANNED',
      measured_at timestamptz,
      measurement jsonb not null default '{}'::jsonb,
      result text,
      lesson_id text,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists titan_decision_exp_biz_idx
      on titan_decision_experiments (business_id, created_at desc);
    create index if not exists titan_decision_exp_status_idx
      on titan_decision_experiments (status);
    alter table titan_claims
      add column if not exists verification_method text;
    alter table titan_claims
      add column if not exists supporting_source_ids text[] not null default '{}';
    alter table titan_claims
      add column if not exists conflicting_source_ids text[] not null default '{}';
  `);
}

export async function createReworkDecisionExperiment(input: {
  pool: pg.Pool;
  businessId: string;
  decisionType: string;
  evidencePackId?: string | null;
  researchRunId?: string | null;
  gateScore?: number | null;
  gateReason?: string | null;
  mutationRequested: string;
  mutationAuthorization: string;
  baseline?: Record<string, unknown>;
  logger?: Logger;
}): Promise<string> {
  await ensureDecisionLifecycleTables(input.pool);
  const existing = await input.pool.query(
    `select id from titan_decision_experiments
     where business_id=$1 and status in ('PLANNED','AUTHORIZED','MUTATING','AWAITING_MEASUREMENT')
     order by created_at desc limit 1`,
    [input.businessId],
  );
  if (existing.rows[0]?.id) return String(existing.rows[0].id);

  const eid = id("tdec");
  const hypothesis =
    "Restoring a publicly reachable commercial storefront (identity + offer + CTA + checkout path) makes this candidate eligible for probation without wasting a LIVE_PROBATION cycle on a broken buyer path.";
  await input.pool.query(
    `insert into titan_decision_experiments
     (id, business_id, candidate_id, decision_type, evidence_pack_id, research_run_id,
      gate_score, gate_reason, hypothesis, mutation_requested, mutation_authorization,
      mutation_started_at, baseline_state, expected_result, measurement_method,
      measurement_window_sec, status, meta)
     values ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11::jsonb,$12,$13,1800,'MUTATING',$14::jsonb)`,
    [
      eid,
      input.businessId,
      input.decisionType,
      input.evidencePackId ?? null,
      input.researchRunId ?? null,
      input.gateScore ?? null,
      input.gateReason ?? null,
      hypothesis,
      input.mutationRequested,
      input.mutationAuthorization,
      JSON.stringify(input.baseline ?? {}),
      "Public commercial readiness: HTTP OK, identity, offer, CTA, checkout path present (deployment alone insufficient).",
      "assessCommercialReadiness",
      JSON.stringify({
        version: TITAN_DECISION_LIFECYCLE_VERSION,
        createdFrom: "admit.titan_rework",
      }),
    ],
  );
  input.logger?.("info", "titan.decision.created", {
    decisionId: eid,
    businessId: input.businessId,
    mutation: input.mutationRequested,
  });
  return eid;
}

export async function measureDecisionExperiment(input: {
  pool: pg.Pool;
  decisionId: string;
  logger?: Logger;
}): Promise<{
  ok: boolean;
  result: "PASS" | "FAIL" | "PARTIAL";
  lessonId: string | null;
  measurement: Record<string, unknown>;
}> {
  const rowRes = await input.pool.query(
    `select * from titan_decision_experiments where id=$1`,
    [input.decisionId],
  );
  const row = rowRes.rows[0];
  if (!row) {
    return { ok: false, result: "FAIL", lessonId: null, measurement: {} };
  }
  if (row.status === "MEASURED" || row.status === "FAILED") {
    return {
      ok: row.result === "PASS",
      result: (row.result as "PASS" | "FAIL" | "PARTIAL") ?? "FAIL",
      lessonId: row.lesson_id ?? null,
      measurement: (row.measurement as Record<string, unknown>) ?? {},
    };
  }

  const siteId = String(row.business_id);
  const readiness = await assessCommercialReadiness({
    siteId,
    pool: input.pool,
  });
  const checks = readiness.checks ?? {};
  const httpOk = checks.http === "pass";
  const offerOk = checks.offer === "pass";
  const ctaOk = checks.cta === "pass";
  const checkoutOk = checks.checkoutPath === "pass";
  const commercialPass = readiness.ready === true;
  const deployOnlyTrap = httpOk && !commercialPass;

  let result: "PASS" | "FAIL" | "PARTIAL" = "FAIL";
  if (commercialPass) result = "PASS";
  else if (httpOk && (offerOk || ctaOk)) result = "PARTIAL";

  const measurement = {
    measuredAt: new Date().toISOString(),
    ready: readiness.ready,
    http: checks.http,
    offer: checks.offer,
    cta: checks.cta,
    checkoutPath: checks.checkoutPath,
    analytics: checks.analytics,
    indexability: checks.indexability,
    failures: (readiness.failures ?? []).map((f) => f.code),
    canonicalUrl: readiness.canonicalUrl,
    deployOnlyTrap,
    note: "Commercial measurement — not deployment status",
  };

  const lessonText =
    result === "PASS"
      ? `${siteId}: restoring public commercial storefront (offer+CTA+checkout) made candidate commercially ready — repair before probation is correct.`
      : deployOnlyTrap
        ? `${siteId}: HTTP reachability alone is NOT commercial readiness (deploy-only trap). Require offer+CTA+checkout before probation.`
        : `${siteId}: REWORK mutation incomplete — commercial failures=${(readiness.failures ?? []).map((f) => f.code).join(",") || "unknown"}. Do not start probation until buyer path works.`;

  const lessonId = await saveCommercialLesson(input.pool, {
    scope: result === "PASS" ? "CHANNEL" : "BUSINESS",
    lesson: lessonText,
    businessIds: [siteId],
    confidence: result === "PASS" ? 0.78 : deployOnlyTrap ? 0.82 : 0.7,
    evidence: [
      {
        decisionId: input.decisionId,
        decisionType: row.decision_type,
        mutation: row.mutation_requested,
        measurement,
        futureRule:
          "Candidates with missing/broken public commercial storefront should be repaired before LIVE_PROBATION.",
        negativeTransfer:
          "Do not treat HTTP 200 / successful deploy as proof of a usable commercial storefront.",
        transferability: "HIGH for NO_PUBLIC_STOREFRONT / NO_COMMERCIAL_OFFER / NO_CTA patterns",
      },
    ],
  });

  await input.pool.query(
    `update titan_decision_experiments set
       status=$2, measured_at=now(), measurement=$3::jsonb, result=$4,
       lesson_id=$5, updated_at=now()
     where id=$1`,
    [
      input.decisionId,
      result === "FAIL" ? "FAILED" : "MEASURED",
      JSON.stringify(measurement),
      result,
      lessonId,
    ],
  );

  input.logger?.("info", "titan.decision.measured", {
    decisionId: input.decisionId,
    businessId: siteId,
    result,
    lessonId,
    ready: readiness.ready,
    deployOnlyTrap,
  });

  return { ok: result === "PASS", result, lessonId, measurement };
}

/** Measure oldest awaiting/mutating decision experiments (bounded). */
export async function measurePendingDecisionExperiments(input: {
  pool: pg.Pool;
  limit?: number;
  logger?: Logger;
}): Promise<number> {
  await ensureDecisionLifecycleTables(input.pool);
  const lim = input.limit ?? 2;
  const res = await input.pool.query(
    `select id from titan_decision_experiments
     where status in ('MUTATING','AWAITING_MEASUREMENT','AUTHORIZED')
       and mutation_started_at < now() - interval '45 seconds'
     order by mutation_started_at asc
     limit $1`,
    [lim],
  );
  let n = 0;
  for (const row of res.rows) {
    await measureDecisionExperiment({
      pool: input.pool,
      decisionId: String(row.id),
      logger: input.logger,
    });
    n += 1;
  }
  return n;
}

export async function loadApplicableLessons(input: {
  pool: pg.Pool;
  siteId: string;
  productWeak?: boolean;
  failureCodes?: string[];
  limit?: number;
}): Promise<ApplicableLesson[]> {
  await ensureDecisionLifecycleTables(input.pool);
  const res = await input.pool.query(
    `select id, scope, lesson, confidence, business_ids, evidence, created_at
     from titan_commercial_lessons
     where scope in ('BUSINESS','CHANNEL','GLOBAL','MARKET')
        or $1 = any(business_ids)
     order by created_at desc
     limit 40`,
    [input.siteId],
  );

  const failures = new Set(
    (input.failureCodes ?? []).map((f) => f.toUpperCase()),
  );
  const out: ApplicableLesson[] = [];

  for (const row of res.rows) {
    const lesson = String(row.lesson ?? "");
    const evidence = row.evidence;
    const ev0 =
      Array.isArray(evidence) && evidence[0] && typeof evidence[0] === "object"
        ? (evidence[0] as Record<string, unknown>)
        : {};
    const text = `${lesson} ${JSON.stringify(ev0)}`.toLowerCase();

    const storefrontPattern =
      /storefront|http reachability|deploy-only|no_public_storefront|no_commercial_offer|cta|checkout|buyer path|repair before probation/i.test(
        text,
      );
    const indexNowPattern = /indexnow/i.test(text);

    let transferability: ApplicableLesson["transferability"] = "NONE";
    let whyRelevant = "Low topical overlap";
    let negativeTransferCheck = "No automatic transfer";
    let applied = false;
    let decisionEffect = "none";

    if (storefrontPattern && (input.productWeak || failures.size > 0)) {
      transferability = "HIGH";
      whyRelevant =
        "Prior lesson covers missing/broken public commercial storefront before probation.";
      negativeTransferCheck =
        "Applied only when productWeak or commercial failures present — not for healthy storefronts.";
      applied = true;
      decisionEffect =
        "Bias toward REWORK_BEFORE_ADMISSION / repair-before-probation; reject deploy-only success.";
    } else if (storefrontPattern) {
      transferability = "MEDIUM";
      whyRelevant =
        "Storefront commercial-readiness lesson exists; candidate not yet proven weak.";
      negativeTransferCheck =
        "Do not force rework without productWeak/failure evidence.";
      applied = false;
      decisionEffect = "noted_only";
    } else if (indexNowPattern) {
      transferability = "MEDIUM";
      whyRelevant = "IndexNow/distribution reliability lesson may affect acquisition choice.";
      negativeTransferCheck =
        "Do not assume IndexNow failure means the business opportunity is weak.";
      applied = false;
      decisionEffect = "acquisition_channel_priority";
    }

    if (transferability === "NONE") continue;

    out.push({
      id: String(row.id),
      scope: String(row.scope),
      lesson: lesson.slice(0, 280),
      confidence: Number(row.confidence ?? 0.5),
      businessIds: (row.business_ids as string[]) ?? [],
      evidence: ev0,
      whyRelevant,
      transferability,
      negativeTransferCheck,
      applied,
      decisionEffect,
    });
    if (out.length >= (input.limit ?? 5)) break;
  }
  return out;
}

/**
 * Bounded claim verification: prefer commercially important claims;
 * require independent host corroboration for SUPPORTED/VERIFIED.
 */
export async function verifyPriorityClaims(input: {
  pool: pg.Pool;
  limit?: number;
  logger?: Logger;
}): Promise<{ examined: number; upgraded: number }> {
  await ensureDecisionLifecycleTables(input.pool);
  const lim = input.limit ?? 8;
  const res = await input.pool.query(
    `select id, topic, claim, source_url, status, commercial_relevance, affected_businesses
     from titan_claims
     where status in ('UNVERIFIED','SINGLE_SOURCE')
       and (
         commercial_relevance ilike '%admission%'
         or commercial_relevance ilike '%pricing%'
         or commercial_relevance ilike '%demand%'
         or commercial_relevance ilike '%customer%'
         or topic ilike '%admission%'
         or topic ilike '%pricing%'
         or claim ilike '%Pain/%'
         or claim ilike '%Customer/intent%'
         or claim ilike '%price signal%'
       )
     order by retrieved_at desc
     limit $1`,
    [lim],
  );

  let upgraded = 0;
  for (const row of res.rows) {
    const claimId = String(row.id);
    const stem = String(row.claim).toLowerCase().replace(/\s+/g, " ").slice(0, 64);
    const hostOf = (u: string | null) => {
      try {
        return u ? new URL(u).hostname.replace(/^www\./, "") : "";
      } catch {
        return "";
      }
    };
    const selfHost = hostOf(row.source_url);

    const peers = await input.pool.query(
      `select id, source_url, source_type from titan_claims
       where id <> $1
         and lower(left(regexp_replace(claim, '\\s+', ' ', 'g'), 64)) = $2
       limit 12`,
      [claimId, stem],
    );

    const independentHosts = new Set<string>();
    const supporting: string[] = [];
    for (const p of peers.rows) {
      const h = hostOf(p.source_url);
      if (!h || h === selfHost) continue;
      // SEO mirror trap: same path-ish hosts often copy; still count distinct hosts.
      independentHosts.add(h);
      supporting.push(String(p.id));
    }

    let status = String(row.status);
    let method = "none";
    let confidence = 0.4;

    // Direct HTTP observation claims from our own probes can be SUPPORTED.
    if (/Observed price signal|Page discusses Admission/i.test(String(row.claim))) {
      // Low-value boilerplate — mark STALE rather than verify.
      status = "STALE";
      method = "boilerplate_demotion";
      confidence = 0.2;
    } else if (independentHosts.size >= 2) {
      status = "VERIFIED";
      method = "independent_multi_host_corroboration";
      confidence = 0.75;
      upgraded += 1;
    } else if (independentHosts.size === 1) {
      status = "SUPPORTED";
      method = "independent_single_host_corroboration";
      confidence = 0.6;
      upgraded += 1;
    } else if (peers.rows.length >= 1 && independentHosts.size === 0) {
      status = "SINGLE_SOURCE";
      method = "same_host_or_mirror_only — not verified";
      confidence = 0.35;
    }

    await input.pool.query(
      `update titan_claims set
         status=$2,
         evidence_quality=$2,
         verification_method=$3,
         supporting_source_ids=$4,
         confidence=$5,
         last_verified_at=now(),
         meta = coalesce(meta,'{}'::jsonb) || $6::jsonb
       where id=$1`,
      [
        claimId,
        status,
        method,
        supporting.slice(0, 8),
        confidence,
        JSON.stringify({
          verifiedAt: new Date().toISOString(),
          independentHosts: [...independentHosts],
        }),
      ],
    );
  }

  input.logger?.("info", "titan.claims.verify_batch", {
    examined: res.rows.length,
    upgraded,
  });
  return { examined: res.rows.length, upgraded };
}
