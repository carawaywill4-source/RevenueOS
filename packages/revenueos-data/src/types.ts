/** Domain types owned by RevenueOS — not a Supabase mirror. */

export type IsoTime = string;

export type BusinessRecord = {
  siteId: string;
  displayName: string;
  industry?: string;
  appUrl?: string | null;
  status: "active" | "retired" | "archived" | "draft";
  metadata?: Record<string, unknown>;
  updatedAt: IsoTime;
};

export type PursuitRecord = {
  id: string;
  siteId: string;
  state: string;
  patternKey?: string | null;
  actionType?: string | null;
  document: Record<string, unknown>;
  updatedAt: IsoTime;
};

export type EventRecord = {
  id: string;
  siteId: string;
  eventType: string;
  detail: Record<string, unknown>;
  createdAt: IsoTime;
};

export type LessonRecord = {
  id: string;
  siteId: string;
  summary: string;
  document: Record<string, unknown>;
  updatedAt: IsoTime;
};

export type ExperimentRecord = {
  id: string;
  siteId: string;
  category: string;
  status: string;
  document: Record<string, unknown>;
  updatedAt: IsoTime;
};

export type ClaimRecord = {
  siteId: string;
  owner: string;
  leaseUntil: IsoTime;
  claimedAt: IsoTime;
};

export type LeaseRecord = {
  id: string;
  siteId: string;
  owner: string;
  leaseUntil: IsoTime;
  document?: Record<string, unknown>;
};

export type ScorecardRecord = {
  id: string;
  siteId: string;
  document: Record<string, unknown>;
  updatedAt: IsoTime;
};

export type PortfolioStateRecord = {
  id: string;
  document: Record<string, unknown>;
  updatedAt: IsoTime;
};

export type JobRecord = {
  jobId: string;
  businessId: string;
  jobType: string;
  priority: number;
  payload: Record<string, unknown>;
  status:
    | "QUEUED"
    | "CLAIMED"
    | "RUNNING"
    | "CHECKPOINTED"
    | "COMPLETE"
    | "FAILED"
    | "RETRY_WAIT";
  attempts: number;
  createdAt: IsoTime;
  scheduledAt: IsoTime;
  startedAt?: IsoTime | null;
  heartbeatAt?: IsoTime | null;
  completedAt?: IsoTime | null;
  leaseOwner?: string | null;
  leaseExpiration?: IsoTime | null;
  error?: string | null;
  checkpoint?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
};

export type ActivityRecord = {
  id: string;
  siteId?: string | null;
  at: IsoTime;
  summary: string;
  quality?: string;
  detail?: Record<string, unknown>;
};

export type ReleaseRecord = {
  id: string;
  siteId: string;
  version: string;
  path: string;
  status: "candidate" | "active" | "previous" | "rejected" | "rolled_back";
  health?: string | null;
  createdAt: IsoTime;
};

export type HealthRecord = {
  id: string;
  subjectType: "business" | "worker" | "db" | "host" | "engine";
  subjectId: string;
  state: string;
  detail?: Record<string, unknown>;
  checkedAt: IsoTime;
};

export type ConfigMetaRecord = {
  key: string;
  value: Record<string, unknown>;
  updatedAt: IsoTime;
};
