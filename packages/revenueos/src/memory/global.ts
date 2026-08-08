import type { Lesson } from "../types";

/** Global lessons travel with the product across sites. No PII. */
export function selectGlobalLessons(lessons: Lesson[]) {
  return lessons.filter((lesson) => lesson.scope === "global" && lesson.transferable);
}

export function mergeLessonEvidence(
  existing: Lesson | undefined,
  incoming: Lesson,
): Lesson {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    id: existing.id || incoming.id,
    createdAt: existing.createdAt || incoming.createdAt,
    summary: incoming.summary || existing.summary,
    evidenceCount: (existing.evidenceCount || 0) + 1,
    originSiteIds: [
      ...new Set([
        ...(existing.originSiteIds ?? []),
        ...(incoming.originSiteIds ?? []),
        ...(existing.siteId ? [existing.siteId] : []),
        ...(incoming.siteId ? [incoming.siteId] : []),
      ]),
    ],
    updatedAt: new Date().toISOString(),
  };
}
