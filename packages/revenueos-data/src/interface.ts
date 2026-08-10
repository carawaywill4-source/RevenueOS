import type { DbHealthReport } from "./health.js";
import type {
  ActivityRecord,
  BusinessRecord,
  ClaimRecord,
  ConfigMetaRecord,
  EventRecord,
  ExperimentRecord,
  HealthRecord,
  JobRecord,
  LeaseRecord,
  LessonRecord,
  PortfolioStateRecord,
  PursuitRecord,
  ReleaseRecord,
  ScorecardRecord,
} from "./types.js";

/**
 * RevenueOS.Data — domain repositories owned by RevenueOS.
 * Supabase / Postgres are adapters behind this interface.
 */
export type RevenueOSData = {
  readonly provider: "supabase" | "postgres";
  health(): Promise<DbHealthReport>;
  /** Run fn inside a provider transaction when supported. */
  withTransaction<T>(fn: (tx: RevenueOSData) => Promise<T>): Promise<T>;
  close(): Promise<void>;

  businesses: {
    upsert(row: BusinessRecord): Promise<void>;
    get(siteId: string): Promise<BusinessRecord | null>;
    list(status?: BusinessRecord["status"]): Promise<BusinessRecord[]>;
  };

  pursuits: {
    upsert(row: PursuitRecord): Promise<void>;
    get(id: string): Promise<PursuitRecord | null>;
    listBySite(siteId: string, limit?: number): Promise<PursuitRecord[]>;
  };

  events: {
    append(row: EventRecord): Promise<void>;
    listBySite(
      siteId: string,
      opts?: { since?: string; limit?: number },
    ): Promise<EventRecord[]>;
  };

  lessons: {
    upsert(row: LessonRecord): Promise<void>;
    listBySite(siteId: string, limit?: number): Promise<LessonRecord[]>;
  };

  experiments: {
    upsert(row: ExperimentRecord): Promise<void>;
    get(id: string): Promise<ExperimentRecord | null>;
    listByCategory(category: string, limit?: number): Promise<ExperimentRecord[]>;
  };

  claims: {
    upsert(row: ClaimRecord): Promise<void>;
    get(siteId: string): Promise<ClaimRecord | null>;
    delete(siteId: string, owner: string): Promise<void>;
  };

  leases: {
    upsert(row: LeaseRecord): Promise<void>;
    get(id: string): Promise<LeaseRecord | null>;
  };

  scorecards: {
    upsert(row: ScorecardRecord): Promise<void>;
    listBySite(siteId: string, limit?: number): Promise<ScorecardRecord[]>;
  };

  portfolio: {
    upsert(row: PortfolioStateRecord): Promise<void>;
    get(id: string): Promise<PortfolioStateRecord | null>;
  };

  jobs: {
    enqueue(row: Omit<JobRecord, "attempts" | "createdAt"> & { attempts?: number }): Promise<JobRecord>;
    get(jobId: string): Promise<JobRecord | null>;
    /** Atomic claim for Stage 2+ workers; Stage 1 implements basic version. */
    claimNext(input: {
      owner: string;
      jobTypes?: string[];
      leaseMs: number;
    }): Promise<JobRecord | null>;
    heartbeat(jobId: string, owner: string): Promise<void>;
    complete(jobId: string, owner: string, result?: Record<string, unknown>): Promise<void>;
    fail(jobId: string, owner: string, error: string): Promise<void>;
  };

  activity: {
    append(row: ActivityRecord): Promise<void>;
    listRecent(limit?: number): Promise<ActivityRecord[]>;
  };

  releases: {
    upsert(row: ReleaseRecord): Promise<void>;
    listBySite(siteId: string): Promise<ReleaseRecord[]>;
  };

  healthRecords: {
    upsert(row: HealthRecord): Promise<void>;
    latest(subjectType: string, subjectId: string): Promise<HealthRecord | null>;
  };

  configMeta: {
    upsert(row: ConfigMetaRecord): Promise<void>;
    get(key: string): Promise<ConfigMetaRecord | null>;
  };
};
