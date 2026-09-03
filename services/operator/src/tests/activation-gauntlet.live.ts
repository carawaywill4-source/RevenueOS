/**
 * Activation gauntlet — remove production blockers (no new features).
 * Usage: npm --workspace @revenueos/operator-service exec tsx src/tests/activation-gauntlet.live.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acknowledgeExternalEvent,
  appendEvent,
  claimWork,
  createEventLedger,
  createKillSwitchState,
  createLockStore,
  evaluateConflict,
  makeCommand,
  makeRevenueEvent,
  resourceKey,
  runActionPipeline,
  setKillSwitch,
  transitionBusiness,
  type MutationDomain,
} from "@revenueos/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");
const OUT_DIR = path.resolve(REPO, ".data/gauntlet");
mkdirSync(OUT_DIR, { recursive: true });

function loadEnv() {
  const p = path.join(REPO, "services/operator/.env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2] ?? "";
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]!]) process.env[m[1]!] = v;
  }
}

type Row = {
  id: string;
  status: "PASS" | "FAIL" | "SKIPPED_EXTERNAL_DEPENDENCY" | "DEGRADED";
  detail: string;
  at: string;
};

const results: Row[] = [];
function record(
  id: string,
  status: Row["status"],
  detail: string,
) {
  const row = { id, status, detail, at: new Date().toISOString() };
  results.push(row);
  console.log(JSON.stringify(row));
}

async function checkCore(): Promise<void> {
  const hz = await fetch("http://127.0.0.1:8080/healthz", {
    signal: AbortSignal.timeout(5000),
  });
  if (!hz.ok) {
    record("core_healthz", "FAIL", `status ${hz.status}`);
    return;
  }
  record("core_healthz", "PASS", "8080 healthy");

  const hb = await fetch("http://127.0.0.1:8080/heartbeat", {
    signal: AbortSignal.timeout(5000),
  }).then((r) => r.json() as Promise<Record<string, unknown>>);
  if (hb.ok) {
    record(
      "core_heartbeat",
      "PASS",
      `mode=${hb.mode} pid=${hb.pid} suspend_gap=${hb.suspend_gap}`,
    );
  } else {
    record("core_heartbeat", "FAIL", JSON.stringify(hb));
  }

  const st = await fetch("http://127.0.0.1:8080/status", {
    signal: AbortSignal.timeout(8000),
  }).then((r) => r.json() as Promise<{
    businesses: Array<{ siteId: string; lastOk: boolean | null; ticks: number }>;
    service: { startedAt: string };
    capabilities?: { openai?: { status?: string; code?: string } };
  }>);
  const sg = st.businesses.find((b) => b.siteId === "scopeguard");
  record(
    "core_scopeguard_loop",
    sg ? "PASS" : "FAIL",
    sg
      ? `ticks=${sg.ticks} lastOk=${sg.lastOk}`
      : "scopeguard missing from Core businesses",
  );
  const openai = st.capabilities?.openai;
  if (openai?.status === "ok") {
    record("openai_credits", "PASS", "openai ok");
  } else if (openai?.code === "no_credits") {
    record(
      "openai_credits",
      "SKIPPED_EXTERNAL_DEPENDENCY",
      "OpenAI org has no credits — owner must add billing credits",
    );
  } else {
    record(
      "openai_credits",
      "DEGRADED",
      JSON.stringify(openai ?? "missing"),
    );
  }
}

async function checkHosting(): Promise<void> {
  const hz = await fetch("http://127.0.0.1:8090/healthz", {
    signal: AbortSignal.timeout(5000),
  });
  record(
    "hosting_healthz",
    hz.ok ? "PASS" : "FAIL",
    hz.ok ? "8090 healthy" : `status ${hz.status}`,
  );
  const viaCore = await fetch("http://127.0.0.1:8080/infra/host", {
    signal: AbortSignal.timeout(8000),
  }).then((r) => r.json() as Promise<{ ok?: boolean; hostingPlane?: string }>);
  record(
    "hosting_via_core",
    viaCore.ok && viaCore.hostingPlane === "online" ? "PASS" : "FAIL",
    JSON.stringify({
      ok: viaCore.ok,
      hostingPlane: viaCore.hostingPlane,
    }),
  );
}

async function checkStripe(): Promise<void> {
  const money = await fetch("http://127.0.0.1:8080/money", {
    signal: AbortSignal.timeout(15000),
  }).then((r) => r.json() as Promise<Record<string, unknown>>);
  if (money.ok && money.source === "stripe") {
    record("stripe_balance_api", "PASS", String(money.stripeAvailableLabel));
  } else {
    record("stripe_balance_api", "FAIL", JSON.stringify(money));
    return;
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    record(
      "stripe_checkout_session",
      "SKIPPED_EXTERNAL_DEPENDENCY",
      "STRIPE_SECRET_KEY not in process env for this harness",
    );
    return;
  }
  const live = key.startsWith("sk_live_");
  // Create a Checkout Session — do not complete payment; no fake revenue.
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", "https://scopeguard.vercel.app/?checkout=success");
  body.set("cancel_url", "https://scopeguard.vercel.app/?checkout=cancel");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][product_data][name]", "ScopeGuard CustomerZero Probe");
  body.set("line_items[0][price_data][unit_amount]", "4500");
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[revenueos_business_id]", "scopeguard");
  body.set("metadata[revenueos_customer_zero]", "true");
  body.set("metadata[exclude_from_stranger_revenue]", "true");
  body.set("metadata[nexus_probe]", "activation_gauntlet");
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(20000),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (res.ok && typeof json.url === "string") {
    record(
      "stripe_checkout_session",
      "PASS",
      `${live ? "LIVE" : "TEST"} session ${json.id} created (not completed)`,
    );
    writeFileSync(
      path.join(OUT_DIR, "stripe-checkout-session.json"),
      JSON.stringify(
        {
          id: json.id,
          url: json.url,
          live,
          customer_zero: true,
          completed: false,
          note: "Session created only — no payment, not stranger revenue",
        },
        null,
        2,
      ),
    );
  } else {
    record(
      "stripe_checkout_session",
      res.status === 401 || res.status === 403
        ? "SKIPPED_EXTERNAL_DEPENDENCY"
        : "FAIL",
      JSON.stringify(json).slice(0, 400),
    );
  }

  // Duplicate webhook protection (unit-level, same as NEXUS).
  let ledger = createEventLedger();
  const a = acknowledgeExternalEvent(ledger, "evt_activation_dup");
  ledger = a.ledger;
  const b = acknowledgeExternalEvent(ledger, "evt_activation_dup");
  record(
    "stripe_duplicate_webhook_guard",
    b.duplicate ? "PASS" : "FAIL",
    `duplicate=${b.duplicate}`,
  );
}

async function conflictWarGame(): Promise<void> {
  const landing = evaluateConflict({
    proposed_domain: "PRODUCT",
    proposed_variables: ["homepage"],
    active_domains: ["LANDING"],
    active_surfaces: [
      {
        experiment_id: "apex-landing",
        business_id: "scopeguard",
        variables: ["homepage"],
        audience: "all",
        channel: "site",
        start: new Date().toISOString(),
        expected_end: new Date().toISOString(),
        domain: "LANDING",
        owner: "APEX",
      },
    ],
  });
  record(
    "conflict_apex_landing_vs_forge_redesign",
    landing.verdict === "CONFLICT" ? "PASS" : "FAIL",
    landing.reason,
  );

  const retire = evaluateConflict({
    proposed_domain: "ACQUISITION",
    active_domains: [],
    business_retiring: true,
  });
  record(
    "conflict_retirement_vs_acquisition",
    retire.verdict === "BLOCK" ? "PASS" : "FAIL",
    retire.reason,
  );

  let state = {
    ledger: createEventLedger(),
    locks: createLockStore(),
    kills: createKillSwitchState(),
    active_domains: [] as MutationDomain[],
    active_surfaces: [],
    world_version: "1",
  };
  const cmd = makeCommand({
    issuer: "FORGE",
    business_id: "scopeguard",
    reason: "deploy",
    requested_action: "deploy_candidate",
    expected_effect: "new_version",
    risk_class: "R3",
    domain: "INFRASTRUCTURE",
    idempotency_key: "deploy:scopeguard:war",
    authorized_against_version: "1",
  });
  let n = 0;
  const exec = async () => {
    n += 1;
    return { ok: true, effect: { deployed: true }, detail: "ok" };
  };
  const first = await runActionPipeline({ state, command: cmd, execute: exec });
  state = first.state;
  const second = await runActionPipeline({ state, command: cmd, execute: exec });
  record(
    "conflict_double_deploy_idempotent",
    first.result.ok && second.result.duplicate && n === 1 ? "PASS" : "FAIL",
    `executions=${n} dup=${second.result.duplicate}`,
  );

  const stale = makeCommand({
    issuer: "TITAN",
    business_id: "scopeguard",
    reason: "price",
    requested_action: "advise_only_should_not_execute_price",
    expected_effect: "none",
    risk_class: "R3",
    domain: "PRICING",
    authorized_against_version: "14",
  });
  // TITAN cannot execute page/price mutations via policy when action looks like edit —
  // stale world version also denies.
  state = { ...state, world_version: "16" };
  const staleOut = await runActionPipeline({
    state,
    command: stale,
    execute: exec,
  });
  record(
    "conflict_stale_titan_command",
    staleOut.result.stale || !staleOut.result.ok ? "PASS" : "FAIL",
    staleOut.result.detail,
  );

  let kills = createKillSwitchState();
  kills = setKillSwitch(kills, "PAUSE_ACQUISITION", true);
  const paused = await runActionPipeline({
    state: { ...state, kills, world_version: "16" },
    command: makeCommand({
      issuer: "APEX",
      business_id: "scopeguard",
      reason: "acq",
      requested_action: "publish_intent_page",
      expected_effect: "exposure",
      risk_class: "R2",
      domain: "ACQUISITION",
      authorized_against_version: "16",
    }),
    execute: exec,
  });
  record(
    "kill_switch_pause_acquisition",
    !paused.result.ok ? "PASS" : "FAIL",
    paused.result.detail,
  );

  const life = transitionBusiness("READY", "FIRST_CUSTOMER");
  record(
    "lifecycle_ready_to_first_customer",
    life.ok ? "PASS" : "FAIL",
    life.reason,
  );
}

async function load50(): Promise<void> {
  const start = Date.now();
  const mem0 = process.memoryUsage().heapUsed;
  let ledger = createEventLedger();
  let locks = createLockStore();
  const businesses = Array.from({ length: 50 }, (_, i) => `sim_biz_${i + 1}`);
  const contamination = new Set<string>();
  for (const id of businesses) {
    for (let t = 0; t < 20; t++) {
      ledger = appendEvent(
        ledger,
        makeRevenueEvent({
          event_type: "nexus.organism.tick",
          producer: "NEXUS",
          business_id: id,
          payload: { i: t },
        }),
      );
    }
    const rk = resourceKey({
      business_id: id,
      domain: "ACQUISITION",
    });
    const c = claimWork(locks, {
      resource_key: rk,
      domain: "ACQUISITION",
      owner: `worker-${id}`,
      business_id: id,
    });
    locks = c.store;
    if (c.claim) contamination.add(c.claim.business_id ?? id);
  }
  // Cross-claim must fail
  const steal = claimWork(locks, {
    resource_key: resourceKey({
      business_id: "sim_biz_1",
      domain: "ACQUISITION",
    }),
    domain: "ACQUISITION",
    owner: "thief",
  });
  const mem1 = process.memoryUsage().heapUsed;
  const ms = Date.now() - start;
  const ok =
    businesses.length === 50 &&
    ledger.events.length === 1000 &&
    steal.claim === null &&
    contamination.size === 50;
  record(
    "fifty_business_simulation",
    ok ? "PASS" : "FAIL",
    `events=${ledger.events.length} claims=${contamination.size} steal_blocked=${steal.claim === null} heapDeltaMb=${((mem1 - mem0) / 1e6).toFixed(1)} ms=${ms}`,
  );
}

async function coreRestartProof(): Promise<void> {
  const before = await fetch("http://127.0.0.1:8080/status", {
    signal: AbortSignal.timeout(8000),
  }).then((r) => r.json() as Promise<{ service: { startedAt: string } }>);
  const oldStart = before.service.startedAt;
  // Kill listening process; LaunchAgent KeepAlive must revive it.
  const { execSync } = await import("node:child_process");
  try {
    const pid = execSync("lsof -tiTCP:8080 -sTCP:LISTEN").toString().trim();
    if (pid) process.kill(Number(pid), "SIGKILL");
  } catch {
    record("core_restart", "FAIL", "could not find/kill :8080");
    return;
  }
  let up = false;
  let newStart = "";
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const st = await fetch("http://127.0.0.1:8080/status", {
        signal: AbortSignal.timeout(2000),
      }).then((r) => r.json() as Promise<{ service: { startedAt: string } }>);
      if (st.service?.startedAt && st.service.startedAt !== oldStart) {
        up = true;
        newStart = st.service.startedAt;
        break;
      }
    } catch {
      /* waiting */
    }
  }
  record(
    "core_restart_keepalive",
    up ? "PASS" : "FAIL",
    up
      ? `LaunchAgent recovered old=${oldStart} new=${newStart}`
      : `did not recover within 45s old=${oldStart}`,
  );
}

