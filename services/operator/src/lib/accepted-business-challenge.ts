/**
 * Accepted-business challenge lifecycle on Azure Postgres:
 * OBSERVE → FITNESS → REPAIR → PIVOT → ECONOMIC JUDGMENT → soft-retire → replace.
 *
 * Does not mass-kill the portfolio. Escalation is evidence-bounded.
 */

import type pg from "pg";
import {
  evaluateBusinessFitness,
  persistFitnessSnapshots,
  summarizeFitness,
  FITNESS_CHALLENGE_KEY,
  type BusinessFitnessRecord,
} from "./accepted-business-fitness.js";
import {
  softRetireManagedBusinessPg,
  recordReplacementLineage,
} from "./portfolio-soft-retire-pg.js";
import {
  bestBenchOpportunity,
  benchEntryToOpportunity,
  listOpportunityBench,
} from "./opportunity-bench-pg.js";
import { seedArchitectReplacement } from "./business-architect-loop.js";
import { executeCodeEvolution } from "./code-evolution-executor.js";
import { executeBusinessPivot } from "./business-pivot.js";
import {
  loadAdmitCheckpoint,
  TARGET_PORTFOLIO_DEFAULT,
} from "./portfolio-admit-controller.js";
import { selectReplacementOpportunity } from "./titan-admission-gate.js";

export const CHALLENGE_VERSION = "accepted-challenge-v1";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

async function loadChallengeState(pool: pg.Pool): Promise<{
  bySite: Record<string, Record<string, unknown>>;
  cursor: number;
  lastFullEvalAt?: string;
}> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [FITNESS_CHALLENGE_KEY],
  );
  const doc = (res.rows[0]?.value ?? {}) as {
    bySite?: Record<string, Record<string, unknown>>;
    cursor?: number;
    lastFullEvalAt?: string;
  };
  return {
    bySite: doc.bySite ?? {},
    cursor: Number(doc.cursor ?? 0),
    lastFullEvalAt: doc.lastFullEvalAt,
  };
}

async function saveChallengeState(
  pool: pg.Pool,
  state: {
    bySite: Record<string, Record<string, unknown>>;
    cursor: number;
    lastFullEvalAt?: string;
  },
): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'ACCEPTED_CHALLENGE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='ACCEPTED_CHALLENGE'`,
    [
      FITNESS_CHALLENGE_KEY,
      JSON.stringify({
        ...state,
        version: CHALLENGE_VERSION,
        updatedAt: new Date().toISOString(),
      }),
    ],
  );
}

async function bumpRepair(pool: pg.Pool, siteId: string): Promise<void> {
  const st = await loadChallengeState(pool);
  const cur = { ...(st.bySite[siteId] ?? {}) };
  cur.repairAttempts = Number(cur.repairAttempts ?? 0) + 1;
  cur.lastRepairAt = new Date().toISOString();
  st.bySite[siteId] = cur;
  await saveChallengeState(pool, st);
}

/**
 * Evaluate all managed businesses (fitness snapshots) and escalate one site.
 */
