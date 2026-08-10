/**
 * Persistent portfolio-wide learning memory (Knowledge Graph).
 *
 * A revenue system that operates across 10 businesses cannot afford to relearn
 * the same lesson ten times. This module encodes what we've learned as a small,
 * queryable graph of typed nodes and outcome-weighted edges:
 *
 *   BuyerSegment ──▶ Mechanism ──▶ Outcome
 *   Message      ──▶ Surface   ──▶ Outcome
 *   Mechanism    ──▶ Business  ──▶ Outcome
 *
 * There is deliberately no new persistence layer. Edges are appended as
 * `knowledge_edge` documents inside the existing pursuit-event ledger (see
 * ExperimentStore.appendPursuitEvent / listPursuitEvents). This keeps the
 * schema of `revenueos_experiments` unchanged while giving us a durable,
 * portfolio-wide substrate for transfer learning.
 *
 * Design rules:
 *   - Only `commercial > intent > verified_exposure` outcomes count as
 *     positive signal (matches action-class weights).
 *   - Aggregations return dollar-anchored deltas whenever the caller supplied
 *     revenueUsd, so ranking always chains back to money.
 *   - Portable across sites: transferrableInsights() re-emits the strongest
 *     source-site edges tagged for the target site, so a new business inherits
 *     lessons on day zero.
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { PursuitEvent } from "../types";

export type KnowledgeNodeType =
  | "buyer_segment"
  | "mechanism"
  | "message"
  | "surface"
  | "business"
  | "outcome";

export type KnowledgeOutcomeKind =
  | "verified_exposure"
  | "intent"
  | "commercial"
  | "none";

export type KnowledgeEdgeInput = {
  siteId: string;
  segment?: string;
  mechanism?: string;
  message?: string;
  surface?: string;
  business?: string;
  outcome: KnowledgeOutcomeKind;
  /** Actual revenue attributed to this edge, if any. */
  revenueUsd?: number;
  /** Free-form tag so callers can filter transfer candidates. */
  tag?: string;
  ts?: string;
};

export type KnowledgeEdge = KnowledgeEdgeInput & {
  id: string;
  createdAt: string;
};

export type KnowledgeQuery = {
  segment?: string;
  mechanism?: string;
  surface?: string;
  message?: string;
  business?: string;
  /** ISO timestamp: only include edges created after. */
  since?: string;
};

export type KnowledgeAggregate = {
  edgeCount: number;
  verifiedExposures: number;
  intents: number;
  commercialWins: number;
  revenueUsd: number;
  /** Weighted commercial score, matches action-class weights. */
  score: number;
  /** Top mechanisms observed under the query, ranked by score. */
  topMechanisms: Array<{ mechanism: string; score: number; revenueUsd: number }>;
  /** Top surfaces observed under the query, ranked by score. */
  topSurfaces: Array<{ surface: string; score: number; revenueUsd: number }>;
};

const OUTCOME_WEIGHT: Record<KnowledgeOutcomeKind, number> = {
  none: 0,
  verified_exposure: 1,
  intent: 4,
  commercial: 16,
};

/** Marker keeping knowledge edges scannable within pursuit_events. */
const KNOWLEDGE_KIND = "knowledge_edge";

function isKnowledgeEdgeEvent(
  event: PursuitEvent,
): event is PursuitEvent & { detail: Record<string, unknown> } {
  return (
    event.eventType === "beacon" &&
    typeof event.detail === "object" &&
    event.detail !== null &&
    (event.detail as { kind?: unknown }).kind === KNOWLEDGE_KIND
  );
}

function eventToEdge(event: PursuitEvent): KnowledgeEdge | null {
  if (!isKnowledgeEdgeEvent(event)) return null;
  const d = event.detail as Record<string, unknown>;
  const outcome = String(d.outcome ?? "none") as KnowledgeOutcomeKind;
  if (!(outcome in OUTCOME_WEIGHT)) return null;
  return {
    id: event.id,
    createdAt: event.createdAt,
    siteId: event.siteId,
    segment: typeof d.segment === "string" ? d.segment : undefined,
    mechanism: typeof d.mechanism === "string" ? d.mechanism : undefined,
    message: typeof d.message === "string" ? d.message : undefined,
    surface: typeof d.surface === "string" ? d.surface : undefined,
    business:
      typeof d.business === "string"
        ? d.business
        : event.siteId,
    outcome,
    revenueUsd: typeof d.revenueUsd === "number" ? d.revenueUsd : 0,
    tag: typeof d.tag === "string" ? d.tag : undefined,
    ts: event.createdAt,
  };
}

