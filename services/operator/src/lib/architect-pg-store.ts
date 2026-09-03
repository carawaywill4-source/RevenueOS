/**
 * Postgres-backed Portfolio Architect persistence.
 * Replaces Supabase-shaped document store for native Azure Core.
 */

import type pg from "pg";
import {
  DEFAULT_ARCHITECT_SAFETY,
  DEFAULT_OWNER_PORTFOLIO_POLICY,
  type PortfolioArchitectState,
} from "@revenueos/core";

export const ARCHITECT_STATE_ID = "portfolio:architect-state";
export const ARCHITECT_EVENTS_KEY = "portfolio_architect_events";
export const BUSINESS_ARCHITECT_QUEUE_KEY = "business_architect_lifecycle_queue";
export const CODE_EVOLUTION_KEY = "code_evolution_receipts";
export const CODE_EVOLUTION_LESSONS_KEY = "code_evolution_lessons";

export function emptyArchitectState(): PortfolioArchitectState {
  return {
    safety: { ...DEFAULT_ARCHITECT_SAFETY },
    ownerPolicy: {
      ...DEFAULT_OWNER_PORTFOLIO_POLICY,
      // Throughput for 50-business autonomous portfolio.
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
    },
    opportunities: [],
    fitness: [],
    retirementDecisions: [],
    launches: [],
    events: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export async function loadArchitectStatePg(
  pool: pg.Pool,
): Promise<PortfolioArchitectState> {
  const res = await pool.query(
    `select document from ros_portfolio_state where id=$1`,
    [ARCHITECT_STATE_ID],
  );
  const doc = res.rows[0]?.document;
  if (!doc || typeof doc !== "object") return emptyArchitectState();
  return {
    ...emptyArchitectState(),
    ...(doc as PortfolioArchitectState),
    safety: {
      ...DEFAULT_ARCHITECT_SAFETY,
      ...(doc as PortfolioArchitectState).safety,
    },
    ownerPolicy: {
      ...DEFAULT_OWNER_PORTFOLIO_POLICY,
      ...(doc as PortfolioArchitectState).ownerPolicy,
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: Math.max(
        50,
        (doc as PortfolioArchitectState).ownerPolicy?.maxActiveBusinesses ?? 50,
      ),
    },
  };
}

export async function saveArchitectStatePg(
  pool: pg.Pool,
  state: PortfolioArchitectState,
): Promise<void> {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await pool.query(
    `insert into ros_portfolio_state (id, document, updated_at, provenance)
     values ($1,$2::jsonb,now(),'BUSINESS_ARCHITECT')
     on conflict (id) do update set
       document=excluded.document,
       updated_at=now(),
       provenance='BUSINESS_ARCHITECT'`,
    [ARCHITECT_STATE_ID, JSON.stringify(next)],
  );
}

export async function appendArchitectEventPg(
  pool: pg.Pool,
  event: { kind: string; summary: string; siteId?: string },
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [ARCHITECT_EVENTS_KEY],
  );
  const doc = (res.rows[0]?.value ?? { events: [] }) as {
    events?: Array<Record<string, unknown>>;
  };
  const events = Array.isArray(doc.events) ? [...doc.events] : [];
  events.push({
    ...event,
    at: new Date().toISOString(),
  });
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'BUSINESS_ARCHITECT')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='BUSINESS_ARCHITECT'`,
    [
      ARCHITECT_EVENTS_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        events: events.slice(-300),
      }),
    ],
  );
}

export type ArchitectLifecycleState =
  | "DISCOVERED"
  | "THESIS"
  | "ARCHITECTING"
  | "BUILDING"
  | "VALIDATING"
  | "PROBATION"
  | "ACCEPTED"
  | "EVOLVING"
  | "REPAIR"
  | "RETIRING"
  | "RETIRED"
  | "REPLACED";

export type ArchitectLifecycleRecord = {
  recordId: string;
  siteId: string;
  state: ArchitectLifecycleState;
  thesis?: Record<string, unknown>;
  architecture?: Record<string, unknown>;
  buildSpec?: Record<string, unknown>;
  commercialHypothesis?: string;
  opportunityId?: string;
  createdAt: string;
  updatedAt: string;
  evidence: string[];
  killCriteria?: string[];
  successMetrics?: string[];
  inFlightBuild?: boolean;
  lastError?: string | null;
};

export async function loadLifecycleQueue(
  pool: pg.Pool,
): Promise<ArchitectLifecycleRecord[]> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [BUSINESS_ARCHITECT_QUEUE_KEY],
  );
  const doc = (res.rows[0]?.value ?? { records: [] }) as {
    records?: ArchitectLifecycleRecord[];
  };
  return Array.isArray(doc.records) ? doc.records : [];
}

export async function saveLifecycleQueue(
  pool: pg.Pool,
  records: ArchitectLifecycleRecord[],
): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'BUSINESS_ARCHITECT')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='BUSINESS_ARCHITECT'`,
    [
      BUSINESS_ARCHITECT_QUEUE_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        records: records.slice(-100),
      }),
    ],
  );
}
