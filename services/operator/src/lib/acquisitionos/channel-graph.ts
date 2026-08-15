import { createHash, randomBytes } from "node:crypto";
import type pg from "pg";
import type {
  ChannelFamily,
  ChannelSurface,
  ExecutionClass,
  ExecutorType,
  SurfaceStatus,
} from "./types.js";

function eid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export function canonicalSurfaceKey(url: string, name?: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return createHash("sha256")
      .update(`${host}${path}|${(name ?? "").toLowerCase().trim()}`)
      .digest("hex")
      .slice(0, 24);
  } catch {
    return createHash("sha256")
      .update(String(url).toLowerCase())
      .digest("hex")
      .slice(0, 24);
  }
}

export async function upsertChannelSurface(
  pool: pg.Pool,
  surface: Omit<ChannelSurface, "channelSurfaceId"> & {
    channelSurfaceId?: string;
  },
): Promise<{ id: string; created: boolean }> {
  const canonical = canonicalSurfaceKey(surface.surfaceUrl, surface.surfaceName);
  const existing = await pool.query(
    `select channel_surface_id from aq_channel_surfaces where canonical_key=$1 limit 1`,
    [canonical],
  );
  if (existing.rows[0]?.channel_surface_id) {
    const id = String(existing.rows[0].channel_surface_id);
    await pool.query(
      `update aq_channel_surfaces set
         business_ids = (
           select array_agg(distinct x) from unnest(business_ids || $2::text[]) as x
         ),
         business_fit = greatest(business_fit, $3),
         commercial_intent = greatest(commercial_intent, $4),
         estimated_relevance = greatest(estimated_relevance, $5),
         confidence = greatest(confidence, $6),
         status = case when status in ('DEAD','PROHIBITED') then status else $7 end,
         updated_at = now(),
         meta = meta || $8::jsonb
       where channel_surface_id=$1`,
      [
        id,
        surface.businessIds,
        surface.businessFit,
        surface.commercialIntent,
        surface.estimatedRelevance,
        surface.confidence,
        surface.status,
        JSON.stringify(surface.meta ?? {}),
      ],
    );
    return { id, created: false };
  }

  const id = surface.channelSurfaceId ?? eid("surf");
  await pool.query(
    `insert into aq_channel_surfaces (
      channel_surface_id, channel_family, platform, surface_name, surface_url, canonical_key,
      audience, buyer_role, market, topic, business_fit, commercial_intent,
      estimated_reach, estimated_relevance, cost, account_required, credential_required,
      api_available, automation_allowed, manual_action_required, posting_allowed,
      promotion_allowed, link_allowed, rate_limits, platform_rules, risk,
      execution_class, executor_type, status, confidence, business_ids, meta
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32::jsonb
    )`,
    [
      id,
      surface.channelFamily,
      surface.platform,
      surface.surfaceName,
      surface.surfaceUrl,
      canonical,
      surface.audience,
      surface.buyerRole,
      surface.market,
      surface.topic,
      surface.businessFit,
      surface.commercialIntent,
      surface.estimatedReach,
      surface.estimatedRelevance,
      surface.cost,
      surface.accountRequired,
      surface.credentialRequired,
      surface.apiAvailable,
      surface.automationAllowed,
      surface.manualActionRequired,
      surface.postingAllowed,
      surface.promotionAllowed,
      surface.linkAllowed,
      surface.rateLimits,
      surface.platformRules,
      surface.risk,
      surface.executionClass,
      surface.executorType,
      surface.status,
      surface.confidence,
      surface.businessIds,
      JSON.stringify(surface.meta ?? {}),
    ],
  );
  return { id, created: true };
}

export async function linkBusinessSurface(
  pool: pg.Pool,
  businessId: string,
  surfaceId: string,
  fitScore: number,
  priority: number,
): Promise<void> {
  await pool.query(
    `insert into aq_business_surfaces (business_id, channel_surface_id, fit_score, priority, status, updated_at)
     values ($1,$2,$3,$4,'CANDIDATE',now())
     on conflict (business_id, channel_surface_id) do update set
       fit_score=greatest(aq_business_surfaces.fit_score, excluded.fit_score),
       priority=least(aq_business_surfaces.priority, excluded.priority),
       updated_at=now()`,
    [businessId, surfaceId, fitScore, priority],
  );
}

