/**
 * Deterministic storefront repair executor (no AI).
 *
 * diagnose → scoped source mutation → typecheck → native Azure deploy →
 * public verification → COMMERCIAL_READY
 *
 * Never marks complete on local-only writes. One repair at a time.
 */

import {
  ADMISSION_GATE_VERSION,
  assessCommercialReadiness,
  admissionAllowed,
  type CommercialFailureCode,
  type CommercialReadinessResult,
  COMMERCIAL_REPAIR_QUEUE_KEY,
  type CommercialRepairItem,
} from "./commercial-readiness.js";
import {
  prepareAndDeployStorefront,
  resolveAppDir,
  restoreSnapshot,
  snapshotStorefrontSources,
  ensureVercelProjectLink,
} from "./vercel-deploy-adapter.js";
import { diagnoseStorefrontFailure } from "./repair-diagnoser.js";
import {
  REPAIR_LEARNING_KEY,
  REPAIR_ATTEMPTS_KEY,
  newId,
  type RepairLesson,
} from "./repair-taxonomy.js";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";

export const COMMERCIAL_STATE_KEY = "commercial_business_states";
export const REPAIR_EXECUTOR_VERSION = "storefront-repair-v2";

export type CommercialBusinessState =
  | "COMMERCIAL_READY"
  | "REPAIR_REQUIRED"
  | "REPAIR_IN_PROGRESS"
  | "REPAIR_VERIFYING";

export type RepairActionKind =
  | "ADD_CTA"
  | "FIX_CTA_DESTINATION"
  | "ADD_CHECKOUT_PATH"
  | "FIX_CHECKOUT_PATH"
  | "ADD_PRICE_OR_PURCHASE_INSTRUCTIONS"
  | "FIX_ANALYTICS_MARKERS"
  | "FIX_ROBOTS"
  | "FIX_SITEMAP"
  | "FIX_CANONICAL"
  | "RESTORE_PUBLIC_STOREFRONT";

export type BusinessCommercialRecord = {
  siteId: string;
  state: CommercialBusinessState;
  gateVersion: string;
  failures: CommercialFailureCode[];
  lastAction?: RepairActionKind | null;
  lastDetail?: string | null;
  updatedAt: string;
  acquisitionSuppressed: boolean;
  grandfatheredManaged: boolean;
  publicVerifiedAt?: string | null;
  attempts: number;
  nextAttemptAt?: string | null;
};

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

const ACQUISITION_ACTION_TYPES = new Set([
  "distribute_owned_urls",
  "demand_radar_sweep",
  "syndicate_content",
  "indexnow_submit",
  "sitemap_ping",
  "schema_enrichment",
  "publish_topic_cluster",
  "gsc_submit_sitemap",
]);

const FAILURE_PRIORITY: CommercialFailureCode[] = [
  "NO_PUBLIC_STOREFRONT",
  "NO_CHECKOUT_PATH",
  "BROKEN_CHECKOUT",
  "NO_CTA",
  "BROKEN_CTA",
  "NO_COMMERCIAL_OFFER",
  "NO_PRICE_OR_PURCHASE_INSTRUCTIONS",
  "BROKEN_ANALYTICS",
  "NON_INDEXABLE",
  "WRONG_CANONICAL_URL",
  "STALE_DEPLOYMENT",
];

function actionForFailures(failures: CommercialFailureCode[]): RepairActionKind {
  const set = new Set(failures);
  if (set.has("NO_PUBLIC_STOREFRONT") || set.has("STALE_DEPLOYMENT")) {
    return "RESTORE_PUBLIC_STOREFRONT";
  }
  // Wrong public app (HTTP 200 but no RevenueOS buyer surface) → full restore.
  if (
    set.has("NO_CTA") &&
    set.has("NO_CHECKOUT_PATH") &&
    (set.has("NO_COMMERCIAL_OFFER") || set.has("BROKEN_ANALYTICS"))
  ) {
    return "RESTORE_PUBLIC_STOREFRONT";
  }
  if (set.has("NO_CHECKOUT_PATH") || set.has("BROKEN_CHECKOUT")) {
    return set.has("NO_CHECKOUT_PATH") ? "ADD_CHECKOUT_PATH" : "FIX_CHECKOUT_PATH";
  }
  if (set.has("NO_CTA") || set.has("BROKEN_CTA")) {
    return set.has("NO_CTA") ? "ADD_CTA" : "FIX_CTA_DESTINATION";
  }
  if (
    set.has("NO_COMMERCIAL_OFFER") ||
    set.has("NO_PRICE_OR_PURCHASE_INSTRUCTIONS")
  ) {
    return "ADD_PRICE_OR_PURCHASE_INSTRUCTIONS";
  }
  if (set.has("BROKEN_ANALYTICS")) return "FIX_ANALYTICS_MARKERS";
  if (set.has("NON_INDEXABLE")) return "FIX_ROBOTS";
  if (set.has("WRONG_CANONICAL_URL")) return "FIX_CANONICAL";
  return "RESTORE_PUBLIC_STOREFRONT";
}

