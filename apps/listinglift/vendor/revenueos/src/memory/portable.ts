import type { ExperimentStore } from "../ledger/store";
import type { CapabilityGap, Lesson, LessonScope } from "../types";
import { mergeLessonEvidence } from "./global";

/**
 * Portable memory — learning survives across businesses.
 *
 * Transferable lessons are stored as industry (or global) scope with stable ids
 * so a new site on the same ledger inherits every prior win/loss. Site-only
 * lessons stay local (PII-adjacent / one-off). Failure lessons travel so the
 * next business does not repeat the same $0 mistakes.
 */

export type PortableKnowledgePack = {
  version: 1;
  exportedAt: string;
  lessons: Lesson[];
  capabilityGaps: CapabilityGap[];
};

export function stablePortableLessonId(input: {
  patternKey: string;
  scope: LessonScope;
  industry?: string;
}): string {
  const key = input.patternKey
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (input.scope === "global") return `lesson_global_${key}`;
  if (input.scope === "industry") {
    const ind = (input.industry ?? "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 32);
    return `lesson_ind_${ind}_${key}`;
  }
  return `lesson_site_${key}`;
}

/**
 * Promote a transferable lesson to industry/global so other businesses see it.
 * Non-transferable lessons remain site-scoped.
 */
export type LessonDraft = Omit<
  Lesson,
  "id" | "createdAt" | "updatedAt" | "scope"
> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  scope?: LessonScope;
};

export function toPortableLesson(input: {
  lesson: LessonDraft;
  siteId: string;
  industry?: string;
  now?: Date;
}): Lesson {
  const now = (input.now ?? new Date()).toISOString();
  const transferable = input.lesson.transferable !== false;
  const industry = input.industry ?? input.lesson.industry;
  const scope: LessonScope = !transferable
    ? "site"
    : industry
      ? "industry"
      : "global";

  const id =
    scope === "site"
      ? input.lesson.id ??
        stablePortableLessonId({
          patternKey: `${input.siteId}:${input.lesson.patternKey}`,
          scope: "site",
        })
      : stablePortableLessonId({
          patternKey: input.lesson.patternKey,
          scope,
          industry,
        });

  const originSiteIds = new Set<string>([
    ...(input.lesson.originSiteIds ?? []),
    input.siteId,
  ]);
  if (input.lesson.siteId) originSiteIds.add(input.lesson.siteId);

  return {
    ...input.lesson,
    id,
    scope,
    industry: scope === "industry" ? industry : input.lesson.industry,
    // Portable rows are not owned by one site; keep origins for audit.
    siteId: scope === "site" ? input.siteId : undefined,
    originSiteIds: [...originSiteIds],
    transferable: scope === "site" ? Boolean(input.lesson.transferable) : true,
    createdAt: input.lesson.createdAt ?? now,
    updatedAt: now,
  };
}

/** Upsert a lesson, merging evidence when the portable id already exists. */
export async function persistPortableLesson(
  store: ExperimentStore,
  draft: {
    lesson: LessonDraft;
    siteId: string;
    industry?: string;
    now?: Date;
  },
): Promise<Lesson> {
  const portable = toPortableLesson(draft);
  const existingPool = store.listAllLessons
    ? await store.listAllLessons()
    : await store.listLessons({
        siteId: draft.siteId,
        industry: draft.industry,
      });
  const existing =
    existingPool.find((l) => l.id === portable.id) ??
    existingPool.find(
      (l) =>
        l.patternKey === portable.patternKey &&
        l.scope === portable.scope &&
        (l.scope !== "industry" || l.industry === portable.industry),
    );

  const merged = mergeLessonEvidence(existing, portable);
  // Reinforce ranking pressure when the same failure/success repeats.
  if (existing && typeof portable.rankingWeight === "number") {
    const prev = existing.rankingWeight ?? 1;
    const next = portable.rankingWeight;
    merged.rankingWeight = Number(
      (prev * 0.6 + next * 0.4).toFixed(3),
    );
  }
  if (existing?.originSiteIds || portable.originSiteIds) {
    merged.originSiteIds = [
      ...new Set([
        ...(existing?.originSiteIds ?? []),
        ...(portable.originSiteIds ?? []),
      ]),
    ];
  }
  if (portable.sentiment) merged.sentiment = portable.sentiment;
  if (portable.cooldownUntil) merged.cooldownUntil = portable.cooldownUntil;
  await store.saveLesson(merged);
  return merged;
}

