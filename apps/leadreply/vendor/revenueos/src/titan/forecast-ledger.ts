/**
 * ForecastLedger — predict before major actions; score later.
 * Phase 1: record only (no autonomous high-impact execution).
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { ForecastRecord } from "./types";

const FORECAST_PURSUIT = "titan_forecast";

export function createForecast(input: Omit<ForecastRecord, "forecast_id">): ForecastRecord {
  return {
    forecast_id: newId("tfc"),
    ...input,
  };
}

export async function appendForecast(
  store: ExperimentStore,
  forecast: ForecastRecord,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("tevt"),
    pursuitId: FORECAST_PURSUIT,
    siteId: forecast.business_id,
    eventType: "learned",
    detail: { titan: true, kind: "titan_forecast", forecast },
    createdAt: forecast.timestamp,
  });
}

export async function listForecasts(
  store: ExperimentStore,
  businessId: string,
  limit = 50,
): Promise<ForecastRecord[]> {
  if (!store.listPursuitEvents) return [];
  const events = await store.listPursuitEvents(businessId, { limit: limit * 2 });
  const out: ForecastRecord[] = [];
  for (const e of events) {
    if (e.pursuitId !== FORECAST_PURSUIT) continue;
    const f = (e.detail as { forecast?: ForecastRecord } | undefined)?.forecast;
    if (f) out.push(f);
  }
  return out.slice(0, limit);
}
