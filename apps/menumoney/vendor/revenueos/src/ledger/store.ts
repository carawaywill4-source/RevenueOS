import type {
  Attribution,
  CapabilityGap,
  ChannelRecord,
  CycleReportRecord,
  DiscoveryDoor,
  Experiment,
  ExposureRecord,
  Lesson,
  PlannerRunRecord,
  PursuitEvent,
  PursuitJob,
  Scorecard,
} from "../types";

export type ClaimPursuitsInput = {
  siteId: string;
  limit: number;
  owner: string;
  leaseMs: number;
  now?: Date;
  /** When set, prefer jobs whose actionType is not already waiting. */
  excludeActionTypes?: string[];
};

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

  /** Durable channel registry (acquisition surfaces + posteriors). */
  listChannels?(siteId: string): Promise<ChannelRecord[]>;
  saveChannel?(channel: ChannelRecord): Promise<void>;

  /** Persistent pursuit queue */
  listPursuits?(siteId: string, opts?: { states?: string[]; limit?: number }): Promise<PursuitJob[]>;
  savePursuit?(job: PursuitJob): Promise<void>;
  claimPursuits?(input: ClaimPursuitsInput): Promise<PursuitJob[]>;
  appendPursuitEvent?(event: PursuitEvent): Promise<void>;
  listPursuitEvents?(
    siteId: string,
    opts?: { since?: string; limit?: number },
  ): Promise<PursuitEvent[]>;
  /**
   * Acquire a named lease. Returns true if this caller owns it.
   * Used for tick/report/action-rate locks.
   */
  claimLease?(input: {
    id: string;
    siteId: string;
    kind: string;
    leaseUntil: string;
    document?: Record<string, unknown>;
  }): Promise<boolean>;
};

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
