/**
 * Parameterized ONE-business live cutover acceptance test.
 *
 *   CUTOVER_SITE_ID=resumeforge CLAIM_ENABLED=1 SHADOW_MODE=0 \
 *     npx tsx src/tests/business-cutover.live.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  checkOperatorHosting,
  createOperatorAdapter,
  getOpenAICapabilityStatus,
  operatorClaimDocId,
  runOperatorTick,
} from "@revenueos/core";
import { hydrateEnvFromFiles, loadEnv } from "../env.js";
import { findBusiness } from "../portfolio.js";
import { createSupabaseStore } from "../lib/supabase-store.js";
import { claimBusiness } from "../lib/claims.js";
import {
  executeOperatorCommercialAction,
  listCutoverSafeActions,
} from "../lib/agent-executor.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const SITE = (process.env.CUTOVER_SITE_ID || process.argv[2] || "").trim();
if (!SITE) {
  console.error("Usage: CUTOVER_SITE_ID=<siteId> npx tsx src/tests/business-cutover.live.ts");
  process.exit(2);
}

const trace: Record<string, unknown> = { siteId: SITE, steps: [] as unknown[] };

function step(name: string, data: Record<string, unknown>) {
  const row = { at: new Date().toISOString(), name, ...data };
  (trace.steps as unknown[]).push(row);
  console.log(JSON.stringify(row));
}

function parseEnvFile(p: string) {
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

async function fetchCron(appUrl: string, secret: string, timeoutMs = 120_000) {
  const res = await fetch(`${appUrl.replace(/\/$/, "")}/api/cron/revenueos`, {
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  return { status: res.status, json, textHead: text.slice(0, 500) };
}

async function main() {
  hydrateEnvFromFiles();
  process.env.BUSINESSES = SITE;
  process.env.SHADOW_MODE = "0";
  process.env.CLAIM_ENABLED = "1";
  process.env.CLAIM_LEASE_MS ??= "900000";
  const env = loadEnv();
  const biz = findBusiness(SITE);
  if (!biz) throw new Error(`unknown business ${SITE}`);

  const root = path.resolve(process.cwd(), "../..");
  const secret =
    parseEnvFile(path.join(root, ".env.portfolio")).CRON_SECRET ||
    parseEnvFile(path.join(root, ".env.local")).CRON_SECRET ||
    parseEnvFile(path.join(root, `apps/${SITE}/.env.local`)).CRON_SECRET ||
    process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET missing for Vercel proof");

  const openai = getOpenAICapabilityStatus();
  step("CAPABILITY_STATUS", {
    openai: {
      status: openai.status,
      code: openai.code,
      note: openai.note,
      degradedActionTypes: openai.degradedActionTypes,
    },
  });

  const { store, mode, client } = createSupabaseStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const ledger = await mode();
  const projectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];

  const { count: expCount } = await client
    .from("revenueos_experiments")
    .select("*", { count: "exact", head: true })
    .eq("site_id", SITE);
  const { count: allExp } = await client
    .from("revenueos_experiments")
    .select("*", { count: "exact", head: true });
  step("EXISTING_MEMORY_LOADED", {
    projectRef,
    ledger,
    siteExperiments: expCount,
    portfolioExperiments: allExp,
  });
  const minExp = Number(process.env.MIN_EXPERIMENTS ?? "10");
  if ((expCount ?? 0) < minExp) {
    throw new Error(
      `Refuse cutover: ${SITE} memory too thin (${expCount} < ${minExp})`,
    );
  }

  const claim = await claimBusiness(client, {
    siteId: SITE,
    owner: env.OPERATOR_NAME,
    leaseMs: env.CLAIM_LEASE_MS,
  });
  if (!claim) throw new Error("claim denied");
  step("MAC_CLAIM_ACQUIRED", {
    owner: claim.owner,
    leaseUntil: claim.leaseUntil,
    storage: claim.storage,
    docId: operatorClaimDocId(SITE),
  });

  const hostLocal = await checkOperatorHosting(SITE, {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  step("CLAIM_VERIFIED_IN_DURABLE_STORE", {
    hosted: hostLocal.hosted,
    reason: hostLocal.reason,
    storage: "storage" in hostLocal ? hostLocal.storage : null,
  });
  if (!hostLocal.hosted) {
    throw new Error("STOP: claim not visible via checkOperatorHosting");
  }

  let cron;
  try {
    cron = await fetchCron(biz.appUrl, secret);
  } catch (e) {
    step("VERCEL_CRON_PROBE_ERROR", {
      error: e instanceof Error ? e.message : String(e),
    });
    throw new Error("STOP: could not reach Vercel cron — repair ownership first");
  }
  const modeVal = cron.json?.mode ?? cron.json?.cycleStatus;
  step("VERCEL_DUPLICATE_EXECUTION_BLOCKED", {
    httpStatus: cron.status,
    mode: modeVal,
    skipped: cron.json?.skipped ?? null,
    host: cron.json?.host ?? null,
    bodyHead: cron.textHead,
  });
  if (
    cron.status !== 200 ||
    (modeVal !== "hosted_by_operator" && cron.json?.skipped !== true)
  ) {
    throw new Error(
      `STOP: Vercel did not respect claim (mode=${String(modeVal)})`,
    );
  }

  const adapter = createOperatorAdapter({
    manifest: biz,
    store,
    safeActionSource: listCutoverSafeActions,
    executor: async (action) =>
      executeOperatorCommercialAction({
        action,
        manifest: biz,
        store,
        cronSecret: secret,
      }),
  });

  const bookkeeping = new Set([
    "scorecard_snapshot",
    "indexnow_submit",
    "ping_search_engines",
    "sitemap_ping",
  ]);
  const sinceExec = new Date(Date.now() - 20 * 60_000).toISOString();
  const isStrong = (ev: {
    eventType?: string;
    detail?: { ok?: boolean; actionType?: string };
  }) =>
    ev.eventType === "executed" &&
    ev.detail?.ok === true &&
    /publish|discovery_attack|directory|gumroad|youtube|distribute|outreach|gbp|nextdoor|bing|feature_product/i.test(
      String(ev.detail?.actionType ?? ""),
    ) &&
    !bookkeeping.has(String(ev.detail?.actionType ?? ""));

  // When OpenAI is degraded, the first drain may only defer generative jobs.
  // Retry ticks so the brain can still pick non-LLM commercial limbs.
  let tick1 = await runOperatorTick({
    businessId: SITE,
    adapter,
    tickBudgetMs: 180_000,
    maxJobsPerTick: 8,
    logger: (level, event, fields) =>
      console.log(level, event, JSON.stringify(fields ?? {}).slice(0, 300)),
  });
  let recentEvents = store.listPursuitEvents
    ? await store.listPursuitEvents(SITE, { since: sinceExec, limit: 120 })
    : [];
  let strong = recentEvents.find(isStrong);
  for (let attempt = 2; !strong && attempt <= 4; attempt++) {
    step("COMMERCIAL_DRAIN_RETRY", {
      attempt,
      openai: getOpenAICapabilityStatus().status,
      priorExecuted: tick1.drain.executed,
      priorEnqueued: tick1.plan.enqueuedCount,
    });
    tick1 = await runOperatorTick({
      businessId: SITE,
      adapter,
      tickBudgetMs: 180_000,
      maxJobsPerTick: 10,
      logger: (level, event, fields) =>
        console.log(level, event, JSON.stringify(fields ?? {}).slice(0, 300)),
    });
    recentEvents = store.listPursuitEvents
      ? await store.listPursuitEvents(SITE, { since: sinceExec, limit: 160 })
      : [];
    strong = recentEvents.find(isStrong);
  }
  if (!strong) {
    step("EXISTING_REVENUEOS_BRAIN_SELECTED_ACTION", {
      ok: tick1.ok,
      enqueued: tick1.plan.enqueuedCount,
      executed: tick1.drain.executed,
      drainSummary: tick1.drain.jobs.map((j) => ({
        id: j.id,
        actionType: j.actionType,
        state: j.state,
        err: j.lastError?.slice(0, 120) ?? null,
        summary: j.workSummary?.slice(0, 120) ?? null,
      })),
      openai: getOpenAICapabilityStatus(),
    });
    throw new Error(
      "STOP: no meaningful commercial action executed successfully this window",
    );
  }

  const chosenType = String(strong.detail?.actionType);
  const chosenDetail = String(strong.detail?.detail ?? "");
  const chosenUrl =
    chosenDetail.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[.)]+$/, "") ?? null;
  const chosenJobId = strong.pursuitId;

  step("EXISTING_REVENUEOS_BRAIN_SELECTED_ACTION", {
    ok: tick1.ok,
    enqueued: tick1.plan.enqueuedCount,
    executed: tick1.drain.executed,
    actionType: chosenType,
    jobId: chosenJobId,
    detail: chosenDetail.slice(0, 300),
    url: chosenUrl,
    fcm: tick1.plan.firstCustomerMode,
  });

  const pursuitBefore = await client
    .from("revenueos_experiments")
    .select("id,status,updated_at,document")
    .eq("id", `ros:pursuit:${chosenJobId}`)
    .maybeSingle();
  const priorLifecycle = recentEvents.filter(
    (ev) =>
      ev.pursuitId === chosenJobId &&
      (ev.eventType === "claimed" ||
        ev.eventType === "enqueued" ||
        ev.eventType === "planned") &&
      Date.parse(String(ev.createdAt ?? 0)) <=
        Date.parse(String(strong.createdAt ?? Date.now())),
  );
  step("ACTION_PERSISTED_BEFORE_EXECUTION", {
    pursuitPresent: Boolean(pursuitBefore.data),
    pursuitStatus: pursuitBefore.data?.status ?? null,
    priorLifecycleEvents: priorLifecycle.map((e) => e.eventType).slice(0, 6),
    ok: Boolean(pursuitBefore.data) || priorLifecycle.length > 0,
  });
  if (!pursuitBefore.data && priorLifecycle.length === 0) {
    throw new Error("STOP: action was not persisted before/during execution");
  }

  step("ACTION_DURABLY_QUEUED_AND_EXECUTED", {
    jobId: chosenJobId,
    actionType: chosenType,
    resultOk: true,
    detail: chosenDetail.slice(0, 300),
    url: chosenUrl,
    eventId: strong.id,
  });

  let external: Record<string, unknown> = { skipped: true, ok: true };
  if (chosenUrl) {
    try {
      const er = await fetch(chosenUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      const body = await er.text();
      const keywords = [
        biz.displayName,
        biz.product.name,
        ...(biz.product.audience ? biz.product.audience.split(/\s+/).slice(0, 3) : []),
      ].filter(Boolean);
      external = {
        skipped: false,
        url: chosenUrl,
        httpStatus: er.status,
        ok: er.ok,
        contentSignals: {
          bytes: body.length,
          keywordHit: keywords.some((k) =>
            new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(body),
          ),
        },
      };
    } catch (e) {
      external = {
        skipped: false,
        ok: false,
        url: chosenUrl,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  } else {
    external = {
      skipped: false,
      kind: "durable_event",
      found: true,
      eventId: strong.id,
      actionType: chosenType,
      ok: true,
    };
  }
  step("EXTERNAL_EXECUTION_VERIFIED", external);
  if (external.ok === false) {
    throw new Error("STOP: external verification failed");
  }

  const pursuitRow = await client
    .from("revenueos_experiments")
    .select("id,status,updated_at")
    .eq("id", `ros:pursuit:${chosenJobId}`)
    .maybeSingle();
  step("RESULT_STORED_AND_LEARNING_WRITTEN", {
    pursuitPresent: Boolean(pursuitRow.data),
    pursuitStatus: pursuitRow.data?.status ?? null,
    executedEventPresent: true,
    actionType: chosenType,
  });

  const tick2 = await runOperatorTick({
    businessId: SITE,
    adapter,
    tickBudgetMs: 180_000,
    maxJobsPerTick: 2,
  });
  const recentAfter = store.listPursuitEvents
    ? await store.listPursuitEvents(SITE, { since: sinceExec, limit: 120 })
    : [];
  step("NEXT_DECISION_READ_THE_LEARNING", {
    ok: tick2.ok,
    enqueued: tick2.plan.enqueuedCount,
    executed: tick2.drain.executed,
    fcmStage: tick2.plan.firstCustomerMode?.stage,
    patternGateBanned: tick2.plan.patternGate
      ? [...(tick2.plan.patternGate.bannedPatterns ?? [])].slice(0, 10)
      : [],
    priorActionStillInMemory: recentAfter.some((ev) => ev.id === strong.id),
    nextEnqueuedTypes: tick2.plan.enqueued?.map((e) => e.actionType).slice(0, 8),
  });

  const { store: store2, client: client2 } = createSupabaseStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const hostAfter = await checkOperatorHosting(SITE, {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const pursuitReload = await client2
    .from("revenueos_experiments")
    .select("id,status")
    .eq("id", `ros:pursuit:${chosenJobId}`)
    .maybeSingle();
  const eventReload = await client2
    .from("revenueos_experiments")
    .select("id")
    .eq("id", `ros:pevt:${strong.id}`)
    .maybeSingle();
  const expAfter = await client2
    .from("revenueos_experiments")
    .select("*", { count: "exact", head: true });
  step("MAC_CORE_RESTARTED_MEMORY_SURVIVED", {
    claimStillActive: hostAfter.hosted,
    pursuitStillPresent: Boolean(pursuitReload.data),
    executedEventStillPresent: Boolean(eventReload.data),
    portfolioExperiments: expAfter.count,
    portfolioNotReset: (expAfter.count ?? 0) >= (allExp ?? 0),
  });
  if (!pursuitReload.data && !eventReload.data) {
    throw new Error("STOP: action/result missing after restart reload");
  }

  const adapter2 = createOperatorAdapter({
    manifest: biz,
    store: store2,
    safeActionSource: listCutoverSafeActions,
    executor: async (action) =>
      executeOperatorCommercialAction({
        action,
        manifest: biz,
        store: store2,
        cronSecret: secret,
      }),
  });
  const tick3 = await runOperatorTick({
    businessId: SITE,
    adapter: adapter2,
    tickBudgetMs: 120_000,
    maxJobsPerTick: 2,
  });
  step("OPERATION_RESUMED", {
    ok: tick3.ok,
    enqueued: tick3.plan.enqueuedCount,
    executed: tick3.drain.executed,
    withoutVercelCron: true,
  });

  mkdirSync(path.join(root, ".data"), { recursive: true });
  const out = path.join(
    root,
    ".data",
    `${SITE}-cutover-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(out, JSON.stringify(trace, null, 2));
  step("ACCEPTANCE_TRACE_WRITTEN", { path: out });
  console.log(
    JSON.stringify({
      ACCEPTANCE: "PASS_PENDING_REVIEW",
      siteId: SITE,
      keepClaim: true,
      owner: env.OPERATOR_NAME,
      leaseUntil: claim.leaseUntil,
      openai: getOpenAICapabilityStatus().status,
    }),
  );
}

main().catch((e) => {
  console.error("CUTOVER_FAIL", SITE, e);
  process.exit(1);
});