/**
 * Append a knowledge_edge to the pursuit-event ledger. Safe to call from any
 * cycle end / attribution step — dedupe is unnecessary because outcomes are
 * additive and every distinct observation is meaningful.
 */
export async function recordOutcomeEdge(input: {
  store: ExperimentStore;
  edge: KnowledgeEdgeInput;
  now?: Date;
}): Promise<KnowledgeEdge | { ok: false; reason: string }> {
  const { store, edge } = input;
  if (!store.appendPursuitEvent) {
    return { ok: false, reason: "store has no appendPursuitEvent" };
  }
  const now = input.now ?? new Date();
  const createdAt = edge.ts ?? now.toISOString();
  const evt: PursuitEvent = {
    id: newId("kedge"),
    pursuitId: "knowledge",
    siteId: edge.siteId,
    eventType: "beacon",
    detail: {
      kind: KNOWLEDGE_KIND,
      segment: edge.segment ?? null,
      mechanism: edge.mechanism ?? null,
      message: edge.message ?? null,
      surface: edge.surface ?? null,
      business: edge.business ?? edge.siteId,
      outcome: edge.outcome,
      revenueUsd: edge.revenueUsd ?? 0,
      tag: edge.tag ?? null,
    },
    createdAt,
  };
  await store.appendPursuitEvent(evt);
  return {
    id: evt.id,
    createdAt,
    siteId: edge.siteId,
    segment: edge.segment,
    mechanism: edge.mechanism,
    message: edge.message,
    surface: edge.surface,
    business: edge.business ?? edge.siteId,
    outcome: edge.outcome,
    revenueUsd: edge.revenueUsd ?? 0,
    tag: edge.tag,
    ts: createdAt,
  };
}

function matchesQuery(edge: KnowledgeEdge, q: KnowledgeQuery): boolean {
  if (q.segment && edge.segment !== q.segment) return false;
  if (q.mechanism && edge.mechanism !== q.mechanism) return false;
  if (q.surface && edge.surface !== q.surface) return false;
  if (q.message && edge.message !== q.message) return false;
  if (q.business && edge.business !== q.business) return false;
  if (q.since && Date.parse(edge.createdAt) < Date.parse(q.since)) return false;
  return true;
}

/**
 * Pull knowledge edges for a site (or many sites — call once per siteId or
 * pass in a pre-loaded events[] via queryKnowledgeGraphFromEvents).
 */
export async function queryKnowledgeGraph(input: {
  store: ExperimentStore;
  siteId: string;
  query?: KnowledgeQuery;
  limit?: number;
}): Promise<{ edges: KnowledgeEdge[]; aggregate: KnowledgeAggregate }> {
  const { store, siteId } = input;
  const query = input.query ?? {};
  if (!store.listPursuitEvents) {
    return { edges: [], aggregate: emptyAggregate() };
  }
  const events = await store.listPursuitEvents(siteId, {
    since: query.since,
    limit: input.limit ?? 500,
  });
  return queryKnowledgeGraphFromEvents({ events, query });
}

export function queryKnowledgeGraphFromEvents(input: {
  events: PursuitEvent[];
  query?: KnowledgeQuery;
}): { edges: KnowledgeEdge[]; aggregate: KnowledgeAggregate } {
  const query = input.query ?? {};
  const edges: KnowledgeEdge[] = [];
  for (const event of input.events) {
    const edge = eventToEdge(event);
    if (!edge) continue;
    if (!matchesQuery(edge, query)) continue;
    edges.push(edge);
  }
  return { edges, aggregate: aggregateEdges(edges) };
}

function emptyAggregate(): KnowledgeAggregate {
  return {
    edgeCount: 0,
    verifiedExposures: 0,
    intents: 0,
    commercialWins: 0,
    revenueUsd: 0,
    score: 0,
    topMechanisms: [],
    topSurfaces: [],
  };
}

