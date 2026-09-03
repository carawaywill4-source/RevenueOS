/**
 * FINAL owner intervention: soft-retire current portfolio → forge 50 actives.
 * Run: cd services/operator && npx tsx src/tests/portfolio-reset-50.live.ts
 *
 * Env:
 *   PORTFOLIO_RESET_DEPLOY=1  — also Vercel-deploy all 50 (slow)
 *   PORTFOLIO_RESET_DEPLOY_LIMIT=N — deploy only first N (smoke)
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPortfolio50Shape,
  portfolio50AsOpportunities,
  PORTFOLIO_50_SPECS,
} from "@revenueos/core";

// Node 20 + supabase-js realtime constructor requires a WebSocket global.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error minimal stub for client construction; REST does not use it
  globalThis.WebSocket = class {
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
import {
  authorizeResetPolicy,
  backupRetiredRegistry,
  deployFiftyZeroSpend,
  materializeAllFifty,
  registerFiftyActive,
  softRetireCurrentPortfolio,
} from "../lib/portfolio-reset.js";
import { getPortfolio, getRetiredPortfolio } from "../portfolio.js";

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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
loadEnvFile(path.join(root, "services/operator/.env"));

async function main() {
  const shape = assertPortfolio50Shape();
  if (!shape.ok) {
    console.error("SPEC_FAIL", shape.detail);
    process.exit(1);
  }
  console.log("SPEC_OK", shape);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cron = process.env.CRON_SECRET;
  if (!url || !key || !cron) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CRON_SECRET");
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  mkdirSync(path.join(root, ".data"), { recursive: true });
  backupRetiredRegistry();

  const phases = [];

  const auth = await authorizeResetPolicy(client);
  phases.push(auth);
  console.log(auth);

  const retire = await softRetireCurrentPortfolio({
    client,
    reason:
      "Owner final portfolio reset 2026-08-10 — soft retire prior actives; preserve all learning",
  });
  phases.push(retire);
  console.log(retire);

  const mat = materializeAllFifty("scopeguard");
  phases.push(mat);
  console.log(mat);
  if (!mat.ok) {
    writeFileSync(
      path.join(root, ".data/portfolio-reset-50-report.json"),
      JSON.stringify({ phases, at: new Date().toISOString() }, null, 2),
    );
    process.exit(1);
  }

  let productionUrls: Record<string, string> = {};
  const doDeploy = process.env.PORTFOLIO_RESET_DEPLOY === "1";
  if (doDeploy) {
    const limit = Number(process.env.PORTFOLIO_RESET_DEPLOY_LIMIT || "50");
    if (limit < 50) {
      // Deploy subset then register all with provisional URLs
      process.env.PORTFOLIO_RESET_DEPLOY_LIMIT = String(limit);
    }
    const dep = await deployFiftyZeroSpend({
      cronSecret: cron,
      supabaseUrl: url,
      supabaseServiceRoleKey: key,
      concurrency: Number(process.env.PORTFOLIO_RESET_CONCURRENCY || "2"),
      rematerialize: false,
    });
    phases.push(dep);
    console.log({ phase: dep.phase, ok: dep.ok, detail: dep.detail, okCount: dep.data?.okCount });
    productionUrls = (dep.data?.productionUrls as Record<string, string>) || {};
  }

  const reg = registerFiftyActive(productionUrls);
  phases.push(reg);
  console.log(reg);

  // Persist architect opportunities for the new 50
  const opps = portfolio50AsOpportunities();
  const prev = await (await import("../lib/portfolio-evolution.js")).loadArchitectState(client);
  const at = new Date().toISOString();
  await (await import("../lib/portfolio-evolution.js")).saveArchitectState(client, {
    ...prev,
    opportunities: opps,
    events: [
      ...(prev.events ?? []),
      {
        at,
        kind: "portfolio_reset_50_complete",
        summary: `Active portfolio reset to 50 (25 cashflow + 25 empire). Deploy=${doDeploy}`,
      },
    ],
    updatedAt: at,
  });

  // Update Core BUSINESSES env (in-place)
  const envPath = path.join(root, "services/operator/.env");
  if (existsSync(envPath)) {
    let envText = readFileSync(envPath, "utf8");
    const csv = PORTFOLIO_50_SPECS.map((s) => s.siteId).join(",");
    if (/^BUSINESSES=/m.test(envText)) {
      envText = envText.replace(/^BUSINESSES=.*$/m, `BUSINESSES=${csv}`);
    } else {
      envText += `\nBUSINESSES=${csv}\n`;
    }
    writeFileSync(envPath, envText);
  }

  const active = getPortfolio();
  const retired = getRetiredPortfolio();
  const report = {
    at: new Date().toISOString(),
    phases,
    activeCount: active.length,
    retiredCount: retired.length,
    cashflow: PORTFOLIO_50_SPECS.filter((s) => s.portfolioClass === "cashflow").map((s) => s.siteId),
    empire: PORTFOLIO_50_SPECS.filter((s) => s.portfolioClass === "empire").map((s) => s.siteId),
    deployEnabled: doDeploy,
    mode: "AUTONOMOUS_OPERATOR",
    note: "Build mode complete for reset scaffolding. Core should tick the 50. Stranger revenue is the scoreboard.",
  };
  writeFileSync(
    path.join(root, ".data/portfolio-reset-50-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        ok: active.length === 50,
        activeCount: active.length,
        retiredCount: retired.length,
        report: ".data/portfolio-reset-50-report.json",
      },
      null,
      2,
    ),
  );

  if (active.length !== 50) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
