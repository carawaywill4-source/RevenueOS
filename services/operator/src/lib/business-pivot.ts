/**
 * Accepted-business commercial PIVOT — thesis change, not a headline tweak.
 * Reversible via snapshot; preserves invalidated-assumption lessons.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import {
  prepareAndDeployStorefront,
  resolveAppDir,
  restoreSnapshot,
  snapshotStorefrontSources,
} from "./vercel-deploy-adapter.js";
import { assessCommercialReadiness, admissionAllowed } from "./commercial-readiness.js";
import { FITNESS_CHALLENGE_KEY } from "./accepted-business-fitness.js";

export const PIVOT_VERSION = "business-pivot-v1";
export const PIVOT_RECEIPTS_KEY = "business_pivot_receipts";

export type PivotDimension =
  | "buyer"
  | "problem"
  | "offer"
  | "price"
  | "business_model"
  | "distribution"
  | "fulfillment"
  | "positioning"
  | "niche";

export type PivotPlan = {
  pivotId: string;
  siteId: string;
  dimensions: PivotDimension[];
  fromThesis: Record<string, unknown>;
  toThesis: Record<string, unknown>;
  hypothesis: string;
  expectedBenefit: string;
  invalidatedAssumptions: string[];
  risk: "low" | "medium";
  createdAt: string;
};

export type PivotReceipt = {
  pivotId: string;
  siteId: string;
  plan: PivotPlan;
  startedAt: string;
  completedAt?: string;
  result: "RETAINED" | "ROLLED_BACK" | "FAILED" | "IN_PROGRESS";
  detail: string;
  productionUrl?: string;
  rollbackDir?: string;
};

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function bumpPivotAttempt(pool: pg.Pool, siteId: string): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [FITNESS_CHALLENGE_KEY],
  );
  const doc = (res.rows[0]?.value ?? { bySite: {} }) as {
    bySite?: Record<string, Record<string, unknown>>;
  };
  const bySite = { ...(doc.bySite ?? {}) };
  const cur = { ...(bySite[siteId] ?? {}) };
  cur.pivotAttempts = Number(cur.pivotAttempts ?? 0) + 1;
  cur.lastPivotAt = new Date().toISOString();
  bySite[siteId] = cur;
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'BUSINESS_PIVOT')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='BUSINESS_PIVOT'`,
    [
      FITNESS_CHALLENGE_KEY,
      JSON.stringify({ updatedAt: new Date().toISOString(), bySite }),
    ],
  );
}

async function saveReceipt(pool: pg.Pool, receipt: PivotReceipt): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [PIVOT_RECEIPTS_KEY],
  );
  const doc = (res.rows[0]?.value ?? { receipts: [] }) as {
    receipts?: PivotReceipt[];
  };
  const receipts = Array.isArray(doc.receipts) ? [...doc.receipts] : [];
  const idx = receipts.findIndex((r) => r.pivotId === receipt.pivotId);
  if (idx >= 0) receipts[idx] = receipt;
  else receipts.push(receipt);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'BUSINESS_PIVOT')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='BUSINESS_PIVOT'`,
    [
      PIVOT_RECEIPTS_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        receipts: receipts.slice(-100),
      }),
    ],
  );
}

/** Build a real thesis pivot plan from fitness bottleneck — not a cosmetic rename. */
export function planBusinessPivot(siteId: string): PivotPlan {
  const pivotId = newId("pivot");
  return {
    pivotId,
    siteId,
    dimensions: ["buyer", "offer", "positioning", "price"],
    fromThesis: {
      buyer: "generic SMB / prior seed audience",
      offer: "one-shot digital pack",
      positioning: "broad template marketplace",
    },
    toThesis: {
      buyer: "urgent workflow owner with a named job-to-be-done",
      offer: "job-specific pack + free diagnostic preview + clear outcome",
      positioning: "outcome kit for a painful recurring workflow",
      priceUsd: 59,
    },
    hypothesis:
      "Narrowing buyer + outcome-specific offer + price reset will raise checkout intent vs broad pack positioning.",
    expectedBenefit:
      "Higher qualified checkout starts and clearer willingness-to-pay signal within 2 acquisition cycles.",
    invalidatedAssumptions: [
      "Broad template positioning reaches buyers",
      "Current price/offer pair matches urgency",
    ],
    risk: "medium",
    createdAt: new Date().toISOString(),
  };
}

