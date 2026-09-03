/**
 * Dual-run proof: deploy ONE low-risk business onto the hosting plane
 * while Vercel remains live. Does NOT cut public DNS.
 *
 * Usage:
 *   HOSTING_RUNTIME=process npm --workspace @revenueos/operator-service exec tsx src/tests/hosting-plane-dual-run.live.ts
 *
 * Prerequisites:
 *   - hosting-plane listening on HOSTING_PLANE_URL (default :8090)
 *   - apps/scopeguard present
 *   - Vercel ScopeGuard stays untouched
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHostingPlaneClient } from "../lib/hosting-plane-client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");
const SITE = process.env.DUAL_RUN_SITE || "scopeguard";
const VERCEL_URL =
  process.env.DUAL_RUN_VERCEL_URL ||
  "https://scopeguard-rho-jade.vercel.app";

async function main() {
  const hp = createHostingPlaneClient();
  const up = await hp.available();
  if (!up) {
    console.error(
      JSON.stringify({
        ok: false,
        detail: "hosting_plane_offline",
        hint: "npm --workspace @revenueos/hosting-plane run start",
      }),
    );
    process.exit(2);
  }

  const env: Record<string, string> = {
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1`,
  };
  // Pass through public + checkout-needed keys if present; never invent secrets.
  for (const k of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "CRON_SECRET",
  ]) {
    if (process.env[k]) env[k] = process.env[k] as string;
  }

  const deploy = await hp.deploy({
    siteId: SITE,
    appDir: `apps/${SITE}`,
    version: `dual-run-${new Date().toISOString()}`,
    reason: "dual_run_migration_candidate",
    hypothesis:
      "Self-hosted candidate can serve HTTPS-ready local runtime without taking Vercel offline",
    env,
  });

  const port = Number((deploy as { port?: number }).port || 0);
  const localUrl = port ? `http://127.0.0.1:${port}` : null;

  let localHealth: Record<string, unknown> = { ok: false };
  if (localUrl) {
    try {
      const r = await fetch(localUrl, { signal: AbortSignal.timeout(8000) });
      localHealth = { ok: r.ok || r.status < 500, status: r.status, url: localUrl };
    } catch (e) {
      localHealth = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  let vercelHealth: Record<string, unknown> = { ok: false };
  try {
    const r = await fetch(VERCEL_URL, { signal: AbortSignal.timeout(8000) });
    vercelHealth = { ok: r.ok || r.status < 500, status: r.status, url: VERCEL_URL };
  } catch (e) {
    vercelHealth = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const report = {
    at: new Date().toISOString(),
    siteId: SITE,
    deploy,
    localHealth,
    vercelHealth,
    vercelStillPrimary: true,
    dnsCutover: false,
    independenceNote:
      "Stop RevenueOSCore / Cursor — local hosting-plane process should keep serving candidate.",
    nextGates: [
      "Attach real domain on VPS gateway (not Mac public IP)",
      "Real Stripe payment against hosting candidate webhook",
      "Rollback proof",
      "24h stability",
      "Only then cut DNS from Vercel",
    ],
    pass:
      Boolean((deploy as { ok?: boolean }).ok) &&
      Boolean(localHealth.ok) &&
      Boolean(vercelHealth.ok),
  };

  const outDir = path.join(REPO, ".data");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(
    outDir,
    `hosting-dual-run-${SITE}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, trace: out }, null, 2));
  process.exit(report.pass ? 0 : 1);
}

void main();