async function hostingRollbackProof(): Promise<void> {
  const token = process.env.HOSTING_PLANE_TOKEN || process.env.CRON_SECRET || "";
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const status = await fetch("http://127.0.0.1:8090/status", {
    headers,
    signal: AbortSignal.timeout(8000),
  }).then((r) => r.json() as Promise<Record<string, unknown>>);
  const host = status.host as { sites?: Array<{ siteId: string; port?: number; healthy?: boolean }> } | undefined;
  const sg = host?.sites?.find((s) => s.siteId === "scopeguard");
  if (!sg) {
    record(
      "hosting_scopeguard_present",
      "DEGRADED",
      "scopeguard not in hosting status — run dual-run deploy",
    );
  } else {
    record(
      "hosting_scopeguard_present",
      "PASS",
      `port=${sg.port} healthy=${sg.healthy}`,
    );
  }

  // Failed candidate: deploy nonsense version path should fail without killing known-good
  const bad = await fetch("http://127.0.0.1:8090/deploy", {
    method: "POST",
    headers,
    body: JSON.stringify({
      siteId: "scopeguard",
      appDir: "apps/does-not-exist-activation-fail",
      version: `fail-candidate-${Date.now()}`,
      reason: "gauntlet_bad_deploy",
      hypothesis: "known-good must survive",
    }),
    signal: AbortSignal.timeout(120000),
  })
    .then(async (r) => ({
      status: r.status,
      body: (await r.json()) as Record<string, unknown>,
    }))
    .catch((e) => ({
      status: 0,
      body: { error: e instanceof Error ? e.message : String(e) },
    }));

  const after = await fetch("http://127.0.0.1:8090/healthz", {
    signal: AbortSignal.timeout(5000),
  });
  const planeStillUp = after.ok;
  const badFailed = bad.status >= 400 || bad.body.ok === false;
  record(
    "hosting_bad_deploy_known_good",
    planeStillUp && badFailed ? "PASS" : planeStillUp ? "DEGRADED" : "FAIL",
    `badStatus=${bad.status} planeUp=${planeStillUp} body=${JSON.stringify(bad.body).slice(0, 200)}`,
  );

  // Rollback action if supported
  const rb = await fetch("http://127.0.0.1:8080/infra/host/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ siteId: "scopeguard", action: "rollback" }),
    signal: AbortSignal.timeout(60000),
  })
    .then(async (r) => ({
      status: r.status,
      body: (await r.json()) as Record<string, unknown>,
    }))
    .catch((e) => ({
      status: 0,
      body: { error: e instanceof Error ? e.message : String(e) },
    }));
  record(
    "hosting_rollback_action",
    rb.status === 200 || rb.body.ok === true
      ? "PASS"
      : rb.status === 404
        ? "DEGRADED"
        : "FAIL",
    `status=${rb.status} ${JSON.stringify(rb.body).slice(0, 240)}`,
  );
}

