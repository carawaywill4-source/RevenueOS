import type { Experiment, Lesson } from "../types";
import { newId } from "./store";

/** Shape accepted for seeding; timestamps are filled by the executive. */
export type SeedLesson = Omit<Lesson, "createdAt" | "updatedAt">;

/**
 * Portable, transferable lessons that ship with the brain and apply to every
 * site. No industry- or tenant-specific content lives here — adapters inject
 * their own site/industry seeds via SiteAdapter.getSeedLessons().
 */
export const SEED_LESSONS: SeedLesson[] = [
  {
    id: "lesson_output_qa_global",
    scope: "global",
    patternKey: "output-artifact-usability-qa",
    summary:
      "Verifying that an artifact was produced is not verifying it is usable. Assert output invariants (page counts, layout, totals) before claiming fulfillment works.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "neutral",
  },
  {
    id: "lesson_money_over_vanity",
    scope: "global",
    patternKey: "rank-money-over-vanity",
    summary:
      "When purchases are near zero, ranking must bias levers that move revenue precursors over maintenance chores, or the brain congratulates itself for busywork.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
  },
  {
    id: "lesson_activation_before_scaling",
    scope: "global",
    patternKey: "fix-conversion-before-scaling-traffic",
    summary:
      "Scaling traffic into a leaky funnel wastes spend and attention. Prove the funnel converts qualified visitors before pouring in acquisition.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
  },
  {
    id: "lesson_false_positive_trap",
    scope: "global",
    patternKey: "experiment-signal-window",
    summary:
      "Do not declare a lever a win before its signal window elapses; small samples produce false positives that corrupt future ranking.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "neutral",
  },
];

export function seedExperimentFromLesson(
  siteId: string,
  lessonId: string,
  title: string,
  outcome: string,
  status: Experiment["status"],
): Experiment {
  const now = new Date().toISOString();
  return {
    id: newId("exp"),
    siteId,
    status,
    hypothesis: {
      id: newId("hyp"),
      title,
      metric: "learning",
      predictedDelta: "n/a (historical seed)",
      confidence: 0.8,
      effort: 1,
      expectedImpact: 5,
      action: outcome,
      constraintsChecked: ["seed"],
    },
    actions: [],
    predictedOutcome: "Historical seed",
    actualOutcome: outcome,
    lessonId,
    createdAt: now,
    updatedAt: now,
    endedAt: now,
  };
}
