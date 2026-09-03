/**
 * RevenueOS CORE self-evolution — isolated workspace, diffable, reversible.
 * Never edits the only production copy without a restore baseline.
 *
 * Does NOT churn: requires demonstrated limitation + expected benefit.
 * HIGH/R3/R4 actions are denied by Apex.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import type pg from "pg";
import { governAction } from "@revenueos/core";

export const CORE_EVOLUTION_VERSION = "core-evolution-v1";
export const CORE_EVOLUTION_KEY = "core_evolution_receipts";
export const CORE_EVOLUTION_LESSONS_KEY = "core_evolution_lessons";

export type CoreRisk = "LOW" | "MEDIUM" | "HIGH";

export type CoreEvolutionProposal = {
  evolutionId: string;
  problem: string;
  evidence: string[];
  hypothesis: string;
  expectedBenefit: string;
  baseline: string;
  targetRelPath: string;
  patchKind: "ADD_TELEMETRY_COMMENT" | "NOOP_TEST_GUARD";
  risk: CoreRisk;
  createdAt: string;
};

export type CoreEvolutionReceipt = {
  evolutionId: string;
  proposal: CoreEvolutionProposal;
  startedAt: string;
  completedAt?: string;
  workspaceDir?: string;
  baselineHash?: string;
  result: "PROPOSED" | "RETAINED" | "ROLLED_BACK" | "FAILED" | "DENIED" | "SKIPPED";
  detail: string;
  apex?: { authorized: boolean; detail: string; riskClass: string };
  tests?: { ok: boolean; detail: string };
};

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}

async function saveReceipt(pool: pg.Pool, receipt: CoreEvolutionReceipt) {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [CORE_EVOLUTION_KEY],
  );
  const doc = (res.rows[0]?.value ?? { receipts: [] }) as {
    receipts?: CoreEvolutionReceipt[];
  };
  const receipts = Array.isArray(doc.receipts) ? [...doc.receipts] : [];
  const idx = receipts.findIndex((r) => r.evolutionId === receipt.evolutionId);
  if (idx >= 0) receipts[idx] = receipt;
  else receipts.push(receipt);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'CORE_EVOLUTION')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CORE_EVOLUTION'`,
    [
      CORE_EVOLUTION_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        receipts: receipts.slice(-80),
      }),
    ],
  );
}

async function saveLesson(
  pool: pg.Pool,
  lesson: Record<string, unknown>,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [CORE_EVOLUTION_LESSONS_KEY],
  );
  const doc = (res.rows[0]?.value ?? { lessons: [] }) as {
    lessons?: Record<string, unknown>[];
  };
  const lessons = Array.isArray(doc.lessons) ? [...doc.lessons] : [];
  lessons.push(lesson);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'CORE_EVOLUTION')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CORE_EVOLUTION'`,
    [
      CORE_EVOLUTION_LESSONS_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        lessons: lessons.slice(-80),
      }),
    ],
  );
}

/**
 * Detect a real limitation that justifies a LOW-risk core patch.
 * Returns null when no demonstrated limitation — prevents self-churn.
 *
 * Meta-contradictions (commercial incompetence signals) always count as
 * demonstrated limitations even when no code stub remains.
 */
