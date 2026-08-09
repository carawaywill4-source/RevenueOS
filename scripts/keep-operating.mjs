#!/usr/bin/env node
/**
 * Continuous RevenueOS operator — not a 20-minute heartbeat.
 *
 * Drains pursuits across the portfolio as fast as hosts allow.
 * Only brief pauses when every site is waiting on evidence (no executable work).
 *
 * Usage: node scripts/keep-operating.mjs [--hours 8]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseEnv(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    let v = s.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (v.includes("[SENSITIVE]")) continue;
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

const SITES = [
  ["raiseready", "https://raiseready-seven.vercel.app"],
  ["ledgerleaf", "https://ledgerleaf-ashen.vercel.app"],
  ["depositproof", "https://depositproof-omega.vercel.app"],
  ["turnoverkit", "https://turnoverkit.vercel.app"],
  ["listinglift", "https://listinglift-eight.vercel.app"],
  ["closeshift", "https://closeshift.vercel.app"],
  ["bidbinder", "https://bidbinder.vercel.app"],
  ["resumeforge", "https://resumeforge-liard.vercel.app"],
  ["waitroom", "https://waitroom-sepia.vercel.app"],
  ["shopbeacon", "https://shopbeacon.vercel.app"],
];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const hours = Number(arg("--hours", "8"));
const endAt = Date.now() + hours * 60 * 60 * 1000;
const BUSY_PAUSE_MS = 2_000; // work remaining → almost no pause
const IDLE_PAUSE_MS = 12_000; // all waiting on evidence → short breathe
const logDir = path.join(ROOT, ".data");
mkdirSync(logDir, { recursive: true });
const logPath = path.join(logDir, "keep-operating.log");

function log(line) {
  const row = `[${new Date().toISOString()}] ${line}`;
  console.log(row);
  writeFileSync(logPath, row + "\n", { flag: "a" });
}

async function tickSite(siteId, url) {
  const env = parseEnv(path.join(ROOT, "apps", siteId, ".env.local"));
  const secret = env.CRON_SECRET;
  if (!secret) return { siteId, error: "no_cron_secret" };
  const res = await fetch(`${url}/api/cron/revenueos`, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { siteId, error: `HTTP ${res.status} ${text.slice(0, 80)}` };
  }
  if (!res.ok) return { siteId, error: data.error || res.status };
  const drain = data.drain || {};
  return {
    siteId,
    executed: drain.executed ?? 0,
    enqueued: data.enqueued ?? 0,
    claimable: drain.claimableRemaining ?? 0,
    stillWaiting: drain.stillWaiting ?? 0,
    fcm: data.firstCustomerMode,
  };
}

async function maybeDigest() {
  const tr = parseEnv(path.join(ROOT, ".env.development.local"));
  const secret = tr.CRON_SECRET;
  if (!secret) return { skipped: "no_tr_secret" };
  const res = await fetch(
    "https://tributeready.vercel.app/api/cron/portfolio-digest",
    {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(120_000),
    },
  );
  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    emailId: data.emailId,
    skip: data.emailSkip || data.skipped,
    liveCount: data.liveCount,
  };
}

log(`keep-operating CONTINUOUS start hours=${hours}`);

let round = 0;
let lastDigestHour = "";
while (Date.now() < endAt) {
  round += 1;
  const started = Date.now();
  // Hit all sites in parallel — continuous portfolio pressure
  const outcomes = await Promise.all(
    SITES.map(async ([siteId, url]) => {
      try {
        return await tickSite(siteId, url);
      } catch (e) {
        return { siteId, error: e.message };
      }
    }),
  );

  let execTotal = 0;
  let claimableTotal = 0;
  for (const o of outcomes) {
    if (o.error) log(`${o.siteId} ERROR ${o.error}`);
    else {
      execTotal += o.executed || 0;
      claimableTotal += o.claimable || 0;
      log(
        `${o.siteId} exec=${o.executed} enq=${o.enqueued} claimable=${o.claimable} wait=${o.stillWaiting}`,
      );
    }
  }
  const elapsed = Date.now() - started;
  const busy = execTotal > 0 || claimableTotal > 0;
  log(
    `round ${round} exec=${execTotal} claimable=${claimableTotal} ${elapsed}ms mode=${busy ? "BUSY→continue" : "IDLE→brief"}`,
  );

  const hourKey = new Date().toISOString().slice(0, 13);
  if (hourKey !== lastDigestHour) {
    try {
      const d = await maybeDigest();
      log(`digest ${JSON.stringify(d)}`);
      if (d.emailId || d.skip === "already_sent_this_hour") {
        lastDigestHour = hourKey;
      }
    } catch (e) {
      log(`digest THROW ${e.message}`);
    }
  }

  writeFileSync(
    path.join(logDir, "keep-operating-latest.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        mode: "continuous",
        round,
        outcomes,
        execTotal,
        claimableTotal,
        busy,
      },
      null,
      2,
    ),
  );

  if (Date.now() >= endAt) break;
  const pause = busy ? BUSY_PAUSE_MS : IDLE_PAUSE_MS;
  await new Promise((r) => setTimeout(r, pause));
}

log("keep-operating finished");
