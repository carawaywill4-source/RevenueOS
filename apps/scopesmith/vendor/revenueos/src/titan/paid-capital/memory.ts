/**
 * Paid experiment learning memory — failures are valuable institutional evidence.
 */

import { newId, type ExperimentStore } from "../../ledger/store";
import type { PaidExperimentMemory } from "./types";

const MEMORY_PURSUIT = "titan_paid_memory";

export function createPaidExperimentMemory(
  input: Omit<PaidExperimentMemory, "experiment_id" | "created_at"> & {
    created_at?: string;
  },
): PaidExperimentMemory {
  return {
    experiment_id: newId("tpayex"),
    created_at: input.created_at ?? new Date().toISOString(),
    ...input,
  };
}

export async function persistPaidExperimentMemory(
  store: ExperimentStore,
  memory: PaidExperimentMemory,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("tevt"),
    pursuitId: MEMORY_PURSUIT,
    siteId: memory.business_id,
    eventType: "learned",
    detail: { titan: true, kind: "paid_experiment_memory", memory },
    createdAt: memory.created_at,
  });
}

export async function listPaidExperimentMemory(
  store: ExperimentStore,
  businessId: string,
  limit = 50,
): Promise<PaidExperimentMemory[]> {
  if (!store.listPursuitEvents) return [];
  const events = await store.listPursuitEvents(businessId, { limit: limit * 2 });
  const out: PaidExperimentMemory[] = [];
  for (const e of events) {
    if (e.pursuitId !== MEMORY_PURSUIT) continue;
    const m = (e.detail as { memory?: PaidExperimentMemory } | undefined)?.memory;
    if (m) out.push(m);
  }
  return out.slice(0, limit);
}