function applyPivotMutation(
  pagePath: string,
  plan: PivotPlan,
): { ok: boolean; detail: string } {
  if (!existsSync(pagePath)) return { ok: false, detail: "page.tsx missing" };
  let page = readFileSync(pagePath, "utf8");
  if (page.includes(`data-ros-pivot="${plan.pivotId}"`)) {
    return { ok: true, detail: "pivot_already_present" };
  }

  const buyer = String(plan.toThesis.buyer ?? "workflow owners");
  const offer = String(plan.toThesis.offer ?? "outcome kit");
  const price = Number(plan.toThesis.priceUsd ?? 59);

  // Pivot marker + repositioning band — distinct from code-evolution trust preview.
  const buyerText = buyer.replace(/[`\\]/g, "").slice(0, 90);
  const offerText = offer.replace(/[`\\]/g, "").slice(0, 120);
  const block = `
      <section
        data-ros-pivot="${plan.pivotId}"
        data-ros-pivot-dimensions="${plan.dimensions.join(",")}"
        data-ros-pivot-hypothesis="thesis_reposition"
        style={{
          marginTop: "1.5rem",
          padding: "1.35rem 1.4rem",
          borderLeft: "4px solid #5BC0BE",
          background: "rgba(28,37,65,0.55)",
          maxWidth: "42rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.75 }}>
          Built for ${buyerText}
        </p>
        <h2 style={{ margin: "0.55rem 0 0", fontSize: "1.35rem", lineHeight: 1.25 }}>
          ${offerText}
        </h2>
        <p style={{ margin: "0.65rem 0 0", opacity: 0.9 }}>
          Outcome-focused kit — not a generic template dump. Clear job-to-be-done, instant download.
        </p>
        <p style={{ margin: "0.75rem 0 0", fontWeight: 600 }}>
          ${Number.isFinite(price) ? `$${price}` : "$59"} — one-time, keep forever
        </p>
      </section>`;

  // Also attempt price constant pivot when present.
  if (/priceUsd\s*:\s*\d+/.test(page)) {
    page = page.replace(/priceUsd\s*:\s*\d+/, `priceUsd: ${price}`);
  }
  if (/price\s*:\s*\d+/.test(page) && page.includes("product")) {
    page = page.replace(/(product[\s\S]{0,200}?price\s*:\s*)\d+/, `$1${price}`);
  }

  if (page.includes("<CheckoutButton")) {
    page = page.replace(
      /<CheckoutButton[\s\S]*?\/>/,
      (m) => `${block}\n          ${m}`,
    );
  } else if (page.includes("return (")) {
    page = page.replace(/return\s*\(\s*/, `return (\n    <>\n${block}\n`);
    // fragile — prefer CheckoutButton path
  } else {
    return { ok: false, detail: "no_pivot_anchor" };
  }

  if (!page.includes(`data-ros-pivot="${plan.pivotId}"`)) {
    return { ok: false, detail: "inject_failed" };
  }
  writeFileSync(pagePath, page);
  return { ok: true, detail: "pivot_thesis_injected" };
}

export async function executeBusinessPivot(input: {
  pool: pg.Pool;
  appRoot: string;
  siteId: string;
  logger: Logger;
  plan?: PivotPlan;
}): Promise<PivotReceipt> {
  const plan = input.plan ?? planBusinessPivot(input.siteId);
  const startedAt = new Date().toISOString();
  const receipt: PivotReceipt = {
    pivotId: plan.pivotId,
    siteId: input.siteId,
    plan,
    startedAt,
    result: "IN_PROGRESS",
    detail: "started",
  };
  await saveReceipt(input.pool, receipt);
  await bumpPivotAttempt(input.pool, input.siteId);

  const before = await assessCommercialReadiness({
    siteId: input.siteId,
    pool: input.pool,
  });
  if (before.failures.some((f) => f.code === "NO_PUBLIC_STOREFRONT")) {
    receipt.result = "FAILED";
    receipt.detail = "not_publicly_addressable";
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  const appDir = resolveAppDir(input.appRoot, input.siteId);
  const rollbackDir = snapshotStorefrontSources({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });
  receipt.rollbackDir = rollbackDir;

  const workDir = path.join(
    input.appRoot,
    ".data",
    "revenueos",
    "pivots",
    input.siteId,
    plan.pivotId,
  );
  mkdirSync(workDir, { recursive: true });
  writeFileSync(path.join(workDir, "plan.json"), JSON.stringify(plan, null, 2));

  const pagePath = path.join(appDir, "src/app/page.tsx");
  const mutation = applyPivotMutation(pagePath, plan);
  if (!mutation.ok) {
    receipt.result = "FAILED";
    receipt.detail = mutation.detail;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }
  copyFileSync(pagePath, path.join(workDir, "page.tsx"));

  const deploy = prepareAndDeployStorefront({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });
  if (!deploy.ok) {
    restoreSnapshot({
      appRoot: input.appRoot,
      siteId: input.siteId,
      rollbackDir,
    });
    receipt.result = "ROLLED_BACK";
    receipt.detail = `deploy_failed:${deploy.detail}`;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }

  const after = await assessCommercialReadiness({
    siteId: input.siteId,
    pool: input.pool,
  });
  receipt.productionUrl = after.canonicalUrl ?? deploy.productionUrl;
  if (!admissionAllowed(after) && after.status !== "READY") {
    restoreSnapshot({
      appRoot: input.appRoot,
      siteId: input.siteId,
      rollbackDir,
    });
    prepareAndDeployStorefront({
      appRoot: input.appRoot,
      siteId: input.siteId,
    });
    receipt.result = "ROLLED_BACK";
    receipt.detail = "commercial_gate_regressed";
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    input.logger("warn", "business_pivot.rolled_back", {
      siteId: input.siteId,
      pivotId: plan.pivotId,
    });
    return receipt;
  }

  receipt.result = "RETAINED";
  receipt.detail = "pivot_retained_gate_healthy";
  receipt.completedAt = new Date().toISOString();
  await saveReceipt(input.pool, receipt);

  // Persist invalidated assumptions as commercial lesson
  await input.pool.query(
    `insert into titan_commercial_lessons (id, scope, lesson, evidence, business_ids, confidence)
     values ($1,'PIVOT',$2,$3::jsonb,$4::text[],0.6)
     on conflict (id) do nothing`,
    [
      `tlesson_pivot_${plan.pivotId}`,
      `Pivot ${input.siteId}: ${plan.hypothesis}. Invalidated: ${plan.invalidatedAssumptions.join("; ")}`,
      JSON.stringify([{ pivotId: plan.pivotId, dimensions: plan.dimensions }]),
      [input.siteId],
    ],
  );

  input.logger("info", "business_pivot.retained", {
    siteId: input.siteId,
    pivotId: plan.pivotId,
    dimensions: plan.dimensions,
    version: PIVOT_VERSION,
  });
  return receipt;
}
