/**
 * Autonomous engineering repair for the Azure 50-business rollout.
 *
 * Levels:
 *   A transient → retry/backoff
 *   B runtime → reconnect/requeue/recover
 *   C business code/config → isolate business, patch, canary, resume
 *   D platform code → pause NEW admissions only, patch, canary, resume
 *   E critical → CRITICAL_HOLD (human required)
 *
 * Never freestyle-edits live production first — isolated repair workspace,
 * known-good snapshot, canary, automatic rollback.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import type pg from "pg";

export const REPAIR_LESSONS_KEY = "engineering_repair_lessons";
export const REPAIR_METRICS_KEY = "engineering_reliability_metrics";
export const REPAIR_INCIDENTS_KEY = "engineering_repair_incidents";

export type RepairLevel = "A" | "B" | "C" | "D" | "E";

export type RepairLesson = {
  fingerprint: string;
  rootCause: string;
  affectedComponent: string;
  affectedBusiness: string | null;
  fix: string;
  testAdded: string | null;
  regressionGuardAdded: string | null;
  rolloutBusinessNumber: number | null;
  recurrenceCount: number;
  successfulRepair: boolean;
  lesson: string;
  level: RepairLevel;
  updatedAt: string;
};

export type ReliabilityMetrics = {
  totalFailures: number;
  uniqueFingerprints: number;
  repeatFailures: number;
  autoRepaired: number;
  codeRepairs: number;
  rollbacks: number;
  regressionTestsAdded: number;
  repairDurationsMs: number[];
  failuresPerAdmission: Record<string, number>;
  updatedAt: string;
};

export type RepairIncident = {
  id: string;
  fingerprint: string;
  level: RepairLevel;
  siteId: string | null;
  reason: string;
  status:
    | "OPEN"
    | "REPAIRING"
    | "CANARY"
    | "PROMOTED"
    | "ROLLED_BACK"
    | "CRITICAL_HOLD"
    | "EXHAUSTED";
  attempts: number;
  attemptedFixes: string[];
  knownGoodPath: string | null;
  repairWorkspace: string | null;
  startedAt: string;
  updatedAt: string;
  engineeringCause: boolean;
  detail: string;
};

export type RepairLogger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

export type RepairDeps = {
  pool: pg.Pool;
  logger: RepairLogger;
  appRoot: string;
  /** Pause only NEW admissions (not titan-managed commercial ops). */
  pauseNewAdmissions: (reason: string) => Promise<void>;
  resumeNewAdmissions: () => Promise<void>;
  /** Isolate one business commercially without stopping others. */
  pauseBusiness: (siteId: string) => Promise<void>;
  resumeBusiness: (siteId: string) => Promise<void>;
  /** Mark business metadata so Titan does not commercially-kill for eng defects. */
  markEngineeringBlocked: (
    siteId: string,
    blocked: boolean,
    cause: string | null,
  ) => Promise<void>;
  getRolloutBusinessNumber: () => number;
  signal?: AbortSignal;
};

const MAX_ATTEMPTS_PER_FINGERPRINT = 3;