async function loadStates(
  pool: pg.Pool,
): Promise<Record<string, BusinessCommercialRecord>> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [COMMERCIAL_STATE_KEY],
  );
  const raw = (res.rows[0]?.value ?? {}) as {
    businesses?: Record<string, BusinessCommercialRecord>;
  };
  return raw.businesses ?? {};
}

async function saveStates(
  pool: pg.Pool,
  businesses: Record<string, BusinessCommercialRecord>,
): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'COMMERCIAL_STATE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='COMMERCIAL_STATE'`,
    [
      COMMERCIAL_STATE_KEY,
      JSON.stringify({
        version: REPAIR_EXECUTOR_VERSION,
        gateVersion: ADMISSION_GATE_VERSION,
        updatedAt: new Date().toISOString(),
        businesses,
      }),
    ],
  );
}

export async function getCommercialRecord(
  pool: pg.Pool,
  siteId: string,
): Promise<BusinessCommercialRecord | null> {
  const all = await loadStates(pool);
  return all[siteId] ?? null;
}

export function isAcquisitionSuppressedFor(
  record: BusinessCommercialRecord | null | undefined,
): boolean {
  if (!record) return false;
  return (
    record.acquisitionSuppressed ||
    record.state === "REPAIR_REQUIRED" ||
    record.state === "REPAIR_IN_PROGRESS" ||
    record.state === "REPAIR_VERIFYING"
  );
}

export function shouldBlockAcquisitionAction(
  actionType: string,
  record: BusinessCommercialRecord | null | undefined,
): boolean {
  return (
    ACQUISITION_ACTION_TYPES.has(actionType) &&
    isAcquisitionSuppressedFor(record)
  );
}

/** In-memory cache refreshed by executor — used by agent-executor hot path. */
let acquisitionBlockCache: Map<string, boolean> = new Map();

export function refreshAcquisitionBlockCache(
  businesses: Record<string, BusinessCommercialRecord>,
): void {
  const next = new Map<string, boolean>();
  for (const [id, rec] of Object.entries(businesses)) {
    next.set(id, isAcquisitionSuppressedFor(rec));
  }
  acquisitionBlockCache = next;
}

export function isAcquisitionBlockedCached(siteId: string): boolean {
  return acquisitionBlockCache.get(siteId) === true;
}

function donorCheckoutRoute(appRoot: string): string | null {
  for (const donor of ["menumoney", "ledgerleaf", "homelistpro"]) {
    const p = path.join(
      appRoot,
      "apps",
      donor,
      "src/app/api/checkout/route.ts",
    );
    if (existsSync(p)) return p;
  }
  return null;
}

function donorCheckoutButton(appRoot: string): string | null {
  for (const donor of ["menumoney", "storelift", "homelistpro"]) {
    const p = path.join(
      appRoot,
      "apps",
      donor,
      "src/components/CheckoutButton.tsx",
    );
    if (existsSync(p)) return p;
  }
  return null;
}

