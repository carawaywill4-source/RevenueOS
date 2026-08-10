#!/usr/bin/env node
/**
 * Sequential Vercel brain-cron inventory for the active 50-business portfolio.
 * ONE project at a time — inspect → record → next. No redeploys.
 *
 * Usage: node scripts/verify-vercel-brain-crons.mjs
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const portfolio = JSON.parse(
  readFileSync(
    path.join(ROOT, "services/operator/src/portfolio-dynamic.json"),
    "utf8",
  ),
);
const siteIds = portfolio.map((b) => b.siteId);
const outDir = path.join(ROOT, ".data");
mkdirSync(outDir, { recursive: true });
const checkpointPath = path.join(outDir, "vercel-brain-cron-checkpoint.json");

const prev = existsSync(checkpointPath)
  ? JSON.parse(readFileSync(checkpointPath, "utf8"))
  : { projects: {} };

const results = { ...prev.projects };
let beforeWithCrons = 0;
let afterWithCrons = 0;
const unknown = [];

function listCrons(siteId) {
  const cwd = path.join(ROOT, "apps", siteId);
  if (!existsSync(cwd)) {
    return { ok: false, error: "missing_app_dir", crons: [] };
  }
  const r = spawnSync(
    "vercel",
    ["crons", "ls", "--non-interactive"],
    { cwd, encoding: "utf8", timeout: 60_000 },
  );
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/No cron jobs found/i.test(text)) {
    return { ok: true, crons: [], raw: text.trim().slice(0, 400) };
  }
  if (r.status !== 0 && !/cron/i.test(text)) {
    return { ok: false, error: text.slice(0, 300), crons: null };
  }
  // Parse path lines roughly
  const paths = [];
  for (const line of text.split("\n")) {
    const m = line.match(/\/api\/[^\s]+/);
    if (m) paths.push(m[0]);
  }
  return { ok: true, crons: paths, raw: text.trim().slice(0, 600) };
}

function envHasVercelBrain(siteId) {
  const cwd = path.join(ROOT, "apps", siteId);
  const r = spawnSync(
    "vercel",
    ["env", "ls", "--non-interactive"],
    { cwd, encoding: "utf8", timeout: 60_000 },
  );
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  const present = /REVENUEOS_VERCEL_BRAIN/.test(text);
  return { present, sample: text.split("\n").filter((l) => /REVENUEOS_|CRON_/.test(l)).slice(0, 8) };
}

console.log(`[vercel-brain] sequential inspect of ${siteIds.length} projects`);

for (const siteId of siteIds) {
  console.log(`\n=== ${siteId} ===`);
  const cron = listCrons(siteId);
  const env = envHasVercelBrain(siteId);
  const brainPaths = (cron.crons || []).filter((p) =>
    /revenueos|pursuit|operator|portfolio-digest|daily-growth/i.test(p),
  );
  const ordinary = (cron.crons || []).filter((p) => !brainPaths.includes(p));
  if ((cron.crons || []).length) beforeWithCrons += 1;
  if (brainPaths.length) afterWithCrons += 1; // still present = not cleared
  if (!cron.ok) unknown.push(siteId);

  results[siteId] = {
    at: new Date().toISOString(),
    cronOk: cron.ok,
    crons: cron.crons,
    brainCrons: brainPaths,
    ordinaryCrons: ordinary,
    vercelBrainEnvPresent: env.present,
    error: cron.error || null,
  };
  writeFileSync(
    checkpointPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        portfolioCount: siteIds.length,
        inspected: Object.keys(results).length,
        projects: results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      crons: cron.crons,
      brainCrons: brainPaths,
      vercelBrainEnvPresent: env.present,
      ok: cron.ok,
    }),
  );
}

// Root TributeReady project (not under apps/)
console.log("\n=== tributeready (root) ===");
const rootCrons = spawnSync(
  "vercel",
  ["crons", "ls", "--non-interactive"],
  { cwd: ROOT, encoding: "utf8", timeout: 60_000 },
);
const rootText = `${rootCrons.stdout || ""}\n${rootCrons.stderr || ""}`;
const rootPaths = [];
for (const line of rootText.split("\n")) {
  const m = line.match(/\/api\/[^\s]+/);
  if (m) rootPaths.push(m[0]);
}
results["__tributeready__"] = {
  at: new Date().toISOString(),
  crons: rootPaths,
  brainCrons: rootPaths.filter((p) =>
    /revenueos|pursuit|portfolio-digest|daily-growth/i.test(p),
  ),
  ordinaryCrons: rootPaths.filter(
    (p) => /cleanup|growth-report/i.test(p),
  ),
  raw: rootText.trim().slice(0, 800),
};

const brainRemaining = Object.entries(results).filter(
  ([, v]) => (v.brainCrons || []).length > 0,
);
const envBreakGlass = Object.entries(results).filter(
  ([k, v]) => k !== "__tributeready__" && v.vercelBrainEnvPresent,
);

const summary = {
  updatedAt: new Date().toISOString(),
  portfolioCount: siteIds.length,
  projectsWithAnyCron: Object.values(results).filter(
    (v) => (v.crons || []).length > 0,
  ).length,
  projectsWithBrainCron: brainRemaining.length,
  brainCronProjects: brainRemaining.map(([k, v]) => ({ id: k, crons: v.brainCrons })),
  vercelBrainEnvPresentCount: envBreakGlass.length,
  vercelBrainEnvProjects: envBreakGlass.map(([k]) => k),
  unknownInspectFailures: unknown,
  rootOrdinaryCrons: results["__tributeready__"]?.ordinaryCrons || [],
  rootBrainCrons: results["__tributeready__"]?.brainCrons || [],
  pass:
    brainRemaining.length === 0 &&
    unknown.length === 0 &&
    envBreakGlass.length === 0,
};

writeFileSync(
  checkpointPath,
  JSON.stringify({ ...summary, projects: results }, null, 2) + "\n",
);
console.log("\n[vercel-brain] SUMMARY");
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.pass ? 0 : 2);
