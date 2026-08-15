/**
 * Persist and ingest traffic events (beacon + Caddy access log).
 */

import { createHash, randomBytes } from "node:crypto";
import { existsSync, openSync, readSync, statSync, closeSync } from "node:fs";
import type pg from "pg";
import { classifyTraffic, type TrafficClass } from "./traffic-classify.js";

function eid(): string {
  return `trf_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export async function ensureTrafficTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
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
    create index if not exists ros_traffic_events_class_created_idx
      on ros_traffic_events (class, created_at desc);
    create index if not exists ros_traffic_events_created_class_idx
      on ros_traffic_events (created_at desc, class);
    create index if not exists ros_traffic_events_proven_human_idx
      on ros_traffic_events (created_at desc)
      where class not in ('SYNTHETIC_TEST', 'INTERNAL', 'BOT', 'CRAWLER');
    create table if not exists ros_traffic_ingest_cursor (
      source text primary key,
      byte_offset bigint not null default 0,
      updated_at timestamptz not null default now()
    );
  `);
}

export async function recordTrafficEvent(
  pool: pg.Pool,
  input: {
    businessId: string;
    source: string;
    path?: string;
    host?: string;
    userAgent?: string;
    referer?: string;
    remoteIp?: string;
    eventKind?: string;
    meta?: Record<string, unknown>;
  },
): Promise<{ id: string; class: TrafficClass }> {
  const classified = classifyTraffic({
    userAgent: input.userAgent,
    path: input.path,
    referer: input.referer,
    remoteIp: input.remoteIp,
    eventKind: input.eventKind,
    host: input.host,
  });
  const id = eid();
  await pool.query(
    `insert into ros_traffic_events
     (id, business_id, class, source, path, host, user_agent, referer, remote_ip, event_kind, qualified, meta)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
    [
      id,
      input.businessId,
      classified.class,
      input.source,
      input.path ?? null,
      input.host ?? null,
      input.userAgent ?? null,
      input.referer ?? null,
      input.remoteIp ?? null,
      input.eventKind ?? null,
      classified.qualified,
      JSON.stringify({
        reason: classified.reason,
        ...(input.meta ?? {}),
      }),
    ],
  );
  return { id, class: classified.class };
}

function siteIdFromHost(host: string): string | null {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  if (!h) return null;
  const base = (
    process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io"
  ).toLowerCase();
  if (h.endsWith(`.${base}`)) {
    return h.slice(0, -(base.length + 1)) || null;
  }
  const first = h.split(".")[0];
  return first && first !== "www" && first !== "130" ? first : null;
}

/**
 * Tail Caddy JSON access log and insert classified events.
 * Dedupes loosely via content hash in meta for same offset window.
 */
export async function ingestCaddyAccessLog(input: {
  pool: pg.Pool;
  logPath?: string;
  maxBytes?: number;
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<{ ingested: number; path: string | null }> {
  await ensureTrafficTables(input.pool);
  const logPath =
    input.logPath ||
    process.env.CADDY_ACCESS_LOG ||
    "/var/log/caddy/access.log";
  if (!existsSync(logPath)) {
    return { ingested: 0, path: null };
  }

  const st = statSync(logPath);
  const curRes = await input.pool.query(
    `select byte_offset from ros_traffic_ingest_cursor where source=$1`,
    [logPath],
  );
  let offset = Number(curRes.rows[0]?.byte_offset ?? 0);
  if (offset > st.size) offset = 0; // rotated
  const maxBytes = input.maxBytes ?? 2_000_000;
  const toRead = Math.min(st.size - offset, maxBytes);
  if (toRead <= 0) {
    return { ingested: 0, path: logPath };
  }

  const fd = openSync(logPath, "r");
  const buf = Buffer.alloc(toRead);
  readSync(fd, buf, 0, toRead, offset);
  closeSync(fd);
  const chunk = buf.toString("utf8");
  const lines = chunk.split("\n");
  // Keep incomplete last line for next pass
  let consumed = toRead;
  if (!chunk.endsWith("\n") && lines.length) {
    const last = lines.pop() ?? "";
    consumed = toRead - Buffer.byteLength(last, "utf8");
  }

  let ingested = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      const req = (row.request as Record<string, unknown>) || {};
      const headers = (req.headers as Record<string, unknown>) || {};
      const hostRaw = headers.Host ?? headers.host ?? req.host;
      const host = Array.isArray(hostRaw)
        ? String(hostRaw[0] ?? "")
        : String(hostRaw ?? "");
      const uaRaw = headers["User-Agent"] ?? headers["user-agent"];
      const ua = Array.isArray(uaRaw)
        ? String(uaRaw[0] ?? "")
        : String(uaRaw ?? "");
      const refRaw = headers.Referer ?? headers.referer;
      const referer = Array.isArray(refRaw)
        ? String(refRaw[0] ?? "")
        : String(refRaw ?? "");
      const uri = String(req.uri ?? req.url ?? "/");
      const remoteIp = String(
        (req as { client_ip?: string; remote_ip?: string }).client_ip ??
          (req as { remote_ip?: string }).remote_ip ??
          row["client_ip"] ??
          "",
      );
      // Prefer request.host when Host header absent (Caddy JSON access format).
      const hostFinal = host || String(req.host ?? "");
      const siteId = siteIdFromHost(hostFinal);
      if (!siteId) continue;
      // Skip static asset noise lightly
      if (/\.(css|js|map|png|jpg|jpeg|gif|ico|svg|woff2?)(\?|$)/i.test(uri)) {
        continue;
      }
      await recordTrafficEvent(input.pool, {
        businessId: siteId,
        source: "caddy_access",
        path: uri,
        host: hostFinal,
        userAgent: ua,
        referer: referer || undefined,
        remoteIp: remoteIp || undefined,
        eventKind: "http_request",
        meta: {
          status: row.status,
          duration: row.duration,
          hash: createHash("sha256").update(trimmed).digest("hex").slice(0, 16),
        },
      });
      ingested++;
    } catch {
      /* skip bad line */
    }
  }

  const newOffset = offset + consumed;
  await input.pool.query(
    `insert into ros_traffic_ingest_cursor (source, byte_offset, updated_at)
     values ($1,$2,now())
     on conflict (source) do update set byte_offset=excluded.byte_offset, updated_at=now()`,
    [logPath, newOffset],
  );

  input.logger?.("info", "traffic.caddy.ingest", { ingested, logPath, newOffset });
  return { ingested, path: logPath };
}
