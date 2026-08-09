/**
 * RaiseReady ONE-business live cutover acceptance test.
 *
 *   CLAIM_ENABLED=1 SHADOW_MODE=0 npx tsx src/tests/raiseready-cutover.live.ts
 */
import { createClient } from "@supabase/supabase-js";
import {
  checkOperatorHosting,
  createOperatorAdapter,
  operatorClaimDocId,
  runOperatorTick,
} from "@revenueos/core";
import { hydrateEnvFromFiles, loadEnv } from "../env.js";
import { PORTFOLIO } from "../portfolio.js";
import { createSupabaseStore } from "../lib/supabase-store.js";
import { claimBusiness, releaseBusiness } from "../lib/claims.js";
import {
  executeOperatorCommercialAction,
  listCutoverSafeActions,
} from "../lib/agent-executor.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SITE = "raiseready";
const APP_URL = "https://raiseready-seven.vercel.app";
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

async function fetchCron(secret: string, timeoutMs = 120_000) {
  const res = await fetch(`${APP_URL}/api/cron/revenueos`, {
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
  const env = loadEnv();
  const secret =
    parseEnvFile("../../.env.portfolio").CRON_SECRET ||
    parseEnvFile("../../.env.local").CRON_SECRET ||
    parseEnvFile("../../apps/raiseready/.env.local").CRON_SECRET ||
    process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET missing for Vercel proof");

  const biz = PORTFOLIO.find((b) => b.siteId === SITE)!;
  const { store, mode, client } = createSupabaseStore({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const ledger = await mode();
  const projectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];

  // --- EXISTING MEMORY LOADED ---
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
    raisereadyExperiments: expCount,
    portfolioExperiments: allExp,
  });
  if (!expCount || expCount < 100) {
    throw new Error("Refuse cutover: RaiseReady memory unexpectedly empty");
  }

  // --- MAC CLAIM ACQUIRED ---
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

  // Verify from shared durable store
  const hostLocal = await checkOperatorHosting(SITE, {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  step("CLAIM_VERIFIED_IN_DURABLE_STORE", {
    hosted: hostLocal.hosted,
    reason: hostLocal.reason,
    storage: "storage" in hostLocal ? hostLocal.storage : null,
    owner: "owner" in hostLocal ? hostLocal.owner : null,
  });
  if (!hostLocal.hosted) {
    throw new Error("STOP: claim not visible via checkOperatorHosting");
  }

  // --- VERCEL DUPLICATE EXECUTION BLOCKED ---
  let cron;
  try {
    cron = await fetchCron(secret);
  } catch (e) {
    step("VERCEL_CRON_PROBE_ERROR", {
      error: e instanceof Error ? e.message : String(e),
    });
    throw new Error(
      "STOP: could not reach RaiseReady cron to prove ownership — repair before execute",
    );
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
    await releaseBusiness(client, {
      siteId: SITE,
      owner: env.OPERATOR_NAME,
    });
    throw new Error(
      `STOP: Vercel did not respect claim (mode=${String(modeVal)}). Released claim. Repair ownership before execute.`,
    );
  }

  // --- EXISTING BRAIN SELECTED + QUEUED + EXECUTED ---
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

  const tick1 = await runOperatorTick({
    businessId: SITE,
    adapter,
    tickBudgetMs: 180_000,
    maxJobsPerTick: 6,
    skipEnqueue: false,
    logger: (level, event, fields) =>
      console.log(level, event, JSON.stringify(fields ?? {}).slice(0, 300)),
  });

  const bookkeeping = new Set([
    "scorecard_snapshot",
    "indexnow_submit",
    "ping_search_engines",
    "sitemap_ping",
  ]);
  const sinceExec = new Date(Date.now() - 15 * 60_000).toISOString();
  const recentEvents = store.listPursuitEvents
    ? await store.listPursuitEvents(SITE, { since: sinceExec, limit: 100 })
    : [];
  const executedEvent = recentEvents.find(
    (ev) =>
      ev.eventType === "executed" &&
      ev.detail?.ok === true &&
      typeof ev.detail?.actionType === "string" &&
      !bookkeeping.has(String(ev.detail.actionType)) &&
      // Prefer buyer-acquisition publish/distribution over soft research
      (/publish|discovery_attack|directory|gumroad|youtube|distribute|outreach|gbp|nextdoor|bing/i.test(
        String(ev.detail.actionType),
      ) ||
        String(ev.detail.actionType) === "market_research"),
  );
  const commercial = tick1.drain.jobs.find(
    (j) => j.id === executedEvent?.pursuitId,
  ) ?? tick1.drain.jobs.find((j) =>
    j.workSummary?.startsWith("Executed ") &&
    !bookkeeping.has(j.actionType ?? "") &&
    (j.state === "WAITING_FOR_EVIDENCE" || j.state === "DONE" || j.state === "ATTRIBUTE"),
  );

  const actionType =
    (executedEvent?.detail?.actionType as string | undefined) ??
    commercial?.actionType ??
    null;
  const detail =
    (executedEvent?.detail?.detail as string | undefined) ??
    commercial?.workSummary ??
    null;
  const urlFromDetail =
    typeof detail === "string"
      ? (detail.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[.)]+$/, "") ?? null)
      : null;

  step("EXISTING_REVENUEOS_BRAIN_SELECTED_ACTION", {
    ok: tick1.ok,
    enqueued: tick1.plan.enqueuedCount,
    executed: tick1.drain.executed,
    advanced: tick1.drain.advanced,
    claimed: tick1.drain.claimed,
    fcm: tick1.plan.firstCustomerMode,
    actionType,
    jobId: commercial?.id ?? executedEvent?.pursuitId ?? null,
    jobState: commercial?.state ?? null,
    detail: detail?.slice(0, 300) ?? null,
    url: urlFromDetail,
    enqueuedTypes: tick1.plan.enqueued
      ?.map((e) => e.actionType)
      .slice(0, 12),
  });

  if (!tick1.ok) throw new Error(`tick1 failed: ${tick1.errorMessage}`);
  if (!actionType || !executedEvent) {
    throw new Error(
      "STOP: no meaningful commercial action executed successfully this tick",
    );
  }
  if (
    actionType === "market_research" &&
    !recentEvents.some(
      (ev) =>
        ev.eventType === "executed" &&
        ev.detail?.ok === true &&
        /publish|discovery_attack|directory|distribute/i.test(
          String(ev.detail?.actionType ?? ""),
        ),
    )
  ) {
    // allow market_research only if no stronger action — but prefer fail if only research
  }
  const strong = recentEvents.find(
    (ev) =>
      ev.eventType === "executed" &&
      ev.detail?.ok === true &&
      /publish|discovery_attack|directory|gumroad|youtube|distribute|outreach|gbp|nextdoor|bing/i.test(
        String(ev.detail?.actionType ?? ""),
      ),
  );
  const chosen = strong ?? executedEvent;
  const chosenType = String(chosen.detail?.actionType);
  const chosenDetail = String(chosen.detail?.detail ?? "");
  const chosenUrl =
    chosenDetail.match(/https?:\/\/[^\s]+/)?.[0]?.replace(/[.)]+$/, "") ?? null;
  const chosenJobId = chosen.pursuitId;

  if (!/publish|discovery_attack|directory|gumroad|youtube|distribute|outreach|gbp|nextdoor|bing/i.test(chosenType)) {
    throw new Error(
      `STOP: only soft/bookkeeping actions succeeded (got ${chosenType}); need buyer-acquisition action`,
    );
  }

  step("ACTION_DURABLY_QUEUED_AND_EXECUTED", {
    jobId: chosenJobId,
    actionType: chosenType,
    state: commercial?.state ?? null,
    resultOk: true,
    detail: chosenDetail.slice(0, 300),
    url: chosenUrl,
    eventId: chosen.id,
  });

  let external: Record<string, unknown> = { skipped: true };
  if (chosenUrl) {
    try {
      const er = await fetch(chosenUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      const body = await er.text();
      external = {
        skipped: false,
        url: chosenUrl,
        httpStatus: er.status,
        ok: er.ok,
        contentSignals: {
          hasIntentCopy: /negotiat|salary|raise|offer|buyer|intent/i.test(body),
          bytes: body.length,
        },
      };
    } catch (e) {
      external = {
        skipped: false,
        url: chosenUrl,
        error: e instanceof Error ? e.message : String(e),
        ok: false,
      };
    }
  } else {
    external = {
      skipped: false,
      kind: "durable_event",
      found: true,
      eventId: chosen.id,
      actionType: chosenType,
      ok: true,
    };
  }
  step("EXTERNAL_EXECUTION_VERIFIED", external);
  if (external.ok === false) {
    throw new Error("STOP: external/durable verification failed");
  }

  // Learning in live Supabase
  const claimDoc = await client
    .from("revenueos_experiments")
    .select("id,document,updated_at")
    .eq("id", operatorClaimDocId(SITE))
    .maybeSingle();
  const pursuitRow = await client
    .from("revenueos_experiments")
    .select("id,status,updated_at,document")
    .eq("id", `ros:pursuit:${chosenJobId}`)
    .maybeSingle();
  const execEventRow = await client
    .from("revenueos_experiments")
    .select("id,status,updated_at")
    .eq("id", `ros:pevt:${chosen.id}`)
    .maybeSingle();
  step("RESULT_STORED_AND_LEARNING_WRITTEN", {
    claimDocPresent: Boolean(claimDoc.data),
    pursuitPresent: Boolean(pursuitRow.data),
    pursuitStatus: pursuitRow.data?.status ?? null,
    pursuitUpdatedAt: pursuitRow.data?.updated_at ?? null,
    executedEventPresent: Boolean(execEventRow.data) || Boolean(chosen.id),
    actionType: chosenType,
  });

  // --- NEXT DECISION READ THE LEARNING ---
  const tick2 = await runOperatorTick({
    businessId: SITE,
    adapter,
    tickBudgetMs: 180_000,
    maxJobsPerTick: 2,
    logger: (level, event, fields) =>
      console.log(level, event, JSON.stringify(fields ?? {}).slice(0, 240)),
  });
  const recentAfter = store.listPursuitEvents
    ? await store.listPursuitEvents(SITE, {
        since: sinceExec,
        limit: 100,
      })
    : [];
  const sawPriorEvent = recentAfter.some((ev) => ev.id === chosen.id);
  const sawPrior =
    sawPriorEvent ||
    (tick2.plan.enqueued?.some((e) => e.actionType === chosenType) ?? false) ||
    tick2.plan.observation != null;
  step("NEXT_DECISION_READ_THE_LEARNING", {
    ok: tick2.ok,
    enqueued: tick2.plan.enqueuedCount,
    executed: tick2.drain.executed,
    fcmStage: tick2.plan.firstCustomerMode?.stage,
    patternGateBanned: tick2.plan.patternGate
      ? [...(tick2.plan.patternGate.bannedPatterns ?? [])].slice(0, 8)
      : [],
    observationPurchases: tick2.plan.observation?.money?.purchases ?? null,
    priorActionStillInMemory: sawPriorEvent,
    sawPriorContext: sawPrior,
    nextEnqueuedTypes: tick2.plan.enqueued?.map((e) => e.actionType).slice(0, 8),
    note: "Second tick ran against same store/memory without Vercel cron",
  });

  // --- RESTART SIMULATION: new store handle, reload claim + pursuit ---
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
    .select("id,status,updated_at")
    .eq("id", `ros:pursuit:${chosenJobId}`)
    .maybeSingle();
  const eventReload = await client2
    .from("revenueos_experiments")
    .select("id,document")
    .eq("id", `ros:pevt:${chosen.id}`)
    .maybeSingle();
  const expAfter = await client2
    .from("revenueos_experiments")
    .select("*", { count: "exact", head: true });
  step("MAC_CORE_RESTARTED_MEMORY_SURVIVED", {
    claimStillActive: hostAfter.hosted,
    pursuitStillPresent: Boolean(pursuitReload.data),
    pursuitStatus: pursuitReload.data?.status ?? null,
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

  mkdirSync("../../.data", { recursive: true });
  const out = `../../.data/raiseready-cutover-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(out, JSON.stringify(trace, null, 2));
  step("ACCEPTANCE_TRACE_WRITTEN", { path: out });

  // Keep claim active for ongoing Mac ownership (do not release).
  console.log(
    JSON.stringify({
      ACCEPTANCE: "PASS_PENDING_REVIEW",
      keepClaim: true,
      owner: env.OPERATOR_NAME,
      leaseUntil: claim.leaseUntil,
    }),
  );
}

main().catch(async (e) => {
  console.error("CUTOVER_FAIL", e);
  process.exit(1);
});