function applySourceMutation(input: {
  appRoot: string;
  siteId: string;
  action: RepairActionKind;
}): { ok: boolean; detail: string; mutatedFiles: string[] } {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  if (!existsSync(appDir)) {
    return { ok: false, detail: `apps/${input.siteId} missing`, mutatedFiles: [] };
  }
  const mutated: string[] = [];

  if (
    input.action === "RESTORE_PUBLIC_STOREFRONT" ||
    input.action === "ADD_CTA" ||
    input.action === "FIX_CTA_DESTINATION"
  ) {
    const pagePath = path.join(appDir, "src/app/page.tsx");
    const btnPath = path.join(appDir, "src/components/CheckoutButton.tsx");
    if (!existsSync(btnPath)) {
      const donor = donorCheckoutButton(input.appRoot);
      if (!donor) {
        return { ok: false, detail: "no CheckoutButton donor", mutatedFiles: [] };
      }
      mkdirSync(path.dirname(btnPath), { recursive: true });
      copyFileSync(donor, btnPath);
      mutated.push("src/components/CheckoutButton.tsx");
    }
    if (existsSync(pagePath)) {
      let page = readFileSync(pagePath, "utf8");
      if (!/CheckoutButton/.test(page)) {
        // Inject minimal hero CTA block if page lacks it — keep scoped.
        if (!/from \"@\/components\/CheckoutButton\"/.test(page)) {
          page = `import { CheckoutButton } from "@/components/CheckoutButton";\n${page}`;
        }
        if (!/checkoutAllowed/.test(page)) {
          page = page.replace(
            /^/,
            `import { checkoutAllowed } from "@/lib/readiness";\n`,
          );
        }
        // Append CTA near first </main> or end of default export return
        if (!/<CheckoutButton/.test(page)) {
          page = page.replace(
            /<\/main>/,
            `  <div style={{marginTop:"1.35rem"}}><CheckoutButton enabled={checkoutAllowed()} /></div>\n    </main>`,
          );
        }
        writeFileSync(pagePath, page);
        mutated.push("src/app/page.tsx");
      }
    }
  }

  if (
    input.action === "RESTORE_PUBLIC_STOREFRONT" ||
    input.action === "ADD_CHECKOUT_PATH" ||
    input.action === "FIX_CHECKOUT_PATH"
  ) {
    const checkoutPath = path.join(appDir, "src/app/api/checkout/route.ts");
    if (!existsSync(checkoutPath)) {
      const donor = donorCheckoutRoute(input.appRoot);
      if (!donor) {
        return { ok: false, detail: "no checkout route donor", mutatedFiles: mutated };
      }
      mkdirSync(path.dirname(checkoutPath), { recursive: true });
      copyFileSync(donor, checkoutPath);
      mutated.push("src/app/api/checkout/route.ts");
    }
  }

  if (
    input.action === "ADD_PRICE_OR_PURCHASE_INSTRUCTIONS" ||
    input.action === "RESTORE_PUBLIC_STOREFRONT"
  ) {
    const brandPath = path.join(appDir, "src/lib/brand.ts");
    if (existsSync(brandPath)) {
      const brand = readFileSync(brandPath, "utf8");
      if (!/priceUsd/.test(brand)) {
        return {
          ok: false,
          detail: "brand.ts missing priceUsd — manual brand repair required",
          mutatedFiles: mutated,
        };
      }
    }
  }

  if (input.action === "FIX_ANALYTICS_MARKERS" || input.action === "RESTORE_PUBLIC_STOREFRONT") {
    const layoutPath = path.join(appDir, "src/app/layout.tsx");
    const beaconComp = path.join(appDir, "src/components/Beacon.tsx");
    if (existsSync(layoutPath) && !existsSync(beaconComp)) {
      // Prefer existing beacon API — inject lightweight script tag marker.
      let layout = readFileSync(layoutPath, "utf8");
      if (!/api\/beacon|data-revenueos|va\.vercel-scripts/.test(layout)) {
        layout = layout.replace(
          /<body([^>]*)>/,
          `<body$1>\n        <script dangerouslySetInnerHTML={{__html:"window.__REVENUEOS_BEACON=1"}} data-revenueos="beacon" />`,
        );
        writeFileSync(layoutPath, layout);
        mutated.push("src/app/layout.tsx");
      }
    }
  }

  if (input.action === "FIX_ROBOTS" || input.action === "RESTORE_PUBLIC_STOREFRONT") {
    const robotsPath = path.join(appDir, "src/app/robots.ts");
    if (!existsSync(robotsPath)) {
      writeFileSync(
        robotsPath,
        `import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://${input.siteId}.${process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io"}/sitemap.xml",
  };
}
`,
      );
      mutated.push("src/app/robots.ts");
    }
  }

  if (input.action === "FIX_CANONICAL") {
    // Canonical is deploy-time NEXT_PUBLIC_APP_URL — no source file required.
    mutated.push("(canonical via deploy env)");
  }

  // RESTORE always deploys even if sources already correct (public site wrong).
  if (input.action === "RESTORE_PUBLIC_STOREFRONT" && mutated.length === 0) {
    return {
      ok: true,
      detail: "source already has buyer surface — restore via redeploy",
      mutatedFiles: ["(redeploy only)"],
    };
  }

  if (mutated.length === 0 && input.action !== "RESTORE_PUBLIC_STOREFRONT") {
    return {
      ok: true,
      detail: "no source gaps — will redeploy for public sync",
      mutatedFiles: ["(redeploy only)"],
    };
  }

  return {
    ok: true,
    detail: `mutated: ${mutated.join(", ")}`,
    mutatedFiles: mutated,
  };
}

