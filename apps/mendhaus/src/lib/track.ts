"use client";

import { getOrCreateSessionId, readAttributionCookie } from "@/lib/session";
import type { MhEventName } from "@/lib/events";

type QueuedEvent = {
  eventId: string;
  name: MhEventName;
  sessionId: string;
  productId?: string;
  attribution?: unknown;
  metadata?: Record<string, unknown>;
};

const QUEUE_KEY = "mh_event_queue";
const FLUSH_MS = 1200;
const MAX_BATCH = 40;

let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function readQueue(): QueuedEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    return raw
      ? (JSON.parse(raw) as Array<Partial<QueuedEvent>>).map((event) => ({
          ...event,
          eventId: event.eventId ?? crypto.randomUUID(),
        })) as QueuedEvent[]
      : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedEvent[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-200)));
  } catch {
    // private mode / quota
  }
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushTrackQueue();
  }, FLUSH_MS);
}

export async function flushTrackQueue() {
  if (typeof window === "undefined" || flushing) return;
  const batch = readQueue().slice(0, MAX_BATCH);
  if (!batch.length) return;
  flushing = true;
  writeQueue(readQueue().slice(batch.length));
  try {
    const body = JSON.stringify({ events: batch });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/events", blob);
      if (!ok) {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } else {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    writeQueue([...batch, ...readQueue()]);
  } finally {
    flushing = false;
    if (readQueue().length) scheduleFlush();
  }
}

export function track(
  name: MhEventName,
  opts: {
    productId?: string;
    metadata?: Record<string, unknown>;
    /** Fire immediately (checkout, purchase-adjacent) */
    immediate?: boolean;
  } = {},
) {
  if (typeof window === "undefined") return;
  const event: QueuedEvent = {
    eventId: crypto.randomUUID(),
    name,
    sessionId: getOrCreateSessionId(),
    productId: opts.productId,
    attribution: readAttributionCookie(),
    metadata: {
      path: window.location.pathname,
      referrer: document.referrer || undefined,
      ...opts.metadata,
    },
  };
  writeQueue([...readQueue(), event]);
  if (opts.immediate) {
    void flushTrackQueue();
  } else {
    scheduleFlush();
  }
}

/** Once per session+path for landing_view; page_view on every navigation. */
export function trackPage(path: string, isLanding: boolean) {
  track("page_view", { metadata: { path }, immediate: false });
  if (isLanding) {
    const key = `mh_lv:${path}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      track("landing_view", { metadata: { path }, immediate: true });
    }
  }
}

export function trackCta(label: string, href?: string, productId?: string) {
  track("cta_click", {
    productId,
    metadata: { label, href },
    immediate: true,
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushTrackQueue();
  });
  window.addEventListener("pagehide", () => {
    void flushTrackQueue();
  });
}
