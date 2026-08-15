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

export type CodeEvolutionMutationKind =
  | "TRUST_PREVIEW_SECTION"
  | "VALUE_BULLET_CLARITY"
  | "FAQ_OBJECTION"
  | "HEADLINE_VALUE_PROP"
  | "CTA_STRUCTURE"
  | "PRICING_EMPHASIS";

export type CodeEvolutionPlan = {
  evolutionId: string;
  siteId: string;
  observation: string;
  hypothesis: string;
  expectedEffect: string;
  mutationKind: CodeEvolutionMutationKind;
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
  const kinds: Array<{
    kind: CodeEvolutionMutationKind;
    observation: string;
    hypothesis: string;
    expectedEffect: string;
  }> = [
    {
      kind: "TRUST_PREVIEW_SECTION",
      observation:
        "Public storefront has offer + CTA but limited pre-purchase value demonstration.",
      hypothesis:
        "Free interactive preview above the fold increases trust and checkout-start rate.",
      expectedEffect: "Higher checkout-start rate; gate stays READY.",
    },
    {
      kind: "VALUE_BULLET_CLARITY",
      observation: "Value bullets may be generic; buyers need outcome-specific clarity.",
      hypothesis: "Sharper outcome bullets reduce ambiguity before CTA.",
      expectedEffect: "Clearer offer comprehension; no gate regression.",
    },
    {
      kind: "FAQ_OBJECTION",
      observation: "Common purchase objections are unanswered on-page.",
      hypothesis: "FAQ addressing delivery/time/fit objections raises checkout confidence.",
      expectedEffect: "Fewer abandonments from unanswered objections.",
    },
    {
      kind: "HEADLINE_VALUE_PROP",
      observation: "Headline may not state the painful job-to-be-done.",
      hypothesis: "Outcome-led headline improves qualified engagement.",
      expectedEffect: "Stronger first-viewport value clarity.",
    },
    {
      kind: "CTA_STRUCTURE",
      observation: "CTA may lack urgency/specificity for the pack outcome.",
      hypothesis: "Outcome-specific CTA copy improves click-through to checkout.",
      expectedEffect: "Higher CTA engagement without changing price.",
    },
    {
      kind: "PRICING_EMPHASIS",
      observation: "Price/value framing may be weak near the CTA.",
      hypothesis: "Emphasizing one-time price + keep-forever framing raises WTP clarity.",
      expectedEffect: "Clearer willingness-to-pay signal.",
    },
  ];
  const pick = kinds[Math.abs(hashSite(siteId) + Math.floor(Date.now() / 3_600_000)) % kinds.length]!;
  return {
    evolutionId: newId("cevo"),
    siteId,
    observation: pick.observation,
    hypothesis: pick.hypothesis,
    expectedEffect: pick.expectedEffect,
    mutationKind: pick.kind,
    files: ["src/lib/brand.ts", "src/app/page.tsx"],
    risk: "low",
    createdAt: new Date().toISOString(),
  };
}

function hashSite(siteId: string): number {
  let h = 0;
  for (let i = 0; i < siteId.length; i++) h = (h * 33 + siteId.charCodeAt(i)) | 0;
  return h;
}

function applyTrustPreviewMutation(pagePath: string): {
  ok: boolean;
  detail: string;
} {
  return applyMarkedSection(pagePath, {
    marker: "trust-preview",
    hypothesis: "free_preview_increases_checkout_starts",
    detail: "trust_preview_injected",
    inner: `
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
        </p>`,
  });
}

function applyMarkedSection(
  pagePath: string,
  opts: {
    marker: string;
    hypothesis: string;
    detail: string;
    inner: string;
  },
): { ok: boolean; detail: string } {
  if (!existsSync(pagePath)) return { ok: false, detail: "page.tsx missing" };
  let page = readFileSync(pagePath, "utf8");
  const attr = `data-ros-code-evolution="${opts.marker}"`;
  if (page.includes(attr)) {
    return { ok: true, detail: "mutation_already_present" };
  }
  const block = `
      <section
        ${attr}
        data-ros-hypothesis="${opts.hypothesis}"
        style={{
          marginTop: "2rem",
          padding: "1.25rem 1.35rem",
          border: "1px solid rgba(244,241,234,0.22)",
          borderRadius: "12px",
          background: "rgba(12,12,12,0.35)",
          maxWidth: "42rem",
        }}
      >${opts.inner}
      </section>`;

  if (!page.includes("<CheckoutButton")) {
    return { ok: false, detail: "no CheckoutButton anchor" };
  }
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
  if (!page.includes(attr)) return { ok: false, detail: "inject_failed" };
  writeFileSync(pagePath, page);
  return { ok: true, detail: opts.detail };
}