async function updateQueueItem(
  pool: pg.Pool,
  siteId: string,
  patch: Partial<CommercialRepairItem>,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [COMMERCIAL_REPAIR_QUEUE_KEY],
  );
  const doc = (res.rows[0]?.value ?? { items: [] }) as {
    items?: CommercialRepairItem[];
  };
  const items = Array.isArray(doc.items) ? doc.items : [];
  const idx = items.findIndex((i) => i.siteId === siteId);
  if (idx >= 0) {
    items[idx] = { ...items[idx]!, ...patch };
  }
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'COMMERCIAL_REPAIR_QUEUE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(),
       provenance='COMMERCIAL_REPAIR_QUEUE'`,
    [
      COMMERCIAL_REPAIR_QUEUE_KEY,
      JSON.stringify({
        gateVersion: ADMISSION_GATE_VERSION,
        updatedAt: new Date().toISOString(),
        items,
      }),
    ],
  );
}

export async function syncManagedCommercialStates(input: {
  pool: pg.Pool;
  titanManaged: string[];
  logger?: Logger;
}): Promise<Record<string, BusinessCommercialRecord>> {
  const businesses = await loadStates(input.pool);
  const now = new Date().toISOString();
  for (const siteId of input.titanManaged) {
    const assessment = await assessCommercialReadiness({
      siteId,
      pool: input.pool,
    });
    const prev = businesses[siteId];
    const ready = admissionAllowed(assessment) && assessment.failures.length === 0;
    // Grandfathered managed: keep TITAN membership, never pretend ready.
    if (ready) {
      businesses[siteId] = {
        siteId,
        state: "COMMERCIAL_READY",
        gateVersion: ADMISSION_GATE_VERSION,
        failures: [],
        updatedAt: now,
        acquisitionSuppressed: false,
        grandfatheredManaged: prev?.grandfatheredManaged ?? true,
        publicVerifiedAt: now,
        attempts: prev?.attempts ?? 0,
        lastAction: prev?.lastAction ?? null,
        lastDetail: "audit pass",
      };
    } else if (
      prev?.state === "REPAIR_IN_PROGRESS" ||
      prev?.state === "REPAIR_VERIFYING"
    ) {
      businesses[siteId] = {
        ...prev,
        failures: assessment.failures.map((f) => f.code),
        updatedAt: now,
        acquisitionSuppressed: true,
        grandfatheredManaged: true,
      };
    } else {
      businesses[siteId] = {
        siteId,
        state: "REPAIR_REQUIRED",
        gateVersion: ADMISSION_GATE_VERSION,
        failures: assessment.failures.map((f) => f.code),
        updatedAt: now,
        acquisitionSuppressed: true,
        grandfatheredManaged: true,
        publicVerifiedAt: null,
        attempts: prev?.attempts ?? 0,
        nextAttemptAt: prev?.nextAttemptAt ?? now,
        lastDetail: assessment.failures.map((f) => f.code).join(","),
      };
    }
    input.logger?.("info", "commercial.state.sync", {
      siteId,
      state: businesses[siteId]!.state,
      failures: businesses[siteId]!.failures,
    });
  }
  await saveStates(input.pool, businesses);
  refreshAcquisitionBlockCache(businesses);
  return businesses;
}

async function recordRepairLesson(
  pool: pg.Pool,
  lesson: RepairLesson,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [REPAIR_LEARNING_KEY],
  );
  const doc = (res.rows[0]?.value ?? { lessons: [] }) as {
    lessons?: RepairLesson[];
  };
  const lessons = Array.isArray(doc.lessons) ? [...doc.lessons] : [];
  lessons.push(lesson);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'REPAIR_LEARNING')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='REPAIR_LEARNING'`,
    [
      REPAIR_LEARNING_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        lessons: lessons.slice(-200),
      }),
    ],
  );
}

