/**
 * QualifiedExposureScore — buyers over clicks.
 * CHANNEL × PERSONA × INTENT × MESSAGE × OFFER × PRODUCT → commercial outcome
 */

import type { PursuitEvent } from "../types";
import type { DemandSignal } from "./types";

export type QualifiedExposureScore = {
  source: string;
  score: number;
  plausible_buyer: boolean;
  reasons: string[];
  events: number;
};

const BUYER_SOURCE_HINTS = [
  "reddit",
  "gumroad",
  "freelancer",
  "indiehackers",
  "producthunt",
  "hn",
  "search",
  "google",
  "bing",
  "scope",
  "contract",
  "change.order",
  "change_order",
];

const LOW_QUALITY_HINTS = [
  "bot",
  "crawler",
  "localhost",
  "vercel",
  "monitor",
  "preview",
  "internal",
];

export function scoreQualifiedExposure(input: {
  source: string;
  demand?: DemandSignal;
  hadIntent?: boolean;
  hadCheckout?: boolean;
  hadPurchase?: boolean;
  trafficQuality?: string;
}): QualifiedExposureScore {
  const source = (input.source || "unknown").toLowerCase();
  const reasons: string[] = [];
  let score = 0.25;

  if (input.trafficQuality === "RAW") {
    return {
      source,
      score: 0,
      plausible_buyer: false,
      reasons: ["raw_or_bot"],
      events: 1,
    };
  }
  if (input.trafficQuality === "QUALIFIED") {
    score += 0.25;
    reasons.push("qualified_traffic");
  }

  if (BUYER_SOURCE_HINTS.some((h) => source.includes(h))) {
    score += 0.2;
    reasons.push("buyer_channel_hint");
  }
  if (LOW_QUALITY_HINTS.some((h) => source.includes(h))) {
    score -= 0.3;
    reasons.push("low_quality_source");
  }
  if (input.demand) {
    score += input.demand.commerciality * 0.15;
    score += input.demand.accessibility * 0.05;
    reasons.push("demand_prior");
  }
  if (input.hadIntent) {
    score += 0.2;
    reasons.push("intent");
  }
  if (input.hadCheckout) {
    score += 0.25;
    reasons.push("checkout");
  }
  if (input.hadPurchase) {
    score += 0.4;
    reasons.push("purchase");
  }

  score = Math.max(0, Math.min(1, score));
  return {
    source,
    score: Number(score.toFixed(3)),
    plausible_buyer: score >= 0.45,
    reasons,
    events: 1,
  };
}

export function aggregateSourceQuality(
  events: PursuitEvent[],
  demand?: DemandSignal,
): QualifiedExposureScore[] {
  const bySource = new Map<
    string,
    { n: number; intent: number; checkout: number; purchase: number; q: string }
  >();
  for (const e of events) {
    const detail = (e.detail ?? {}) as Record<string, unknown>;
    const ce = (detail.commercial_event ?? {}) as Record<string, unknown>;
    if (e.eventType !== "beacon" && detail.kind !== "apex_commercial_event") continue;
    const source = String(detail.utm_source ?? ce.source ?? "unknown");
    const kind = String(detail.kind ?? "");
    const bucket = bySource.get(source) ?? {
      n: 0,
      intent: 0,
      checkout: 0,
      purchase: 0,
      q: String(detail.traffic_quality ?? "LIKELY_HUMAN"),
    };
    bucket.n += 1;
    if (kind.includes("cta") || kind === "checkout_start") bucket.intent += 1;
    if (kind === "checkout_start" || kind === "CHECKOUT") bucket.checkout += 1;
    if (kind.includes("purchase") || kind === "checkout_complete") bucket.purchase += 1;
    bySource.set(source, bucket);
  }
  const out: QualifiedExposureScore[] = [];
  for (const [source, b] of bySource) {
    const s = scoreQualifiedExposure({
      source,
      demand,
      hadIntent: b.intent > 0,
      hadCheckout: b.checkout > 0,
      hadPurchase: b.purchase > 0,
      trafficQuality: b.q,
    });
    s.events = b.n;
    out.push(s);
  }
  return out.sort((a, b) => b.score - a.score);
}
