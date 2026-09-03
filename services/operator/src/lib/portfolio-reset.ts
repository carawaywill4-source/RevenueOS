/**
 * Owner-authorized FINAL portfolio reset → 50 ACTIVE businesses.
 * Soft-retires prior actives (preserve learning). Materializes + deploys replacements.
 */

import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  opportunityToManifest,
  portfolio50AsOpportunities,
  assertPortfolio50Shape,
  PORTFOLIO_50_SPECS,
  type PortfolioArchitectState,
} from "@revenueos/core";
import {
  launchBusinessZeroSpend,
  materializeBusinessApp,
} from "./business-launcher.js";
import {
  loadArchitectState,
  saveArchitectState,
  updateOwnerPortfolioPolicy,
} from "./portfolio-evolution.js";
import {
  getPortfolio,
  registerDynamicBusiness,
  retireBusinessPreserve,
  setActiveMode,
  replaceDynamicPortfolio,
} from "../portfolio.js";

function rootDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

export type ResetPhaseResult = {
  phase: string;
  ok: boolean;
  detail: string;
  data?: Record<string, unknown>;
};

export async function softRetireCurrentPortfolio(input: {
  client: SupabaseClient;
  reason: string;
}): Promise<ResetPhaseResult> {
  const active = getPortfolio();
  const retiredAt = new Date().toISOString();
  const decisions = [];
  for (const b of active) {
    retireBusinessPreserve(b, {
      retiredAt,
      reason: input.reason,
      mode: "soft",
    });
    decisions.push({
      siteId: b.siteId,
      mode: "soft" as const,
      why: input.reason,
      evidence: { previousAppUrl: b.appUrl, industry: b.industry },
      whatWasTried: [
        "permissionless acquisition",
        "Mac Core operation",
        "portfolio exploration",
      ],
      whatWasLearned: [
        "Preserve traffic/conversion/channel/pricing/Stripe attribution history in ledgers",
        "Do not delete source or experiment memory",
      ],
      reversible: true,
      at: retiredAt,
    });
  }

  const prev = await loadArchitectState(input.client);
  const state: PortfolioArchitectState = {
    ...prev,
    retirementDecisions: [...(prev.retirementDecisions ?? []), ...decisions],
    events: [
      ...(prev.events ?? []),
      {
        at: retiredAt,
        kind: "portfolio_soft_retire_batch",
        summary: `Soft-retired ${active.length} businesses preserving intelligence`,
      },
    ],
    updatedAt: retiredAt,
  };
  await saveArchitectState(input.client, state);

  for (const b of active) {
    try {
      await fetch("http://127.0.0.1:8090/retire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteId: b.siteId }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* hosting optional */
    }
  }

  return {
    phase: "retire",
    ok: true,
    detail: `Soft-retired ${active.length} businesses`,
    data: { siteIds: active.map((b) => b.siteId) },
  };
}

export async function authorizeResetPolicy(
  client: SupabaseClient,
): Promise<ResetPhaseResult> {
  const at = new Date().toISOString();
  await updateOwnerPortfolioPolicy(client, {
    stopCreatingNewBusinesses: false,
    maxActiveBusinesses: 50,
    prioritizeExistingOverNew: false,
    allowCreationWithoutReferenceProof: true,
    portfolioResetAuthorizedAt: at,
    lockedSiteIds: [],
  });
  const prev = await loadArchitectState(client);
  await saveArchitectState(client, {
    ...prev,
    safety: {
      ...prev.safety,
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
      prioritizeExistingOverNew: false,
      autonomousBusinessDiscovery: true,
      autonomousIncubation: true,
      autonomousZeroCostLaunch: true,
      autonomousSoftRetirement: true,
      autonomousPermanentSourceDeletion: false,
      preserveAllLearning: true,
    },
    ownerPolicy: {
      ...prev.ownerPolicy,
      stopCreatingNewBusinesses: false,
      maxActiveBusinesses: 50,
      prioritizeExistingOverNew: false,
      allowCreationWithoutReferenceProof: true,
      portfolioResetAuthorizedAt: at,
      lockedSiteIds: [],
      updatedAt: at,
    },
    updatedAt: at,
  });
  return {
    phase: "authorize",
    ok: true,
    detail: "Owner policy unlocked for 50-business autonomous portfolio",
  };
}

export function materializeAllFifty(
  templateSiteId = "scopeguard",
): ResetPhaseResult {
  const shape = assertPortfolio50Shape();
  if (!shape.ok) {
    return { phase: "materialize", ok: false, detail: shape.detail };
  }
  const opps = portfolio50AsOpportunities();
  const created: string[] = [];
  const failed: Array<{ siteId: string; error: string }> = [];
  for (const opp of opps) {
    try {
      materializeBusinessApp({ opportunity: opp, templateSiteId });
      const appDir = path.join(rootDir(), "apps", opp.siteId);
      const metaPath = path.join(appDir, "content/portfolio-meta.json");
      mkdirSync(path.dirname(metaPath), { recursive: true });
      const spec = PORTFOLIO_50_SPECS.find((s) => s.siteId === opp.siteId);
      writeFileSync(
        metaPath,
        JSON.stringify(
          {
            siteId: opp.siteId,
            portfolioClass: spec?.portfolioClass ?? "cashflow",
            empireLadder: spec?.empireLadder ?? [],
            resetAt: new Date().toISOString(),
          },
          null,
          2,
        ) + "\n",
      );
      created.push(opp.siteId);
    } catch (e) {
      failed.push({
        siteId: opp.siteId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return {
    phase: "materialize",
    ok: failed.length === 0,
    detail: `Materialized ${created.length}/50 (failed ${failed.length})`,
    data: { created, failed },
  };
}

export function registerFiftyActive(
  productionUrls: Record<string, string> = {},
): ResetPhaseResult {
  const opps = portfolio50AsOpportunities();
  const manifests = opps.map((opp, i) => {
    const url = productionUrls[opp.siteId] || `https://${opp.siteId}.vercel.app`;
    return opportunityToManifest(opp, url, 200 + i);
  });
  replaceDynamicPortfolio(manifests);
  setActiveMode("dynamic_only_50");
  return {
    phase: "register",
    ok: manifests.length === 50,
    detail: `Registered ${manifests.length} active businesses (dynamic_only_50)`,
    data: { siteIds: manifests.map((m) => m.siteId) },
  };
}

export async function deployFiftyZeroSpend(input: {
  cronSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  concurrency?: number;
  rematerialize?: boolean;
}): Promise<ResetPhaseResult> {
  const opps = portfolio50AsOpportunities();
  const concurrency = input.concurrency ?? 2;
  const productionUrls: Record<string, string> = {};
  const results: Array<{
    siteId: string;
    ok: boolean;
    detail: string;
    url?: string;
  }> = [];

  mkdirSync(path.join(rootDir(), ".data"), { recursive: true });

  for (let i = 0; i < opps.length; i += concurrency) {
    const batch = opps.slice(i, i + concurrency);
    const settled = await Promise.all(
      batch.map(async (opp) => {
        if (input.rematerialize !== false) {
          materializeBusinessApp({
            opportunity: opp,
            templateSiteId: "scopeguard",
          });
        }
        const launch = await launchBusinessZeroSpend({
          opportunity: opp,
          cronSecret: input.cronSecret,
          supabaseUrl: input.supabaseUrl,
          supabaseServiceRoleKey: input.supabaseServiceRoleKey,
          sequenceIndex: 200 + opps.findIndex((o) => o.siteId === opp.siteId),
        });
        if (launch.productionUrl) {
          productionUrls[opp.siteId] = launch.productionUrl;
        }
        if (launch.manifest) registerDynamicBusiness(launch.manifest);
        return {
          siteId: opp.siteId,
          ok: launch.ok,
          detail: launch.detail,
          url: launch.productionUrl,
        };
      }),
    );
    results.push(...settled);
    writeFileSync(
      path.join(rootDir(), ".data/portfolio-reset-50-progress.json"),
      JSON.stringify(
        { at: new Date().toISOString(), results, productionUrls },
        null,
        2,
      ) + "\n",
    );
  }

  setActiveMode("dynamic_only_50");
  const okCount = results.filter((r) => r.ok).length;
  return {
    phase: "deploy",
    ok: okCount >= 1,
    detail: `Deployed journey-ok ${okCount}/50`,
    data: { results, productionUrls, okCount },
  };
}

export function backupRetiredRegistry(): void {
  const dyn = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../portfolio-dynamic.json",
  );
  const retiredDir = path.join(rootDir(), ".data/portfolio-retired");
  mkdirSync(retiredDir, { recursive: true });
  if (existsSync(dyn)) {
    copyFileSync(
      dyn,
      path.join(retiredDir, `portfolio-dynamic-${Date.now()}.json`),
    );
  }
}