/**
 * Backfill: any site-scoped lesson marked transferable becomes industry/global
 * so a newly attached business inherits it.
 */
export async function promoteTransferableSiteLessons(
  store: ExperimentStore,
  opts?: { industry?: string },
): Promise<number> {
  if (!store.listAllLessons) return 0;
  const all = await store.listAllLessons();
  let promoted = 0;
  for (const lesson of all) {
    if (lesson.scope !== "site") continue;
    if (!lesson.transferable) continue;
    if (!lesson.siteId) continue;
    const portable = toPortableLesson({
      lesson,
      siteId: lesson.siteId,
      industry: opts?.industry ?? lesson.industry,
    });
    if (portable.scope === "site") continue;
    const existing = all.find((l) => l.id === portable.id);
    const merged = mergeLessonEvidence(existing, portable);
    merged.originSiteIds = [
      ...new Set([
        ...(existing?.originSiteIds ?? []),
        ...(portable.originSiteIds ?? []),
        lesson.siteId,
      ]),
    ];
    await store.saveLesson(merged);
    promoted += 1;
  }
  return promoted;
}

/** Snapshot portable brain memory for attaching RevenueOS to another ledger. */
export async function exportPortableKnowledge(
  store: ExperimentStore,
): Promise<PortableKnowledgePack> {
  const lessons = store.listAllLessons
    ? await store.listAllLessons()
    : [];
  const portableLessons = lessons.filter(
    (l) =>
      l.transferable &&
      (l.scope === "global" || l.scope === "industry"),
  );
  const gaps = store.listCapabilityGaps
    ? await store.listCapabilityGaps()
    : [];
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    lessons: portableLessons,
    capabilityGaps: gaps,
  };
}

/** Import a knowledge pack into this ledger (new business attach). */
export async function importPortableKnowledge(
  store: ExperimentStore,
  pack: PortableKnowledgePack,
): Promise<{ lessons: number; gaps: number }> {
  let lessons = 0;
  let gaps = 0;
  const existing = store.listAllLessons
    ? await store.listAllLessons()
    : [];
  for (const lesson of pack.lessons) {
    if (!lesson.transferable) continue;
    if (lesson.scope === "site") continue;
    const prev = existing.find((l) => l.id === lesson.id);
    await store.saveLesson(mergeLessonEvidence(prev, lesson));
    lessons += 1;
  }
  if (store.saveCapabilityGap) {
    const existingGaps = store.listCapabilityGaps
      ? await store.listCapabilityGaps()
      : [];
    for (const gap of pack.capabilityGaps) {
      const prev = existingGaps.find(
        (g) =>
          g.missingCapability === gap.missingCapability &&
          g.desiredAction === gap.desiredAction,
      );
      if (prev) {
        await store.saveCapabilityGap({
          ...prev,
          timesBlocked: prev.timesBlocked + gap.timesBlocked,
          expectedValueUsd: Math.max(prev.expectedValueUsd, gap.expectedValueUsd),
          businessesAffected: [
            ...new Set([...prev.businessesAffected, ...gap.businessesAffected]),
          ],
          lastSeenAt: new Date().toISOString(),
          reason: gap.reason || prev.reason,
        });
      } else {
        await store.saveCapabilityGap(gap);
      }
      gaps += 1;
    }
  }
  return { lessons, gaps };
}

/** Bootstrap portable memory at cycle start for any site. */
export async function ensurePortableMemory(input: {
  store: ExperimentStore;
  siteId: string;
  industry?: string;
}): Promise<{ promoted: number; portableCount: number }> {
  const promoted = await promoteTransferableSiteLessons(input.store, {
    industry: input.industry,
  });
  const visible = await input.store.listLessons({
    siteId: input.siteId,
    industry: input.industry,
  });
  const portableCount = visible.filter(
    (l) => l.scope === "global" || l.scope === "industry",
  ).length;
  return { promoted, portableCount };
}
