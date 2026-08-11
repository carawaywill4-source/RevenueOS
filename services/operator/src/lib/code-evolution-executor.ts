/**
 * CODE_EVOLUTION — commercially hypothesized product/code changes for managed businesses.
 *
 * Separate from SELF_REPAIR (broken → restore) and BUSINESS_REPAIR (commercial gate).
 * Mutates apps/{siteId}, validates, deploys via vercel-deploy-adapter, verifies, learns.
 * $0 paid AI — deterministic mutations only in v1.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
import type pg from "pg";
import {
  assessCommercialReadiness,
  admissionAllowed,
} from "./commercial-readiness.js";
import {
  prepareAndDeployStorefront,
  snapshotStorefrontSources,
  restoreSnapshot,
  resolveAppDir,
} from "./vercel-deploy-adapter.js";
import {
  CODE_EVOLUTION_KEY,
  CODE_EVOLUTION_LESSONS_KEY,
} from "./architect-pg-store.js";

export const CODE_EVOLUTION_VERSION = "code-evolution-v1";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

export type CodeEvolutionPlan = {
  evolutionId: string;
  siteId: string;
  observation: string;
  hypothesis: string;
  expectedEffect: string;
  mutationKind: "TRUST_PREVIEW_SECTION" | "VALUE_BULLET_CLARITY" | "FAQ_OBJECTION";
  files: string[];
  risk: "low" | "medium";
  createdAt: string;
};

export type CodeEvolutionReceipt = {
  evolutionId: string;
  siteId: string;
  plan: CodeEvolutionPlan;
  startedAt: string;
  completedAt?: string;
  filesChanged: string[];
  productionUrl?: string;
  rollbackDir?: string;
  result: "RETAINED" | "ROLLED_BACK" | "FAILED" | "IN_PROGRESS";
  verification?: Record<string, unknown>;
  detail: string;
};

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function saveReceipt(pool: pg.Pool, receipt: CodeEvolutionReceipt) {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [CODE_EVOLUTION_KEY],
  );
  const doc = (res.rows[0]?.value ?? { receipts: [] }) as {
    receipts?: CodeEvolutionReceipt[];
  };
  const receipts = Array.isArray(doc.receipts) ? [...doc.receipts] : [];
  const idx = receipts.findIndex((r) => r.evolutionId === receipt.evolutionId);
  if (idx >= 0) receipts[idx] = receipt;
  else receipts.push(receipt);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'CODE_EVOLUTION')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CODE_EVOLUTION'`,
    [
      CODE_EVOLUTION_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        receipts: receipts.slice(-100),
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
    [CODE_EVOLUTION_LESSONS_KEY],
  );
  const doc = (res.rows[0]?.value ?? { lessons: [] }) as {
    lessons?: Record<string, unknown>[];
  };
  const lessons = Array.isArray(doc.lessons) ? [...doc.lessons] : [];
  lessons.push(lesson);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'CODE_EVOLUTION')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CODE_EVOLUTION'`,
    [
      CODE_EVOLUTION_LESSONS_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        lessons: lessons.slice(-100),
      }),
    ],
  );
}

/** Deterministic commercially-hypothesized plans for digital storefronts. */
export function planCodeEvolution(siteId: string): CodeEvolutionPlan {
  return {
    evolutionId: newId("cevo"),
    siteId,
    observation:
      "Public storefront has offer + CTA but limited pre-purchase value demonstration — visitors may not understand the pack before checkout.",
    hypothesis:
      "Adding a free interactive preview of pack contents above the fold increases trust and checkout-start rate without paid ads.",
    expectedEffect:
      "Higher checkout-start rate and clearer product differentiation; no regression in commercial-readiness gate.",
    mutationKind: "TRUST_PREVIEW_SECTION",
    files: ["src/app/page.tsx"],
    risk: "low",
    createdAt: new Date().toISOString(),
  };
}