function applyBrandMutation(
  brandPath: string,
  kind: CodeEvolutionMutationKind,
): { ok: boolean; detail: string } {
  if (!existsSync(brandPath)) return { ok: false, detail: "brand.ts missing" };
  let src = readFileSync(brandPath, "utf8");
  const stamp = `ros-evo-${kind.toLowerCase()}`;
  if (src.includes(stamp)) {
    return { ok: true, detail: "brand_mutation_already_present" };
  }

  const injectTagline = (extra: string) => {
    const m = src.match(/(["']tagline["']\s*:\s*["'])([^"']*)(["'])/);
    if (!m) return false;
    if (m[2].includes(extra)) return true;
    const next = `${m[2]} ${extra}`.slice(0, 180);
    src = src.replace(m[0], `${m[1]}${next}${m[3]}`);
    return true;
  };
  const injectBullet = (bullet: string) => {
    if (src.includes(bullet)) return true;
    const m = src.match(/(["']bullets["']\s*:\s*\[)/);
    if (!m) return false;
    src = src.replace(m[0], `${m[1]}\n      "${bullet.replace(/"/g, '\\"')}",`);
    return true;
  };

  let ok = false;
  switch (kind) {
    case "TRUST_PREVIEW_SECTION":
      ok = injectTagline("Free preview before you buy.");
      ok = injectBullet("Free preview — see inside before you buy") || ok;
      break;
    case "VALUE_BULLET_CLARITY":
      ok = injectBullet("Outcome-first deliverable — not fluff");
      break;
    case "FAQ_OBJECTION":
      ok = injectTagline("Instant download. Keep forever.");
      break;
    case "HEADLINE_VALUE_PROP":
      ok = injectTagline("Stop improvising — use a ready pack for the job.");
      break;
    case "CTA_STRUCTURE":
      ok = injectBullet("Checkout takes under a minute");
      break;
    case "PRICING_EMPHASIS":
      ok = injectTagline("One-time price. Keep forever. No seat drama.");
      break;
    default:
      return { ok: false, detail: "unknown_mutation_kind" };
  }
  if (!ok) return { ok: false, detail: "brand_inject_failed" };
  if (!src.includes(`// ${stamp}`)) src = `// ${stamp}\n${src}`;
  writeFileSync(brandPath, src);
  return { ok: true, detail: `brand_${kind.toLowerCase()}_injected` };
}

function applyCodeMutation(
  pagePath: string,
  kind: CodeEvolutionMutationKind,
): { ok: boolean; detail: string } {
  switch (kind) {
    case "TRUST_PREVIEW_SECTION":
      return applyTrustPreviewMutation(pagePath);
    case "VALUE_BULLET_CLARITY":
      return applyMarkedSection(pagePath, {
        marker: "value-bullets",
        hypothesis: "outcome_bullets_reduce_ambiguity",
        detail: "value_bullets_injected",
        inner: `
        <p style={{ margin: 0, fontWeight: 600 }}>What you get — outcomes, not fluff</p>
        <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.1rem", lineHeight: 1.55 }}>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>`,
      });
    case "FAQ_OBJECTION":
      return applyMarkedSection(pagePath, {
        marker: "faq-objections",
        hypothesis: "faq_clears_purchase_objections",
        detail: "faq_injected",
        inner: `
        <p style={{ margin: 0, fontWeight: 600 }}>Before you buy</p>
        <p style={{ margin: "0.6rem 0 0", opacity: 0.9 }}><strong>Delivery?</strong> Instant digital download after checkout.</p>
        <p style={{ margin: "0.4rem 0 0", opacity: 0.9 }}><strong>Fit?</strong> Built for a specific painful workflow — preview the contents above.</p>
        <p style={{ margin: "0.4rem 0 0", opacity: 0.9 }}><strong>Updates?</strong> Keep the files forever; no subscription required to open them.</p>`,
      });
    case "HEADLINE_VALUE_PROP":
      return applyMarkedSection(pagePath, {
        marker: "headline-value",
        hypothesis: "outcome_headline_improves_engagement",
        detail: "headline_band_injected",
        inner: `
        <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 650, lineHeight: 1.3 }}>
          Stop improvising the painful workflow — use a ready pack built for the job.
        </p>`,
      });
    case "CTA_STRUCTURE":
      return applyMarkedSection(pagePath, {
        marker: "cta-structure",
        hypothesis: "outcome_cta_raises_clickthrough",
        detail: "cta_helper_injected",
        inner: `
        <p style={{ margin: 0, fontWeight: 600 }}>Next step</p>
        <p style={{ margin: "0.5rem 0 0", opacity: 0.9 }}>
          Get the pack now — checkout takes under a minute. Files arrive immediately.
        </p>`,
      });
    case "PRICING_EMPHASIS":
      return applyMarkedSection(pagePath, {
        marker: "pricing-emphasis",
        hypothesis: "price_value_framing_raises_wtp_clarity",
        detail: "pricing_band_injected",
        inner: `
        <p style={{ margin: 0, fontWeight: 600 }}>
          One-time price · keep forever · no seat drama
        </p>
        <p style={{ margin: "0.5rem 0 0", opacity: 0.9 }}>
          Cheaper than one hour of agency rework on the same problem.
        </p>`,
      });
    default:
      return { ok: false, detail: "unknown_mutation_kind" };
  }
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
  const brandPath = path.join(appDir, "src/lib/brand.ts");
  // Native Azure static hosting serves brand.ts — mutate it first (authoritative).
  const brandMutation = applyBrandMutation(brandPath, plan.mutationKind);
  // Keep page.tsx mutation for source continuity / future Next builds.
  const pageMutation = applyCodeMutation(pagePath, plan.mutationKind);
  if (!brandMutation.ok && !pageMutation.ok) {
    receipt.result = "FAILED";
    receipt.detail = `mutation failed brand=${brandMutation.detail} page=${pageMutation.detail}`;
    receipt.completedAt = new Date().toISOString();
    await saveReceipt(input.pool, receipt);
    return receipt;
  }
  receipt.filesChanged = [];
  if (brandMutation.ok) receipt.filesChanged.push("src/lib/brand.ts");
  if (pageMutation.ok) receipt.filesChanged.push("src/app/page.tsx");
  if (existsSync(pagePath)) {
    copyFileSync(pagePath, path.join(workDir, "page.tsx"));
  }
  if (existsSync(brandPath)) {
    copyFileSync(brandPath, path.join(workDir, "brand.ts"));
  }

  input.logger("info", "code_evolution.mutated", {
    siteId: input.siteId,
    detail: `${brandMutation.detail};${pageMutation.detail}`,
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
  // Brief settle for Caddy/TLS after native publish (avoids false NO_PUBLIC_STOREFRONT).
  await new Promise((r) => setTimeout(r, 2500));
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
  let cursor = 0;
  const COOLDOWN_MS = 6 * 60 * 60_000;
  while (!deps.signal.aborted) {
    if (!first) await sleep(interval, deps.signal);
    first = false;
    if (deps.signal.aborted) break;
    try {
      const managed = deps.getManagedSiteIds();
      if (!managed.length) {
        deps.logger("info", "code_evolution.loop.idle", { reason: "no_managed" });
        continue;
      }
      const res = await deps.pool.query(
        `select value from ros_config_meta where key=$1`,
        [CODE_EVOLUTION_KEY],
      );
      const doc = (res.rows[0]?.value ?? { receipts: [] }) as {
        receipts?: CodeEvolutionReceipt[];
      };
      const receipts = doc.receipts ?? [];
      const inCooldown = (siteId: string): boolean => {
        const recent = receipts.filter((r) => r.siteId === siteId);
        const last = recent[recent.length - 1];
        if (!last || last.result !== "RETAINED") return false;
        const t = Date.parse(last.completedAt ?? last.startedAt);
        return Number.isFinite(t) && Date.now() - t < COOLDOWN_MS;
      };
      // Prefer site only until first successful retain, then rotate all managed.
      let siteId: string | null = null;
      if (preferSiteId && managed.includes(preferSiteId) && !inCooldown(preferSiteId)) {
        siteId = preferSiteId;
      } else {
        if (preferSiteId && inCooldown(preferSiteId)) preferSiteId = undefined;
        for (let i = 0; i < managed.length; i++) {
          const idx = (cursor + i) % managed.length;
          const candidate = managed[idx]!;
          if (!inCooldown(candidate)) {
            siteId = candidate;
            cursor = (idx + 1) % managed.length;
            break;
          }
        }
      }
      if (!siteId) {
        deps.logger("info", "code_evolution.loop.idle", {
          reason: "all_managed_in_cooldown",
          managed: managed.length,
        });
        continue;
      }

      // CAE funnel gate + CEE v4: do not polish sites with zero verified exposure
      try {
        const { shouldAllowSiteEvolution } = await import(
          "./titan-commercial-executive/customer-acquisition-evolution.js"
        );
        const gate = await shouldAllowSiteEvolution(deps.pool, siteId);
        if (!gate.allow) {
          deps.logger("info", "code_evolution.loop.skipped_funnel_gate", {
            siteId,
            stage: gate.stage,
            reason: gate.reason,
          });
          continue;
        }
        const { polishAllowed, refreshExposureClock } = await import(
          "./commercial-execution-v4/ledger.js"
        );
        const clock = await refreshExposureClock(deps.pool, siteId);
        if (!polishAllowed(clock)) {
          deps.logger("info", "code_evolution.loop.skipped_zero_exposure", {
            siteId,
            minutesWithoutHuman: clock.minutesSinceLastVerifiedHuman,
          });
          continue;
        }
      } catch {
        /* gate optional if module missing */
      }

      const receipt = await executeCodeEvolution({
        pool: deps.pool,
        appRoot: deps.appRoot,
        siteId,
        logger: deps.logger,
      });
      deps.logger("info", "code_evolution.loop.done", {
        siteId,
        result: receipt.result,
        evolutionId: receipt.evolutionId,
      });
      if (receipt.result === "RETAINED" && preferSiteId === siteId) {
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
