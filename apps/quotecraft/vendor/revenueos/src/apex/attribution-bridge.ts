/**
 * Bridge signed UTM classification + attribution-ML into APEX ingest/tick.
 */

import type { ExperimentStore } from "../ledger/store";
import type { PursuitEvent } from "../types";
import {
  attributeSignalToPatterns,
  updatePosteriorsWithAttribution,
} from "../modules/attribution-ml";
import type { PatternPosteriorMap } from "../modules/pattern-posterior";
import { classifyIncomingAttribution } from "../modules/signed-utm";

export type AttributionIngestResult = {
  source: "signed" | "self_reported" | "none";
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  attribution_confidence: number;
  channel?: string;
};

export async function classifyRequestAttribution(input: {
  requestUrl: string;
  businessId: string;
}): Promise<AttributionIngestResult> {
  const verdict = await classifyIncomingAttribution({
    requestUrl: input.requestUrl,
    businessId: input.businessId,
  });
  if (verdict.source === "signed") {
    return {
      source: "signed",
      utm_source: verdict.utm.utm_source,
      utm_medium: verdict.utm.utm_medium,
      utm_campaign: verdict.utm.utm_campaign,
      attribution_confidence: 0.9,
      channel: verdict.utm.utm_source,
    };
  }
  if (verdict.source === "self_reported") {
    return {
      source: "self_reported",
      utm_source: verdict.utm.utm_source,
      utm_medium: verdict.utm.utm_medium,
      utm_campaign: verdict.utm.utm_campaign,
      attribution_confidence: 0.35,
      channel: verdict.utm.utm_source,
    };
  }
  return { source: "none", attribution_confidence: 0 };
}

/**
 * Apply attribution-ML to recent pursuit events and return updated posteriors.
 * Does not invent causality — weights recent verified signals onto patterns.
 */
export async function applyAttributionMlTick(input: {
  store: ExperimentStore;
  businessId: string;
  events?: PursuitEvent[];
}): Promise<{ applied: boolean; records: number; posteriors?: PatternPosteriorMap }> {
  const events =
    input.events ??
    (input.store.listPursuitEvents
      ? await input.store.listPursuitEvents(input.businessId, { limit: 400 })
      : []);
  if (!events.length) return { applied: false, records: 0 };

  const base: PatternPosteriorMap = {};
  const attributed = attributeSignalToPatterns({ events });
  if (!attributed.length) return { applied: false, records: 0, posteriors: base };

  const updated = updatePosteriorsWithAttribution({
    posteriors: base,
    attributions: attributed,
  });
  return { applied: true, records: attributed.length, posteriors: updated };
}