function applyTrustPreviewMutation(pagePath: string): {
  ok: boolean;
  detail: string;
} {
  if (!existsSync(pagePath)) return { ok: false, detail: "page.tsx missing" };
  let page = readFileSync(pagePath, "utf8");
  if (page.includes("data-ros-code-evolution=\"trust-preview\"")) {
    return { ok: true, detail: "mutation_already_present" };
  }
  const block = `
      <section
        data-ros-code-evolution="trust-preview"
        data-ros-hypothesis="free_preview_increases_checkout_starts"
        style={{
          marginTop: "2rem",
          padding: "1.25rem 1.35rem",
          border: "1px solid rgba(244,241,234,0.22)",
          borderRadius: "12px",
          background: "rgba(12,12,12,0.35)",
          maxWidth: "42rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.78rem", letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>
          Free preview — see inside before you buy
        </p>
        <ul style={{ margin: "0.85rem 0 0", paddingLeft: "1.1rem", lineHeight: 1.55 }}>
          {BRAND.product.bullets.slice(0, 3).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p style={{ margin: "0.9rem 0 0", fontSize: "0.92rem", opacity: 0.85 }}>
          Instant download after Stripe checkout. No account required to evaluate fit.
        </p>
      </section>`;

  if (!page.includes("<CheckoutButton")) {
    return { ok: false, detail: "no CheckoutButton anchor" };
  }
  // Insert preview immediately before CTA container when possible.
  if (page.includes(`<div style={{ marginTop: "1.35rem" }}>`)) {
    page = page.replace(
      `<div style={{ marginTop: "1.35rem" }}>`,
      `${block}\n          <div style={{ marginTop: "1.35rem" }}>`,
    );
  } else {
    page = page.replace(
      /<CheckoutButton[\s\S]*?\/>/,
      (m) => `${block}\n          ${m}`,
    );
  }
  if (!page.includes("data-ros-code-evolution=\"trust-preview\"")) {
    return { ok: false, detail: "inject_failed" };
  }
  writeFileSync(pagePath, page);
  return { ok: true, detail: "trust_preview_injected" };
}

export async function executeCodeEvolution(input: {
  pool: pg.Pool;
  appRoot: string;
  siteId: string;
  logger: Logger;
  plan?: CodeEvolutionPlan;
}): Promise<CodeEvolutionReceipt> {
  const plan = input.plan ?? planCodeEvolution(input.siteId);
  const startedAt = new Date().toISOString();
  const receipt: CodeEvolutionReceipt = {
    evolutionId: plan.evolutionId,
    siteId: input.siteId,
    plan,
    startedAt,
    filesChanged: [],
    result: "IN_PROGRESS",
    detail: "started",
  };
  await saveReceipt(input.pool, receipt);
  input.logger("info", "code_evolution.started", {
    siteId: input.siteId,
    evolutionId: plan.evolutionId,
    mutationKind: plan.mutationKind,
    hypothesis: plan.hypothesis.slice(0, 160),
  });

  const before = await assessCommercialReadiness({
    siteId: input.siteId,
    pool: input.pool,
  });
  if (!admissionAllowed(before) && before.status !== "READY") {
    // Still allow evolution on READY or soft-ready managed sites; block hard failures.
    if (before.failures.some((f) => f.code === "NO_PUBLIC_STOREFRONT")) {
      receipt.result = "FAILED";
      receipt.detail = "site not commercially addressable";
      receipt.completedAt = new Date().toISOString();
      await saveReceipt(input.pool, receipt);
      return receipt;
    }
  }

  const appDir = resolveAppDir(input.appRoot, input.siteId);
  const rollbackDir = snapshotStorefrontSources({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });
  receipt.rollbackDir = rollbackDir;

  // Isolated workspace copy of mutated files for audit (not a full git worktree — snapshot is rollback).
  const workDir = path.join(
    input.appRoot,
    ".data",
    "revenueos",
    "code-evolution",
    input.siteId,
    plan.evolutionId,
  );
  mkdirSync(workDir, { recursive: true });
  writeFileSync(
    path.join(workDir, "plan.json"),
    JSON.stringify(plan, null, 2),
  );

  const pagePath = path.join(appDir, "src/app/page.tsx");
  const mutation = applyTrustPreviewMutation(pagePath);
  if (!mutation.ok) {
    receipt.result = "FAILED";
    receipt.detail = mutation.detail;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }
  receipt.filesChanged = ["src/app/page.tsx"];
  copyFileSync(pagePath, path.join(workDir, "page.tsx"));

  input.logger("info", "code_evolution.mutated", {
    siteId: input.siteId,
    detail: mutation.detail,
  });

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
    receipt.detail = `deploy failed: ${deploy.detail}`;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    input.logger("error", "code_evolution.deploy_failed", {
      siteId: input.siteId,
      detail: deploy.detail,
    });
    return receipt;
  }

  receipt.productionUrl = deploy.productionUrl;
  const after = await assessCommercialReadiness({
    siteId: input.siteId,
    pool: input.pool,
    canonicalUrl: deploy.productionUrl,
  });
  const healthy =
    after.status === "READY" &&
    after.checks.http === "pass" &&
    after.checks.cta === "pass" &&
    after.checks.checkoutPath === "pass";

  receipt.verification = {
    beforeStatus: before.status,
    afterStatus: after.status,
    failures: after.failures.map((f) => f.code),
    productionUrl: deploy.productionUrl,
  };

  if (!healthy) {
    restoreSnapshot({
      appRoot: input.appRoot,
      siteId: input.siteId,
      rollbackDir,
    });
    const redeploy = prepareAndDeployStorefront({
      appRoot: input.appRoot,
      siteId: input.siteId,
    });
    receipt.result = "ROLLED_BACK";
    receipt.detail = `verify failed after mutation; rollback redeploy=${redeploy.ok}`;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    input.logger("warn", "code_evolution.rolled_back", {
      siteId: input.siteId,
      failures: after.failures.map((f) => f.code),
    });
    return receipt;
  }

  // Persist app_url if deploy produced preferred URL
  if (deploy.productionUrl) {
    await input.pool.query(
      `update ros_businesses
       set app_url=$2,
           metadata = coalesce(metadata,'{}'::jsonb) || $3::jsonb,
           updated_at=now()
       where site_id=$1`,
      [
        input.siteId,
        deploy.productionUrl,
        JSON.stringify({
          codeEvolution: {
            at: new Date().toISOString(),
            evolutionId: plan.evolutionId,
            mutationKind: plan.mutationKind,
            version: CODE_EVOLUTION_VERSION,
          },
        }),
      ],
    );
  }

  receipt.result = "RETAINED";
  receipt.detail = "commercial gate healthy after code evolution";
  receipt.completedAt = new Date().toISOString();
  await saveReceipt(input.pool, receipt);
  await saveLesson(input.pool, {
    lessonId: newId("celesson"),
    siteId: input.siteId,
    mutationKind: plan.mutationKind,
    hypothesis: plan.hypothesis,
    success: true,
    productionUrl: deploy.productionUrl,
    recordedAt: new Date().toISOString(),
    transferablePrinciple:
      "Pre-purchase free preview of deliverables can raise trust before CTA",
  });
  input.logger("info", "code_evolution.retained", {
    siteId: input.siteId,
    evolutionId: plan.evolutionId,
    productionUrl: deploy.productionUrl,
  });
  return receipt;
}

