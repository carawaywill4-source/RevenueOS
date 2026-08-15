/**
 * FIX 3 — Reclassify recent traffic so historical evidence is not misleading.
 * Bulk SQL for the known false-positive patterns; JS classifier for leftovers.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { classifyTraffic } from "../traffic-classify.js";

export async function reclassifyRecentTraffic(
  pool: pg.Pool,
  logger: Logger,
  lookbackDays = 14,
): Promise<{ scanned: number; changed: number }> {
  let changed = 0;

  const owned = await pool.query(
    `update ros_traffic_events
        set class = 'INTERNAL',
            qualified = false,
            class_reason = 'owned_referer',
            meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
              'reclassifiedFrom', class,
              'reclassifiedAt', now(),
              'reason', 'owned_referer'
            )
      where created_at > now() - ($1::int * interval '1 day')
        and class in ('LIKELY_HUMAN','QUALIFIED')
        and (
          coalesce(referer,'') ilike '%sslip.io%'
          or coalesce(referer,'') ilike '%130.131.15.68%'
          or coalesce(host,'') ilike '%sslip.io%'
        )
      returning id`,
    [lookbackDays],
  );
  changed += owned.rowCount ?? 0;

  const synth = await pool.query(
    `update ros_traffic_events
        set class = 'SYNTHETIC_TEST',
            qualified = false,
            class_reason = 'synthetic_utm_or_probe',
            meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
              'reclassifiedFrom', class,
              'reclassifiedAt', now(),
              'reason', 'synthetic_utm_or_probe'
            )
      where created_at > now() - ($1::int * interval '1 day')
        and class in ('LIKELY_HUMAN','QUALIFIED','UNKNOWN','INTERNAL')
        and (
          coalesce(path,'') ilike '%utm_source=acquisitionos%'
          or coalesce(referer,'') ilike '%utm_source=acquisitionos%'
          or coalesce(meta->>'url','') ilike '%utm_source=acquisitionos%'
          or coalesce(user_agent,'') ilike '%RevenueOS%'
          or coalesce(user_agent,'') ilike '%Playwright%'
        )
      returning id`,
    [lookbackDays],
  );
  changed += synth.rowCount ?? 0;

  const crawler = await pool.query(
    `update ros_traffic_events
        set class = 'CRAWLER',
            qualified = false,
            class_reason = 'crawler_ua',
            meta = coalesce(meta,'{}'::jsonb) || jsonb_build_object(
              'reclassifiedFrom', class,
              'reclassifiedAt', now(),
              'reason', 'crawler_ua'
            )
      where created_at > now() - ($1::int * interval '1 day')
        and class in ('LIKELY_HUMAN','QUALIFIED','BOT','UNKNOWN')
        and coalesce(user_agent,'') ~* 'Googlebot|Bingbot|Ahrefs|Semrush|Bytespider|DuckDuckBot|Applebot|Yandex|Baiduspider'
      returning id`,
    [lookbackDays],
  );
  changed += crawler.rowCount ?? 0;

  // Remaining LIKELY_HUMAN sample — JS classifier, capped.
  const leftover = await pool.query(
    `select id, user_agent, path, referer, remote_ip, event_kind, host, class, meta
       from ros_traffic_events
      where created_at > now() - ($1::int * interval '1 day')
        and class in ('LIKELY_HUMAN','QUALIFIED')
      order by created_at desc
      limit 500`,
    [lookbackDays],
  );
  for (const r of leftover.rows) {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    const classified = classifyTraffic({
      userAgent: r.user_agent,
      path: r.path,
      referer: r.referer,
      remoteIp: r.remote_ip,
      eventKind: r.event_kind,
      host: r.host,
      url: typeof meta.url === "string" ? meta.url : null,
    });
    if (classified.class !== r.class) {
      await pool.query(
        `update ros_traffic_events
            set class = $2, qualified = $3, class_reason = $4,
                meta = coalesce(meta,'{}'::jsonb) || $5::jsonb
          where id = $1`,
        [
          r.id,
          classified.class,
          classified.qualified,
          classified.reason,
          JSON.stringify({
            reclassifiedFrom: r.class,
            reclassifiedAt: new Date().toISOString(),
            reason: classified.reason,
          }),
        ],
      );
      changed++;
    }
  }

  const scanned = (owned.rowCount ?? 0) + (synth.rowCount ?? 0) + (crawler.rowCount ?? 0) + (leftover.rowCount ?? 0);
  logger("info", "ultron.traffic.reclassify", { scanned, changed });
  return { scanned, changed };
}
