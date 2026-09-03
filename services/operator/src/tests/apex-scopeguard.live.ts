/**
 * APEX ScopeGuard laboratory proof.
 *
 * Runs one APEX cycle against the live operator adapter for scopeguard and
 * writes a full decision/demand/attribution trace. Purchase may be null / $0.
 *
 *   npm --workspace @revenueos/operator-service exec tsx src/tests/apex-scopeguard.live.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createOperatorAdapter,
  loadApexState,
  runApexCycle,
  type ApexCycleResult,
} from "@revenueos/core";
import { createSupabaseStore } from "../lib/supabase-store.js";
import { findBusiness } from "../portfolio.js";

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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");

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

async function main() {
  loadEnv();
  const siteId = "scopeguard";
  const manifest = findBusiness(siteId);
  if (!manifest) {
    console.error(JSON.stringify({ ok: false, detail: "scopeguard_not_in_portfolio" }));
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error(JSON.stringify({ ok: false, detail: "supabase_env_missing" }));
    process.exit(2);
  }

  const handle = createSupabaseStore({ url, serviceRoleKey: key });

  const adapter = createOperatorAdapter({
    manifest,
    store: handle.store,
  });

  const apex: ApexCycleResult = await runApexCycle({ adapter });
  const state = await loadApexState(handle.store, siteId);

  const recent = handle.store.listPursuitEvents
    ? await handle.store.listPursuitEvents(siteId, { limit: 80 })
    : [];
  const commercial = recent.filter(
    (e) =>
      e.detail?.kind === "apex_commercial_event" ||
      e.detail?.kind === "apex_purchase",
  );
  const purchases = commercial.filter((e) => e.detail?.kind === "apex_purchase");

  const report = {
    at: new Date().toISOString(),
    siteId,
    phase: "A+evidence_gate",
    demand_identified: apex.demand_signals,
    evidence_level: apex.evidence_level,
    diagnosis_evidence: apex.diagnosis_evidence,
    learning_clock: apex.learning_clock,
    first_customer_mode: apex.first_customer_mode,
    product_mutation_blocked: apex.product_mutation_blocked,
    acquisition_urgency: apex.acquisition_urgency,
    primary_objective: apex.decision?.primary_objective ?? null,
    bottleneck: apex.bottleneck,
    bottleneck_detail: apex.bottleneck_detail,
    why_audience: apex.decision?.why_this_audience ?? null,
    why_channel: apex.decision?.why_this_channel ?? null,
    hypothesis: apex.decision?.expected_outcome ?? null,
    selected_action: apex.decision?.selected_action ?? null,
    counterfactual: apex.decision?.counterfactual_note ?? null,
    disconfirming_tests: apex.decision?.disconfirming_tests ?? [],
    authorized: apex.decision?.authorized ?? false,
    authorization_detail: apex.decision?.authorization_detail ?? null,
    risk_class: apex.decision?.risk_class ?? null,
    confidence: apex.decision?.confidence ?? null,
    alternatives: apex.decision?.alternatives_considered ?? [],
    trace_id: apex.trace_id,
    beliefs: state.beliefs.map((b) => ({
      statement: b.statement,
      confidence: b.confidence,
      next_falsification_test: b.next_falsification_test,
      contradicting_evidence: b.contradicting_evidence,
    })),
    qualified_traffic: {
      state_qualified_visits: state.qualified_visits,
      commercial_events_seen: commercial.length,
      note: commercial.length
        ? "commercial events present in ledger"
        : "UNKNOWN — no qualified commercial events yet",
    },
    purchase: purchases.length
      ? { count: purchases.length, detail: purchases[0]?.detail }
      : { count: 0, revenue_usd: 0, status: "UNKNOWN_OR_ZERO" },
    attribution_confidence:
      apex.decision?.confidence ?? "UNKNOWN",
    attribution_ml_applied: apex.attribution_ml_applied,
    data_quality_issues: apex.data_quality_issues,
    constitution_blocks: apex.constitution_blocks,
    what_learned: state.learning_notes.slice(0, 10),
    what_next_for_sale_2: apex.decision
      ? `Stay on FAST acquisition until stranger purchase; next limb ${apex.decision.alternatives_considered[1]?.action ?? "demand_radar_sweep"}`
      : "No decision recorded",
    pass:
      apex.ok &&
      Boolean(apex.decision) &&
      Boolean(apex.decision?.authorized) &&
      apex.demand_signals.length > 0 &&
      apex.learning_clock === "FAST_ACQUISITION" &&
      apex.product_mutation_blocked === true &&
      !String(apex.decision?.selected_action ?? "").includes("offer_clarity"),
  };

  const outDir = path.join(REPO, ".data");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(
    outDir,
    `apex-scopeguard-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, trace_file: out }, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