async function recordRepairAttempt(
  pool: pg.Pool,
  receipt: Record<string, unknown>,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [REPAIR_ATTEMPTS_KEY],
  );
  const doc = (res.rows[0]?.value ?? { attempts: [] }) as {
    attempts?: Record<string, unknown>[];
  };
  const attempts = Array.isArray(doc.attempts) ? [...doc.attempts] : [];
  attempts.push(receipt);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'REPAIR_ATTEMPTS')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='REPAIR_ATTEMPTS'`,
    [
      REPAIR_ATTEMPTS_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        attempts: attempts.slice(-300),
      }),
    ],
  );
}

/** Admission candidate commercial failure → durable REPAIR_REQUIRED (do not exclude). */
export async function requestCommercialRepairForCandidate(input: {
  pool: pg.Pool;
  siteId: string;
  failures: { code: string; detail: string }[];
  logger?: Logger;
}): Promise<void> {
  const businesses = await loadStates(input.pool);
  const prev = businesses[input.siteId];
  const attempts = prev?.attempts ?? 0;
  if (attempts >= 3) {
    businesses[input.siteId] = {
      siteId: input.siteId,
      state: "REPAIR_REQUIRED",
      gateVersion: ADMISSION_GATE_VERSION,
      failures: input.failures.map((f) => f.code as CommercialFailureCode),
      updatedAt: new Date().toISOString(),
      acquisitionSuppressed: true,
      grandfatheredManaged: prev?.grandfatheredManaged ?? false,
      publicVerifiedAt: null,
      attempts,
      nextAttemptAt: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      lastDetail: `BLOCKED after ${attempts} attempts`,
      lastAction: prev?.lastAction ?? null,
    };
    await saveStates(input.pool, businesses);
    refreshAcquisitionBlockCache(businesses);
    input.logger?.("warn", "repair.blocked", { siteId: input.siteId, attempts });
    return;
  }
  businesses[input.siteId] = {
    siteId: input.siteId,
    state: "REPAIR_REQUIRED",
    gateVersion: ADMISSION_GATE_VERSION,
    failures: input.failures.map((f) => f.code as CommercialFailureCode),
    updatedAt: new Date().toISOString(),
    acquisitionSuppressed: true,
    grandfatheredManaged: prev?.grandfatheredManaged ?? false,
    publicVerifiedAt: null,
    attempts,
    nextAttemptAt: new Date().toISOString(),
    lastDetail: input.failures.map((f) => f.code).join(","),
    lastAction: prev?.lastAction ?? null,
  };
  await saveStates(input.pool, businesses);
  refreshAcquisitionBlockCache(businesses);
  input.logger?.("info", "repair.detected", {
    siteId: input.siteId,
    failures: input.failures.map((f) => f.code),
    priority: "admission_candidate",
  });
  input.logger?.("info", "admit.repair_requested", { siteId: input.siteId });
}

function attemptDue(nextAttemptAt: string | null | undefined): boolean {
  if (!nextAttemptAt) return true;
  // Accept ISO and Postgres text timestamps ("2026-08-11 15:23:06.487231+00").
  const normalized = nextAttemptAt.includes("T")
    ? nextAttemptAt
    : nextAttemptAt.replace(" ", "T").replace(/\+00$/, "Z");
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return true;
  return ms <= Date.now();
}

function pickNextRepair(
  businesses: Record<string, BusinessCommercialRecord>,
  excludeSiteIds: Set<string>,
  preferSiteId?: string | null,
): BusinessCommercialRecord | null {
  if (preferSiteId && businesses[preferSiteId]) {
    const pref = businesses[preferSiteId]!;
    if (
      pref.state === "REPAIR_REQUIRED" &&
      !excludeSiteIds.has(preferSiteId) &&
      attemptDue(pref.nextAttemptAt) &&
      pref.attempts < 3
    ) {
      return pref;
    }
  }
  const candidates = Object.values(businesses).filter(
    (b) =>
      b.state === "REPAIR_REQUIRED" &&
      !excludeSiteIds.has(b.siteId) &&
      attemptDue(b.nextAttemptAt) &&
      b.attempts < 3,
  );
  candidates.sort((a, b) => {
    const pa = Math.min(
      ...a.failures.map((f) => {
        const i = FAILURE_PRIORITY.indexOf(f);
        return i < 0 ? 99 : i;
      }),
      99,
    );
    const pb = Math.min(
      ...b.failures.map((f) => {
        const i = FAILURE_PRIORITY.indexOf(f);
        return i < 0 ? 99 : i;
      }),
      99,
    );
    return pa - pb || a.attempts - b.attempts;
  });
  return candidates[0] ?? null;
}

export async function executeOneStorefrontRepair(input: {
  pool: pg.Pool;
  appRoot: string;
  siteId: string;
  logger: Logger;
}): Promise<{
  ok: boolean;
  siteId: string;
  action: RepairActionKind;
  sourceMutationSuccess: boolean;
  buildSuccess: boolean;
  deploySuccess: boolean;
  publicVerification: boolean;
  rollbackAvailable: boolean;
  detail: string;
  before: CommercialReadinessResult;
  after?: CommercialReadinessResult;
}> {
  const before = await assessCommercialReadiness({
    siteId: input.siteId,
    pool: input.pool,
  });
  const diagnosis = await diagnoseStorefrontFailure({
    pool: input.pool,
    appRoot: input.appRoot,
    siteId: input.siteId,
    commercialFailures: before.failures,
    source: "storefront_repair_executor",
  });
  input.logger("info", "repair.diagnosis.complete", {
    siteId: input.siteId,
    rootCause: diagnosis.rootCause.slice(0, 240),
    smallestRepair: diagnosis.smallestRepair,
    identityMatch: diagnosis.evidence.identityMatch,
    planId: diagnosis.plan.repairPlanId,
  });
  input.logger("info", "repair.plan.created", {
    siteId: input.siteId,
    repairType: diagnosis.plan.repairType,
    steps: diagnosis.plan.steps.length,
  });

  // Prefer diagnoser strategy when identity is wrong.
  let action = actionForFailures(before.failures.map((f) => f.code));
  if (
    diagnosis.smallestRepair === "RESTORE_PUBLIC_STOREFRONT" ||
    !diagnosis.evidence.identityMatch
  ) {
    action = "RESTORE_PUBLIC_STOREFRONT";
  }

  // Ensure vercel project link exists (copy known project.json if present on disk).
  ensureVercelProjectLink({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });

  const businesses = await loadStates(input.pool);
  const prev = businesses[input.siteId];
  const attemptId = newId("attempt");
  businesses[input.siteId] = {
    siteId: input.siteId,
    state: "REPAIR_IN_PROGRESS",
    gateVersion: ADMISSION_GATE_VERSION,
    failures: before.failures.map((f) => f.code),
    lastAction: action,
    updatedAt: new Date().toISOString(),
    acquisitionSuppressed: true,
    grandfatheredManaged: prev?.grandfatheredManaged ?? true,
    attempts: (prev?.attempts ?? 0) + 1,
    publicVerifiedAt: null,
  };
  await saveStates(input.pool, businesses);
  refreshAcquisitionBlockCache(businesses);
  await updateQueueItem(input.pool, input.siteId, {
    status: "in_progress",
    lastAttemptAt: new Date().toISOString(),
    attempts: businesses[input.siteId]!.attempts,
  });

  input.logger("info", "repair.attempt.started", {
    siteId: input.siteId,
    attemptId,
    action,
    failures: before.failures.map((f) => f.code),
    executor: REPAIR_EXECUTOR_VERSION,
  });
  input.logger("info", "storefront.repair.start", {
    siteId: input.siteId,
    action,
    failures: before.failures.map((f) => f.code),
    executor: REPAIR_EXECUTOR_VERSION,
  });

  const snap = snapshotStorefrontSources({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });

  const mutation = applySourceMutation({
    appRoot: input.appRoot,
    siteId: input.siteId,
    action,
  });
  if (!mutation.ok) {
    businesses[input.siteId] = {
      ...businesses[input.siteId]!,
      state: "REPAIR_REQUIRED",
      lastDetail: mutation.detail,
      nextAttemptAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    };
    await saveStates(input.pool, businesses);
    refreshAcquisitionBlockCache(businesses);
    await updateQueueItem(input.pool, input.siteId, {
      status: "blocked",
      note: mutation.detail,
    });
    return {
      ok: false,
      siteId: input.siteId,
      action,
      sourceMutationSuccess: false,
      buildSuccess: false,
      deploySuccess: false,
      publicVerification: false,
      rollbackAvailable: Boolean(snap),
      detail: mutation.detail,
      before,
    };
  }

  businesses[input.siteId]!.state = "REPAIR_VERIFYING";
  businesses[input.siteId]!.lastDetail = mutation.detail;
  await saveStates(input.pool, businesses);

  const deploy = await Promise.resolve(
    prepareAndDeployStorefront({
      appRoot: input.appRoot,
      siteId: input.siteId,
    }),
  );

  if (!deploy.ok) {
    // Restore local sources; do not claim public fixed.
    restoreSnapshot({
      appRoot: input.appRoot,
      siteId: input.siteId,
      rollbackDir: snap,
    });
    businesses[input.siteId] = {
      ...businesses[input.siteId]!,
      state: "REPAIR_REQUIRED",
      lastDetail: deploy.detail,
      nextAttemptAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      acquisitionSuppressed: true,
    };
    await saveStates(input.pool, businesses);
    refreshAcquisitionBlockCache(businesses);
    await updateQueueItem(input.pool, input.siteId, {
      status: "queued",
      note: `deploy failed: ${deploy.detail}`.slice(0, 240),
    });
    input.logger("error", "storefront.repair.deploy_failed", {
      siteId: input.siteId,
      detail: deploy.detail,
      deployLog: deploy.deployLog?.slice(0, 500),
    });
    return {
      ok: false,
      siteId: input.siteId,
      action,
      sourceMutationSuccess: true,
      buildSuccess: !/typecheck failed/.test(deploy.detail),
      deploySuccess: false,
      publicVerification: false,
      rollbackAvailable: true,
      detail: deploy.detail,
      before,
    };
  }

  // Public verification against live URL (not localhost).
  const after = await assessCommercialReadiness({
    siteId: input.siteId,
    pool: input.pool,
    canonicalUrl: deploy.productionUrl,
  });
  // Full public commercial readiness — not merely local deploy success.
  const verified =
    after.status === "READY" &&
    after.checks.http === "pass" &&
    after.checks.offer === "pass" &&
    after.checks.cta === "pass" &&
    after.checks.checkoutPath === "pass" &&
    after.checks.analytics === "pass" &&
    after.checks.indexability === "pass" &&
    after.checks.canonicalUrl === "pass";

  if (!verified) {
    const attempts = businesses[input.siteId]!.attempts || 1;
    const backoffMin = Math.min(180, 15 * Math.pow(2, Math.max(0, attempts - 1)));
    businesses[input.siteId] = {
      ...businesses[input.siteId]!,
      state: "REPAIR_REQUIRED",
      failures: after.failures.map((f) => f.code),
      lastDetail: `public verify failed: ${after.failures.map((f) => f.code).join(",")}`,
      nextAttemptAt: new Date(Date.now() + backoffMin * 60_000).toISOString(),
      acquisitionSuppressed: true,
    };
    await saveStates(input.pool, businesses);
    refreshAcquisitionBlockCache(businesses);
    await updateQueueItem(input.pool, input.siteId, {
      status: "queued",
      note: businesses[input.siteId]!.lastDetail ?? "verify failed",
      failures: after.failures,
    });
    input.logger("warn", "storefront.repair.verify_failed", {
      siteId: input.siteId,
      failures: after.failures.map((f) => f.code),
      productionUrl: deploy.productionUrl,
    });
    input.logger("warn", "repair.failed", {
      siteId: input.siteId,
      stage: "verify",
      failures: after.failures.map((f) => f.code),
    });
    await recordRepairAttempt(input.pool, {
      repairAttemptId: attemptId,
      businessId: input.siteId,
      startedAt: businesses[input.siteId]!.updatedAt,
      completedAt: new Date().toISOString(),
      result: "verify_failed",
      productionUrl: deploy.productionUrl,
      failures: after.failures.map((f) => f.code),
    });
    await recordRepairLesson(input.pool, {
      lessonId: newId("lesson"),
      category: "WRONG_SITE_IDENTITY",
      architecture: "native_azure_static_storefront",
      rootCause: diagnosis.rootCause.slice(0, 240),
      repairType: action,
      success: false,
      recordedAt: new Date().toISOString(),
      detail: `verify failed: ${after.failures.map((f) => f.code).join(",")}`,
    });
    input.logger("info", "repair.retry_scheduled", {
      siteId: input.siteId,
      nextAttemptAt: businesses[input.siteId]!.nextAttemptAt,
      backoffMin,
    });
    return {
      ok: false,
      siteId: input.siteId,
      action,
      sourceMutationSuccess: true,
      buildSuccess: true,
      deploySuccess: true,
      publicVerification: false,
      rollbackAvailable: true,
      detail: businesses[input.siteId]!.lastDetail ?? "verify failed",
      before,
      after,
    };
  }

  businesses[input.siteId] = {
    siteId: input.siteId,
    state: "COMMERCIAL_READY",
    gateVersion: ADMISSION_GATE_VERSION,
    failures: after.failures.map((f) => f.code),
    lastAction: action,
    lastDetail: "public verification passed",
    updatedAt: new Date().toISOString(),
    acquisitionSuppressed: false,
    grandfatheredManaged: prev?.grandfatheredManaged ?? true,
    publicVerifiedAt: new Date().toISOString(),
    attempts: businesses[input.siteId]!.attempts,
  };
  await saveStates(input.pool, businesses);
  refreshAcquisitionBlockCache(businesses);
  await updateQueueItem(input.pool, input.siteId, {
    status: "completed",
    note: "public verification passed",
    lastAttemptAt: new Date().toISOString(),
  });
  // Persist app_url
  await input.pool.query(
    `update ros_businesses
     set app_url=$2,
         metadata = coalesce(metadata,'{}'::jsonb) || $3::jsonb,
         updated_at=now()
     where site_id=$1`,
    [
      input.siteId,
      deploy.productionUrl ?? `https://${input.siteId}.${process.env.HOSTING_PUBLIC_BASE_HOST || process.env.REVENUEOS_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io"}`,
      JSON.stringify({
        commercialState: "COMMERCIAL_READY",
        commercialRepairedAt: new Date().toISOString(),
        repairExecutor: REPAIR_EXECUTOR_VERSION,
        repairAction: action,
      }),
    ],
  );

  input.logger("info", "storefront.repair.completed", {
    siteId: input.siteId,
    action,
    productionUrl: deploy.productionUrl,
    executor: REPAIR_EXECUTOR_VERSION,
  });
  input.logger("info", "repair.succeeded", {
    siteId: input.siteId,
    attemptId,
    productionUrl: deploy.productionUrl,
    repairType: action,
  });
  await recordRepairAttempt(input.pool, {
    repairAttemptId: attemptId,
    businessId: input.siteId,
    startedAt: businesses[input.siteId]!.updatedAt,
    completedAt: new Date().toISOString(),
    result: "repaired",
    productionUrl: deploy.productionUrl,
    deploymentId: null,
    verification: "public_commercial_ready",
  });
  await recordRepairLesson(input.pool, {
    lessonId: newId("lesson"),
    category: diagnosis.evidence.identityMatch
      ? "NO_CTA"
      : "WRONG_SITE_IDENTITY",
    architecture: "native_azure_static_storefront",
    rootCause: diagnosis.rootCause.slice(0, 240),
    repairType: action,
    success: true,
    recordedAt: new Date().toISOString(),
    detail: `verified ${deploy.productionUrl}`,
  });

  return {
    ok: true,
    siteId: input.siteId,
    action,
    sourceMutationSuccess: true,
    buildSuccess: true,
    deploySuccess: true,
    publicVerification: true,
    rollbackAvailable: true,
    detail: "COMMERCIAL_READY after public verification",
    before,
    after,
  };
}

