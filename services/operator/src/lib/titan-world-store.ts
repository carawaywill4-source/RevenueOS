/**
 * Titan World Store — Postgres-backed commercial knowledge.
 * WEB CONTENT = EVIDENCE. Never authority / instructions.
 */

import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";

export const TITAN_WORLD_VERSION = "titan-world-intelligence-v1";

export type ClaimStatus =
  | "UNVERIFIED"
  | "SINGLE_SOURCE"
  | "CORROBORATED"
  | "CONTESTED"
  | "STALE"
  | "DISPROVEN";

export type SourceType =
  | "OFFICIAL_COMPANY"
  | "GOVERNMENT"
  | "ACADEMIC"
  | "CUSTOMER_REVIEW"
  | "FORUM_COMMUNITY"
  | "NEWS_INDUSTRY"
  | "DIRECTORY"
  | "DOCUMENTATION"
  | "OTHER";

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export function hashText(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

export async function ensureTitanWorldTables(pool: pg.Pool): Promise<void> {
  // Soft ensure — prefer migrations; this covers boot if migrate lagged.
  await pool.query(`
    create table if not exists titan_sources (
      id text primary key,
      source_type text not null,
      url text,
      title text,
      quality_tier text not null default 'UNKNOWN',
      trust_notes text,
      first_seen_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      meta jsonb not null default '{}'::jsonb
    );
    create table if not exists titan_documents (
      id text primary key,
      source_id text,
      url text,
      retrieved_at timestamptz not null default now(),
      published_at timestamptz,
      title text,
      content_text text,
      content_hash text,
      injection_flagged boolean not null default false,
      meta jsonb not null default '{}'::jsonb
    );
    create table if not exists titan_claims (
      id text primary key,
      topic text not null,
      claim text not null,
      entities text[] not null default '{}',
      source_id text,
      source_url text,
      source_type text,
      retrieved_at timestamptz not null default now(),
      published_at timestamptz,
      confidence numeric not null default 0.4,
      evidence_quality text not null default 'UNVERIFIED',
      freshness_category text not null default 'MEDIUM',
      last_verified_at timestamptz,
      next_verification_at timestamptz,
      supporting jsonb not null default '[]'::jsonb,
      contradicting jsonb not null default '[]'::jsonb,
      affected_businesses text[] not null default '{}',
      commercial_relevance text,
      status text not null default 'UNVERIFIED',
      meta jsonb not null default '{}'::jsonb
    );
    create table if not exists titan_research_runs (
      id text primary key,
      question text not null,
      business_id text,
      purpose text not null,
      status text not null default 'RUNNING',
      plan jsonb not null default '{}'::jsonb,
      sources_inspected int not null default 0,
      useful_sources int not null default 0,
      claims_created int not null default 0,
      started_at timestamptz not null default now(),
      finished_at timestamptz,
      result_summary text,
      meta jsonb not null default '{}'::jsonb
    );
    create table if not exists titan_evidence_packs (
      id text primary key,
      business_id text not null,
      purpose text not null,
      created_at timestamptz not null default now(),
      decision_hint text,
      pack jsonb not null,
      claim_ids text[] not null default '{}',
      research_run_id text
    );
    create table if not exists titan_customer_models (
      id text primary key,
      business_id text not null,
      document jsonb not null,
      updated_at timestamptz not null default now()
    );
    create unique index if not exists titan_customer_models_biz_uidx
      on titan_customer_models (business_id);
    create table if not exists titan_commercial_lessons (
      id text primary key,
      scope text not null,
      lesson text not null,
      evidence jsonb not null default '[]'::jsonb,
      business_ids text[] not null default '{}',
      confidence numeric not null default 0.5,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists titan_acquisition_experiments (
      id text primary key,
      business_id text not null,
      hypothesis text not null,
      action text not null,
      channel text,
      status text not null default 'PLANNED',
      started_at timestamptz,
      measured_at timestamptz,
      metrics jsonb not null default '{}'::jsonb,
      result text,
      lesson_id text,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create table if not exists titan_business_money_models (
      business_id text primary key,
      daily_target_usd numeric not null default 10000,
      document jsonb not null,
      updated_at timestamptz not null default now()
    );
    create table if not exists titan_freshness_queue (
      id text primary key,
      claim_id text,
      topic text,
      reason text not null,
      due_at timestamptz not null,
      status text not null default 'QUEUED',
      meta jsonb not null default '{}'::jsonb
    );
    create table if not exists titan_contradictions (
      id text primary key,
      topic text not null,
      claim_a text not null,
      claim_b text not null,
      status text not null default 'OPEN',
      notes text,
      created_at timestamptz not null default now()
    );
    create table if not exists titan_entities (
      id text primary key,
      kind text not null,
      name text not null,
      aliases text[] not null default '{}',
      attributes jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);
}

export async function upsertSource(
  pool: pg.Pool,
  input: {
    url?: string;
    title?: string;
    sourceType: SourceType;
    qualityTier?: string;
    trustNotes?: string;
  },
): Promise<string> {
  const existing = input.url
    ? await pool.query(`select id from titan_sources where url=$1 limit 1`, [
        input.url,
      ])
    : { rows: [] as Array<{ id: string }> };
  if (existing.rows[0]?.id) {
    await pool.query(
      `update titan_sources set last_seen_at=now(), title=coalesce($2,title) where id=$1`,
      [existing.rows[0].id, input.title ?? null],
    );
    return existing.rows[0].id;
  }
  const sid = id("tsrc");
  await pool.query(
    `insert into titan_sources (id, source_type, url, title, quality_tier, trust_notes)
     values ($1,$2,$3,$4,$5,$6)`,
    [
      sid,
      input.sourceType,
      input.url ?? null,
      input.title ?? null,
      input.qualityTier ?? "UNKNOWN",
      input.trustNotes ?? null,
    ],
  );
  return sid;
}

export async function insertDocument(
  pool: pg.Pool,
  input: {
    sourceId?: string;
    url?: string;
    title?: string;
    contentText: string;
    injectionFlagged: boolean;
  },
): Promise<string> {
  const did = id("tdoc");
  await pool.query(
    `insert into titan_documents
     (id, source_id, url, title, content_text, content_hash, injection_flagged)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      did,
      input.sourceId ?? null,
      input.url ?? null,
      input.title ?? null,
      input.contentText.slice(0, 50_000),
      hashText(input.contentText),
      input.injectionFlagged,
    ],
  );
  return did;
}

