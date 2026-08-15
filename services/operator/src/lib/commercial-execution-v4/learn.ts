/**
 * Channel × business memory. Profit is the scoreboard.
 * A host that sells for construction is not automatically used for resumes.
 * A host that sold nothing after the wait is not retried for that pair.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import { ensureCommercialExecutionSchema } from "./schema.js";
import { GUMROAD_LIVE, utmKeyForHost } from "./offer.js";

export const JUDGE_AFTER_MINUTES = 90;
export const EXPLORE_RATE = 0.18;

export const BUSINESS_FAMILY: Record<string, string> = {
  buildgrid: "construction",
  quotecraft: "construction",
  invoicechaser: "billing",
  listinglift: "ecommerce_sellers",
  guestlane: "short_term_rental",
  raiseready: "career",
  resumeforge: "career",
  launchcopy: "launch",
  locallaunch: "local_promo",
  depositproof: "housing",
};

export type ChannelVerdict =
  | "UNTRIED"
  | "WAITING"
  | "WORKS"
  | "WRONG_FIT"
  | "DEAD";

export type ChannelMemory = {
  host: string;
  businessId: string;
  family: string;
  listedAt: Date | null;
  attempts: number;
  humans: number;
  checkouts: number;
  purchases: number;
  revenueUsd: number;
  lastResult: string;
  verdict: ChannelVerdict;
  score: number;
  reason: string;
};

export type Placement = {
  businessId: string;
  host: string | null;
  reason: string;
  verdict: ChannelVerdict;
};

export function familyOf(businessId: string): string {
  return BUSINESS_FAMILY[businessId] || "general";
}

export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.slice(0, 80).toLowerCase();
  }
}

export function channelScore(row: {
  verdict: ChannelVerdict;
  purchases: number;
  revenueUsd: number;
  checkouts: number;
  humans: number;
  attempts: number;
}): number {
  if (row.verdict === "DEAD") return -1000;
  if (row.verdict === "WRONG_FIT") return -40;
  if (row.verdict === "WAITING") return -5;
  return (
    row.purchases * 1000 +
    row.revenueUsd * 12 +
    row.checkouts * 80 +
    row.humans * 20 +
    (row.verdict === "UNTRIED" ? 8 : 0) -
    row.attempts * 0.4
  );
}

export function judgePair(input: {
  listedAt: Date | null;
  humans: number;
  checkouts: number;
  purchases: number;
  revenueUsd: number;
  lastResult: string;
  now?: Date;
  familyHasWorksOnHost?: boolean;
}): { verdict: ChannelVerdict; reason: string } {
  if (/captcha|kyc|phone|http_409|http_403|http_401|automation_prohibited/.test(input.lastResult)) {
    return { verdict: "DEAD", reason: "blocked_or_rejected" };
  }
  if (input.purchases > 0 || input.revenueUsd > 0) {
    return { verdict: "WORKS", reason: "attributed_purchase" };
  }
  if (input.checkouts > 0) {
    return { verdict: "WORKS", reason: "attributed_checkout" };
  }
  if (input.humans > 0) {
    return { verdict: "WORKS", reason: "attributed_human_traffic" };
  }
  if (!input.listedAt) {
    return { verdict: "UNTRIED", reason: "never_listed" };
  }
  const now = input.now ?? new Date();
  const waitedMin = (now.getTime() - input.listedAt.getTime()) / 60_000;
  if (waitedMin < JUDGE_AFTER_MINUTES) {
    return { verdict: "WAITING", reason: `waiting_${Math.floor(waitedMin)}m` };
  }
  if (input.familyHasWorksOnHost) {
    return { verdict: "WRONG_FIT", reason: "host_works_for_other_family_not_this_product" };
  }
  return { verdict: "DEAD", reason: "no_humans_no_revenue_after_wait" };
}

export function pickPlacement(input: {
  businesses: string[];
  hosts: string[];
  memory: ChannelMemory[];
  explore?: boolean;
}): Placement {
  const businesses = input.businesses.length ? input.businesses : ["buildgrid"];
  const mem = input.memory;
  const byPair = new Map(mem.map((m) => [`${m.host}|${m.businessId}`, m]));

  const hostDead = new Set<string>();
  const hostWorksFamily = new Map<string, Set<string>>();
  for (const m of mem) {
    if (m.verdict === "DEAD" && /blocked|captcha|409|403/.test(m.reason + m.lastResult)) {
      hostDead.add(m.host);
    }
    if (m.verdict === "WORKS") {
      const set = hostWorksFamily.get(m.host) ?? new Set();
      set.add(m.family);
      hostWorksFamily.set(m.host, set);
    }
  }
  for (const host of new Set(mem.map((m) => m.host))) {
    const familiesDead = new Set(
      mem.filter((m) => m.host === host && m.verdict === "DEAD").map((m) => m.family),
    );
    if (familiesDead.size >= 3) hostDead.add(host);
  }

  const liveHosts = input.hosts.filter(
    (h) => h && !hostDead.has(h) && !/comodo\.com|recaptcha|hcaptcha/i.test(h),
  );

  const transfer: Placement[] = [];
  for (const host of liveHosts) {
    const winningFamilies = hostWorksFamily.get(host);
    if (!winningFamilies) continue;
    for (const businessId of businesses) {
      const fam = familyOf(businessId);
      if (!winningFamilies.has(fam)) continue;
      const row = byPair.get(`${host}|${businessId}`);
      if (!row || row.verdict === "UNTRIED") {
        transfer.push({
          businessId,
          host,
          reason: `clone_works_${fam}_on_${host}`,
          verdict: "UNTRIED",
        });
      }
    }
  }
  if (transfer.length) return transfer[0]!;

  const reuse = mem
    .filter((m) => m.verdict === "WORKS" && businesses.includes(m.businessId) && !hostDead.has(m.host))
    .filter((m) => !m.listedAt || Date.now() - m.listedAt.getTime() > 7 * 24 * 60 * 60 * 1000)
    .sort((a, b) => b.score - a.score)[0];
  if (reuse) {
    return {
      businessId: reuse.businessId,
      host: reuse.host,
      reason: `double_down_${reuse.host}`,
      verdict: "WORKS",
    };
  }

  for (const m of mem.filter((m) => m.verdict === "WRONG_FIT" && !hostDead.has(m.host))) {
    const other = businesses.find((b) => familyOf(b) !== m.family && !byPair.has(`${m.host}|${b}`));
    if (other) {
      return {
        businessId: other,
        host: m.host,
        reason: `host_sucked_for_${m.businessId}_try_${other}`,
        verdict: "UNTRIED",
      };
    }
  }

  const explore = input.explore !== false && Math.random() < EXPLORE_RATE;
  const waiting = new Set(
    mem.filter((m) => m.verdict === "WAITING").map((m) => `${m.host}|${m.businessId}`),
  );
  const untriedHosts = liveHosts.filter((h) =>
    businesses.some((b) => {
      const row = byPair.get(`${h}|${b}`);
      return !row || row.verdict === "UNTRIED";
    }),
  );
  if (untriedHosts.length && (explore || !reuse)) {
    const counts = new Map<string, number>();
    for (const b of businesses) {
      counts.set(
        b,
        mem.filter((m) => m.businessId === b && (m.verdict === "WAITING" || m.verdict === "WORKS")).length,
      );
    }
    businesses.sort((a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0));
    const businessId = businesses[0]!;
    const host =
      untriedHosts.find((h) => {
        const row = byPair.get(`${h}|${businessId}`);
        return (!row || row.verdict === "UNTRIED") && !waiting.has(`${h}|${businessId}`);
      }) ?? untriedHosts[0]!;
    return {
      businessId,
      host,
      reason: explore ? `explore_${host}` : `next_untried_${host}`,
      verdict: "UNTRIED",
    };
  }

  return {
    businessId: businesses[0]!,
    host: liveHosts[0] ?? null,
    reason: "fallback_first_live_host",
    verdict: "UNTRIED",
  };
}

function memoryId(host: string, businessId: string): string {
  return `cm_${createHash("sha1").update(`${host}|${businessId}`).digest("hex").slice(0, 18)}`;
}

export async function recordChannelEvent(
  pool: pg.Pool,
  input: {
    urlOrHost: string;
    businessId: string;
    result: string;
    listed: boolean;
  },
): Promise<void> {
  await ensureCommercialExecutionSchema(pool);
  const host = input.urlOrHost.includes("://") ? hostOfUrl(input.urlOrHost) : input.urlOrHost;
  if (!host) return;
  const family = familyOf(input.businessId);
  const judged = judgePair({
    listedAt: input.listed ? new Date() : null,
    humans: 0,
    checkouts: 0,
    purchases: 0,
    revenueUsd: 0,
    lastResult: input.result,
  });
  const score = channelScore({
    verdict: judged.verdict,
    purchases: 0,
    revenueUsd: 0,
    checkouts: 0,
    humans: 0,
    attempts: 1,
  });
  await pool.query(
    `insert into ros_channel_memory (
       id, host, business_id, family, utm_key, listed_at, last_result,
       attempts, humans, checkouts, purchases, revenue_usd, verdict, score, reason, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,1,0,0,0,0,$8,$9,$10, now())
     on conflict (host, business_id) do update set
       attempts=ros_channel_memory.attempts+1,
       last_result=excluded.last_result,
       listed_at=coalesce(ros_channel_memory.listed_at, excluded.listed_at),
       verdict=case
         when ros_channel_memory.verdict in ('WORKS') then ros_channel_memory.verdict
         when excluded.verdict='DEAD' then 'DEAD'
         else ros_channel_memory.verdict
       end,
       reason=excluded.reason,
       score=excluded.score,
       updated_at=now()`,
    [
      memoryId(host, input.businessId),
      host,
      input.businessId,
      family,
      utmKeyForHost(host),
      input.listed ? new Date() : null,
      input.result.slice(0, 180),
      judged.verdict,
      score,
      judged.reason,
    ],
  );
}

export async function refreshChannelMemory(pool: pg.Pool): Promise<{ pairs: number; works: number; dead: number }> {
  await ensureCommercialExecutionSchema(pool);
  await pool.query(
    `update ros_channel_memory m set
       humans = coalesce((
         select count(*)::int from ros_traffic_events t
          where t.business_id = m.business_id
            and t.class in ('VERIFIED_HUMAN_SIGNAL','LIKELY_HUMAN')
            and t.created_at >= coalesce(m.listed_at, t.created_at)
            and (
              coalesce(t.referer,'') ilike '%'||m.host||'%'
              or coalesce(t.path,'') ilike '%'||m.utm_key||'%'
              or coalesce(t.meta->>'url','') ilike '%'||m.utm_key||'%'
            )
       ), 0),
       updated_at=now()
     where m.listed_at is not null`,
  ).catch(() => undefined);

  await pool.query(
    `update ros_channel_memory m set
       purchases = coalesce((
         select count(*)::int from ros_purchases p
          where p.business_id = m.business_id
            and p.created_at >= coalesce(m.listed_at, p.created_at)
            and (
              coalesce(p.acquisition_channel,'') ilike '%'||m.host||'%'
              or coalesce(p.host,'') ilike '%'||m.host||'%'
              or coalesce(p.meta->>'utm_source','') ilike '%'||m.utm_key||'%'
            )
       ), m.purchases),
       revenue_usd = coalesce((
         select sum(coalesce(p.amount_cents,0)) / 100.0 from ros_purchases p
          where p.business_id = m.business_id
            and p.created_at >= coalesce(m.listed_at, p.created_at)
            and (
              coalesce(p.acquisition_channel,'') ilike '%'||m.host||'%'
              or coalesce(p.host,'') ilike '%'||m.host||'%'
              or coalesce(p.meta->>'utm_source','') ilike '%'||m.utm_key||'%'
            )
       ), m.revenue_usd)
     where m.listed_at is not null`,
  ).catch(() => undefined);

  const rows = await pool.query(
    `select host, business_id, family, listed_at, attempts, humans, checkouts,
            purchases, revenue_usd, last_result, verdict
       from ros_channel_memory`,
  );
  const worksByHost = new Map<string, Set<string>>();
  for (const r of rows.rows) {
    if (Number(r.purchases) > 0 || Number(r.humans) > 0) {
      const set = worksByHost.get(String(r.host)) ?? new Set();
      set.add(String(r.family));
      worksByHost.set(String(r.host), set);
    }
  }
  let works = 0;
  let dead = 0;
  for (const r of rows.rows) {
    const host = String(r.host);
    const family = String(r.family);
    const judged = judgePair({
      listedAt: r.listed_at ? new Date(r.listed_at) : null,
      humans: Number(r.humans ?? 0),
      checkouts: Number(r.checkouts ?? 0),
      purchases: Number(r.purchases ?? 0),
      revenueUsd: Number(r.revenue_usd ?? 0),
      lastResult: String(r.last_result ?? ""),
      familyHasWorksOnHost: Boolean(
        [...(worksByHost.get(host) ?? [])].some((f) => f !== family),
      ),
    });
    const score = channelScore({
      verdict: judged.verdict,
      purchases: Number(r.purchases ?? 0),
      revenueUsd: Number(r.revenue_usd ?? 0),
      checkouts: Number(r.checkouts ?? 0),
      humans: Number(r.humans ?? 0),
      attempts: Number(r.attempts ?? 0),
    });
    if (judged.verdict === "WORKS") works += 1;
    if (judged.verdict === "DEAD") dead += 1;
    await pool.query(
      `update ros_channel_memory
          set verdict=$3, score=$4, reason=$5, updated_at=now()
        where host=$1 and business_id=$2`,
      [host, r.business_id, judged.verdict, score, judged.reason],
    );
  }
  return { pairs: rows.rows.length, works, dead };
}

export async function choosePlacement(pool: pg.Pool): Promise<Placement> {
  await ensureCommercialExecutionSchema(pool);
  const mem = await pool.query(
    `select host, business_id, family, listed_at, attempts, humans, checkouts,
            purchases, revenue_usd, last_result, verdict, score, reason
       from ros_channel_memory`,
  );
  const hosts = await pool.query(
    `select distinct regexp_replace(substring(url from 'https?://([^/]+)'), '^www\\.', '') as host
       from ros_external_surfaces
      where url not ilike '%sslip.io%'
        and url ~ '^https?://'
      limit 800`,
  ).catch(() => ({ rows: [] as Array<{ host: string }> }));
  const memory: ChannelMemory[] = mem.rows.map((r) => ({
    host: String(r.host),
    businessId: String(r.business_id),
    family: String(r.family),
    listedAt: r.listed_at ? new Date(r.listed_at) : null,
    attempts: Number(r.attempts ?? 0),
    humans: Number(r.humans ?? 0),
    checkouts: Number(r.checkouts ?? 0),
    purchases: Number(r.purchases ?? 0),
    revenueUsd: Number(r.revenue_usd ?? 0),
    lastResult: String(r.last_result ?? ""),
    verdict: r.verdict as ChannelVerdict,
    score: Number(r.score ?? 0),
    reason: String(r.reason ?? ""),
  }));
  return pickPlacement({
    businesses: Object.keys(GUMROAD_LIVE),
    hosts: hosts.rows.map((r) => String(r.host || "")).filter(Boolean),
    memory,
  });
}
