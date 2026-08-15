/**
 * One-shot commercial readiness report (non-destructive).
 * Usage: DATABASE_URL=... tsx services/operator/src/scripts/commercial-gate-report.ts
 */
import pg from "pg";
import {
  ADMISSION_GATE_VERSION,
  assessCommercialReadiness,
  auditManagedBusinesses,
  admissionAllowed,
} from "../lib/commercial-readiness.js";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const pool = new pg.Pool({ connectionString: url });
  try {
    const cpRes = await pool.query(
      `select value from ros_config_meta where key='admit_rollout_checkpoint'`,
    );
    const cp = (cpRes.rows[0]?.value ?? {}) as {
      titanManaged?: string[];
      currentCandidate?: string | null;
      phase?: string;
      healthyMsAccumulated?: number;
      probationMinutes?: number;
      pauseNewAdmissions?: boolean;
    };
    const managed = Array.isArray(cp.titanManaged) ? cp.titanManaged : [];
    const results = await auditManagedBusinesses({
      pool,
      siteIds: managed,
    });

    const menuGate = await assessCommercialReadiness({
      siteId: "menumoney",
      pool,
    });

    const report = {
      ADMISSION_GATE_VERSION,
      TITAN_MANAGED: managed,
      CURRENT_PROBATION: {
        siteId: cp.currentCandidate ?? null,
        phase: cp.phase ?? null,
        healthyMsAccumulated: cp.healthyMsAccumulated ?? 0,
        probationMinutes: cp.probationMinutes ?? 15,
      },
      ROLLOUT_ADVANCING: cp.pauseNewAdmissions !== true,
      COMMERCIAL_READY_COUNT: results.filter((r) => r.status === "READY").length,
      REPAIR_REQUIRED_COUNT: results.filter((r) => r.status === "REPAIR_REQUIRED")
        .length,
      MANAGED_ROWS: results.map((r) => ({
        BUSINESS: r.siteId,
        HTTP: r.checks.http,
        OFFER: r.checks.offer,
        CTA: r.checks.cta,
        CHECKOUT_PATH: r.checks.checkoutPath,
        ANALYTICS: r.checks.analytics,
        INDEXABILITY: r.checks.indexability,
        CANONICAL_URL: r.canonicalUrl,
        STATUS: r.status,
        FAILURES: r.failures.map((f) => f.code),
      })),
      MENUMONEY_COMMERCIAL_GATE: {
        ready: menuGate.ready,
        admissionAllowed: admissionAllowed(menuGate),
        status: menuGate.status,
        failures: menuGate.failures,
        checks: menuGate.checks,
        canonicalUrl: menuGate.canonicalUrl,
        evidence: menuGate.evidence,
      },
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
