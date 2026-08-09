/**
 * Self-improving strategist: A/B test prompt variants over time.
 *
 * Maintains a small registry of prompt versions with per-version outcome
 * scores (successes / attempts). Selection is via Thompson sampling on a
 * Beta(1+wins, 1+losses) posterior — this converges on the best prompt while
 * still exploring variants that could beat the incumbent.
 *
 * Backed by the ExperimentStore (piggy-backs on pursuit-events via a
 * `prompt_outcome` beacon detail) so no schema migration is needed. A local
 * cache is used inside a single process for hot reads.
 *
 * IMPORTANT: this module only imports the openai-client — it never modifies
 * it. All actual OpenAI calls remain in llm-strategist.ts (owned by the
 * parallel worker).
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type { PursuitEvent } from "../types";

export type StrategistPromptVersion = {
  id: string;
  label: string;
  systemPrompt: string;
  createdAt: string;
  /** Optional model override for this variant. */
  model?: string;
};

export type StrategistPromptOutcome = {
  versionId: string;
  siteId: string;
  ok: boolean;
  /** Optional numeric reward; when set, ok is derived (reward > 0). */
  reward?: number;
  reason?: string;
  ts: string;
};

/**
 * Default seed registry. Callers may extend via registerPromptVersion() but
 * these two versions guarantee the sampler always has something to draw from.
 */
const DEFAULT_VERSIONS: StrategistPromptVersion[] = [
  {
    id: "v1_direct",
    label: "direct-money",
    systemPrompt:
      "You are RevenueOS. Optimize for real, collected revenue. Speak in dollar-anchored, concrete next moves.",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "v2_socratic",
    label: "socratic-friction",
    systemPrompt:
      "You are RevenueOS. Before proposing a move, name the buyer's primary objection, then remove it in the same reply.",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const memoryRegistry = new Map<string, StrategistPromptVersion>();
for (const v of DEFAULT_VERSIONS) memoryRegistry.set(v.id, v);

export function registerPromptVersion(v: StrategistPromptVersion): void {
  memoryRegistry.set(v.id, v);
}

export function listPromptVersions(): StrategistPromptVersion[] {
  return [...memoryRegistry.values()];
}

const PROMPT_OUTCOME_KIND = "prompt_outcome";

function readOutcomesFromEvents(events: PursuitEvent[]): StrategistPromptOutcome[] {
  const out: StrategistPromptOutcome[] = [];
  for (const e of events) {
    if (e.eventType !== "beacon") continue;
    const d = (e.detail ?? {}) as Record<string, unknown>;
    if (d.kind !== PROMPT_OUTCOME_KIND) continue;
    const versionId = typeof d.versionId === "string" ? d.versionId : null;
    if (!versionId) continue;
    const ok = d.ok === true;
    const reward = typeof d.reward === "number" ? d.reward : undefined;
    out.push({
      versionId,
      siteId: e.siteId,
      ok: ok || (typeof reward === "number" && reward > 0),
      reward,
      reason: typeof d.reason === "string" ? d.reason : undefined,
      ts: e.createdAt,
    });
  }
  return out;
}

export type PromptSelection = {
  version: StrategistPromptVersion;
  posteriorWinRate: number;
  trials: number;
  wins: number;
};

/**
 * Thompson sampling over all registered versions. `rand` may be injected for
 * deterministic tests. When no outcomes exist, all versions get a uniform
 * Beta(1,1) draw and one is selected uniformly at random.
 */
export function selectStrategistPromptVersion(input?: {
  outcomes?: StrategistPromptOutcome[];
  rand?: () => number;
  registry?: StrategistPromptVersion[];
}): PromptSelection {
  const registry = input?.registry ?? listPromptVersions();
  if (registry.length === 0) {
    throw new Error("no prompt versions registered");
  }
  const rand = input?.rand ?? Math.random;
  const outcomes = input?.outcomes ?? [];
  const stats = new Map<string, { wins: number; losses: number }>();
  for (const v of registry) stats.set(v.id, { wins: 0, losses: 0 });
  for (const o of outcomes) {
    const s = stats.get(o.versionId);
    if (!s) continue;
    if (o.ok) s.wins += 1;
    else s.losses += 1;
  }

  let best: PromptSelection | null = null;
  let bestDraw = -Infinity;
  for (const v of registry) {
    const s = stats.get(v.id)!;
    const alpha = 1 + s.wins;
    const beta = 1 + s.losses;
    const draw = sampleBeta(alpha, beta, rand);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = {
        version: v,
        posteriorWinRate: alpha / (alpha + beta),
        trials: s.wins + s.losses,
        wins: s.wins,
      };
    }
  }
  return best!;
}

/**
 * Load outcomes for a site (or all sites) from the durable store. Convenience
 * over hand-rolling listPursuitEvents. When multiple siteIds are provided,
 * outcomes are merged — cross-site prompt learning is the point.
 */
export async function loadPromptOutcomes(input: {
  store: ExperimentStore;
  siteIds: string[];
  sinceMs?: number;
  now?: Date;
}): Promise<StrategistPromptOutcome[]> {
  if (!input.store.listPursuitEvents) return [];
  const now = input.now ?? new Date();
  const since = input.sinceMs
    ? new Date(now.getTime() - input.sinceMs).toISOString()
    : undefined;
  const merged: StrategistPromptOutcome[] = [];
  for (const siteId of input.siteIds) {
    const events = await input.store.listPursuitEvents(siteId, {
      since,
      limit: 500,
    });
    merged.push(...readOutcomesFromEvents(events));
  }
  return merged;
}

/**
 * Record one outcome. Deliberately fire-and-forget — the caller must not gate
 * on this write. Persistence failures degrade to in-memory-only learning.
 */
export async function recordPromptOutcome(input: {
  store: ExperimentStore;
  siteId: string;
  outcome: Omit<StrategistPromptOutcome, "ts" | "siteId"> & { ts?: string };
  now?: Date;
}): Promise<{ ok: boolean; reason?: string }> {
  const { store } = input;
  if (!store.appendPursuitEvent) return { ok: false, reason: "no persistence" };
  const now = input.now ?? new Date();
  const evt: PursuitEvent = {
    id: newId("prompt"),
    pursuitId: "prompt",
    siteId: input.siteId,
    eventType: "beacon",
    detail: {
      kind: PROMPT_OUTCOME_KIND,
      versionId: input.outcome.versionId,
      ok: input.outcome.ok,
      reward: input.outcome.reward ?? null,
      reason: input.outcome.reason ?? null,
    },
    createdAt: input.outcome.ts ?? now.toISOString(),
  };
  try {
    await store.appendPursuitEvent(evt);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

function sampleBeta(alpha: number, beta: number, rand: () => number): number {
  // Sample two independent Gammas via Marsaglia & Tsang; return X/(X+Y).
  const x = sampleGamma(alpha, rand);
  const y = sampleGamma(beta, rand);
  if (x + y <= 0) return 0.5;
  return x / (x + y);
}

function sampleGamma(shape: number, rand: () => number): number {
  if (shape < 1) {
    const g = sampleGamma(shape + 1, rand);
    const u = Math.max(1e-12, rand());
    return g * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x = 0;
    let v = 0;
    do {
      x = normal(rand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(Math.max(u, 1e-12)) < 0.5 * x * x + d * (1 - v + Math.log(v)))
      return d * v;
  }
}

function normal(rand: () => number): number {
  const u1 = Math.max(1e-12, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export const __internal = { PROMPT_OUTCOME_KIND };
