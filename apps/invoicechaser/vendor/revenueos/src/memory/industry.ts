import type { Lesson } from "../types";

export function selectIndustryLessons(lessons: Lesson[], industry: string) {
  return lessons.filter(
    (lesson) =>
      lesson.scope === "industry" &&
      lesson.industry === industry &&
      lesson.transferable,
  );
}