export async function bumpSurfaceAttempt(
  pool: pg.Pool,
  surfaceId: string,
  ok: boolean,
): Promise<void> {
  await pool.query(
    `update aq_channel_surfaces set
       attempt_count = attempt_count + 1,
       failure_count = failure_count + case when $2 then 0 else 1 end,
       last_used_at = now(),
       status = case
         when $2 then 'MEASURING'
         when failure_count + 1 >= 3 then 'WEAK'
         else status
       end,
       updated_at = now()
     where channel_surface_id=$1`,
    [surfaceId, ok],
  );
}

export async function channelUniverseStats(pool: pg.Pool): Promise<{
  total: number;
  byExecution: Record<string, number>;
  byFamily: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  const totalRes = await pool.query(
    `select count(*)::int as n from aq_channel_surfaces`,
  );
  const execRes = await pool.query(
    `select execution_class, count(*)::int as n from aq_channel_surfaces group by 1`,
  );
  const famRes = await pool.query(
    `select channel_family, count(*)::int as n from aq_channel_surfaces group by 1`,
  );
  const stRes = await pool.query(
    `select status, count(*)::int as n from aq_channel_surfaces group by 1`,
  );
  const byExecution: Record<string, number> = {};
  for (const r of execRes.rows) byExecution[String(r.execution_class)] = r.n;
  const byFamily: Record<string, number> = {};
  for (const r of famRes.rows) byFamily[String(r.channel_family)] = r.n;
  const byStatus: Record<string, number> = {};
  for (const r of stRes.rows) byStatus[String(r.status)] = r.n;
  return {
    total: Number(totalRes.rows[0]?.n ?? 0),
    byExecution,
    byFamily,
    byStatus,
  };
}

export async function listExecutableSurfaces(
  pool: pg.Pool,
  businessId: string,
  limit = 8,
): Promise<
  Array<{
    channelSurfaceId: string;
    surfaceName: string;
    surfaceUrl: string;
    channelFamily: ChannelFamily;
    executionClass: ExecutionClass;
    executorType: ExecutorType;
    status: SurfaceStatus;
    fitScore: number;
  }>
> {
  const res = await pool.query(
    `select s.channel_surface_id, s.surface_name, s.surface_url, s.channel_family,
            s.execution_class, s.executor_type, s.status, b.fit_score
     from aq_business_surfaces b
     join aq_channel_surfaces s on s.channel_surface_id = b.channel_surface_id
     where b.business_id=$1
       and s.status not in ('DEAD','PROHIBITED','PAUSED','BLOCKED')
       and s.execution_class = 'AUTO_EXECUTABLE'
       and (s.last_used_at is null or s.last_used_at < now() - interval '6 hours')
     order by b.fit_score desc, s.commercial_intent desc, b.priority asc
     limit $2`,
    [businessId, limit],
  );
  return res.rows.map((r) => ({
    channelSurfaceId: String(r.channel_surface_id),
    surfaceName: String(r.surface_name),
    surfaceUrl: String(r.surface_url),
    channelFamily: r.channel_family as ChannelFamily,
    executionClass: r.execution_class as ExecutionClass,
    executorType: r.executor_type as ExecutorType,
    status: r.status as SurfaceStatus,
    fitScore: Number(r.fit_score ?? 0),
  }));
}

export async function listHumanActionSurfaces(
  pool: pg.Pool,
  businessId: string,
  limit = 10,
): Promise<
  Array<{
    channelSurfaceId: string;
    surfaceName: string;
    surfaceUrl: string;
    platform: string;
    channelFamily: string;
    fitScore: number;
  }>
> {
  const res = await pool.query(
    `select s.channel_surface_id, s.surface_name, s.surface_url, s.platform,
            s.channel_family, b.fit_score
     from aq_business_surfaces b
     join aq_channel_surfaces s on s.channel_surface_id = b.channel_surface_id
     where b.business_id=$1
       and s.execution_class in ('HUMAN_ACTION_REQUIRED','OWNER_ACCOUNT_REQUIRED','CREDENTIAL_REQUIRED')
       and s.status not in ('DEAD','PROHIBITED')
     order by b.fit_score desc, s.commercial_intent desc
     limit $2`,
    [businessId, limit],
  );
  return res.rows.map((r) => ({
    channelSurfaceId: String(r.channel_surface_id),
    surfaceName: String(r.surface_name),
    surfaceUrl: String(r.surface_url),
    platform: String(r.platform),
    channelFamily: String(r.channel_family),
    fitScore: Number(r.fit_score ?? 0),
  }));
}