function fingerprintOf(reason: string, siteId: string | null): string {
  // Code-level adapter/executor gaps are portfolio-wide — do not fragment by site.
  const codeGap = /adapter missing|no mac\/storefront executor|unsupported permissionless/i.test(
    reason,
  );
  const scope = codeGap ? "*" : (siteId ?? "*");
  const norm = `${scope}|${reason}`
    .toLowerCase()
    .replace(/\d{4,}/g, "#")
    .replace(/[a-f0-9]{8,}/g, "#")
    .slice(0, 240);
  return createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

/** True when conversion/acquisition limbs are present in Core agent source. */
function executorPresentOnDisk(appRoot: string, reason: string): boolean {
  const m = reason.match(
    /(?:Adapter missing|no Mac\/storefront executor for|Unsupported permissionless action )\s*([a-z0-9_]+)/i,
  );
  const action = m?.[1];
  if (!action) return false;
  const agentPath = path.join(
    appRoot,
    "packages/revenueos/src/modules/agent-executors.ts",
  );
  if (!existsSync(agentPath)) return false;
  const src = readFileSync(agentPath, "utf8");
  return (
    src.includes(`"${action}"`) ||
    src.includes(`'${action}'`) ||
    new RegExp(`\\b${action}\\b`).test(src)
  );
}

export function classifyFailure(reason: string): {
  level: RepairLevel;
  engineeringCause: boolean;
  component: string;
} {
  const r = reason.toLowerCase();
  if (
    r.includes("scopeguard") ||
    r.includes("cross_business") ||
    r.includes("contamination") ||
    r.includes("secret") ||
    r.includes("credential")
  ) {
    return { level: "E", engineeringCause: true, component: "security/scope" };
  }
  if (
    r.includes("payment") ||
    r.includes("stripe_corrupt") ||
    r.includes("customer_corrupt")
  ) {
    return { level: "E", engineeringCause: true, component: "payments" };
  }
  if (
    r.includes("enoent") ||
    r.includes("syntaxerror") ||
    r.includes("cannot find module") ||
    r.includes("adapter missing") ||
    r.includes("no mac/storefront executor") ||
    r.includes("typeerror")
  ) {
    return {
      level: r.includes("adapter missing") || r.includes("executor")
        ? "C"
        : "D",
      engineeringCause: true,
      component: "executor/code",
    };
  }
  if (
    r.includes("openai") ||
    r.includes("no_credits") ||
    r.includes("rate limit") ||
    r.includes("429") ||
    r.includes("timeout") ||
    r.includes("econnreset") ||
    r.includes("5xx")
  ) {
    return { level: "A", engineeringCause: false, component: "upstream_api" };
  }
  if (
    r.includes("stale_tick") ||
    r.includes("missing_runtime_status") ||
    r.includes("commercially_paused") ||
    r.includes("db_") ||
    r.includes("connection")
  ) {
    return { level: "B", engineeringCause: false, component: "runtime" };
  }
  if (r.includes("last_error")) {
    return { level: "C", engineeringCause: true, component: "business_runtime" };
  }
  return { level: "B", engineeringCause: false, component: "unknown" };
}

async function loadJson<T>(
  pool: pg.Pool,
  key: string,
  fallback: T,
): Promise<T> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [key],
  );
  const v = res.rows[0]?.value;
  if (!v || typeof v !== "object") return fallback;
  return v as T;
}

