import type { Lesson } from "../types";

export function selectSiteLessons(lessons: Lesson[], siteId: string) {
  return lessons.filter(
    (lesson) => lesson.scope === "site" && lesson.siteId === siteId,
  );
}
