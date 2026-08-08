import type { Attribution, Experiment, Lesson, Scorecard } from "../types";

export type ExperimentStore = {
  listExperiments(siteId: string): Promise<Experiment[]>;
  getExperiment(id: string): Promise<Experiment | null>;
  saveExperiment(experiment: Experiment): Promise<void>;
  listLessons(opts: {
    siteId: string;
    industry?: string;
  }): Promise<Lesson[]>;
  saveLesson(lesson: Lesson): Promise<void>;
  saveScorecard(scorecard: Scorecard): Promise<void>;
  listScorecards(siteId: string, limit?: number): Promise<Scorecard[]>;
  saveAttribution(attribution: Attribution): Promise<void>;
  listAttributions(siteId: string): Promise<Attribution[]>;
};

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