function aggregateEdges(edges: KnowledgeEdge[]): KnowledgeAggregate {
  let ve = 0;
  let it = 0;
  let co = 0;
  let rev = 0;
  const mech = new Map<string, { score: number; revenueUsd: number }>();
  const surf = new Map<string, { score: number; revenueUsd: number }>();
  for (const e of edges) {
    const w = OUTCOME_WEIGHT[e.outcome];
    if (e.outcome === "verified_exposure") ve += 1;
    if (e.outcome === "intent") it += 1;
    if (e.outcome === "commercial") co += 1;
    rev += e.revenueUsd ?? 0;
    if (e.mechanism) {
      const b = mech.get(e.mechanism) ?? { score: 0, revenueUsd: 0 };
      b.score += w;
      b.revenueUsd += e.revenueUsd ?? 0;
      mech.set(e.mechanism, b);
    }
    if (e.surface) {
      const b = surf.get(e.surface) ?? { score: 0, revenueUsd: 0 };
      b.score += w;
      b.revenueUsd += e.revenueUsd ?? 0;
      surf.set(e.surface, b);
    }
  }
  const score =
    ve * OUTCOME_WEIGHT.verified_exposure +
    it * OUTCOME_WEIGHT.intent +
    co * OUTCOME_WEIGHT.commercial;
  return {
    edgeCount: edges.length,
    verifiedExposures: ve,
    intents: it,
    commercialWins: co,
    revenueUsd: Number(rev.toFixed(2)),
    score,
    topMechanisms: [...mech.entries()]
      .map(([mechanism, v]) => ({
        mechanism,
        score: v.score,
        revenueUsd: Number(v.revenueUsd.toFixed(2)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10),
    topSurfaces: [...surf.entries()]
      .map(([surface, v]) => ({
        surface,
        score: v.score,
        revenueUsd: Number(v.revenueUsd.toFixed(2)),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10),
  };
}

/**
 * Cross-site transfer: return the best (mechanism, surface, message) edges
 * from a source site as fresh recommendation edges for the target site.
 *
 * Only edges with positive commercial signal transfer — a mechanism that only
 * ever produced production/distribution work is not a lesson, it is dead code.
 */
export async function transferrableInsights(input: {
  store: ExperimentStore;
  sourceSiteId: string;
  targetSiteId: string;
  minScore?: number;
  limit?: number;
}): Promise<
  Array<{
    mechanism?: string;
    surface?: string;
    message?: string;
    segment?: string;
    reason: string;
    revenueUsd: number;
    score: number;
  }>
> {
  const { store, sourceSiteId, targetSiteId } = input;
  const minScore = input.minScore ?? OUTCOME_WEIGHT.intent;
  const limit = input.limit ?? 10;
  const { edges } = await queryKnowledgeGraph({
    store,
    siteId: sourceSiteId,
  });
  // Aggregate by (mechanism, surface) tuple — this is the granularity a new
  // business can immediately act on.
  type Key = string;
  const bucket = new Map<
    Key,
    {
      mechanism?: string;
      surface?: string;
      message?: string;
      segment?: string;
      score: number;
      revenueUsd: number;
    }
  >();
  for (const e of edges) {
    // Do not attempt to transfer edges the target already produced.
    if (e.business === targetSiteId) continue;
    const key = `${e.mechanism ?? "*"}|${e.surface ?? "*"}|${e.segment ?? "*"}`;
    const b = bucket.get(key) ?? {
      mechanism: e.mechanism,
      surface: e.surface,
      message: e.message,
      segment: e.segment,
      score: 0,
      revenueUsd: 0,
    };
    b.score += OUTCOME_WEIGHT[e.outcome];
    b.revenueUsd += e.revenueUsd ?? 0;
    if (!b.message && e.message) b.message = e.message;
    bucket.set(key, b);
  }
  return [...bucket.values()]
    .filter((b) => b.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((b) => ({
      mechanism: b.mechanism,
      surface: b.surface,
      message: b.message,
      segment: b.segment,
      revenueUsd: Number(b.revenueUsd.toFixed(2)),
      score: b.score,
      reason: `Transferred from ${sourceSiteId}: score ${b.score}, revenue $${b.revenueUsd.toFixed(2)}`,
    }));
}

export const __internal = { KNOWLEDGE_KIND, OUTCOME_WEIGHT };
