/**
 * ULTRON_ARCHITECTURE_GAP_MAP.
 *
 * Live gap-map computed from the actual codebase + production state.
 * Each entry classifies a concept as ALREADY_REAL / PARTIAL /
 * FEATURE_THEATER / MISSING / DUPLICATED / DISCONNECTED, and where
 * possible attaches the existing component reference so downstream
 * decisions can extend rather than duplicate.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { GapMapEntry, Logger } from "./types.js";

function repoRoot(): string {
  return (
    process.env.REVENUEOS_REPO_ROOT ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  );
}

function fileExists(rel: string): boolean {
  return existsSync(path.join(repoRoot(), rel));
}

async function tableExists(pool: pg.Pool, name: string): Promise<boolean> {
  try {
    const r = await pool.query(
      `select 1 from information_schema.tables where table_name = $1 limit 1`,
      [name],
    );
    return (r.rowCount ?? 0) > 0;
  } catch {
    return false;
  }
}

async function tableRowcount(pool: pg.Pool, name: string): Promise<number> {
  try {
    const r = await pool.query(`select count(*)::int as n from ${name}`);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function computeGapMap(
  pool: pg.Pool,
  logger: Logger,
): Promise<{
  entries: GapMapEntry[];
  missingLinks: string[];
  organs: Record<string, { real: number; partial: number; missing: number }>;
}> {
  const entries: GapMapEntry[] = [];

  const worldTables = [
    "titan_world_store",
    "aq_channel_surfaces",
    "aq_business_surfaces",
  ];
  const [twsExists, chExists, bsExists] = await Promise.all(
    worldTables.map((t) => tableExists(pool, t)),
  );
  const rosWfExists = await tableExists(pool, "ros_world_facts");
  const rosWfCount = rosWfExists ? await tableRowcount(pool, "ros_world_facts") : 0;

  entries.push({
    concept: "World model (structured, timestamped, sourced)",
    organ: 1,
    existingComponent: [
      twsExists && "titan_world_store",
      chExists && "aq_channel_surfaces",
      bsExists && "aq_business_surfaces",
      rosWfExists && "ros_world_facts",
    ]
      .filter(Boolean)
      .join(", ") || null,
    status: rosWfExists && rosWfCount > 0 ? "ALREADY_REAL" : rosWfExists ? "PARTIAL" : "MISSING",
    missingLink: rosWfExists ? null : "Unified queryable world model with time+source+confidence",
    evidence: { rosWfCount },
  });

  entries.push({
    concept: "Continuous knowledge acquisition (world model refresh)",
    organ: 1,
    existingComponent: "titan-research-engine + titan-world-lane",
    status: fileExists("services/operator/src/lib/titan-world-lane.ts") ? "PARTIAL" : "MISSING",
    missingLink: "Research findings must always mutate the world model with expiry horizons.",
  });

  const capRegExists = await tableExists(pool, "ros_capability_registry");
  const capGraphExists = await tableExists(pool, "ros_capability_graph");
  const capGraphCount = capGraphExists ? await tableRowcount(pool, "ros_capability_graph") : 0;

  entries.push({
    concept: "Capability graph (C0–C6 proof levels + bus)",
    organ: 2,
    existingComponent: capGraphExists ? "ros_capability_graph" : capRegExists ? "ros_capability_registry" : null,
    status: capGraphCount > 0 ? "ALREADY_REAL" : capGraphExists ? "PARTIAL" : "MISSING",
    missingLink: capGraphCount > 0 ? null : "Bus derives proof levels from live evidence, not registry state alone.",
    evidence: { capGraphCount },
  });

  const skillsExists = await tableExists(pool, "ros_skills");
  const skillsCount = skillsExists ? await tableRowcount(pool, "ros_skills") : 0;
  entries.push({
    concept: "Executable skill library (compounding compositions)",
    organ: 2,
    existingComponent: skillsExists ? "ros_skills" : null,
    status: skillsCount > 0 ? "ALREADY_REAL" : skillsExists ? "PARTIAL" : "MISSING",
    missingLink: skillsCount > 0 ? null : "Skill compositions must be seeded from proven AE v3 executions.",
    evidence: { skillsCount },
  });

  entries.push({
    concept: "Capability compiler (desired-effect → path or gap)",
    organ: 2,
    existingComponent: "ultron-core/capability-compiler.ts",
    status: fileExists("services/operator/src/lib/ultron-core/capability-compiler.ts")
      ? "ALREADY_REAL"
      : "MISSING",
    missingLink: null,
  });

  entries.push({
    concept: "Adversarial strategy review (proposer vs. critic)",
    organ: 3,
    existingComponent: "titan-commercial-executive + ae/novel/design-options",
    status: "PARTIAL",
    missingLink:
      "Critic runs alongside proposer, receives message-only view, blocks send if fails.",
  });

  entries.push({
    concept: "Outcome prediction + calibration",
    organ: 3,
    existingComponent: "ros_first_task_state.predictions (new)",
    status: "PARTIAL",
    missingLink: "Predictions recorded, but calibration curve/adjustment loop still needed.",
  });

  entries.push({
    concept: "Automatic curriculum (M1–M9)",
    organ: 3,
    existingComponent: "ros_curriculum_state",
    status: (await tableExists(pool, "ros_curriculum_state")) ? "ALREADY_REAL" : "MISSING",
    missingLink: null,
  });

  entries.push({
    concept: "Local-maximum breaker",
    organ: 3,
    existingComponent: "ultron-core/local-max-breaker.ts + ae/novel/v3/design-memory.ts",
    status: fileExists("services/operator/src/lib/ultron-core/local-max-breaker.ts")
      ? "ALREADY_REAL"
      : "PARTIAL",
    missingLink: null,
  });

  entries.push({
    concept: "Cognitive resource router (deterministic/cheap/strong)",
    organ: 3,
    existingComponent: "ultron-core/cognitive-router.ts",
    status: process.env.ULTRON_STRONG_MODEL || process.env.OPENAI_STRONG_MODEL
      ? "ALREADY_REAL"
      : "PARTIAL",
    missingLink: (process.env.ULTRON_STRONG_MODEL || process.env.OPENAI_STRONG_MODEL)
      ? null
      : "No strong reasoning model authorized in runtime — COGNITIVE_CAPABILITY_LIMIT will fire.",
  });

  entries.push({
    concept: "Actuation: outbound email",
    organ: 4,
    existingComponent: "capability-reality + ae v3 v3-external-email-action",
    status: "ALREADY_REAL",
    missingLink: null,
  });
  entries.push({
    concept: "Actuation: inbound email (inbox as sensor)",
    organ: 4,
    existingComponent: "ros_inbound_messages",
    status: (await tableRowcount(pool, "ros_inbound_messages")) > 0 ? "PARTIAL" : "DISCONNECTED",
    missingLink: "Inbound webhook receiver is not wired end-to-end — inbox exists but is unused.",
  });
  entries.push({
    concept: "Actuation: browser operator",
    organ: 4,
    existingComponent: null,
    status: "MISSING",
    missingLink: "No persistent Playwright/CDP operator in production runtime.",
  });
  entries.push({
    concept: "Actuation: autonomous account factory",
    organ: 4,
    existingComponent: "ros_platform_accounts + ros_credential_vault",
    status: (await tableRowcount(pool, "ros_platform_accounts")) > 0 ? "PARTIAL" : "MISSING",
    missingLink: "Account creation flow exists as intention only — no autonomous registration proven.",
  });
  entries.push({
    concept: "External event bus (normalized)",
    organ: 4,
    existingComponent: "ros_ultron_events (ultron)",
    status: (await tableExists(pool, "ros_ultron_events")) ? "ALREADY_REAL" : "MISSING",
    missingLink: null,
  });

  entries.push({
    concept: "Episodic / semantic / procedural memory separation",
    organ: 5,
    existingComponent: "commercial_comms_lessons + ros_skills + ros_world_facts",
    status: "PARTIAL",
    missingLink: "Promotion pipeline: episode → generalized lesson → procedural skill still manual.",
  });
  entries.push({
    concept: "Reflection loop (produces action)",
    organ: 5,
    existingComponent: "ae v3 design-memory + ultron first-task reflection",
    status: "PARTIAL",
    missingLink: "Reflection runs after each first-task tick; broader reflections not yet automated.",
  });
  entries.push({
    concept: "Causal attribution graph",
    organ: 5,
    existingComponent: "aq_distribution_receipts + ros_traffic_events + ros_ultron_events",
    status: "PARTIAL",
    missingLink: "Attribution join exists, but no first-class attribution table / graph traversal.",
  });
  entries.push({
    concept: "Proof ledger",
    organ: 5,
    existingComponent: "ros_proof_ledger",
    status: (await tableExists(pool, "ros_proof_ledger")) ? "ALREADY_REAL" : "MISSING",
    missingLink: null,
  });
  entries.push({
    concept: "Closed-loop watcher",
    organ: 5,
    existingComponent: "ros_closed_loop_defects",
    status: (await tableExists(pool, "ros_closed_loop_defects")) ? "ALREADY_REAL" : "MISSING",
    missingLink: null,
  });
  entries.push({
    concept: "Self-engineering (AE) integrated into capability system",
    organ: 5,
    existingComponent: "autonomous-engineering/loop + novel/v3/external-action-002",
    status: "PARTIAL",
    missingLink:
      "AE runs, but its own skills (TRACE_CODE_PATH, DESIGN_ARCHITECTURE, PATCH_CODE, DEPLOY, MEASURE_EFFECT) are not first-class skill objects yet.",
  });

  const missingLinks = entries
    .filter((e) => e.missingLink)
    .map((e) => `${e.concept}: ${e.missingLink}`);

  const organs: Record<string, { real: number; partial: number; missing: number }> = {};
  for (const e of entries) {
    const key = `ORGAN_${e.organ}`;
    if (!organs[key]) organs[key] = { real: 0, partial: 0, missing: 0 };
    if (e.status === "ALREADY_REAL") organs[key].real++;
    else if (e.status === "PARTIAL" || e.status === "DISCONNECTED" || e.status === "DUPLICATED")
      organs[key].partial++;
    else organs[key].missing++;
  }

  await pool.query(
    `insert into ros_gap_map (snapshot_id, taken_at, map, missing_links, organs)
     values ($1, now(), $2::jsonb, $3::jsonb, $4::jsonb)`,
    [
      `gap_${randomUUID().slice(0, 12)}`,
      JSON.stringify(entries),
      JSON.stringify(missingLinks),
      JSON.stringify(organs),
    ],
  );

  logger("info", "ultron.gap_map.computed", {
    entries: entries.length,
    missingLinks: missingLinks.length,
    organs,
  });
  return { entries, missingLinks, organs };
}

export async function latestGapMap(pool: pg.Pool): Promise<{
  entries: GapMapEntry[];
  missingLinks: string[];
  organs: Record<string, unknown>;
} | null> {
  const r = await pool.query(
    `select map, missing_links, organs from ros_gap_map order by taken_at desc limit 1`,
  );
  if (!r.rows[0]) return null;
  return {
    entries: (r.rows[0].map ?? []) as GapMapEntry[],
    missingLinks: (r.rows[0].missing_links ?? []) as string[],
    organs: (r.rows[0].organs ?? {}) as Record<string, unknown>,
  };
}