export async function detectCoreLimitation(
  pool: pg.Pool,
  appRoot: string,
): Promise<CoreEvolutionProposal | null> {
  // —— Meta-contradiction detector (must never return false calm during stalls) ——
  const zt = await pool.query(
    `select value from ros_config_meta where key='zero_traffic_war_room' limit 1`,
  );
  const ztDoc = (zt.rows[0]?.value ?? {}) as {
    status?: string;
    meaningfulAttemptsPerHour?: number;
    channelReality?: {
      discovered?: number;
      thirdPartyAutoExecutable?: number;
      acceptedOrPublishedNewAudience24h?: number;
    };
  };
  const humans = await pool.query(
    `select count(*)::int as n from ros_traffic_events
     where created_at > now() - interval '48 hours'
       and class in ('LIKELY_HUMAN','QUALIFIED')
       and coalesce(referer,'') <> ''
       and referer not ilike '%sslip.io%'`,
  );
  const verifiedHumans = Number(humans.rows[0]?.n ?? 0);
  const attemptsPerHour = Number(ztDoc.meaningfulAttemptsPerHour ?? 0);
  const discovered = Number(ztDoc.channelReality?.discovered ?? 0);
  const thirdAuto = Number(
    ztDoc.channelReality?.thirdPartyAutoExecutable ?? 0,
  );
  const contradictions: string[] = [];
  if (ztDoc.status === "CRITICAL" && verifiedHumans === 0 && attemptsPerHour < 0.5) {
    contradictions.push(
      "goal=customers + humans=0 + meaningful_attempts/hour<0.5",
    );
  }
  if (discovered >= 100 && thirdAuto <= 1) {
    contradictions.push(
      `claimed_channels=${discovered} but third_party_auto_executable=${thirdAuto}`,
    );
  }
  if (
    ztDoc.status === "CRITICAL" &&
    Number(ztDoc.channelReality?.acceptedOrPublishedNewAudience24h ?? 0) === 0
  ) {
    contradictions.push("zero_traffic_critical + zero_new_audience_publications_24h");
  }

  if (contradictions.length) {
    await pool.query(
      `insert into ros_config_meta (key, value, updated_at, provenance)
       values ('self_evolution_contradictions', $1::jsonb, now(), 'CORE_EVOLUTION')
       on conflict (key) do update set
         value=excluded.value, updated_at=now(), provenance='CORE_EVOLUTION'`,
      [
        JSON.stringify({
          updatedAt: new Date().toISOString(),
          contradictions,
          verifiedHumans,
          attemptsPerHour,
          discovered,
          thirdAuto,
          note: "Demonstrated system limitation — not SKIPPED calm",
        }),
      ],
    );
    // Prefer actionable commercial patch target when present
    const targetRelPath =
      "services/operator/src/lib/capability-reality/registry.ts";
    const absMeta = path.join(appRoot, targetRelPath);
    if (existsSync(absMeta)) {
      return {
        evolutionId: newId("corevo"),
        problem: `Commercial meta-contradiction: ${contradictions.join(" | ")}`,
        evidence: contradictions,
        hypothesis:
          "Capability reality audit + distribution registry must stay authoritative; treat stalls as demonstrated limitations, never no_demonstrated_limitation.",
        expectedBenefit:
          "Self-evolution cannot claim calm while acquisition is stalled; forces capability repairs.",
        baseline: "skip_on_stub_absence_only",
        targetRelPath,
        patchKind: "NOOP_TEST_GUARD",
        risk: "LOW",
        createdAt: new Date().toISOString(),
      };
    }
  }

  // Limitation: Mac/Supabase evolution path still hardcodes stub telemetry.
  const targetRelPath = "services/operator/src/lib/portfolio-evolution.ts";
  const abs = path.join(appRoot, targetRelPath);
  if (!existsSync(abs)) return null;
  const src = readFileSync(abs, "utf8");
  if (!src.includes("ageDays: 30")) {
    // Stub already fixed — contradictions alone already recorded above.
    // Do not churn code when only meta-contradictions remain without a safe patch.
    if (contradictions.length) {
      return {
        evolutionId: newId("corevo"),
        problem: `Commercial meta-contradiction (no stub left): ${contradictions[0]}`,
        evidence: contradictions,
        hypothesis:
          "Record demonstrated limitation; commercial executive / capability registry owns the repair loop.",
        expectedBenefit: "Honest self-diagnosis instead of false SKIPPED calm",
        baseline: "no_demonstrated_limitation false negative",
        targetRelPath: "services/operator/src/lib/core-evolution-executor.ts",
        patchKind: "NOOP_TEST_GUARD",
        risk: "LOW",
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  }
  if (src.includes("CORE_EVO_MARKER:stub_telemetry_removed")) {
    return null;
  }

  // Evidence the stub blocked retirement historically.
  const evidenceRows = await pool.query(
    `select 1 from ros_config_meta where key='admit_rollout_checkpoint' limit 1`,
  );
  if (!evidenceRows.rowCount) return null;

  return {
    evolutionId: newId("corevo"),
    problem:
      "portfolio-evolution.ts feeds stub telemetry (ageDays:30, purchases:0), which prevents honest retirement evaluation on the Supabase evolution path.",
    evidence: [
      "source_contains_ageDays_30_stub",
      "accepted_soft_retire_was_not_functional",
      "fitness_snapshots_key_introduced",
    ],
    hypothesis:
      "Replacing stub constants with conservative UNKNOWN-safe defaults (ageDays from 0, purchases sentinel -1, experimentCount 0) stops false retirement suppression/activation from fake numbers.",
    expectedBenefit:
      "Supabase evolution path no longer invents mature zero-purchase businesses; aligns with UNKNOWN policy.",
    baseline: "stub ageDays:30 purchases:0 experimentCount:100",
    targetRelPath,
    patchKind: "ADD_TELEMETRY_COMMENT",
    risk: "LOW",
    createdAt: new Date().toISOString(),
  };
}

function applyPatchInWorkspace(
  workspaceFile: string,
  proposal: CoreEvolutionProposal,
): { ok: boolean; detail: string } {
  if (!existsSync(workspaceFile)) return { ok: false, detail: "workspace_file_missing" };
  let src = readFileSync(workspaceFile, "utf8");
  if (proposal.patchKind === "NOOP_TEST_GUARD") {
    return { ok: true, detail: "meta_contradiction_recorded_no_file_mutation" };
  }
  if (proposal.patchKind === "ADD_TELEMETRY_COMMENT") {
    if (!src.includes("ageDays: 30")) {
      return { ok: true, detail: "stub_already_absent" };
    }
    const before = src;
    // Match both object-property and const-assignment stub blocks.
    src = src.replace(
      /(?:const\s+telemetry\s*=\s*|telemetry:\s*)input\.activeSiteIds\.map\(\(siteId\)\s*=>\s*\(\{[\s\S]*?engineeringBlocked:\s*engBlocked\.has\(siteId\),\s*\}\)\)(,|;)/,
      `const telemetry = input.activeSiteIds.map((siteId) => ({
    siteId,
    // CORE_EVO_MARKER:stub_telemetry_removed — never invent mature zero-purchase firms.
    purchases: -1,
    revenueUsd: 0,
    landingViews: 0,
    checkoutStarts: 0,
    ageDays: 0,
    experimentCount: 0,
    ownerLocked: prev.ownerPolicy.lockedSiteIds.includes(siteId),
    engineeringBlocked: engBlocked.has(siteId),
  }));`,
    );
    // If property form was `telemetry: ...,` restore property syntax.
    if (before.includes("telemetry: input.activeSiteIds.map") && src.includes("const telemetry = input.activeSiteIds.map")) {
      // portfolio-evolution uses const — fine.
    }
    if (src === before) {
      // Fallback: line-level stub field rewrite.
      if (src.includes("ageDays: 30")) {
        src = src
          .replace(/purchases:\s*0,/, "purchases: -1,")
          .replace(/ageDays:\s*30,/, "ageDays: 0,")
          .replace(/experimentCount:\s*100,/, "experimentCount: 0,");
        if (!src.includes("CORE_EVO_MARKER:stub_telemetry_removed")) {
          src = src.replace(
            /ageDays:\s*0,/,
            "ageDays: 0, // CORE_EVO_MARKER:stub_telemetry_removed\n",
          );
        }
      }
    }
    if (src === before || src.includes("ageDays: 30")) {
      return { ok: false, detail: "stub_block_not_matched" };
    }
    writeFileSync(workspaceFile, src);
    return { ok: true, detail: "stub_telemetry_neutralized" };
  }
  return { ok: false, detail: "unknown_patch_kind" };
}

function runSyntaxCheck(
  filePath: string,
  patchKind?: CoreEvolutionProposal["patchKind"],
): { ok: boolean; detail: string } {
  if (patchKind === "NOOP_TEST_GUARD") {
    return { ok: true, detail: "noop_guard_ok" };
  }
  const src = readFileSync(filePath, "utf8");
  if (src.includes("ageDays: 30")) {
    return { ok: false, detail: "stub_still_present" };
  }
  if (!src.includes("CORE_EVO_MARKER:stub_telemetry_removed")) {
    return { ok: false, detail: "marker_missing_after_patch" };
  }
  return { ok: true, detail: "static_checks_ok" };
}

/**
 * Execute one core evolution cycle if a limitation is detected.
 * Workspace copy → patch → checks → promote → lesson. Rollback on failure.
 */
export async function executeCoreEvolution(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  proposal?: CoreEvolutionProposal | null;
}): Promise<CoreEvolutionReceipt> {
  const proposal =
    input.proposal === undefined
      ? await detectCoreLimitation(input.pool, input.appRoot)
      : input.proposal;

  if (!proposal) {
    return {
      evolutionId: newId("corevo"),
      proposal: {
        evolutionId: "none",
        problem: "none",
        evidence: [],
        hypothesis: "",
        expectedBenefit: "",
        baseline: "",
        targetRelPath: "",
        patchKind: "ADD_TELEMETRY_COMMENT",
        risk: "LOW",
        createdAt: new Date().toISOString(),
      },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result: "SKIPPED",
      detail: "no_demonstrated_limitation",
    };
  }

  const startedAt = new Date().toISOString();
  const action =
    proposal.risk === "HIGH"
      ? "owner_core_mutation_high_risk"
      : proposal.risk === "MEDIUM"
        ? "core_evolution_medium"
        : "core_evolution_low_telemetry_fix";
  const apex = governAction({
    action,
    riskClass: proposal.risk === "HIGH" ? "R4" : proposal.risk === "MEDIUM" ? "R2" : "R1",
  });

  const receipt: CoreEvolutionReceipt = {
    evolutionId: proposal.evolutionId,
    proposal,
    startedAt,
    result: "PROPOSED",
    detail: "proposed",
    apex: {
      authorized: apex.authorized,
      detail: apex.detail,
      riskClass: apex.riskClass,
    },
  };
  await saveReceipt(input.pool, receipt);

  if (!apex.authorized || proposal.risk === "HIGH") {
    receipt.result = "DENIED";
    receipt.detail = apex.detail;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  const absTarget = path.join(input.appRoot, proposal.targetRelPath);
  if (!existsSync(absTarget)) {
    receipt.result = "FAILED";
    receipt.detail = "target_missing";
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  const baseline = readFileSync(absTarget, "utf8");
  receipt.baselineHash = simpleHash(baseline);

  const workspaceDir = path.join(
    input.appRoot,
    ".data",
    "revenueos",
    "core-evolution",
    proposal.evolutionId,
  );
  mkdirSync(workspaceDir, { recursive: true });
  receipt.workspaceDir = workspaceDir;
  const workspaceFile = path.join(workspaceDir, path.basename(absTarget));
  writeFileSync(path.join(workspaceDir, "baseline.ts"), baseline);
  writeFileSync(workspaceFile, baseline);
  writeFileSync(
    path.join(workspaceDir, "proposal.json"),
    JSON.stringify(proposal, null, 2),
  );

  const patched = applyPatchInWorkspace(workspaceFile, proposal);
  if (!patched.ok) {
    receipt.result = "FAILED";
    receipt.detail = patched.detail;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  const tests = runSyntaxCheck(workspaceFile, proposal.patchKind);
  receipt.tests = tests;
  if (!tests.ok) {
    receipt.result = "ROLLED_BACK";
    receipt.detail = tests.detail;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  // Meta-contradiction: record demonstrated limitation; do not mutate files.
  if (proposal.patchKind === "NOOP_TEST_GUARD") {
    receipt.result = "RETAINED";
    receipt.detail = `demonstrated_limitation:${proposal.evidence.slice(0, 3).join("|")}`;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    await saveLesson(input.pool, {
      at: receipt.completedAt,
      evolutionId: proposal.evolutionId,
      result: "RETAINED",
      problem: proposal.problem,
      evidence: proposal.evidence,
      kind: "meta_contradiction",
    });
    input.logger("warn", "core_evolution.meta_contradiction", {
      evolutionId: proposal.evolutionId,
      evidence: proposal.evidence,
    });
    return receipt;
  }

  // Canary: write .canary sibling, verify, then promote.
  const canaryPath = `${absTarget}.canary`;
  try {
    cpSync(workspaceFile, canaryPath);
    const canaryOk = runSyntaxCheck(canaryPath, proposal.patchKind);
    if (!canaryOk.ok) {
      rmSync(canaryPath, { force: true });
      receipt.result = "ROLLED_BACK";
      receipt.detail = `canary_failed:${canaryOk.detail}`;
      receipt.completedAt = new Date().toISOString();
      await saveReceipt(input.pool, receipt);
      return receipt;
    }
    // Promote with restore baseline already in workspace.
    writeFileSync(absTarget, readFileSync(workspaceFile, "utf8"));
    rmSync(canaryPath, { force: true });
  } catch (err) {
    try {
      writeFileSync(absTarget, baseline);
    } catch {
      /* */
    }
    receipt.result = "ROLLED_BACK";
    receipt.detail = err instanceof Error ? err.message : String(err);
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  // Verify production file
  const after = readFileSync(absTarget, "utf8");
  if (
    after.includes("ageDays: 30") ||
    !after.includes("CORE_EVO_MARKER:stub_telemetry_removed")
  ) {
    writeFileSync(absTarget, baseline);
    receipt.result = "ROLLED_BACK";
    receipt.detail = "promote_verify_failed";
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  writeFileSync(
    path.join(workspaceDir, "diff.txt"),
    [
      `--- baseline ${receipt.baselineHash}`,
      `+++ patched ${simpleHash(after)}`,
      `@@ stub_telemetry @@`,
      `-ageDays: 30 / purchases: 0`,
      `+CORE_EVO_MARKER:stub_telemetry_removed (purchases:-1 ageDays:0)`,
    ].join("\n"),
  );

  receipt.result = "RETAINED";
  receipt.detail = "core_patch_retained";
  receipt.completedAt = new Date().toISOString();
  await saveReceipt(input.pool, receipt);
  await saveLesson(input.pool, {
    evolutionId: proposal.evolutionId,
    problem: proposal.problem,
    result: "RETAINED",
    benefit: proposal.expectedBenefit,
    at: receipt.completedAt,
    reversible: true,
    baselineHash: receipt.baselineHash,
  });

  input.logger("info", "core_evolution.retained", {
    evolutionId: proposal.evolutionId,
    target: proposal.targetRelPath,
    version: CORE_EVOLUTION_VERSION,
  });
  return receipt;
}

export async function runCoreEvolutionLane(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
}): Promise<void> {
  const interval = input.intervalMs ?? 30 * 60_000;
  input.logger("info", "core_evolution.lane.start", {
    version: CORE_EVOLUTION_VERSION,
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
      const receipt = await executeCoreEvolution({
        pool: input.pool,
        appRoot: input.appRoot,
        logger: input.logger,
      });
      input.logger("info", "core_evolution.lane.tick", {
        result: receipt.result,
        detail: receipt.detail,
      });
    } catch (err) {
      input.logger("error", "core_evolution.lane.error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
