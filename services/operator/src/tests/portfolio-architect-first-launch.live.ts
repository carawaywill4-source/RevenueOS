/**
 * FIRST autonomous business lifecycle proof.
 *
 * RevenueOS PortfolioArchitect chooses the opportunity and launches it.
 * Cursor only runs this harness — it does not hard-code the winner.
 *
 * After success: stopCreatingNewBusinesses=true until owner raises throughput.
 *
 *   npx tsx src/tests/portfolio-architect-first-launch.live.ts
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import {
  enrichOpportunitiesWithModel,
  getOpenAICapabilityStatus,
  runPortfolioArchitectCycle,
  selectLaunchCandidate,
  type BusinessOpportunity,
} from "@revenueos/core";
import { hydrateEnvFromFiles, loadEnv } from "../env.js";
import { createSupabaseStore } from "../lib/supabase-store.js";
import { getPortfolio, registerDynamicBusiness } from "../portfolio.js";
import { launchBusinessZeroSpend } from "../lib/business-launcher.js";
import {
  loadArchitectState,
  recordAutonomousLaunch,
  saveArchitectState,
} from "../lib/portfolio-evolution.js";

function parseEnv(p: string) {
  const out: Record<string, string> = {};
  if (!existsSync(p)) return out;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    let v = s.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[s.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  hydrateEnvFromFiles();
  const env = loadEnv();
  const root = path.resolve(process.cwd(), "../..");
  const secret =
    parseEnv(path.join(root, ".env.portfolio")).CRON_SECRET ||
    parseEnv(path.join(root, ".env.local")).CRON_SECRET ||
    process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET missing");

  const { client } = createSupabaseStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });

  const prev = await loadArchitectState(client);
  if (prev.launches.length > 0) {
    console.log(
      JSON.stringify({
        STOP: "first_autonomous_launch_already_done",
        launches: prev.launches,
        note: "Await owner approval before raising creation throughput",
      }),
    );
    process.exit(0);
  }

  const catalog = getPortfolio();
  const activeSiteIds = catalog.map((b) => b.siteId);
  const activeIndustries = catalog.map((b) => b.industry);
  const openai = getOpenAICapabilityStatus();

  let cycle = runPortfolioArchitectCycle({
    activeSiteIds,
    activeIndustries,
    telemetry: activeSiteIds.map((siteId) => ({
      siteId,
      purchases: 0,
      revenueUsd: 0,
      landingViews: 0,
      checkoutStarts: 0,
      ageDays: 40,
      experimentCount: 200,
    })),
    portableLessonHints: [
      "digital packs with buyer-intent doors have produced external verified publishes",
      "gumroad sync and discovery_attack are available commercial limbs",
      "OpenAI often degraded — prefer non-LLM acquisition hypotheses",
    ],
    safety: { ...prev.safety, stopCreatingNewBusinesses: false },
    ownerPolicy: prev.ownerPolicy,
  });

  const enriched = await enrichOpportunitiesWithModel(
    cycle.statePatch.opportunities ?? [],
  );
  if (enriched.length) {
    cycle.statePatch.opportunities = enriched;
    cycle.launchCandidate = selectLaunchCandidate({
      opportunities: enriched,
      activeCount: activeSiteIds.length,
      safety: { ...prev.safety, stopCreatingNewBusinesses: false },
      ownerPolicy: prev.ownerPolicy,
    });
    cycle.topAlternatives = enriched
      .filter((o) => o.siteId !== cycle.launchCandidate?.siteId)
      .slice(0, 10);
  }

  const chosen = cycle.launchCandidate;
  if (!chosen) {
    throw new Error("PortfolioArchitect selected no launch candidate");
  }

  // Persist selection reasoning before build
  await saveArchitectState(client, {
    ...prev,
    ...cycle.statePatch,
    opportunities: cycle.statePatch.opportunities ?? [],
    events: [
      ...(prev.events ?? []),
      ...(cycle.statePatch.events ?? []),
      {
        at: new Date().toISOString(),
        kind: "first_launch_selected",
        summary: `Selected ${chosen.displayName} score=${chosen.score}`,
        siteId: chosen.siteId,
      },
    ],
    updatedAt: new Date().toISOString(),
  });

  console.log(
    JSON.stringify({
      SELECTED: chosen.siteId,
      score: chosen.score,
      buyer: chosen.buyer,
      product: chosen.productName,
      priceUsd: chosen.priceUsd,
      openai: openai.status,
      alternatives: cycle.topAlternatives.map((a) => ({
        siteId: a.siteId,
        score: a.score,
        title: a.title,
      })),
    }),
  );

  const launch = await launchBusinessZeroSpend({
    opportunity: chosen as BusinessOpportunity,
    cronSecret: secret,
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    sequenceIndex: 100 + catalog.length,
  });

  console.log(JSON.stringify({ LAUNCH: launch }, null, 2));
  if (!launch.ok || !launch.manifest || !launch.productionUrl) {
    throw new Error(`Launch failed: ${launch.detail}`);
  }

  registerDynamicBusiness(launch.manifest);
  const state = await recordAutonomousLaunch(client, {
    opportunity: chosen,
    productionUrl: launch.productionUrl,
    reason: chosen.acquisitionHypothesis,
  });

  // Hot-add into running Core if available
  try {
    const add = await fetch("http://127.0.0.1:8080/control/add-business", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siteId: chosen.siteId }),
      signal: AbortSignal.timeout(10_000),
    });
    console.log("hot_add", add.status, await add.text());
  } catch (e) {
    console.log("hot_add_skipped", e instanceof Error ? e.message : e);
  }

  // Update Core BUSINESSES env for next LaunchAgent restart
  const envPath = path.join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    let t = readFileSync(envPath, "utf8");
    const ids = [...activeSiteIds, chosen.siteId].join(",");
    if (/^BUSINESSES=/m.test(t)) t = t.replace(/^BUSINESSES=.*$/m, `BUSINESSES=${ids}`);
    else t += `\nBUSINESSES=${ids}\n`;
    writeFileSync(envPath, t);
  }

  mkdirSync(path.join(root, ".data"), { recursive: true });
  const report = {
    phase: "FIRST_AUTONOMOUS_BUSINESS",
    at: new Date().toISOString(),
    selected: chosen,
    alternatives: cycle.topAlternatives,
    launch,
    architectStateSummary: {
      launches: state.launches,
      stopCreatingNewBusinesses: state.safety.stopCreatingNewBusinesses,
    },
    firstAcquisitionActions: [
      "enter first-customer mode via normal operator tick",
      "permissionless publish/discovery limbs preferred while OpenAI degraded",
    ],
  };
  const out = path.join(
    root,
    ".data",
    `portfolio-architect-first-launch-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ACCEPTANCE: "FIRST_LAUNCH_REPORT", path: out }));
}

main().catch((e) => {
  console.error("FIRST_LAUNCH_FAIL", e);
  process.exit(1);
});