export async function insertClaim(
  pool: pg.Pool,
  input: {
    topic: string;
    claim: string;
    entities?: string[];
    sourceId?: string;
    sourceUrl?: string;
    sourceType?: string;
    confidence?: number;
    freshness?: string;
    affectedBusinesses?: string[];
    commercialRelevance?: string;
    status?: ClaimStatus;
  },
): Promise<string> {
  const claimText = input.claim.slice(0, 2000);
  // Near-duplicate suppression: reuse existing row instead of growing noise.
  const dup = await pool.query(
    `select id from titan_claims
     where claim = $1
        or left(lower(regexp_replace(claim, '\\s+', ' ', 'g')), 96)
         = left(lower(regexp_replace($1, '\\s+', ' ', 'g')), 96)
     order by retrieved_at desc limit 1`,
    [claimText],
  );
  if (dup.rows[0]?.id) {
    const existingId = String(dup.rows[0].id);
    await pool.query(
      `update titan_claims set
         last_verified_at = coalesce(last_verified_at, now()),
         affected_businesses = (
           select array_agg(distinct x) from unnest(
             coalesce(affected_businesses,'{}'::text[]) || $2::text[]
           ) as x
         ),
         meta = coalesce(meta,'{}'::jsonb) || '{"deduped":true}'::jsonb
       where id=$1`,
      [existingId, input.affectedBusinesses ?? []],
    );
    return existingId;
  }

  const cid = id("tclaim");
  const freshness = input.freshness ?? "MEDIUM";
  const nextVerify = freshnessDue(freshness);
  await pool.query(
    `insert into titan_claims
     (id, topic, claim, entities, source_id, source_url, source_type, confidence,
      evidence_quality, freshness_category, last_verified_at, next_verification_at,
      affected_businesses, commercial_relevance, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11,$12,$13,$14)`,
    [
      cid,
      input.topic,
      claimText,
      input.entities ?? [],
      input.sourceId ?? null,
      input.sourceUrl ?? null,
      input.sourceType ?? null,
      input.confidence ?? 0.45,
      input.status ?? "UNVERIFIED",
      freshness,
      nextVerify,
      input.affectedBusinesses ?? [],
      input.commercialRelevance ?? null,
      input.status ?? "UNVERIFIED",
    ],
  );
  return cid;
}