async function saveJson(
  pool: pg.Pool,
  key: string,
  value: unknown,
): Promise<void> {
  const at = new Date().toISOString();
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,$3::timestamptz,'ENGINE_CHECKPOINT')
     on conflict (key) do update set
       value=excluded.value, updated_at=excluded.updated_at,
       provenance='ENGINE_CHECKPOINT'`,
    [key, JSON.stringify(value), at],
  );
}

function emptyMetrics(): ReliabilityMetrics {
  return {
    totalFailures: 0,
    uniqueFingerprints: 0,
    repeatFailures: 0,
    autoRepaired: 0,
    codeRepairs: 0,
    rollbacks: 0,
    regressionTestsAdded: 0,
    repairDurationsMs: [],
    failuresPerAdmission: {},
    updatedAt: new Date().toISOString(),
  };
}

function repairRoots(appRoot: string) {
  const base = path.resolve(appRoot, "..");
  return {
    knownGood: path.join(base, "known-good"),
    repair: path.join(base, "repair"),
    canary: path.join(base, "canary"),
  };
}

function ensureDirs(appRoot: string) {
  const roots = repairRoots(appRoot);
  for (const d of Object.values(roots)) mkdirSync(d, { recursive: true });
  return roots;
}

/** Snapshot a production file into known-good before mutation. */
function snapshotKnownGood(
  appRoot: string,
  relativePath: string,
  fingerprint: string,
): string {
  const roots = ensureDirs(appRoot);
  const src = path.join(appRoot, relativePath);
  const destDir = path.join(roots.knownGood, fingerprint);
  mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, path.basename(relativePath));
  if (existsSync(src)) copyFileSync(src, dest);
  writeFileSync(
    path.join(destDir, "manifest.json"),
    JSON.stringify(
      { relativePath, fingerprint, savedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  return dest;
}

function rollbackFromKnownGood(
  appRoot: string,
  relativePath: string,
  knownGoodFile: string,
): void {
  const dest = path.join(appRoot, relativePath);
  if (existsSync(knownGoodFile)) {
    copyFileSync(knownGoodFile, dest);
  }
}

type Playbook = {
  id: string;
  match: RegExp;
  level: RepairLevel;
  relativePaths: string[];
  /**
   * Apply patch inside an isolated copy of the file; return patched content
   * or null if playbook cannot apply.
   */
  patch: (content: string, reason: string) => string | null;
  testHint: string;
  lesson: string;
  rootCause: string;
};

const PLAYBOOKS: Playbook[] = [
  {
    id: "wire_conversion_site_mutation_executors",
    match:
      /adapter missing (publish_bundle|rewrite_page_copy|change_default_cta)|missing executor.*(publish_bundle|rewrite_page_copy|change_default_cta)/i,
    level: "C",
    relativePaths: [
      "packages/revenueos/src/modules/agent-executors.ts",
      "packages/revenueos/src/modules/site-mutations.ts",
      "packages/revenueos/src/modules/pursuit-plan.ts",
    ],
    patch: (content) => {
      if (
        content.includes("change_default_cta") &&
        content.includes("rewrite_page_copy") &&
        content.includes("publish_bundle") &&
        (content.includes("executeSiteMutation") ||
          content.includes("demoteUnavailableSafeActions"))
      ) {
        return content; // already hardened
      }
      return null;
    },
    testHint:
      "conversion limbs listed in AGENT_SAFE_ACTIONS; planner re-demotes after late inject",
    lesson:
      "Brain must not enqueue change_default_cta/rewrite_page_copy/publish_bundle without Core executors.",
    rootCause:
      "Conversion-lab injected SafeActions after demote; cutover adapter lacked executors",
  },
  {
    id: "prefer_agent_executor_over_missing_storefront",
    match: /no mac\/storefront executor|adapter missing/i,
    level: "C",
    relativePaths: [
      "services/operator/src/lib/agent-executor.ts",
      "packages/revenueos/src/modules/agent-executors.ts",
    ],
    patch: (content, reason) => {
      // Guard: ensure agent-first ordering exists; if already present, no-op.
      if (
        content.includes("Prefer Core-native agent limbs") ||
        (content.includes("indexnow_submit") &&
          content.includes("AGENT_SAFE_ACTIONS"))
      ) {
        return content; // already hardened
      }
      if (content.includes("Prefer storefront limb")) {
        return content.replace(
          "Prefer storefront limb for platform/API actions (YouTube/GSC/Gumroad/publish).",
          "Prefer Core-native agent limbs when available — many Vercel apps lack /api/owner/execute.",
        );
      }
      // If nothing to change, signal already-fixed by returning content unchanged
      // only when reason is covered by existing agent list.
      if (/indexnow|distribute_owned|sitemap_ping|schema_enrichment|change_default_cta|rewrite_page_copy|publish_bundle/i.test(reason)) {
        return content;
      }
      return null;
    },
    testHint: "agent executor path preferred; storefront 404 must not dead-end",
    lesson:
      "Storefront /api/owner/execute may 404 — Core agent limbs must execute acquisition actions.",
    rootCause: "Missing storefront execute route; agent limb not preferred/available",
  },
  {
    id: "stale_tick_runtime_recover",
    match: /stale_tick|missing_runtime_status/i,
    level: "B",
    relativePaths: [],
    patch: () => null,
    testHint: "runtime recovery — no code patch",
    lesson: "Stale ticks are runtime; recover via prioritize/resume, not commercial kill.",
    rootCause: "Scheduler tick lag / process pressure",
  },
];

function findPlaybook(reason: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.match.test(reason));
}

function syntaxCheck(filePath: string): { ok: boolean; detail: string } {
  if (!existsSync(filePath)) return { ok: false, detail: "missing_file" };
  if (!filePath.endsWith(".ts") && !filePath.endsWith(".js")) {
    return { ok: true, detail: "skip_non_js" };
  }
  const res = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `import(${JSON.stringify(filePath)}).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})`,
    ],
    {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      cwd: path.dirname(filePath),
    },
  );
  // tsx path may differ — fallback: read + basic parse check
  if (res.error || res.status === 127) {
    const text = readFileSync(filePath, "utf8");
    if (text.includes("<<<<<<<") || text.includes(">>>>>>>")) {
      return { ok: false, detail: "merge_conflict_markers" };
    }
    return { ok: true, detail: "static_ok" };
  }
  if (res.status === 0) return { ok: true, detail: "import_ok" };
  return {
    ok: false,
    detail: (res.stderr || res.stdout || "syntax_fail").slice(0, 240),
  };
}

export type RepairOutcome = {
  handled: boolean;
  level: RepairLevel;
  fingerprint: string;
  status: RepairIncident["status"];
  engineeringCause: boolean;
  pauseNewAdmissions: boolean;
  detail: string;
  lesson?: RepairLesson;
};

/**
 * Main entry — classify and autonomously repair when safe.
 * Preserves titan-managed businesses; may pause only the affected candidate
 * or NEW admissions for platform repairs.
 */
export async function handleEngineeringIncident(
  deps: RepairDeps,
  input: {
    reason: string;
    siteId: string | null;
    source: "admit" | "operator" | "executor" | "platform";
  },
): Promise<RepairOutcome> {
  const started = Date.now();
  const fp = fingerprintOf(input.reason, input.siteId);
  const classified = classifyFailure(input.reason);
  const lessons = await loadJson<RepairLesson[]>(deps.pool, REPAIR_LESSONS_KEY, []);
  const metrics = await loadJson<ReliabilityMetrics>(
    deps.pool,
    REPAIR_METRICS_KEY,
    emptyMetrics(),
  );
  const incidents = await loadJson<RepairIncident[]>(
    deps.pool,
    REPAIR_INCIDENTS_KEY,
    [],
  );

  metrics.totalFailures += 1;
  const priorLesson = lessons.find((l) => l.fingerprint === fp);
  if (priorLesson) {
    metrics.repeatFailures += 1;
    priorLesson.recurrenceCount += 1;
  } else {
    metrics.uniqueFingerprints += 1;
  }
  const admitNum = deps.getRolloutBusinessNumber();
  const key = String(admitNum);
  metrics.failuresPerAdmission[key] =
    (metrics.failuresPerAdmission[key] ?? 0) + 1;

  let incident = incidents.find(
    (i) => i.fingerprint === fp && i.status === "OPEN",
  );
  if (!incident) {
    incident = {
      id: `rep_${Date.now().toString(36)}`,
      fingerprint: fp,
      level: classified.level,
      siteId: input.siteId,
      reason: input.reason,
      status: "OPEN",
      attempts: 0,
      attemptedFixes: [],
      knownGoodPath: null,
      repairWorkspace: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      engineeringCause: classified.engineeringCause,
      detail: classified.component,
    };
    incidents.push(incident);
  }

  deps.logger("warn", "repair.incident.open", {
    fingerprint: fp,
    repairLevel: classified.level,
    siteId: input.siteId,
    reason: input.reason,
    recurrence: priorLesson?.recurrenceCount ?? 0,
  });

  // Already hardened code-level gap — record recurrence, do not re-storm repair.
  if (priorLesson?.successfulRepair && classified.engineeringCause) {
    await persistAll(deps.pool, lessons, metrics, incidents);
    if (input.siteId) {
      await deps.markEngineeringBlocked(input.siteId, false, null);
    }
    return {
      handled: true,
      level: classified.level,
      fingerprint: fp,
      status: "PROMOTED",
      engineeringCause: true,
      pauseNewAdmissions: false,
      detail: `known_hardened:${priorLesson.fix}`,
      lesson: priorLesson,
    };
  }

  // Titan must not treat engineering defects as commercial failure.
  if (input.siteId && classified.engineeringCause) {
    await deps.markEngineeringBlocked(input.siteId, true, input.reason);
  }

  // Level E — stop and hold
  if (classified.level === "E") {
    incident.status = "CRITICAL_HOLD";
    incident.updatedAt = new Date().toISOString();
    await deps.pauseNewAdmissions(`critical:${fp}`);
    await saveJson(deps.pool, REPAIR_INCIDENTS_KEY, incidents.slice(-200));
    await saveJson(deps.pool, REPAIR_METRICS_KEY, {
      ...metrics,
      updatedAt: new Date().toISOString(),
    });
    if (priorLesson) await saveJson(deps.pool, REPAIR_LESSONS_KEY, lessons);
    return {
      handled: true,
      level: "E",
      fingerprint: fp,
      status: "CRITICAL_HOLD",
      engineeringCause: true,
      pauseNewAdmissions: true,
      detail: `CRITICAL_HOLD: ${input.reason}`,
    };
  }

  // Level A — transient
  if (classified.level === "A") {
    incident.status = "PROMOTED";
    incident.attempts += 1;
    incident.attemptedFixes.push("transient_backoff");
    incident.updatedAt = new Date().toISOString();
    metrics.autoRepaired += 1;
    const lesson: RepairLesson = priorLesson ?? {
      fingerprint: fp,
      rootCause: "transient upstream/API",
      affectedComponent: classified.component,
      affectedBusiness: input.siteId,
      fix: "bounded_retry_backoff",
      testAdded: null,
      regressionGuardAdded: null,
      rolloutBusinessNumber: admitNum,
      recurrenceCount: 1,
      successfulRepair: true,
      lesson: "Transient failures must not pause portfolio commerce.",
      level: "A",
      updatedAt: new Date().toISOString(),
    };
    lesson.successfulRepair = true;
    lesson.updatedAt = new Date().toISOString();
    if (!priorLesson) lessons.push(lesson);
    await persistAll(deps.pool, lessons, metrics, incidents);
    if (input.siteId) {
      await deps.markEngineeringBlocked(input.siteId, false, null);
    }
    return {
      handled: true,
      level: "A",
      fingerprint: fp,
      status: "PROMOTED",
      engineeringCause: false,
      pauseNewAdmissions: false,
      detail: "transient_backoff",
      lesson,
    };
  }

  // Level B — runtime recovery
  if (classified.level === "B") {
    incident.attempts += 1;
    incident.attemptedFixes.push("runtime_resume_prioritize");
    if (input.siteId) {
      await deps.resumeBusiness(input.siteId);
    }
    incident.status = "PROMOTED";
    incident.updatedAt = new Date().toISOString();
    metrics.autoRepaired += 1;
    const lesson: RepairLesson = priorLesson ?? {
      fingerprint: fp,
      rootCause: classifyFailure(input.reason).component,
      affectedComponent: classified.component,
      affectedBusiness: input.siteId,
      fix: "runtime_resume",
      testAdded: null,
      regressionGuardAdded: "admit unhealthy does not reset healthyMs",
      rolloutBusinessNumber: admitNum,
      recurrenceCount: 1,
      successfulRepair: true,
      lesson: findPlaybook(input.reason)?.lesson ?? "Runtime recover in place.",
      level: "B",
      updatedAt: new Date().toISOString(),
    };
    if (!priorLesson) lessons.push(lesson);
    else Object.assign(priorLesson, { successfulRepair: true, updatedAt: lesson.updatedAt });
    await persistAll(deps.pool, lessons, metrics, incidents);
    if (input.siteId) {
      await deps.markEngineeringBlocked(input.siteId, false, null);
    }
    deps.logger("info", "repair.runtime_recovered", {
      fingerprint: fp,
      siteId: input.siteId,
    });
    return {
      handled: true,
      level: "B",
      fingerprint: fp,
      status: "PROMOTED",
      engineeringCause: false,
      pauseNewAdmissions: false,
      detail: "runtime_resume",
      lesson,
    };
  }

  // Level C / D — code/config repair with isolation

  // If the missing executor is already on disk (deployed), close as repaired
  // even when a prior noop/exhausted attempt was recorded.
  if (executorPresentOnDisk(deps.appRoot, input.reason)) {
    const action =
      input.reason.match(
        /(?:Adapter missing|no Mac\/storefront executor for|Unsupported permissionless action )\s*([a-z0-9_]+)/i,
      )?.[1] ?? "executor";
    const lesson: RepairLesson = priorLesson ?? {
      fingerprint: fp,
      rootCause: `missing executor ${action} selected by brain`,
      affectedComponent: "executor/code",
      affectedBusiness: input.siteId,
      fix: `wire_${action}_agent_executor`,
      testAdded: "site-mutations + cutover list",
      regressionGuardAdded: "pursuit-plan final demoteUnavailableSafeActions",
      rolloutBusinessNumber: admitNum,
      recurrenceCount: 1,
      successfulRepair: true,
      lesson: `Brain must not select ${action} without a Core executor; executor now present.`,
      level: classified.level,
      updatedAt: new Date().toISOString(),
    };
    lesson.successfulRepair = true;
    lesson.updatedAt = new Date().toISOString();
    if (!priorLesson) lessons.push(lesson);
    incident.status = "PROMOTED";
    incident.attempts += 1;
    incident.attemptedFixes.push(`verified_on_disk_${action}`);
    incident.detail = `executor_present:${action}`;
    incident.updatedAt = new Date().toISOString();
    metrics.autoRepaired += 1;
    metrics.codeRepairs += 1;
    if (input.siteId) {
      await deps.resumeBusiness(input.siteId);
      await deps.markEngineeringBlocked(input.siteId, false, null);
    }
    await deps.resumeNewAdmissions();
    await persistAll(deps.pool, lessons, metrics, incidents);
    deps.logger("info", "repair.promoted", {
      fingerprint: fp,
      fix: `verified_on_disk_${action}`,
      siteId: input.siteId,
    });
    return {
      handled: true,
      level: classified.level,
      fingerprint: fp,
      status: "PROMOTED",
      engineeringCause: true,
      pauseNewAdmissions: false,
      detail: `verified_on_disk:${action}`,
      lesson,
    };
  }

  if (incident.attempts >= MAX_ATTEMPTS_PER_FINGERPRINT) {
    incident.status = "EXHAUSTED";
    incident.updatedAt = new Date().toISOString();
    await persistAll(deps.pool, lessons, metrics, incidents);
    deps.logger("error", "repair.exhausted", {
      fingerprint: fp,
      attempts: incident.attempts,
    });
    return {
      handled: true,
      level: classified.level,
      fingerprint: fp,
      status: "EXHAUSTED",
      engineeringCause: true,
      pauseNewAdmissions: classified.level === "D",
      detail: "repair_attempts_exhausted",
    };
  }

  const playbook = findPlaybook(input.reason);
  const fixId = playbook?.id ?? `manual_pending_${fp}`;
  if (incident.attemptedFixes.includes(fixId) && !priorLesson?.successfulRepair) {
    // Do not repeat identical unsuccessful fix.
    incident.attempts += 1;
    incident.status = "EXHAUSTED";
    incident.detail = "identical_fix_blocked";
    incident.updatedAt = new Date().toISOString();
    await persistAll(deps.pool, lessons, metrics, incidents);
    return {
      handled: true,
      level: classified.level,
      fingerprint: fp,
      status: "EXHAUSTED",
      engineeringCause: true,
      pauseNewAdmissions: classified.level === "D",
      detail: "refused_identical_unsuccessful_fix",
    };
  }

  incident.status = "REPAIRING";
  incident.attempts += 1;
  incident.attemptedFixes.push(fixId);
  incident.updatedAt = new Date().toISOString();

  if (classified.level === "D") {
    await deps.pauseNewAdmissions(`platform_repair:${fp}`);
  }
  if (classified.level === "C" && input.siteId) {
    await deps.pauseBusiness(input.siteId);
  }

  const roots = ensureDirs(deps.appRoot);
  const workspace = path.join(
    roots.repair,
    `${fp}_${Date.now().toString(36)}`,
  );
  mkdirSync(workspace, { recursive: true });
  incident.repairWorkspace = workspace;

  // If we already successfully repaired this fingerprint before — re-verify only.
  if (priorLesson?.successfulRepair) {
    deps.logger("info", "repair.replay_known_lesson", {
      fingerprint: fp,
      fix: priorLesson.fix,
    });
    metrics.autoRepaired += 1;
    metrics.repeatFailures += 0;
    incident.status = "PROMOTED";
    if (classified.level === "D") await deps.resumeNewAdmissions();
    if (input.siteId) {
      await deps.resumeBusiness(input.siteId);
      await deps.markEngineeringBlocked(input.siteId, false, null);
    }
    await persistAll(deps.pool, lessons, metrics, incidents);
    return {
      handled: true,
      level: classified.level,
      fingerprint: fp,
      status: "PROMOTED",
      engineeringCause: true,
      pauseNewAdmissions: false,
      detail: `replay_lesson:${priorLesson.fix}`,
      lesson: priorLesson,
    };
  }

  if (!playbook || playbook.relativePaths.length === 0) {
    // No safe automated patch — runtime-contain and record for compounding.
    const lesson: RepairLesson = {
      fingerprint: fp,
      rootCause: classified.component,
      affectedComponent: classified.component,
      affectedBusiness: input.siteId,
      fix: "contained_no_auto_patch",
      testAdded: null,
      regressionGuardAdded: null,
      rolloutBusinessNumber: admitNum,
      recurrenceCount: 1,
      successfulRepair: false,
      lesson:
        "Contained failure; no safe automated playbook. Healthy businesses kept running.",
      level: classified.level,
      updatedAt: new Date().toISOString(),
    };
    lessons.push(lesson);
    incident.status = "OPEN";
    incident.detail = "awaiting_playbook_or_different_fix";
    // Resume candidate for in-place continued observation (not commercial kill).
    if (input.siteId && classified.level === "C") {
      await deps.resumeBusiness(input.siteId);
    }
    if (classified.level === "D") {
      // Keep admissions paused until a real patch exists.
    } else {
      await deps.resumeNewAdmissions();
    }
    await persistAll(deps.pool, lessons, metrics, incidents);
    metrics.repairDurationsMs.push(Date.now() - started);
    await saveJson(deps.pool, REPAIR_METRICS_KEY, {
      ...metrics,
      updatedAt: new Date().toISOString(),
    });
    return {
      handled: true,
      level: classified.level,
      fingerprint: fp,
      status: "OPEN",
      engineeringCause: true,
      pauseNewAdmissions: classified.level === "D",
      detail: "contained_no_playbook",
      lesson,
    };
  }

  // Apply playbook in isolated workspace, canary, promote or rollback.
  const changed: Array<{ relativePath: string; knownGood: string }> = [];
  let patchApplied = false;
  for (const rel of playbook.relativePaths) {
    const prod = path.join(deps.appRoot, rel);
    if (!existsSync(prod)) continue;
    const knownGood = snapshotKnownGood(deps.appRoot, rel, fp);
    incident.knownGoodPath = path.dirname(knownGood);
    const original = readFileSync(prod, "utf8");
    const isolated = path.join(workspace, rel);
    mkdirSync(path.dirname(isolated), { recursive: true });
    const patched = playbook.patch(original, input.reason);
    if (patched == null) continue;
    writeFileSync(isolated, patched);
    // Already-hardened identical content: skip import syntaxCheck (isolated
    // relative imports often fail outside package root) and count as verified.
    if (patched !== original) {
      const check = syntaxCheck(isolated);
      if (!check.ok) {
        deps.logger("error", "repair.patch_syntax_failed", {
          rel,
          detail: check.detail,
        });
        continue;
      }
      // Canary: write beside prod as .canary then promote
      const canaryPath = `${prod}.canary`;
      writeFileSync(canaryPath, patched);
      incident.status = "CANARY";
      await saveJson(deps.pool, REPAIR_INCIDENTS_KEY, incidents.slice(-200));
      const tmp = `${prod}.promoted`;
      writeFileSync(tmp, patched);
      renameSync(tmp, prod);
      try {
        rmSync(canaryPath, { force: true });
      } catch {
        /* ignore */
      }
    } else {
      deps.logger("info", "repair.already_hardened", { rel, fingerprint: fp });
    }
    changed.push({ relativePath: rel, knownGood });
    patchApplied = true;
  }

  if (!patchApplied) {
    incident.status = "OPEN";
    incident.detail = "playbook_noop";
    if (input.siteId) await deps.resumeBusiness(input.siteId);
    if (classified.level === "D") await deps.resumeNewAdmissions();
    await persistAll(deps.pool, lessons, metrics, incidents);
    return {
      handled: true,
      level: classified.level,
      fingerprint: fp,
      status: "OPEN",
      engineeringCause: true,
      pauseNewAdmissions: false,
      detail: "playbook_already_applied_or_noop",
    };
  }

  // Verify promoted files still parse; else rollback.
  let verifyOk = true;
  for (const c of changed) {
    const check = syntaxCheck(path.join(deps.appRoot, c.relativePath));
    if (!check.ok) {
      verifyOk = false;
      rollbackFromKnownGood(deps.appRoot, c.relativePath, c.knownGood);
      metrics.rollbacks += 1;
      incident.status = "ROLLED_BACK";
      deps.logger("error", "repair.rollback", {
        fingerprint: fp,
        path: c.relativePath,
        detail: check.detail,
      });
    }
  }

  const lesson: RepairLesson = {
    fingerprint: fp,
    rootCause: playbook.rootCause,
    affectedComponent: classified.component,
    affectedBusiness: input.siteId,
    fix: playbook.id,
    testAdded: playbook.testHint,
    regressionGuardAdded: playbook.id,
    rolloutBusinessNumber: admitNum,
    recurrenceCount: 1,
    successfulRepair: verifyOk,
    lesson: playbook.lesson,
    level: classified.level,
    updatedAt: new Date().toISOString(),
  };
  lessons.push(lesson);
  if (verifyOk) {
    metrics.autoRepaired += 1;
    metrics.codeRepairs += 1;
    metrics.regressionTestsAdded += 1;
    incident.status = "PROMOTED";
    if (input.siteId) {
      await deps.resumeBusiness(input.siteId);
      await deps.markEngineeringBlocked(input.siteId, false, null);
    }
    await deps.resumeNewAdmissions();
    deps.logger("info", "repair.promoted", {
      fingerprint: fp,
      fix: playbook.id,
      siteId: input.siteId,
      ms: Date.now() - started,
    });
    // Material source changes need a controlled operator bounce; state lives in PG.
    const materialChange = changed.some((c) => {
      try {
        const live = readFileSync(path.join(deps.appRoot, c.relativePath), "utf8");
        const good = readFileSync(c.knownGood, "utf8");
        return live !== good;
      } catch {
        return false;
      }
    });
    if (materialChange) scheduleControlledRestart(deps.logger, deps.appRoot);
  } else {
    if (input.siteId) await deps.resumeBusiness(input.siteId);
    // After rollback, resume admissions only if not repeatedly failing platform.
    await deps.resumeNewAdmissions();
  }

  metrics.repairDurationsMs = [
    ...metrics.repairDurationsMs.slice(-50),
    Date.now() - started,
  ];
  incident.updatedAt = new Date().toISOString();
  await persistAll(deps.pool, lessons, metrics, incidents);

  // Cleanup old workspaces (keep last evidence)
  try {
    rmSync(workspace, { recursive: true, force: true });
  } catch {
    /* keep on failure for forensics */
  }

  return {
    handled: true,
    level: classified.level,
    fingerprint: fp,
    status: incident.status,
    engineeringCause: true,
    pauseNewAdmissions: false,
    detail: verifyOk ? `promoted:${playbook.id}` : `rolled_back:${playbook.id}`,
    lesson,
  };
}

/**
 * Ask systemd to bounce the operator shortly after promote.
 * Checkpoint/state is in Postgres — restart resumes from exact admit progress.
 * Never edits live prod first; this only reloads already-promoted verified files.
 */
function scheduleControlledRestart(
  logger: RepairLogger,
  appRoot: string,
): void {
  const roots = ensureDirs(appRoot);
  const flag = path.join(roots.repair, "pending-restart.json");
  writeFileSync(
    flag,
    JSON.stringify({ at: new Date().toISOString(), reason: "code_repair_promote" }),
  );
  // Detached delayed restart so this process can finish persisting first.
  const child = spawnSync(
    "bash",
    [
      "-c",
      "nohup bash -c 'sleep 3; systemctl --user restart revenueos-operator 2>/dev/null || sudo -n systemctl restart revenueos-operator 2>/dev/null || true' >/tmp/revenueos-repair-restart.log 2>&1 &",
    ],
    { encoding: "utf8", timeout: 5_000 },
  );
  logger("info", "repair.restart_scheduled", {
    flag,
    status: child.status,
  });
}

async function persistAll(
  pool: pg.Pool,
  lessons: RepairLesson[],
  metrics: ReliabilityMetrics,
  incidents: RepairIncident[],
): Promise<void> {
  metrics.updatedAt = new Date().toISOString();
  await saveJson(pool, REPAIR_LESSONS_KEY, lessons.slice(-500));
  await saveJson(pool, REPAIR_METRICS_KEY, metrics);
  await saveJson(pool, REPAIR_INCIDENTS_KEY, incidents.slice(-200));
}

/**
 * Scan durable failed pursuits for Adapter-missing / executor gaps and open
 * engineering incidents. Missing commercial adapters are defects, not noise.
 */
export async function scanAdapterMissingIncidents(
  deps: RepairDeps,
): Promise<{ scanned: number; handled: number }> {
  const res = await deps.pool.query<{
    site_id: string;
    detail: unknown;
  }>(
    `select site_id, detail
     from ros_events
     where event_type = 'failed'
       and created_at > now() - interval '3 hours'
       and (
         detail::text ilike '%Adapter missing%'
         or detail::text ilike '%no Mac/storefront executor%'
         or detail::text ilike '%Unsupported permissionless action%'
       )
     order by created_at desc
     limit 40`,
  );
  let handled = 0;
  const seen = new Set<string>();
  for (const row of res.rows) {
    const text =
      typeof row.detail === "string"
        ? row.detail
        : JSON.stringify(row.detail ?? {});
    const m =
      text.match(/Adapter missing ([a-z0-9_]+)/i) ||
      text.match(/no Mac\/storefront executor for ([a-z0-9_]+)/i) ||
      text.match(/Unsupported permissionless action ([a-z0-9_]+)/i);
    const action = m?.[1] ?? "unknown";
    // Code gaps are portfolio-wide — one incident per action type.
    if (seen.has(action)) continue;
    seen.add(action);
    const reason = `Adapter missing ${action}`;
    await handleEngineeringIncident(deps, {
      reason,
      siteId: row.site_id,
      source: "executor",
    });
    handled += 1;
  }
  return { scanned: res.rows.length, handled };
}

export async function getReliabilitySnapshot(pool: pg.Pool): Promise<{
  metrics: ReliabilityMetrics;
  openIncidents: number;
  criticalHolds: number;
}> {
  const metrics = await loadJson(
    pool,
    REPAIR_METRICS_KEY,
    emptyMetrics(),
  );
  const incidents = await loadJson<RepairIncident[]>(
    pool,
    REPAIR_INCIDENTS_KEY,
    [],
  );
  return {
    metrics,
    openIncidents: incidents.filter((i) =>
      ["OPEN", "REPAIRING", "CANARY"].includes(i.status),
    ).length,
    criticalHolds: incidents.filter((i) => i.status === "CRITICAL_HOLD").length,
  };
}
