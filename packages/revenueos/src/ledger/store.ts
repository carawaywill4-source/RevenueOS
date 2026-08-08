import type {
  Attribution,
  CapabilityGap,
  CycleReportRecord,
  DiscoveryDoor,
  Experiment,
  ExposureRecord,
  Lesson,
  PlannerRunRecord,
  Scorecard,
} from "../types";

export type ExperimentStore = {
  listExperiments(siteId: string): Promise<Experiment[]>;
  getExperiment(id: string): Promise<Experiment | null>;
  saveExperiment(experiment: Experiment): Promise<void>;
  listLessons(opts: {
    siteId: string;
    industry?: string;
  }): Promise<Lesson[]>;
  /** Unfiltered lesson ledger — used to promote/export portable memory. */
  listAllLessons?(): Promise<Lesson[]>;
  saveLesson(lesson: Lesson): Promise<void>;
  saveScorecard(scorecard: Scorecard): Promise<void>;
  listScorecards(siteId: string, limit?: number): Promise<Scorecard[]>;
  saveAttribution(attribution: Attribution): Promise<void>;
  listAttributions(siteId: string): Promise<Attribution[]>;
  listPlannerRuns?(siteId: string, limit?: number): Promise<PlannerRunRecord[]>;
  savePlannerRun?(record: PlannerRunRecord): Promise<void>;
  listCycleReports?(siteId: string, limit?: number): Promise<CycleReportRecord[]>;
  saveCycleReport?(record: CycleReportRecord): Promise<void>;
  listExposures?(siteId: string, limit?: number): Promise<ExposureRecord[]>;
  saveExposure?(record: ExposureRecord): Promise<void>;
  listDiscoveryDoors?(siteId: string): Promise<DiscoveryDoor[]>;
  saveDiscoveryDoor?(door: DiscoveryDoor): Promise<void>;
  listCapabilityGaps?(siteId?: string): Promise<CapabilityGap[]>;
  saveCapabilityGap?(gap: CapabilityGap): Promise<void>;
};

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