function freshnessDue(category: string): Date {
  const days =
    category === "VERY_SHORT"
      ? 1
      : category === "SHORT"
        ? 7
        : category === "MEDIUM"
          ? 30
          : category === "LONG"
            ? 180
            : 30;
  return new Date(Date.now() + days * 86_400_000);
}

export async function startResearchRun(
  pool: pg.Pool,
  input: {
    question: string;
    businessId?: string;
    purpose: string;
    plan?: Record<string, unknown>;
  },
): Promise<string> {
  const rid = id("trun");
  await pool.query(
    `insert into titan_research_runs (id, question, business_id, purpose, plan)
     values ($1,$2,$3,$4,$5::jsonb)`,
    [
      rid,
      input.question,
      input.businessId ?? null,
      input.purpose,
      JSON.stringify(input.plan ?? {}),
    ],
  );
  return rid;
}

export async function finishResearchRun(
  pool: pg.Pool,
  runId: string,
  input: {
    status: "COMPLETED" | "FAILED" | "BUDGET_STOPPED";
    sourcesInspected: number;
    usefulSources: number;
    claimsCreated: number;
    resultSummary: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `update titan_research_runs set
       status=$2, sources_inspected=$3, useful_sources=$4, claims_created=$5,
       result_summary=$6, finished_at=now(), meta=coalesce(meta,'{}'::jsonb)||$7::jsonb
     where id=$1`,
    [
      runId,
      input.status,
      input.sourcesInspected,
      input.usefulSources,
      input.claimsCreated,
      input.resultSummary.slice(0, 4000),
      JSON.stringify(input.meta ?? {}),
    ],
  );
}

