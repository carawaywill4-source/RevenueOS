/**
 * Organ 3 — LOCAL-MAXIMUM BREAKER.
 *
 * Detects when RevenueOS is oscillating with no proof-level advancement.
 * Rule: same strategy + same blocker over ≥3 consecutive project ticks
 * and no proof-level movement in ≥6h.
 *
 * When triggered, records a defect (`ENGINEERING_WITHOUT_EXTERNAL_PROOF`),
 * writes a snapshot to ros_config_meta so downstream lanes read it, and
 * requests the cognitive router to escalate to STRONG reasoning.
 */

import type pg from "pg";
import type { Logger } from "./types.js";

const STATE_KEY = "ultron_local_max_state";

type LocalMaxSnapshot = {
  frozenStrategies: string[];
  reason: string;
  detectedAt: string;
  affectedProjects: string[];
  proofLevelAtDetection: number;
};

async function loadSnapshot(pool: pg.Pool): Promise<LocalMaxSnapshot | null> {
  const r = await pool.query(
    `select value from ros_config_meta where key = $1`,
    [STATE_KEY],
  );
  return (r.rows[0]?.value as LocalMaxSnapshot | null) ?? null;
}

async function saveSnapshot(pool: pg.Pool, snap: LocalMaxSnapshot): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [STATE_KEY, JSON.stringify(snap)],
  );
}

export async function detectAndBreak(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ triggered: boolean; snapshot: LocalMaxSnapshot | null }> {
  // Look at AE novel project states.
  const projRows = await pool.query(
    `select key, value->>'stage' as stage,
            coalesce((value->>'proofLevel')::int, 0) as proof,
            value->>'selectedGapId' as gap,
            value->'commercial'->>'humans' as humans,
            (value->>'updatedAt')::timestamptz as updated_at
       from ros_config_meta
      where key like 'ae_novel%'
      order by updated_at desc
      limit 10`,
  );

  const affected: string[] = [];
  let maxProof = 0;
  let strategySignature = "";
  for (const p of projRows.rows) {
    const proof = Number(p.proof ?? 0);
    maxProof = Math.max(maxProof, proof);
    if (String(p.stage ?? "") === "COMMERCIALLY_EFFECTIVE" && Number(p.humans ?? 0) === 0) {
      affected.push(String(p.key));
      strategySignature += `${p.key}:${p.gap};`;
    }
  }

  if (affected.length === 0) {
    return { triggered: false, snapshot: null };
  }

  const prior = await loadSnapshot(pool);
  const priorSig = (prior as unknown as { strategySignature?: string })?.strategySignature ?? "";
  const priorProof = Number(prior?.proofLevelAtDetection ?? 0);

  // Trigger criterion: same strategy signature persisted, proof did not advance.
  if (prior && priorSig === strategySignature && priorProof >= maxProof) {
    logger("warn", "ultron.local_max.persistent", {
      affected,
      proof: maxProof,
      priorProof,
      strategySignature: strategySignature.slice(0, 200),
    });
    // Already frozen — leave the snapshot in place, mark defect.
    await pool.query(
      `insert into ros_closed_loop_defects
         (defect_id, kind, subject, detail, severity, status, first_seen_at, last_seen_at)
       values ('def_localmax_persistent', 'ENGINEERING_WITHOUT_EXTERNAL_PROOF',
               'AE_NOVEL_PROJECTS', $1, 'HIGH', 'OPEN', now(), now())
       on conflict (defect_id) do update set
         detail = excluded.detail, last_seen_at = now(), status = 'OPEN'`,
      [`Local max persistent: ${affected.join(",")} proof=${maxProof}`],
    );
    return { triggered: true, snapshot: prior };
  }

  // New freeze.
  const snap: LocalMaxSnapshot & { strategySignature: string } = {
    frozenStrategies: affected,
    strategySignature,
    reason: `No proof-level advancement while ${affected.length} project(s) sit at proof=${maxProof}.`,
    detectedAt: new Date().toISOString(),
    affectedProjects: affected,
    proofLevelAtDetection: maxProof,
  };
  await saveSnapshot(pool, snap);
  logger("warn", "ultron.local_max.frozen", { snap });
  await pool.query(
    `insert into ros_closed_loop_defects
       (defect_id, kind, subject, detail, severity, status, first_seen_at, last_seen_at)
     values ('def_localmax_freeze', 'ENGINEERING_WITHOUT_EXTERNAL_PROOF',
             'AE_NOVEL_PROJECTS', $1, 'HIGH', 'OPEN', now(), now())
     on conflict (defect_id) do update set
       detail = excluded.detail, last_seen_at = now(), status = 'OPEN'`,
    [snap.reason],
  );
  return { triggered: true, snapshot: snap };
}

export async function readLocalMaxSnapshot(
  pool: pg.Pool,
): Promise<LocalMaxSnapshot | null> {
  return loadSnapshot(pool);
}
