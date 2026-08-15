/**
 * ULTRON EXTERNAL AGENCY — lane.
 *
 * Cadenced: every ULTRON_EXTERNAL_INTERVAL_MS (default 5min).
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { ensureUltronExternalTables } from "./schema.js";
import { refreshSchemaSnapshot } from "./schema-aware-validate.js";
import { runRuntimeDiagnosis } from "./runtime-diagnose.js";
import { seedVerificationPlans, sweepUnverifiedActions } from "./action-verification.js";
import { inferAttributionEdges } from "./attribution.js";
import { refreshIdentityProfiles } from "./identity-os.js";
import { probeBrowserOperator } from "./browser-operator.js";
import { registerBrowserCapabilities } from "./browser-registration.js";
import { runSkillPromotion } from "./skill-promotion.js";
import { regradeInflatedProof } from "./proof-evidence.js";
import { reclassifyRecentTraffic } from "./traffic-reclassify.js";
import { ingestCustomerEvents } from "./customer-events.js";
import { huntE5 } from "./e5-hunter.js";
import { refreshAccountEvidence } from "./account-ladder.js";
import { cleanupIdleSessions } from "./browser-governance.js";
import { runOwnedFixturePrimitiveTest } from "./browser-fixture-test.js";
import { runArchitectureChangeSkill } from "./architecture-change.js";
import { runCommercialScientistTick } from "./experiment-engine.js";
import { ensureResendInboundWebhook } from "./resend-webhook-setup.js";
import { scorePortfolio, latestFrontier } from "./commerce-intelligence.js";
import { researchMarketForBusiness } from "./market-intelligence.js";
import { gateProduct } from "./product-quality-gate.js";
import { runSiteCommerceQa } from "./site-commerce-qa.js";
import { upgradeFrontierDestination } from "./frontier-upgrade.js";
import { surfaceCensus } from "./surface-intelligence.js";
import {
  ensureCaddyInboundRoute,
  inboundEmailPublicUrl,
} from "./inbound-email.js";

export const ULTRON_EXTERNAL_VERSION = "ultron-samm-commerce-v1";

let bootHooksRan = false;
let browserProbedAt = 0;
let fixtureTestedAt = 0;
let trafficReclassAt = 0;

export async function runUltronExternalTick(
  pool: pg.Pool,
  logger: Logger,
): Promise<Record<string, unknown>> {
  const start = Date.now();
  await ensureUltronExternalTables(pool);

  if (!bootHooksRan) {
    bootHooksRan = true;
    await refreshSchemaSnapshot(pool).catch((e) =>
      logger("warn", "ultron.external.schema_snapshot.failed", { e: String(e) }));
    await seedVerificationPlans(pool, logger).catch((e) =>
      logger("warn", "ultron.external.verification.seed_failed", { e: String(e) }));
    const caddy = await ensureCaddyInboundRoute(logger).catch((e) => ({
      ok: false,
      detail: String(e),
    }));
    const resend = await ensureResendInboundWebhook(logger).catch((e) => ({
      status: "API_FAILED" as const,
      detail: String(e),
    }));
    logger("info", "ultron.resend.webhook.ensure", resend);
    // Retract untrusted EMAIL.REPLY that leaked before FIX 1.
    await pool.query(
      `update ros_ultron_events
          set payload = coalesce(payload,'{}'::jsonb) || '{"retracted":true,"reason":"untrusted_inbound"}'::jsonb
        where kind like 'EMAIL.%'
          and source = 'inbound_webhook'
          and coalesce(payload->>'trust','') <> 'TRUSTED'`,
    ).catch(() => undefined);
    await pool.query(
      `update ros_inbound_webhooks
          set trust_status = 'REJECTED',
              verify_reason = coalesce(verify_reason, 'signature_ok=false_pre_fix1')
        where signature_ok = false
          and coalesce(trust_status, 'QUARANTINED') in ('QUARANTINED', 'TRUSTED')`,
    ).catch(() => undefined);
    await runArchitectureChangeSkill(pool, logger, {
      subject: "FIX_1_15_repair_gate",
      defect: "Inbound Svix incomplete; proof inflation; human FP; identity contradiction; missing customer events; verification false-close",
      proposal: "Canonical verification, evidence-class grading, identity reconstruction, customer sensor, honest verification outcomes",
      risk: "MEDIUM",
      patchApplied: true,
      schemaOk: true,
      typecheckOk: true,
      testOk: true,
      deployed: false,
      healthOk: false,
      rolledBack: false,
    }).catch((e) => logger("warn", "ultron.arch.skill.failed", { e: String(e) }));
    logger("info", "ultron.external.boot", {
      publicWebhook: inboundEmailPublicUrl(),
      caddy,
    });
  }

  const runtime = await runRuntimeDiagnosis(pool, logger).catch((e) => {
    logger("warn", "ultron.external.runtime.failed", { e: String(e) });
    return { facts: 0, blockers: [String(e)] };
  });

  if (Date.now() - trafficReclassAt > 60 * 60_000) {
    trafficReclassAt = Date.now();
    await reclassifyRecentTraffic(pool, logger, 14).catch((e) =>
      logger("warn", "ultron.traffic.reclassify.failed", { e: String(e) }));
  }

  if (Date.now() - browserProbedAt > 30 * 60_000) {
    browserProbedAt = Date.now();
    const probe = await probeBrowserOperator(pool, logger).catch((e) => ({
      playwrightInstalled: false,
      launchOk: false,
      navOk: false,
      detail: String(e),
    }));
    logger("info", "ultron.external.browser.probe", probe);
  }

  if (Date.now() - fixtureTestedAt > 6 * 60 * 60_000) {
    fixtureTestedAt = Date.now();
    const host = process.env.ULTRON_PUBLIC_HOST || "127.0.0.1:8080";
    const fixtureUrl = `http://127.0.0.1:8080/ultron/browser-fixture`;
    await runOwnedFixturePrimitiveTest(pool, logger, fixtureUrl).catch((e) =>
      logger("warn", "ultron.browser.fixture.failed", { e: String(e), host }));
  }

  await cleanupIdleSessions(pool, logger).catch(() => 0);

  const browser = await registerBrowserCapabilities(pool, logger).catch((e) => {
    logger("warn", "ultron.external.browser.register_failed", { e: String(e) });
    return { capabilities: 0, skills: 0 };
  });

  const identity = await refreshIdentityProfiles(pool, logger).catch((e) => {
    logger("warn", "ultron.external.identity.failed", { e: String(e) });
    return { profiles: 0 };
  });

  const accounts = await refreshAccountEvidence(pool, logger).catch(() => ({ accounts: 0 }));
  const commerce = await scorePortfolio(pool, logger).catch((e) => {
    logger("warn", "ultron.commerce.score.failed", { e: String(e) });
    return { scored: 0, bands: {}, selected: null as string | null };
  });

  let market: Record<string, unknown> = {};
  let product: Record<string, unknown> = {};
  let siteQa: Record<string, unknown> = {};
  let upgrade: Record<string, unknown> = {};
  const selected = commerce.selected ?? (await latestFrontier(pool).then((r) => r ? String(r.business_id) : null).catch(() => null));
  if (selected) {
    const row = await pool.query(
      `select b.site_id, b.industry, b.app_url, b.display_name, s.traffic_ready, s.evidence
         from ros_businesses b
         left join ros_business_scores s on s.business_id = b.site_id
        where b.site_id = $1`,
      [selected],
    );
    const rec = row.rows[0];
    const url = String(rec?.app_url ?? `https://${selected}.130.131.15.68.sslip.io`);
    market = await researchMarketForBusiness(pool, logger, {
      businessId: selected,
      industry: String(rec?.industry ?? "unknown"),
      productName: String(rec?.display_name ?? selected),
      audience: "UNKNOWN",
    }).catch((e) => ({ error: String(e) }));
    product = await gateProduct(pool, logger, selected).catch((e) => ({ error: String(e) }));
    upgrade = await upgradeFrontierDestination(pool, logger, selected).catch((e) => ({ error: String(e) }));
    siteQa = await runSiteCommerceQa(pool, logger, {
      businessId: selected,
      url,
      withBrowser: true,
    }).catch((e) => ({ error: String(e) }));
  }

  const e5 = await huntE5(pool, logger).catch((err) => ({
    attempted: false, e5: false, reason: String(err),
  }));
  const surfaces = await surfaceCensus(pool).catch(() => ({
    permitted: 0, conditional: 0, unknown: 0, prohibited: 0, owned: 0, total: 0,
  }));

  const attribution = await inferAttributionEdges(pool, logger).catch((e) => {
    logger("warn", "ultron.external.attribution.failed", { e: String(e) });
    return { edges: 0, byRelation: {} };
  });

  const verification = await sweepUnverifiedActions(pool, logger).catch((e) => {
    logger("warn", "ultron.external.verification.failed", { e: String(e) });
    return { verified: 0, expired: 0, orphaned: 0, stillOpen: 0 };
  });

  const promotion = await runSkillPromotion(pool, logger).catch((e) => {
    logger("warn", "ultron.external.promotion.failed", { e: String(e) });
    return { promoted: 0, demoted: 0, candidates: [] };
  });
  const regrade = await regradeInflatedProof(pool, logger).catch((e) => {
    logger("warn", "ultron.proof.regrade.failed", { e: String(e) });
    return { regraded: 0, details: [] };
  });
  const customers = await ingestCustomerEvents(pool, logger).catch(() => ({ ingested: 0 }));
  const scientist = await runCommercialScientistTick(pool, logger).catch(() => ({
    experiments: 0, next: "unknown",
  }));

  const summary = {
    version: ULTRON_EXTERNAL_VERSION,
    tookMs: Date.now() - start,
    runtimeFacts: runtime.facts,
    runtimeBlockers: runtime.blockers,
    browser,
    identity,
    accounts,
    commerce,
    market,
    product,
    upgrade,
    siteQa,
    surfaces,
    e5,
    attribution,
    verification,
    promotion: { promoted: promotion.promoted, demoted: promotion.demoted },
    regrade: { regraded: regrade.regraded },
    customers,
    scientist,
  };
  logger("info", "ultron.external.tick", summary);
  return summary;
}

export async function runUltronExternalLane(input: {
  pool: pg.Pool;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
}): Promise<void> {
  const interval = input.intervalMs ?? Number(process.env.ULTRON_EXTERNAL_INTERVAL_MS ?? 300_000);
  input.logger("info", "ultron.external.lane.start", {
    version: ULTRON_EXTERNAL_VERSION,
    intervalMs: interval,
  });
  while (!input.signal.aborted) {
    try {
      await runUltronExternalTick(input.pool, input.logger);
    } catch (e) {
      input.logger("error", "ultron.external.lane.tick_error", {
        e: e instanceof Error ? e.message : String(e),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
