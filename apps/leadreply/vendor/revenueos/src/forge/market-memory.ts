/**
 * Market Memory — institutional learning across businesses.
 * Transfer lessons without assuming all markets behave identically.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { InstitutionalLesson } from "./enterprise-types";

const MEMORY_PURSUIT = "forge_market_memory";

export function createLesson(
  input: Omit<InstitutionalLesson, "lesson_id" | "created_at"> & { created_at?: string },
): InstitutionalLesson {
  return {
    lesson_id: newId("flesson"),
    created_at: input.created_at ?? new Date().toISOString(),
    ...input,
  };
}

export async function persistLessons(
  store: ExperimentStore,
  businessId: string,
  lessons: InstitutionalLesson[],
): Promise<void> {
  if (!store.appendPursuitEvent || !lessons.length) return;
  for (const lesson of lessons) {
    await store.appendPursuitEvent({
      id: newId("pevt"),
      pursuitId: MEMORY_PURSUIT,
      siteId: businessId,
      eventType: "learned",
      detail: { forge: true, kind: "market_memory", lesson },
      createdAt: lesson.created_at,
    });
  }
}

export async function loadMarketMemory(
  store: ExperimentStore,
  opts?: { businessId?: string; limit?: number },
): Promise<InstitutionalLesson[]> {
  if (!store.listPursuitEvents) return [];
  const siteId = opts?.businessId ?? "portfolio";
  const events = await store.listPursuitEvents(siteId, { limit: opts?.limit ?? 100 });
  const out: InstitutionalLesson[] = [];
  for (const e of events) {
    if (e.pursuitId !== MEMORY_PURSUIT) continue;
    const lesson = (e.detail as { lesson?: InstitutionalLesson } | undefined)?.lesson;
    if (lesson) out.push(lesson);
  }
  return out;
}

/**
 * Filter transferable lessons — require explicit transferable flag + context overlap.
 */
export function relevantLessons(
  lessons: InstitutionalLesson[],
  context: { industryHints: string[]; problemHints: string[] },
): InstitutionalLesson[] {
  const hints = [...context.industryHints, ...context.problemHints]
    .join(" ")
    .toLowerCase();
  return lessons.filter((l) => {
    if (!l.transferable) return false;
    if (!hints.trim()) return l.confidence >= 0.7;
    const ctx = `${l.context} ${l.statement}`.toLowerCase();
    // Soft overlap — do not blindly apply fashion lessons to freelancers, etc.
    const tokens = hints.split(/\W+/).filter((t) => t.length > 4);
    const hits = tokens.filter((t) => ctx.includes(t)).length;
    return hits >= 1 || l.kind === "failure";
  });
}
