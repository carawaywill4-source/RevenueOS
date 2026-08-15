/**
 * Persist storefront beacon events as classified traffic (not Titan probes).
 */

import { randomBytes } from "node:crypto";
import pg from "pg";

let pool: pg.Pool | null = null;
let ready = false;

function getPool(): pg.Pool | null {
  const url =
    process.env.REVENUEOS_DATABASE_URL || process.env.DATABASE_URL || null;
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, max: 2 });
  }
  return pool;
}

async function ensure(p: pg.Pool): Promise<void> {
  if (ready) return;
  await p.query(`
    create table if not exists ros_traffic_events (
      id text primary key,
      business_id text not null,
      class text not null,
      source text not null,
      path text,
      host text,
      user_agent text,
      referer text,
      remote_ip text,
      event_kind text,
      qualified boolean not null default false,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists ros_traffic_events_biz_created_idx
      on ros_traffic_events (business_id, created_at desc);
  `);
  ready = true;
}

function classify(input: {
  ua: string;
  path: string;
  kind: string;
  ip: string;
  referer?: string;
  host?: string;
  url?: string;
}): { class: string; qualified: boolean; reason: string } {
  const ua = input.ua;
  const referer = String(input.referer ?? "");
  const ip = String(input.ip ?? "").replace(/^::ffff:/, "");
  const blob = `${ua} ${input.path} ${referer} ${input.url ?? ""} ${input.kind}`;

  if (
    /RevenueOS|TitanAcquisition|HostingPlane|curl\/|Wget|python-requests|Playwright/i.test(ua) ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "130.131.15.68"
  ) {
    return { class: "INTERNAL", qualified: false, reason: "internal" };
  }
  if (/utm_source=acquisitionos|utm_source=titan|ros-evo-/i.test(blob)) {
    return { class: "SYNTHETIC_TEST", qualified: false, reason: "synthetic_utm_or_probe" };
  }
  if (/Googlebot|Bingbot|Ahrefs|Semrush|Bytespider|DuckDuckBot|Applebot|Yandex|Baiduspider/i.test(ua)) {
    return { class: "CRAWLER", qualified: false, reason: "crawler_ua" };
  }
  if (/bot|crawl|spider|slurp|headless/i.test(ua)) {
    return { class: "BOT", qualified: false, reason: "bot_ua" };
  }
  const owned = /sslip\.io|130\.131\.15\.68|localhost|revenueos-core/i;
  if (owned.test(referer)) {
    return { class: "INTERNAL", qualified: false, reason: "owned_referer" };
  }
  const datacenter = /^(23\.27\.|23\.94\.|149\.57\.|3\.|18\.|34\.|35\.|44\.|52\.|54\.)/;
  if (datacenter.test(ip) && (!referer || owned.test(referer))) {
    return { class: "BOT", qualified: false, reason: "datacenter_owned_or_empty_referer" };
  }
  const intent =
    /checkout_start|cta|purchase/i.test(input.kind) ||
    /checkout|buy|success/i.test(input.path);
  const externalReferer = referer.length > 0 && !owned.test(referer);
  if (/Mozilla\/5\.0.*(Chrome|Firefox|Safari|Edg)/i.test(ua) && externalReferer && !datacenter.test(ip)) {
    return intent
      ? { class: "VERIFIED_HUMAN_SIGNAL", qualified: true, reason: "browser_intent_third_party_referer" }
      : { class: "LIKELY_HUMAN", qualified: false, reason: "browser_third_party_referer" };
  }
  return { class: "UNKNOWN", qualified: false, reason: "unclassified_or_owned_direct" };
}

export async function recordBeaconEvent(input: {
  siteId: string;
  host: string;
  userAgent?: string;
  referer?: string;
  remoteIp?: string;
  body: Record<string, unknown>;
}): Promise<{ ok: boolean; class?: string }> {
  const p = getPool();
  if (!p) return { ok: false };
  try {
    await ensure(p);
    const kind = String(input.body.kind ?? "pageview");
    const path = String(input.body.path ?? "/");
    const classified = classify({
      ua: input.userAgent ?? "",
      path,
      kind,
      ip: input.remoteIp ?? "",
      referer: input.referer,
      host: input.host,
      url: String(input.body.url ?? ""),
    });
    const id = `trf_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
    await p.query(
      `insert into ros_traffic_events
       (id, business_id, class, source, path, host, user_agent, referer, remote_ip, event_kind, qualified, meta)
       values ($1,$2,$3,'beacon',$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        id,
        input.siteId,
        classified.class,
        path,
        input.host,
        input.userAgent ?? null,
        input.referer ?? null,
        input.remoteIp ?? null,
        kind,
        classified.qualified,
        JSON.stringify({
          reason: classified.reason,
          url: input.body.url ?? null,
        }),
      ],
    );
    return { ok: true, class: classified.class };
  } catch {
    return { ok: false };
  }
}
