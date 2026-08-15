/**
 * Storefront-facing APEX ingest helpers (beacon + purchase).
 */

import type { ExperimentStore } from "../ledger/store";
import { newId } from "../ledger/store";
import {
  ingestBeaconEvent,
  type BeaconEvent,
} from "../modules/beacon";
import { classifyRequestAttribution } from "./attribution-bridge";
import {
  commercialEventFromBeacon,
  commercialEventFromPurchase,
} from "./commercial-events";
import { appendEvidence, createEvidence } from "./evidence-ledger";
import {
  applyPurchaseToBeliefs,
  loadApexState,
  saveApexState,
} from "./beliefs";
import { extractTraceIdFromUrl, newTraceId } from "./trace";
import { classifyTrafficQuality, shouldLearnFromTraffic } from "./traffic-quality";
import type { CommercialEvent } from "./types";

export async function ingestApexBeacon(input: {
  event: BeaconEvent;
  store: ExperimentStore;
}): Promise<{
  ok: boolean;
  reason?: string;
  actionClass?: string;
  trafficQuality?: string;
  commercialEvent?: CommercialEvent;
  learned?: boolean;
}> {
  const attr = await classifyRequestAttribution({
    requestUrl: input.event.url,
    businessId: input.event.siteId,
  });
  const quality = classifyTrafficQuality({
    ua: input.event.ua,
    ip: input.event.ip,
    referrer: input.event.referrer,
    path: input.event.path,
    signedAttribution: attr.source === "signed",
  });

  const traceId =
    extractTraceIdFromUrl(input.event.url) ??
    (typeof input.event.meta?.trace_id === "string"
      ? String(input.event.meta.trace_id)
      : newTraceId());

  const enriched: BeaconEvent = {
    ...input.event,
    meta: {
      ...(input.event.meta ?? {}),
      traffic_quality: quality.quality,
      attribution_source: attr.source,
      attribution_confidence: attr.attribution_confidence,
      utm_source: attr.utm_source ?? "",
      utm_medium: attr.utm_medium ?? "",
      utm_campaign: attr.utm_campaign ?? "",
      trace_id: traceId,
      quality_reasons: quality.reasons.join(","),
    },
  };

  // Still reject pure bots at beacon layer; APEX records RAW only when we want audit.
  const result = await ingestBeaconEvent({
    event: enriched,
    store: input.store,
  });

  if (!result.ok) {
    return { ok: false, reason: result.reason, trafficQuality: quality.quality };
  }

  // Patch traffic_quality onto stored detail via follow-up commercial event.
  const ce = commercialEventFromBeacon({
    event: enriched,
    trafficQuality: quality.quality,
    traceId,
    channel: attr.channel,
    source: attr.utm_source,
    campaign: attr.utm_campaign,
    attributionConfidence: attr.attribution_confidence,
  });

  if (input.store.appendPursuitEvent) {
    await input.store.appendPursuitEvent({
      id: newId("pevt"),
      pursuitId: "apex_commercial",
      siteId: input.event.siteId,
      eventType: "beacon",
      detail: {
        apex: true,
        kind: "apex_commercial_event",
        actionClass: result.actionClass,
        commercial_event: ce,
        traffic_quality: quality.quality,
        trace_id: traceId,
      },
      createdAt: ce.timestamp,
    });
  }

  const learned = shouldLearnFromTraffic(quality.quality);
  if (learned) {
    await appendEvidence(
      input.store,
      createEvidence({
        type: "SESSION",
        source: "apex.beacon",
        statement: `${ce.event_type} ${quality.quality} via ${attr.source}`,
        businessId: input.event.siteId,
        confidence: ce.confidence,
        traceId,
      }),
    );
  }

  return {
    ok: true,
    actionClass: result.actionClass,
    trafficQuality: quality.quality,
    commercialEvent: ce,
    learned,
  };
}

export async function ingestApexPurchase(input: {
  store: ExperimentStore;
  businessId: string;
  stripeSessionId: string;
  amountUsd: number;
  productId: string;
  requestUrl?: string;
  emailHash?: string;
}): Promise<{ ok: boolean; commercialEvent: CommercialEvent; traceId: string }> {
  const attr = input.requestUrl
    ? await classifyRequestAttribution({
        requestUrl: input.requestUrl,
        businessId: input.businessId,
      })
    : { source: "none" as const, attribution_confidence: 0 };
  const traceId =
    (input.requestUrl && extractTraceIdFromUrl(input.requestUrl)) ||
    newTraceId();

  const ce = commercialEventFromPurchase({
    businessId: input.businessId,
    stripeSessionId: input.stripeSessionId,
    amountUsd: input.amountUsd,
    productId: input.productId,
    emailHash: input.emailHash,
    traceId,
    channel: attr.channel,
    source: attr.utm_source,
    campaign: attr.utm_campaign,
    attributionConfidence: attr.attribution_confidence || 0.5,
  });

  if (input.store.appendPursuitEvent) {
    await input.store.appendPursuitEvent({
      id: newId("pevt"),
      pursuitId: "apex_commercial",
      siteId: input.businessId,
      eventType: "attributed",
      detail: {
        apex: true,
        kind: "apex_purchase",
        actionClass: "commercial",
        commercial_event: ce,
        success_dna: {
          demand_cluster: "protect_freelancer_unpaid_expansion",
          product: input.productId,
          price: input.amountUsd,
          channel: attr.channel ?? "UNKNOWN",
          attribution_confidence: ce.attribution_confidence,
          incrementality_confidence: "UNKNOWN",
          trace_id: traceId,
        },
      },
      createdAt: ce.timestamp,
    });
  }

  await appendEvidence(
    input.store,
    createEvidence({
      type: "TRANSACTION",
      source: "stripe",
      statement: `PURCHASE $${input.amountUsd} session=${input.stripeSessionId}`,
      businessId: input.businessId,
      confidence: 0.95,
      reliability: 0.95,
      traceId,
      payload: { stripeSessionId: input.stripeSessionId },
    }),
  );

  const state = await loadApexState(input.store, input.businessId);
  await saveApexState(input.store, applyPurchaseToBeliefs(state, input.amountUsd));

  return { ok: true, commercialEvent: ce, traceId };
}