/** Independent CODE_EVOLUTION worker — one evolution at a time, never freezes portfolio. */
export async function runCodeEvolutionLoop(deps: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  signal: AbortSignal;
  getManagedSiteIds: () => string[];
  intervalMs?: number;
  /** Prefer this site for first proof. */
  preferSiteId?: string;
}): Promise<void> {
  const interval = deps.intervalMs ?? 180_000;
  deps.logger("info", "code_evolution.loop.start", {
    version: CODE_EVOLUTION_VERSION,
  });
  let preferSiteId = deps.preferSiteId;
  let first = true;
  let lastSite: string | null = null;
  while (!deps.signal.aborted) {
    if (!first) await sleep(interval, deps.signal);
    first = false;
    if (deps.signal.aborted) break;
    try {
      const managed = deps.getManagedSiteIds();
      const prefer =
        preferSiteId && managed.includes(preferSiteId) ? preferSiteId : null;
      const siteId =
        prefer && prefer !== lastSite
          ? prefer
          : managed.find((s) => s !== lastSite) ?? managed[0] ?? null;
      if (!siteId) {
        deps.logger("info", "code_evolution.loop.idle", { reason: "no_managed" });
        continue;
      }
      // Only evolve each site occasionally — check last receipt.
      const res = await deps.pool.query(
        `select value from ros_config_meta where key=$1`,
        [CODE_EVOLUTION_KEY],
      );
      const doc = (res.rows[0]?.value ?? { receipts: [] }) as {
        receipts?: CodeEvolutionReceipt[];
      };
      const recent = (doc.receipts ?? []).filter((r) => r.siteId === siteId);
      const last = recent[recent.length - 1];
      if (
        last &&
        last.result === "RETAINED" &&
        Date.now() - Date.parse(last.completedAt ?? last.startedAt) <
          6 * 60 * 60_000
      ) {
        deps.logger("info", "code_evolution.loop.skip_recent", { siteId });
        lastSite = siteId;
        continue;
      }
      const receipt = await executeCodeEvolution({
        pool: deps.pool,
        appRoot: deps.appRoot,
        siteId,
        logger: deps.logger,
      });
      lastSite = siteId;
      deps.logger("info", "code_evolution.loop.done", {
        siteId,
        result: receipt.result,
        evolutionId: receipt.evolutionId,
      });
      if (receipt.result === "RETAINED" && prefer === siteId) {
        preferSiteId = undefined;
      }
    } catch (err) {
      deps.logger("error", "code_evolution.loop.error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  deps.logger("info", "code_evolution.loop.stop", {});
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      resolve();
    };
    signal.addEventListener("abort", onAbort);
  });
}
