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
    summary: incoming.summary || existing.summary,
    evidenceCount: existing.evidenceCount + 1,
    updatedAt: new Date().toISOString(),
  };
}