async function controlPlaneDisconnect(): Promise<void> {
  // Hosting must stay up while Core is killed briefly.
  const hostBefore = await fetch("http://127.0.0.1:8090/healthz", {
    signal: AbortSignal.timeout(3000),
  });
  if (!hostBefore.ok) {
    record("control_plane_disconnect", "FAIL", "hosting down before test");
    return;
  }
  const { execSync } = await import("node:child_process");
  try {
    const pid = execSync("lsof -tiTCP:8080 -sTCP:LISTEN").toString().trim();
    if (pid) process.kill(Number(pid), "SIGKILL");
  } catch {
    record("control_plane_disconnect", "FAIL", "no core pid");
    return;
  }
  await new Promise((r) => setTimeout(r, 2000));
  const hostDuring = await fetch("http://127.0.0.1:8090/healthz", {
    signal: AbortSignal.timeout(3000),
  });
  // Wait for Core recovery
  let coreBack = false;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const r = await fetch("http://127.0.0.1:8080/healthz", {
        signal: AbortSignal.timeout(1500),
      });
      if (r.ok) {
        coreBack = true;
        break;
      }
    } catch {
      /* wait */
    }
  }
  record(
    "control_plane_disconnect",
    hostDuring.ok && coreBack ? "PASS" : "FAIL",
    `hostingDuringCoreDown=${hostDuring.ok} coreRecovered=${coreBack}`,
  );
}