export async function runAcceptedBusinessChallengeTick(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
}): Promise<{
  evaluated: number;
  summary: Record<string, number>;
  action?: string;
  siteId?: string;
}> {
  const cp = await loadAdmitCheckpoint(
    input.pool,
    TARGET_PORTFOLIO_DEFAULT,
    15,
  );
  const managed = [...new Set(cp.titanManaged)];
  if (!managed.length) {
    return { evaluated: 0, summary: {} };
  }

  const bench = await listOpportunityBench(input.pool);
  const bestBenchScore = bench[0]?.expected_value ?? null;

  const records: BusinessFitnessRecord[] = [];
  for (const siteId of managed) {
    try {
      const fitness = await evaluateBusinessFitness(input.pool, siteId, {
        strongerOpportunityScore: bestBenchScore,
        ownOpportunityScore: 55,
      });
      records.push(fitness);
    } catch (err) {
      input.logger("warn", "accepted_challenge.fitness_failed", {
        siteId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  await persistFitnessSnapshots(input.pool, records);
  const summary = summarizeFitness(records);
  input.logger("info", "accepted_challenge.fitness_summary", {
    version: CHALLENGE_VERSION,
    evaluated: records.length,
    ...summary,
  });

  const st = await loadChallengeState(input.pool);
  st.lastFullEvalAt = new Date().toISOString();

  // Pick one site to escalate — priority: ECONOMICALLY_FAILED > RETIREMENT > PIVOT > REPAIR
  const rank = (s: string) =>
    (
      {
        ECONOMICALLY_FAILED: 0,
        RETIREMENT_CANDIDATE: 1,
        PIVOT_CANDIDATE: 2,
        REPAIR_REQUIRED: 3,
      } as Record<string, number>
    )[s] ?? 9;

  const actionable = records
    .filter((r) =>
      [
        "ECONOMICALLY_FAILED",
        "RETIREMENT_CANDIDATE",
        "PIVOT_CANDIDATE",
        "REPAIR_REQUIRED",
      ].includes(r.fitness_state),
    )
    .sort((a, b) => rank(a.fitness_state) - rank(b.fitness_state));

  if (!actionable.length) {
    await saveChallengeState(input.pool, st);
    return { evaluated: records.length, summary };
  }

  // Rotate among actionable to avoid hammering one business.
  const idx = st.cursor % actionable.length;
  st.cursor = idx + 1;
  const target = actionable[idx]!;
  const siteState = st.bySite[target.business_id] ?? {};
  const repairAttempts = Number(siteState.repairAttempts ?? target.repair_attempts);
  const pivotAttempts = Number(siteState.pivotAttempts ?? target.pivot_attempts);
  await saveChallengeState(input.pool, st);

  // REPAIR path
  if (
    target.fitness_state === "REPAIR_REQUIRED" &&
    repairAttempts < 3
  ) {
    await bumpRepair(input.pool, target.business_id);
    const evo = await executeCodeEvolution({
      pool: input.pool,
      appRoot: input.appRoot,
      siteId: target.business_id,
      logger: input.logger,
    });
    input.logger("info", "accepted_challenge.repair", {
      siteId: target.business_id,
      result: evo.result,
      evolutionId: evo.evolutionId,
    });
    return {
      evaluated: records.length,
      summary,
      action: `repair:${evo.result}`,
      siteId: target.business_id,
    };
  }

  // PIVOT path — thesis change when demand/positioning is the bottleneck
  if (
    (target.fitness_state === "PIVOT_CANDIDATE" ||
      (target.fitness_state === "REPAIR_REQUIRED" && repairAttempts >= 3)) &&
    pivotAttempts < 2
  ) {
    const pivot = await executeBusinessPivot({
      pool: input.pool,
      appRoot: input.appRoot,
      siteId: target.business_id,
      logger: input.logger,
    });
    return {
      evaluated: records.length,
      summary,
      action: `pivot:${pivot.result}`,
      siteId: target.business_id,
    };
  }

  // RETIRE — only ECONOMICALLY_FAILED or RETIREMENT_CANDIDATE after repair+pivot budget
  const mayRetire =
    target.fitness_state === "ECONOMICALLY_FAILED" ||
    (target.fitness_state === "RETIREMENT_CANDIDATE" &&
      repairAttempts >= 2 &&
      pivotAttempts >= 1);

  if (!mayRetire) {
    input.logger("info", "accepted_challenge.hold", {
      siteId: target.business_id,
      state: target.fitness_state,
      repairAttempts,
      pivotAttempts,
      reason: "escalation_budget_not_exhausted",
    });
    return {
      evaluated: records.length,
      summary,
      action: "hold",
      siteId: target.business_id,
    };
  }

  // Prefer open-world / bench replacement over priors.
  const exclude = [
    ...managed,
    ...cp.accepted,
    ...cp.rejected,
    ...((cp as { softRetired?: string[] }).softRetired ?? []),
  ];
  const benchOpp = await bestBenchOpportunity(input.pool, exclude);
  let replacementOpp = benchOpp ? benchEntryToOpportunity(benchOpp) : null;
  if (!replacementOpp) {
    replacementOpp = selectReplacementOpportunity({
      rejectedSiteId: target.business_id,
      criteria: `soft_retire:${target.fitness_state}`,
      activeSiteIds: managed,
      activeIndustries: [],
      rejectedSiteIds: cp.rejected,
    });
  }

  const retire = await softRetireManagedBusinessPg({
    pool: input.pool,
    siteId: target.business_id,
    fitness: target,
    reason: `challenge:${target.fitness_state}:${target.bottleneck ?? "economic"}`,
    replacementOpportunityId: replacementOpp?.id ?? null,
    expectedValueKeep: target.titan_confidence,
    expectedValueReplace: replacementOpp?.score ?? bestBenchScore ?? 65,
    logger: input.logger,
  });

  if (retire.status === "SOFT_RETIRED" && replacementOpp) {
    const seeded = await seedArchitectReplacement({
      pool: input.pool,
      logger: input.logger,
      opportunity: replacementOpp,
      replacesSiteId: target.business_id,
      criteria: `post_retire_replace:${benchOpp?.origin ?? "prior_fallback"}`,
    });
    // Push into admit replacement queue
    const cp2 = await loadAdmitCheckpoint(
      input.pool,
      TARGET_PORTFOLIO_DEFAULT,
      15,
    );
    if (!cp2.replacementQueue) cp2.replacementQueue = [];
    if (!cp2.replacementQueue.includes(replacementOpp.siteId)) {
      cp2.replacementQueue.push(replacementOpp.siteId);
    }
    const { saveAdmitCheckpoint } = await import(
      "./portfolio-admit-controller.js"
    );
    await saveAdmitCheckpoint(input.pool, cp2);

    await recordReplacementLineage(input.pool, {
      retiredBusiness: target.business_id,
      vacancyReason: retire.reason,
      opportunityId: replacementOpp.id,
      replacementSiteId: replacementOpp.siteId,
      origin: benchOpp?.origin ?? "OPPORTUNITY_PRIOR",
      status: seeded.ok ? "REPLACEMENT_SEEDED" : "REPLACEMENT_SEED_FAILED",
      detail: seeded.detail,
    });
  }

  return {
    evaluated: records.length,
    summary,
    action: `retire:${retire.status}`,
    siteId: target.business_id,
  };
}

export async function runAcceptedBusinessChallengeLane(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
}): Promise<void> {
  const interval = input.intervalMs ?? 180_000;
  input.logger("info", "accepted_challenge.lane.start", {
    version: CHALLENGE_VERSION,
  });
  let first = true;
  while (!input.signal.aborted) {
    if (!first) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, interval);
        input.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            resolve();
          },
          { once: true },
        );
      });
    }
    first = false;
    if (input.signal.aborted) break;
    try {
      await runAcceptedBusinessChallengeTick({
        pool: input.pool,
        appRoot: input.appRoot,
        logger: input.logger,
      });
    } catch (err) {
      input.logger("error", "accepted_challenge.lane.error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  input.logger("info", "accepted_challenge.lane.stop", {});
}
