#!/usr/bin/env node
/**
 * Sequentially clear LIVE Vercel brain crons for projects that still schedule
 * /api/cron/revenueos despite empty git vercel.json.
 *
 * ONE project: deploy empty crons → verify → checkpoint → next.
 * No portfolio fan-out. No cosmetic app changes.
 *
 * Usage:
 *   node scripts/disable-vercel-brain-crons-sequential.mjs
 *   node scripts/disable-vercel-brain-crons-sequential.mjs --only rfpstrike,bidforge
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
const outDir = path.join(ROOT, ".data");
mkdirSync(outDir, { recursive: true });
const checkpointPath = path.join(
  outDir,
  "vercel-brain-cron-disable-checkpoint.json",
);

const DEFAULT_TARGETS = [
  "rfpstrike",
  "bidforge",
  "scopesmith",
  "quotecraft",
  "leadreply",
  "coldforge",
  "reviewrescue",
  "locallaunch",
  "listingpilot",
  "homelistpro",
  "autolistai",
  "marketplacemax",
  "menumoney",
  "storelift",
];

const onlyArg = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : "";
const targets = onlyArg
  ? onlyArg.split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_TARGETS;

const state = existsSync(checkpointPath)
  ? JSON.parse(readFileSync(checkpointPath, "utf8"))
  : { cleared: {}, failed: {} };

function listBrainCrons(siteId) {
  const cwd = path.join(ROOT, "apps", siteId);
  const r = spawnSync("vercel", ["crons", "ls", "--non-interactive"], {
    cwd,
    encoding: "utf8",
    timeout: 90_000,
  });
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (/No cron jobs found/i.test(text)) return [];
  const paths = [];
  for (const line of text.split("\n")) {
    const m = line.match(/\/api\/[^\s]+/);
    if (m && /revenueos|pursuit|operator|digest|daily-growth/i.test(m[0])) {
      paths.push(m[0]);
    }
  }
  return paths;
}

function save() {
  writeFileSync(
    checkpointPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        targets,
        cleared: state.cleared,
        failed: state.failed,
      },
      null,
      2,
    ) + "\n",
  );
}

for (const siteId of targets) {
  if (state.cleared[siteId]?.pass) {
    console.log(`[skip] ${siteId} already cleared`);
    continue;
  }
  console.log(`\n======== ${siteId} ========`);
  const before = listBrainCrons(siteId);
  console.log("[before]", before);
  if (before.length === 0) {
    state.cleared[siteId] = {
      pass: true,
      at: new Date().toISOString(),
      note: "already_empty",
      before,
      after: [],
    };
    save();
    continue;
  }

  const cwd = path.join(ROOT, "apps", siteId);
  console.log("[deploy] vercel --prod --yes --force (empty crons only intent)");
  const dep = spawnSync(
    "vercel",
    ["--prod", "--yes", "--force", "--non-interactive"],
    { cwd, encoding: "utf8", timeout: 600_000 },
  );
  console.log((dep.stdout || "").slice(-800));
  if (dep.status !== 0) {
    console.error((dep.stderr || "").slice(-800));
    state.failed[siteId] = {
      at: new Date().toISOString(),
      error: (dep.stderr || dep.stdout || "deploy_failed").slice(0, 500),
      before,
    };
    save();
    console.error(`[FAIL] ${siteId} — stopping sequential run for safety`);
    process.exit(2);
  }

  // brief settle
  spawnSync("sleep", ["3"]);
  const after = listBrainCrons(siteId);
  console.log("[after]", after);
  const pass = after.length === 0;
  state.cleared[siteId] = {
    pass,
    at: new Date().toISOString(),
    before,
    after,
    deployStatus: dep.status,
  };
  save();
  if (!pass) {
    state.failed[siteId] = { at: new Date().toISOString(), before, after };
    save();
    console.error(`[FAIL] ${siteId} still has brain crons — stop`);
    process.exit(2);
  }
  console.log(`[PASS] ${siteId} brain crons cleared`);
}

const allPass = targets.every((id) => state.cleared[id]?.pass);
console.log("\n[done]", { allPass, cleared: Object.keys(state.cleared).length });
process.exit(allPass ? 0 : 2);
