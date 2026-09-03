/**
 * Organ 1 — WORLD MODEL.
 *
 * This is a facade over the real, already-populated tables:
 *   - titan_world_store       (business snapshots)
 *   - aq_channel_surfaces     (discovered surfaces)
 *   - aq_business_surfaces    (business seed surfaces)
 *   - ros_capability_registry (what we can do)
 *   - aq_distribution_receipts (external actions we attempted)
 *   - ros_traffic_events      (external results we observed)
 *
 * On top of that it maintains ros_world_facts — a time/source/confidence
 * structured layer that other organs query. Every fact carries an expiry
 * horizon so we know the difference between “learned yesterday” and
 * “assumed for six months”.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import type { Logger, WorldFact } from "./types.js";

function stableFactId(kind: string, entity: string, predicate: string): string {
  return `wf_${createHash("sha1").update(`${kind}|${entity}|${predicate}`).digest("hex").slice(0, 20)}`;
}

export type RecordFactInput = {
  entityKind: string;
  entityId: string;
  predicate: string;
  value: Record<string, unknown>;
  source: string;
  confidence?: number;
  ttlHours?: number;
  contradictedBy?: string | null;
};

export async function recordWorldFact(
  pool: pg.Pool,
  input: RecordFactInput,
): Promise<WorldFact> {
  const factId = stableFactId(input.entityKind, input.entityId, input.predicate);
  const ttlHours = input.ttlHours ?? 168; // one week default
  await pool.query(
    `insert into ros_world_facts
       (fact_id, entity_kind, entity_id, predicate, value, source,
        observed_at, last_verified_at, expires_at, confidence, contradicted_by)
     values ($1,$2,$3,$4,$5::jsonb,$6, now(), now(),
             now() + ($7::text || ' hours')::interval, $8, $9)
     on conflict (fact_id) do update set
       value=excluded.value,
       source=excluded.source,
       last_verified_at=now(),
       expires_at=excluded.expires_at,
       confidence=excluded.confidence,
       contradicted_by=excluded.contradicted_by,
       updated_at=now()`,
    [
      factId,
      input.entityKind,
      input.entityId,
      input.predicate,
      JSON.stringify(input.value),
      input.source,
      String(ttlHours),
      input.confidence ?? 0.6,
      input.contradictedBy ?? null,
    ],
  );
  return {
    factId,
    entityKind: input.entityKind,
    entityId: input.entityId,
    predicate: input.predicate,
    value: input.value,
    source: input.source,
    observedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
    confidence: input.confidence ?? 0.6,
    contradictedBy: input.contradictedBy ?? null,
    consumedBy: [],
  };
}

export async function markFactConsumed(
  pool: pg.Pool,
  factId: string,
  consumer: string,
): Promise<void> {
  await pool.query(
    `update ros_world_facts
        set consumed_by = case
                            when $2 = any(consumed_by) then consumed_by
                            else array_append(consumed_by, $2)
                          end,
            updated_at = now()
      where fact_id = $1`,
    [factId, consumer],
  );
}

export async function queryFacts(
  pool: pg.Pool,
  opts: {
    entityKind?: string;
    entityId?: string;
    predicate?: string;
    limit?: number;
    freshOnly?: boolean;
  },
): Promise<WorldFact[]> {
  const conds: string[] = [];
  const args: unknown[] = [];
  if (opts.entityKind) {
    args.push(opts.entityKind);
    conds.push(`entity_kind = $${args.length}`);
  }
  if (opts.entityId) {
    args.push(opts.entityId);
    conds.push(`entity_id = $${args.length}`);
  }
  if (opts.predicate) {
    args.push(opts.predicate);
    conds.push(`predicate = $${args.length}`);
  }
  if (opts.freshOnly) {
    conds.push(`(expires_at is null or expires_at > now())`);
  }
  const where = conds.length ? `where ${conds.join(" and ")}` : "";
  const limit = opts.limit ?? 50;
  const rows = await pool.query(
    `select fact_id, entity_kind, entity_id, predicate, value, source,
            observed_at, last_verified_at, expires_at, confidence,
            contradicted_by, consumed_by
       from ros_world_facts
       ${where}
       order by last_verified_at desc
       limit ${Number(limit)}`,
    args,
  );
  return rows.rows.map((r) => ({
    factId: r.fact_id,
    entityKind: r.entity_kind,
    entityId: r.entity_id,
    predicate: r.predicate,
    value: r.value ?? {},
    source: r.source,
    observedAt: r.observed_at?.toISOString?.() ?? String(r.observed_at),
    lastVerifiedAt: r.last_verified_at?.toISOString?.() ?? String(r.last_verified_at),
    expiresAt: r.expires_at ? (r.expires_at?.toISOString?.() ?? String(r.expires_at)) : null,
    confidence: Number(r.confidence ?? 0.5),
    contradictedBy: r.contradicted_by ?? null,
    consumedBy: (r.consumed_by ?? []) as string[],
  }));
}

/**
 * refreshWorldModel — one authoritative refresh that harvests facts from
 * the *actual* production tables (no simulation). This is the entry point
 * from other organs; it is safe/idempotent and cheap.
 */