export async function saveEvidencePack(
  pool: pg.Pool,
  input: {
    businessId: string;
    purpose: string;
    decisionHint?: string;
    pack: Record<string, unknown>;
    claimIds?: string[];
    researchRunId?: string;
  },
): Promise<string> {
  const eid = id("tepack");
  await pool.query(
    `insert into titan_evidence_packs
     (id, business_id, purpose, decision_hint, pack, claim_ids, research_run_id)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [
      eid,
      input.businessId,
      input.purpose,
      input.decisionHint ?? null,
      JSON.stringify(input.pack),
      input.claimIds ?? [],
      input.researchRunId ?? null,
    ],
  );
  return eid;
}

export async function loadLatestEvidencePack(
  pool: pg.Pool,
  businessId: string,
  purpose?: string,
): Promise<Record<string, unknown> | null> {
  const res = purpose
    ? await pool.query(
        `select pack, decision_hint, created_at, id from titan_evidence_packs
         where business_id=$1 and purpose=$2 order by created_at desc limit 1`,
        [businessId, purpose],
      )
    : await pool.query(
        `select pack, decision_hint, created_at, id from titan_evidence_packs
         where business_id=$1 order by created_at desc limit 1`,
        [businessId],
      );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    decisionHint: row.decision_hint,
    createdAt: row.created_at,
    ...(row.pack as Record<string, unknown>),
  };
}

export async function upsertCustomerModel(
  pool: pg.Pool,
  businessId: string,
  document: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `insert into titan_customer_models (id, business_id, document, updated_at)
     values ($1,$2,$3::jsonb,now())
     on conflict (business_id) do update set
       document=excluded.document, updated_at=now()`,
    [id("tcust"), businessId, JSON.stringify(document)],
  );
}

export async function loadCustomerModel(
  pool: pg.Pool,
  businessId: string,
): Promise<Record<string, unknown> | null> {
  const res = await pool.query(
    `select document from titan_customer_models where business_id=$1 limit 1`,
    [businessId],
  );
  return (res.rows[0]?.document as Record<string, unknown>) ?? null;
}

export async function loadMoneyModel(
  pool: pg.Pool,
  businessId: string,
): Promise<Record<string, unknown> | null> {
  const res = await pool.query(
    `select daily_target_usd, document from titan_business_money_models where business_id=$1 limit 1`,
    [businessId],
  );
  const row = res.rows[0];
  if (!row) return null;
  const doc = (row.document as Record<string, unknown>) ?? {};
  return {
    ...doc,
    daily_target: doc.daily_target ?? Number(row.daily_target_usd) ?? 10000,
  };
}

export async function loadLatestAcquisitionExperiment(
  pool: pg.Pool,
  businessId: string,
): Promise<Record<string, unknown> | null> {
  const res = await pool.query(
    `select id, hypothesis, action, channel, status, metrics, result, created_at
     from titan_acquisition_experiments
     where business_id=$1 order by created_at desc limit 1`,
    [businessId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    hypothesis: row.hypothesis,
    action: row.action,
    channel: row.channel,
    status: row.status,
    metrics: row.metrics,
    result: row.result,
    createdAt: row.created_at,
  };
}

export async function upsertMoneyModel(
  pool: pg.Pool,
  businessId: string,
  document: Record<string, unknown>,
): Promise<void> {
  // Merge — never wipe measured purchases/revenue with acquisition probe updates.
  const prevRes = await pool.query(
    `select document from titan_business_money_models where business_id=$1 limit 1`,
    [businessId],
  );
  const prev = (prevRes.rows[0]?.document as Record<string, unknown>) ?? {};
  const preserveKeys = [
    "purchases",
    "revenueUsd",
    "checkoutStarts",
    "countedSessionIds",
    "lastPurchaseAt",
    "lastPurchaseSessionId",
    "confidence",
  ] as const;
  const merged: Record<string, unknown> = { ...prev, ...document };
  for (const k of preserveKeys) {
    if (document[k] === undefined && prev[k] !== undefined) {
      merged[k] = prev[k];
    }
  }
  // Prefer higher measured purchase counts when both present.
  if (
    typeof prev.purchases === "number" &&
    typeof document.purchases === "number"
  ) {
    merged.purchases = Math.max(prev.purchases, document.purchases);
  }
  if (
    typeof prev.revenueUsd === "number" &&
    typeof document.revenueUsd === "number"
  ) {
    merged.revenueUsd = Math.max(prev.revenueUsd, document.revenueUsd);
  }
  await pool.query(
    `insert into titan_business_money_models (business_id, daily_target_usd, document, updated_at)
     values ($1,10000,$2::jsonb,now())
     on conflict (business_id) do update set
       document=excluded.document, updated_at=now()`,
    [businessId, JSON.stringify(merged)],
  );
}

export async function saveAcquisitionExperiment(
  pool: pg.Pool,
  input: {
    businessId: string;
    hypothesis: string;
    action: string;
    channel?: string;
    status?: string;
    metrics?: Record<string, unknown>;
    result?: string;
    meta?: Record<string, unknown>;
  },
): Promise<string> {
  const eid = id("tacq");
  await pool.query(
    `insert into titan_acquisition_experiments
     (id, business_id, hypothesis, action, channel, status, started_at, metrics, result, meta)
     values ($1,$2,$3,$4,$5,$6,now(),$7::jsonb,$8,$9::jsonb)`,
    [
      eid,
      input.businessId,
      input.hypothesis,
      input.action,
      input.channel ?? null,
      input.status ?? "RUNNING",
      JSON.stringify(input.metrics ?? {}),
      input.result ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  return eid;
}

export async function completeAcquisitionExperiment(
  pool: pg.Pool,
  experimentId: string,
  input: {
    status: string;
    metrics?: Record<string, unknown>;
    result?: string;
  },
): Promise<void> {
  await pool.query(
    `update titan_acquisition_experiments set
       status=$2, measured_at=now(),
       metrics=coalesce(metrics,'{}'::jsonb)||$3::jsonb,
       result=$4
     where id=$1`,
    [
      experimentId,
      input.status,
      JSON.stringify(input.metrics ?? {}),
      input.result ?? null,
    ],
  );
}

export async function saveCommercialLesson(
  pool: pg.Pool,
  input: {
    scope: string;
    lesson: string;
    businessIds?: string[];
    confidence?: number;
    evidence?: unknown[];
  },
): Promise<string> {
  const lid = id("tlesson");
  await pool.query(
    `insert into titan_commercial_lessons
     (id, scope, lesson, evidence, business_ids, confidence)
     values ($1,$2,$3,$4::jsonb,$5,$6)`,
    [
      lid,
      input.scope,
      input.lesson,
      JSON.stringify(input.evidence ?? []),
      input.businessIds ?? [],
      input.confidence ?? 0.55,
    ],
  );
  return lid;
}

export async function queryClaims(
  pool: pg.Pool,
  input: { topic?: string; businessId?: string; limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const lim = input.limit ?? 20;
  if (input.businessId) {
    const res = await pool.query(
      `select id, topic, claim, status, confidence, source_url, commercial_relevance, retrieved_at
       from titan_claims
       where $1 = any(affected_businesses) or topic ilike '%'||$1||'%'
       order by retrieved_at desc limit $2`,
      [input.businessId, lim],
    );
    return res.rows;
  }
  if (input.topic) {
    const res = await pool.query(
      `select id, topic, claim, status, confidence, source_url, commercial_relevance, retrieved_at
       from titan_claims
       where topic ilike '%'||$1||'%' or to_tsvector('english', claim) @@ plainto_tsquery('english', $1)
       order by retrieved_at desc limit $2`,
      [input.topic, lim],
    );
    return res.rows;
  }
  const res = await pool.query(
    `select id, topic, claim, status, confidence, source_url, retrieved_at
     from titan_claims order by retrieved_at desc limit $1`,
    [lim],
  );
  return res.rows;
}

export async function worldModelStats(
  pool: pg.Pool,
): Promise<Record<string, number | string | null>> {
  const q = async (sql: string) => {
    const r = await pool.query(sql);
    return Number(r.rows[0]?.n ?? 0);
  };
  const latest = await pool.query(
    `select question, business_id, status, result_summary, started_at
     from titan_research_runs order by started_at desc limit 1`,
  );
  return {
    sources: await q(`select count(*)::int as n from titan_sources`),
    documents: await q(`select count(*)::int as n from titan_documents`),
    claims: await q(`select count(*)::int as n from titan_claims`),
    researchRuns: await q(`select count(*)::int as n from titan_research_runs`),
    evidencePacks: await q(`select count(*)::int as n from titan_evidence_packs`),
    customerModels: await q(
      `select count(*)::int as n from titan_customer_models`,
    ),
    lessons: await q(`select count(*)::int as n from titan_commercial_lessons`),
    acquisitionExperiments: await q(
      `select count(*)::int as n from titan_acquisition_experiments`,
    ),
    latestResearchQuestion: latest.rows[0]?.question ?? null,
    latestResearchBusiness: latest.rows[0]?.business_id ?? null,
    latestResearchStatus: latest.rows[0]?.status ?? null,
    latestResearchSummary: latest.rows[0]?.result_summary ?? null,
  };
}

export async function corroborateSimilarClaims(
  pool: pg.Pool,
  topic: string,
  claimText: string,
): Promise<{ status: ClaimStatus; peers: number }> {
  const res = await pool.query(
    `select id, claim, source_url from titan_claims
     where topic=$1 and retrieved_at > now() - interval '90 days'
     limit 40`,
    [topic],
  );
  const stem = claimText.toLowerCase().slice(0, 48);
  const peers = res.rows.filter((r) =>
    String(r.claim).toLowerCase().includes(stem.slice(0, 24)),
  );
  const hosts = new Set<string>();
  for (const p of peers) {
    try {
      if (p.source_url) {
        hosts.add(new URL(String(p.source_url)).hostname.replace(/^www\./, ""));
      }
    } catch {
      /* ignore */
    }
  }
  // Independence required — two copied SEO pages on related hosts ≠ verified truth.
  if (hosts.size >= 2) return { status: "CORROBORATED", peers: peers.length };
  if (peers.length >= 1) return { status: "SINGLE_SOURCE", peers: peers.length };
  return { status: "UNVERIFIED", peers: 0 };
}
