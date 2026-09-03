/**
 * Continues Vercel production deploy for the 50-business reset.
 * Safe to re-run — skips siteIds already journey-ok in progress file.
 *
 *   PORTFOLIO_RESET_CONCURRENCY=2 npx tsx src/tests/portfolio-reset-50-deploy.live.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { portfolio50AsOpportunities } from "@revenueos/core";
import { launchBusinessZeroSpend, materializeBusinessApp } from "../lib/business-launcher.js";
import { registerDynamicBusiness, setActiveMode } from "../portfolio.js";

if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error stub
  globalThis.WebSocket = class {
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function loadEnvFile(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    let v = m[2] ?? "";
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

loadEnvFile(path.join(root, "services/operator/.env"));

type Prog = {
  results: Array<{ siteId: string; ok: boolean; detail: string; url?: string }>;
  productionUrls: Record<string, string>;
};

function loadProgress(): Prog {
  const p = path.join(root, ".data/portfolio-reset-50-progress.json");
  if (!existsSync(p)) return { results: [], productionUrls: {} };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Prog;
  } catch {
    return { results: [], productionUrls: {} };
  }
}

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const cron = process.env.CRON_SECRET!;
  if (!url || !key || !cron) throw new Error("missing env");

  const concurrency = Number(process.env.PORTFOLIO_RESET_CONCURRENCY || "2");
  const opps = portfolio50AsOpportunities();
  let prog = loadProgress();
  const doneOk = new Set(prog.results.filter((r) => r.ok).map((r) => r.siteId));
  const pending = opps.filter((o) => !doneOk.has(o.siteId));
  console.log(JSON.stringify({ pending: pending.length, alreadyOk: doneOk.size, concurrency }));

  mkdirSync(path.join(root, ".data"), { recursive: true });

  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);
    const settled = await Promise.all(
      batch.map(async (opp) => {
        console.log("DEPLOY_START", opp.siteId);
        materializeBusinessApp({ opportunity: opp, templateSiteId: "scopeguard" });
        const launch = await launchBusinessZeroSpend({
          opportunity: opp,
          cronSecret: cron,
          supabaseUrl: url,
          supabaseServiceRoleKey: key,
          sequenceIndex: 200 + opps.findIndex((o) => o.siteId === opp.siteId),
        });
        console.log("DEPLOY_DONE", opp.siteId, launch.ok, launch.productionUrl, launch.detail);
        if (launch.productionUrl) prog.productionUrls[opp.siteId] = launch.productionUrl;
        if (launch.manifest) registerDynamicBusiness(launch.manifest);
        return {
          siteId: opp.siteId,
          ok: launch.ok,
          detail: launch.detail,
          url: launch.productionUrl,
        };
      }),
    );
    // merge results (replace prior for same siteId)
    for (const r of settled) {
      prog.results = prog.results.filter((x) => x.siteId !== r.siteId);
      prog.results.push(r);
    }
    writeFileSync(
      path.join(root, ".data/portfolio-reset-50-progress.json"),
      JSON.stringify({ at: new Date().toISOString(), ...prog }, null, 2) + "\n",
    );
  }

  setActiveMode("dynamic_only_50");
  const okCount = prog.results.filter((r) => r.ok).length;
  console.log(JSON.stringify({ done: true, okCount, total: prog.results.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