async function loadAdmitSlice(pool: pg.Pool): Promise<{
  titanManaged: string[];
  currentCandidate: string | null;
}> {
  const res = await pool.query(
    `select value from ros_config_meta where key='admit_rollout_checkpoint'`,
  );
  const v = (res.rows[0]?.value ?? {}) as {
    titanManaged?: string[];
    currentCandidate?: string | null;
  };
  return {
    titanManaged: Array.isArray(v.titanManaged) ? v.titanManaged.map(String) : [],
    currentCandidate: v.currentCandidate ? String(v.currentCandidate) : null,
  };
}

export async function runStorefrontRepairExecutor(deps: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  signal: AbortSignal;
  getTitanManaged?: () => string[];
  getCurrentProbation?: () => string | null;
  intervalMs?: number;
}): Promise<void> {
  // Admission candidates need fast repair pickup; 30s default (was 120s).
  const interval = deps.intervalMs ?? 30_000;
  deps.logger("info", "storefront.repair.executor.start", {
    version: REPAIR_EXECUTOR_VERSION,
    ownerExecuteDependency: false,
    deploymentMethod: "native_azure_hosting_plane",
  });

  // Initial classification of managed businesses (non-destructive).
  try {
    const slice = await loadAdmitSlice(deps.pool);
    await syncManagedCommercialStates({
      pool: deps.pool,
      titanManaged: slice.titanManaged,
      logger: deps.logger,
    });
  } catch (err) {
    deps.logger("warn", "storefront.repair.sync_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let inFlight: string | null = null;
  let cycles = 0;
  let firstCycle = true;

  while (!deps.signal.aborted) {
    if (!firstCycle) {
      await sleep(interval, deps.signal);
    }
    firstCycle = false;
    if (deps.signal.aborted) break;
    cycles += 1;

    try {
      const slice = await loadAdmitSlice(deps.pool);
      const businesses = await loadStates(deps.pool);
      refreshAcquisitionBlockCache(businesses);

      const exclude = new Set<string>();
      // Do NOT exclude currentCandidate — admission commercial failures must be repaired.
      if (inFlight) exclude.add(inFlight);

      // Prefer repairing the live admission candidate first.
      let next = pickNextRepair(
        businesses,
        exclude,
        slice.currentCandidate,
      );

      if (!next) {
        if (cycles % 8 === 0) {
          await syncManagedCommercialStates({
            pool: deps.pool,
            titanManaged: slice.titanManaged,
            logger: deps.logger,
          });
        }
        continue;
      }

      inFlight = next.siteId;
      const result = await executeOneStorefrontRepair({
        pool: deps.pool,
        appRoot: deps.appRoot,
        siteId: next.siteId,
        logger: deps.logger,
      });
      if (result.ok) {
        deps.logger("info", "admit.repair_complete", {
          siteId: result.siteId,
          action: result.action,
        });
      }
      deps.logger(
        result.ok ? "info" : "warn",
        "storefront.repair.cycle_done",
        {
          siteId: result.siteId,
          ok: result.ok,
          action: result.action,
          sourceMutationSuccess: result.sourceMutationSuccess,
          buildSuccess: result.buildSuccess,
          deploySuccess: result.deploySuccess,
          publicVerification: result.publicVerification,
        },
      );
      inFlight = null;
    } catch (err) {
      inFlight = null;
      deps.logger("error", "storefront.repair.cycle_error", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  deps.logger("info", "storefront.repair.executor.stop", {});
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