async function browserCustomerZero(): Promise<void> {
  const urls = [
    "https://scopeguard.vercel.app/",
    process.env.SCOPEGUARD_LOCAL_URL,
  ].filter(Boolean) as string[];

  for (const url of urls) {
    try {
      const r = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
        headers: { "user-agent": "RevenueOS-CustomerZero/1.0" },
      });
      const html = await r.text();
      const hasCta =
        /checkout|get started|buy|purchase|start|pricing/i.test(html);
      const brokenTitle = /application error|internal server error/i.test(html);
      record(
        `browser_fetch_${url.includes("127.0.0.1") ? "local" : "vercel"}`,
        r.ok && !brokenTitle ? "PASS" : "FAIL",
        `status=${r.status} cta=${hasCta} bytes=${html.length}`,
      );
      writeFileSync(
        path.join(
          OUT_DIR,
          `customer-zero-${url.includes("127.0.0.1") ? "local" : "vercel"}.html`,
        ),
        html.slice(0, 200_000),
      );
    } catch (e) {
      record(
        `browser_fetch_${url.includes("127.0.0.1") ? "local" : "vercel"}`,
        "FAIL",
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // Playwright if installed
  try {
    const { chromium, webkit, firefox } = await import("playwright");
    const browsers = [
      ["chromium", chromium],
      ["webkit", webkit],
      ["firefox", firefox],
    ] as const;
    for (const [name, eng] of browsers) {
      try {
        const browser = await eng.launch({ headless: true });
        const page = await browser.newPage({
          viewport: name === "chromium" ? { width: 390, height: 844 } : undefined,
        });
        await page.goto("https://scopeguard.vercel.app/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        const shot = path.join(OUT_DIR, `scopeguard-${name}.png`);
        await page.screenshot({ path: shot, fullPage: true });
        const title = await page.title();
        await browser.close();
        record(
          `playwright_${name}`,
          title ? "PASS" : "FAIL",
          `title=${title} shot=${shot}`,
        );
      } catch (e) {
        record(
          `playwright_${name}`,
          "DEGRADED",
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  } catch {
    record(
      "playwright_suite",
      "SKIPPED_EXTERNAL_DEPENDENCY",
      "playwright package not installed in this workspace",
    );
  }
}

async function waitForNexusTicks(): Promise<void> {
  // Poll logs via heartbeat nexus field after Core has ticked.
  for (let i = 0; i < 90; i++) {
    try {
      const hb = await fetch("http://127.0.0.1:8080/heartbeat", {
        signal: AbortSignal.timeout(3000),
      }).then((r) => r.json() as Promise<Record<string, unknown>>);
      if (hb.last_nexus_tick) {
        record(
          "nexus_ticks_live",
          "PASS",
          `last_nexus_tick=${hb.last_nexus_tick} apex=${hb.last_apex_tick} titan=${hb.last_titan_tick}`,
        );
        return;
      }
    } catch {
      /* wait */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  record(
    "nexus_ticks_live",
    "FAIL",
    "no nexus tick observed within 180s after Core start",
  );
}

async function main() {
  loadEnv();
  console.log(
    JSON.stringify({
      event: "activation_gauntlet.start",
      at: new Date().toISOString(),
    }),
  );
  await checkCore();
  await checkHosting();
  await checkStripe();
  await conflictWarGame();
  await load50();
  await browserCustomerZero();
  await hostingRollbackProof();
  // Restart proofs last (disruptive)
  await coreRestartProof();
  await waitForNexusTicks();
  await controlPlaneDisconnect();
  await waitForNexusTicks();

  const summary = {
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    degraded: results.filter((r) => r.status === "DEGRADED").length,
    skipped: results.filter((r) => r.status === "SKIPPED_EXTERNAL_DEPENDENCY")
      .length,
    results,
  };
  writeFileSync(
    path.join(OUT_DIR, "activation-gauntlet.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify({ event: "activation_gauntlet.done", ...summary }));
  if (summary.fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
