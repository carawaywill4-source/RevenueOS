/**
 * First-party analytics beacon.
 *
 * A published page is production, not exposure. RevenueOS was blind to whether
 * anyone actually loaded the pages it publishes. This module accepts client
 * pings and records them as `verified_exposure` and `intent` events in the
 * durable pursuit-event ledger.
 *
 * Without this, the ban/reward loop has no gradient — every pattern fails the
 * attempt budget with zero signal and is banned. With this, patterns that
 * produce actual visitor traffic are boosted and patterns that produce nothing
 * are correctly demoted.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { PursuitEvent } from "../types";

export type BeaconEvent = {
  /** page_view | cta_click | checkout_start | scroll_depth */
  kind:
    | "page_view"
    | "cta_click"
    | "checkout_start"
    | "checkout_complete"
    | "scroll_depth";
  url: string;
  referrer?: string;
  ua?: string;
  ip?: string;
  path?: string;
  slug?: string;
  siteId: string;
  ts?: string;
  meta?: Record<string, string | number | boolean>;
};

const BOT_UA_MARKERS = [
  "bot",
  "crawler",
  "spider",
  "http",
  "python",
  "wget",
  "curl",
  "phantom",
  "headless",
  "preview",
  "monitor",
  "lighthouse",
  "sitemap",
  "indexnow",
  "bingpreview",
  "googleother",
];

const INTENT_KINDS = new Set(["cta_click", "checkout_start"]);
const COMMERCIAL_KINDS = new Set(["checkout_complete"]);

export function looksLikeBot(ua: string | undefined): boolean {
  if (!ua) return true;
  const lower = ua.toLowerCase();
  return BOT_UA_MARKERS.some((m) => lower.includes(m));
}

export function classifyBeaconAsActionClass(
  kind: BeaconEvent["kind"],
): "verified_exposure" | "intent" | "commercial" {
  if (COMMERCIAL_KINDS.has(kind)) return "commercial";
  if (INTENT_KINDS.has(kind)) return "intent";
  return "verified_exposure";
}

/**
 * Ingest one beacon event into the pursuit-event ledger. The consumer keeps
 * client-side rate limits shallow (fire-and-forget) and the server dedupes on
 * IP+path+kind within a 30s window.
 */
export async function ingestBeaconEvent(input: {
  event: BeaconEvent;
  store: ExperimentStore;
  now?: Date;
  /** Recent event window for dedupe (default 30s). */
  dedupeWindowMs?: number;
}): Promise<
  | { ok: true; event: PursuitEvent; actionClass: string }
  | { ok: false; reason: string }
> {
  const { event, store } = input;
  const now = input.now ?? new Date();
  if (!store.appendPursuitEvent) {
    return { ok: false, reason: "store has no appendPursuitEvent" };
  }
  if (looksLikeBot(event.ua)) {
    return { ok: false, reason: "bot UA" };
  }
  const dedupeWindowMs = input.dedupeWindowMs ?? 30_000;
  if (store.listPursuitEvents) {
    const recent = await store.listPursuitEvents(event.siteId, {
      since: new Date(now.getTime() - dedupeWindowMs).toISOString(),
      limit: 40,
    });
    const dupe = recent.find(
      (e: PursuitEvent) =>
        e.eventType === "beacon" &&
        e.detail?.kind === event.kind &&
        e.detail?.path === (event.path ?? event.url) &&
        (e.detail?.ip === event.ip || e.detail?.ua === event.ua),
    );
    if (dupe) return { ok: false, reason: "duplicate within window" };
  }
  const actionClass = classifyBeaconAsActionClass(event.kind);
  const evt: PursuitEvent = {
    id: newId("pevt"),
    pursuitId: "beacon",
    siteId: event.siteId,
    eventType: "beacon",
    detail: {
      kind: event.kind,
      url: event.url.slice(0, 400),
      referrer: (event.referrer ?? "").slice(0, 400),
      ua: (event.ua ?? "").slice(0, 200),
      path: event.path ?? event.url,
      slug: event.slug,
      ip: event.ip,
      actionClass,
      ...(event.meta ?? {}),
    },
    createdAt: (event.ts ?? now.toISOString()),
  };
  await store.appendPursuitEvent(evt);
  return { ok: true, event: evt, actionClass };
}

/**
 * Roll recent beacon events into per-path counters so the observation adapter
 * can report REAL landingViews / checkouts instead of zero.
 */
export function summarizeBeaconEvents(events: PursuitEvent[]): {
  verifiedExposures: number;
  intents: number;
  commercial: number;
  perPath: Record<
    string,
    { views: number; intents: number; commercial: number }
  >;
} {
  const perPath: Record<
    string,
    { views: number; intents: number; commercial: number }
  > = {};
  let ve = 0;
  let it = 0;
  let co = 0;
  for (const e of events) {
    if (e.eventType !== "beacon") continue;
    const kind = String(e.detail?.kind ?? "");
    const path = String(e.detail?.path ?? "unknown");
    const bucket =
      perPath[path] ?? (perPath[path] = { views: 0, intents: 0, commercial: 0 });
    if (kind === "checkout_complete") {
      co += 1;
      bucket.commercial += 1;
    } else if (kind === "cta_click" || kind === "checkout_start") {
      it += 1;
      bucket.intents += 1;
    } else {
      ve += 1;
      bucket.views += 1;
    }
  }
  return { verifiedExposures: ve, intents: it, commercial: co, perPath };
}