export async function refreshWorldModel(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ facts: number }> {
  let facts = 0;

  // Businesses — active portfolio and their commercial state.
  const biz = await pool.query(
    `select b.site_id, b.status,
            coalesce((select count(*)::int from ros_traffic_events t
                        where t.business_id = b.site_id
                          and t.class in ('LIKELY_HUMAN','QUALIFIED')
                          and coalesce(t.referer,'') <> ''
                          and t.referer not ilike '%sslip.io%'
                          and t.created_at > now() - interval '7 days'), 0) as humans_7d,
            coalesce((select count(*)::int from aq_distribution_receipts r
                        where r.business_id = b.site_id
                          and r.created_at > now() - interval '7 days'), 0) as actions_7d
       from ros_businesses b
       where b.status in ('active','LAUNCHED','ACCEPTED','LIVE','LAUNCHING')
       limit 200`,
  );
  for (const r of biz.rows) {
    await recordWorldFact(pool, {
      entityKind: "business",
      entityId: String(r.site_id),
      predicate: "commercial_state",
      value: {
        status: r.status,
        humans7d: Number(r.humans_7d),
        actions7d: Number(r.actions_7d),
      },
      source: "titan_world_store+traffic",
      confidence: 0.9,
      ttlHours: 24,
    });
    facts++;
  }

  // Platform surfaces (from acquisition os) — top signal only.
  const surfaces = await pool.query(
    `select surface_url, channel_family, platform, audience, market, topic,
            coalesce(business_fit, 0.5)::float as fit,
            coalesce(commercial_intent, 0.5)::float as intent,
            coalesce(estimated_relevance, 0.5)::float as relevance,
            automation_allowed, posting_allowed
       from aq_channel_surfaces
      where surface_url is not null
      order by (coalesce(business_fit,0.5) + coalesce(commercial_intent,0.5)
                + coalesce(estimated_relevance,0.5)) desc
      limit 100`,
  );
  for (const s of surfaces.rows) {
    const q =
      (Number(s.fit) + Number(s.intent) + Number(s.relevance)) / 3;
    await recordWorldFact(pool, {
      entityKind: "platform_surface",
      entityId: String(s.surface_url),
      predicate: "distribution_candidate",
      value: {
        channelFamily: s.channel_family,
        platform: s.platform,
        audience: s.audience,
        market: s.market,
        topic: s.topic,
        qualityScore: q,
        automationAllowed: !!s.automation_allowed,
        postingAllowed: !!s.posting_allowed,
      },
      source: "aq_channel_surfaces",
      confidence: Math.min(0.95, q + 0.1),
      ttlHours: 72,
    });
    facts++;
  }

  // External actions we actually executed — key facts for attribution.
  const acts = await pool.query(
    `select action_id, status, external_destination, business_id,
            coalesce(request_result->>'resendId','') as resend_id,
            coalesce(request_result->>'marker','') as marker,
            created_at
       from aq_distribution_receipts
      where created_at > now() - interval '14 days'
      order by created_at desc
      limit 100`,
  );
  for (const a of acts.rows) {
    await recordWorldFact(pool, {
      entityKind: "external_action",
      entityId: String(a.action_id),
      predicate: "attempt_result",
      value: {
        status: a.status,
        destination: a.external_destination,
        business: a.business_id,
        resendId: a.resend_id || null,
        marker: a.marker || null,
        createdAt: a.created_at?.toISOString?.() ?? String(a.created_at),
      },
      source: "aq_distribution_receipts",
      confidence: 0.98,
      ttlHours: 720, // one month — receipts don't rot
    });
    facts++;
  }

  // Capability truth — what the registry says we can actually do.
  const caps = await pool.query(
    `select capability_id, name, domain, state, autonomous, authenticated,
            owner_authority, live_evidence, failure_point, updated_at
       from ros_capability_registry
      order by updated_at desc
      limit 100`,
  );
  for (const c of caps.rows) {
    await recordWorldFact(pool, {
      entityKind: "capability",
      entityId: String(c.capability_id),
      predicate: "registry_state",
      value: {
        name: c.name,
        domain: c.domain,
        state: c.state,
        autonomous: c.autonomous,
        authenticated: c.authenticated,
        ownerAuthority: c.owner_authority,
        liveEvidence: c.live_evidence,
        failurePoint: c.failure_point,
      },
      source: "ros_capability_registry",
      confidence: 0.95,
      ttlHours: 48,
    });
    facts++;
  }

  logger("info", "ultron.world_model.refresh", { facts });
  return { facts };
}

/**
 * Compute the number of *stale* facts — a health metric consumed by the
 * closed-loop watcher.
 */
export async function staleFactCount(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `select count(*)::int as n from ros_world_facts
       where expires_at is not null and expires_at < now()`,
  );
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * Compute the number of facts never consumed by any downstream subsystem
 * (dangling knowledge). This becomes a defect if it grows unbounded.
 */
export async function danglingFactCount(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `select count(*)::int as n from ros_world_facts
       where cardinality(consumed_by) = 0
         and observed_at < now() - interval '6 hours'`,
  );
  return Number(r.rows[0]?.n ?? 0);
}
