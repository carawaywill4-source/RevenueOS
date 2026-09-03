/**
 * Universal commercial event model across all businesses.
 */

import { newId } from "../ledger/store";
import type { BeaconEvent } from "../modules/beacon";
import type { CommercialEvent, CommercialEventType, TrafficQuality } from "./types";

export function beaconKindToEventType(
  kind: BeaconEvent["kind"],
): CommercialEventType {
  switch (kind) {
    case "page_view":
      return "VISIT";
    case "scroll_depth":
      return "ENGAGEMENT";
    case "cta_click":
      return "CTA";
    case "checkout_start":
      return "CHECKOUT";
    case "checkout_complete":
      return "PURCHASE";
    default:
      return "VISIT";
  }
}

export function commercialEventFromBeacon(input: {
  event: BeaconEvent;
  trafficQuality: TrafficQuality;
  traceId?: string;
  channel?: string;
  source?: string;
  campaign?: string;
  attributionConfidence?: number;
  sessionId?: string;
}): CommercialEvent {
  return {
    event_id: newId("cevt"),
    business_id: input.event.siteId,
    anonymous_session_id: input.sessionId,
    timestamp: input.event.ts ?? new Date().toISOString(),
    channel: input.channel,
    source: input.source,
    campaign: input.campaign,
    landing_version: input.event.slug ?? input.event.path,
    event_type: beaconKindToEventType(input.event.kind),
    confidence:
      input.trafficQuality === "QUALIFIED"
        ? 0.85
        : input.trafficQuality === "LIKELY_HUMAN"
          ? 0.55
          : 0.1,
    traffic_quality: input.trafficQuality,
    trace_id: input.traceId,
    attribution_confidence: input.attributionConfidence,
    metadata: {
      path: input.event.path,
      referrer: input.event.referrer,
      kind: input.event.kind,
      ...(input.event.meta ?? {}),
    },
  };
}

export function commercialEventFromPurchase(input: {
  businessId: string;
  stripeSessionId: string;
  amountUsd: number;
  productId: string;
  emailHash?: string;
  traceId?: string;
  channel?: string;
  source?: string;
  campaign?: string;
  attributionConfidence?: number;
}): CommercialEvent {
  return {
    event_id: newId("cevt"),
    business_id: input.businessId,
    timestamp: new Date().toISOString(),
    channel: input.channel,
    source: input.source,
    campaign: input.campaign,
    product: input.productId,
    price: input.amountUsd,
    event_type: "PURCHASE",
    revenue: input.amountUsd,
    cost: 0,
    confidence: 0.95,
    traffic_quality: "QUALIFIED",
    trace_id: input.traceId,
    attribution_confidence: input.attributionConfidence ?? 0.5,
    metadata: {
      stripeSessionId: input.stripeSessionId,
      emailHash: input.emailHash,
    },
  };
}
