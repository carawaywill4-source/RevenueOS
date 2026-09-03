/**
 * Native Azure storefront deployment adapter.
 *
 * HISTORICAL NAME kept for import stability. Implementation no longer calls Vercel.
 * Deploy path: prepare → hosting-plane static build → Caddy route → verify.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createHostingPlaneClient } from "./hosting-plane-client.js";

export type DeployAdapterResult = {
  ok: boolean;
  detail: string;
  productionUrl?: string;
  buildLog?: string;
  deployLog?: string;
  rollbackDir?: string;
  failureClass?:
    | "CODE_FAILED"
    | "BUILD_FAILED"
    | "NATIVE_DEPLOY_FAILED"
    | "COMMERCIAL_VERIFY_FAILED"
    | "HOSTING_PLANE_UNAVAILABLE";
};

function nativePublicBaseHost(): string {
  return (
    process.env.HOSTING_PUBLIC_BASE_HOST ||
    process.env.REVENUEOS_PUBLIC_BASE_HOST ||
    "130.131.15.68.sslip.io"
  );
}

export function nativeSiteUrl(siteId: string): string {
  return `https://${siteId}.${nativePublicBaseHost()}`;
}

export function resolveAppDir(appRoot: string, siteId: string): string {
  return path.join(appRoot, "apps", siteId);
}

/** @deprecated Vercel project link — no-op. Native hosting does not use Vercel. */
export function ensureVercelProjectLink(_input: {
  appRoot: string;
  siteId: string;
  projectId?: string;
  orgId?: string;
}): { ok: boolean; detail: string } {
  return { ok: true, detail: "vercel_link_disabled_native_azure" };
}

/**
 * Rewrite vendored Core relative imports (kept for Next static build).
 */
export function sanitizeVendoredCoreImports(appDir: string): {
  patchedFiles: number;
} {
  const modulesDir = path.join(appDir, "vendor", "revenueos", "src", "modules");
  if (!existsSync(modulesDir)) return { patchedFiles: 0 };
  let patchedFiles = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
      const before = readFileSync(full, "utf8");
      const after = before.replace(
        /(from\s+["'])(\.\.?\/[^"']+)\.js(["'])/g,
        "$1$2$3",
      );
      if (after !== before) {
        writeFileSync(full, after);
        patchedFiles += 1;
      }
    }
  };
  walk(modulesDir);
  return { patchedFiles };
}

export function snapshotStorefrontSources(input: {
  appRoot: string;
  siteId: string;
}): string {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rollbackDir = path.join(
    input.appRoot,
    ".data",
    "revenueos",
    "storefront-snapshots",
    input.siteId,
    stamp,
  );
  mkdirSync(rollbackDir, { recursive: true });
  const files = ["src/app/page.tsx", "src/lib/brand.ts", "src/components/CheckoutButton.tsx"];
  const saved: string[] = [];
  for (const rel of files) {
    const src = path.join(appDir, rel);
    if (!existsSync(src)) continue;
    const dest = path.join(rollbackDir, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    saved.push(rel);
  }
  writeFileSync(
    path.join(rollbackDir, "manifest.json"),
    JSON.stringify({ files: saved, at: new Date().toISOString() }, null, 2),
  );
  return rollbackDir;
}

export function restoreSnapshot(input: {
  appRoot: string;
  siteId: string;
  rollbackDir: string;
}): { ok: boolean; detail: string } {
  if (!existsSync(input.rollbackDir)) {
    return { ok: false, detail: "rollback dir missing" };
  }
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  const manifestPath = path.join(input.rollbackDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, detail: "rollback manifest missing" };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    files: string[];
  };
  for (const rel of manifest.files ?? []) {
    const src = path.join(input.rollbackDir, rel);
    if (!existsSync(src)) continue;
    const dest = path.join(appDir, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  return { ok: true, detail: `restored snapshot from ${input.rollbackDir}` };
}

export function validateStorefrontBuild(input: {
  appRoot: string;
  siteId: string;
}): { ok: boolean; detail: string; log?: string } {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  if (!existsSync(appDir)) {
    return { ok: false, detail: `missing apps/${input.siteId}` };
  }
  if (!existsSync(path.join(appDir, "src/app/page.tsx"))) {
    return { ok: false, detail: "missing page.tsx" };
  }
  return { ok: true, detail: "structural ok — build delegated to hosting-plane" };
}

/**
 * Deploy storefront via RevenueOS Hosting Plane (Azure native).
 * NEVER invokes vercel CLI / Vercel API.
 */
export function prepareAndDeployStorefront(input: {
  appRoot: string;
  siteId: string;
}): DeployAdapterResult {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  if (!existsSync(appDir)) {
    return {
      ok: false,
      detail: `missing apps/${input.siteId}`,
      failureClass: "CODE_FAILED",
    };
  }

  const rollbackDir = snapshotStorefrontSources({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });

  sanitizeVendoredCoreImports(appDir);

  const prep = spawnSync(
    "bash",
    [path.join(input.appRoot, "scripts/prepare-portfolio-deploy.sh"), input.siteId],
    {
      cwd: input.appRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (prep.status !== 0) {
    return {
      ok: false,
      detail: "prepare-portfolio-deploy failed",
      deployLog: (prep.stderr || prep.stdout).slice(0, 2000),
      rollbackDir,
      failureClass: "BUILD_FAILED",
    };
  }

  const hp = createHostingPlaneClient();
  // Synchronous bridge: hosting plane deploy is async HTTP — use spawn of curl-like via deasync alternative:
  // Node fetch in sync context — use spawnSync to a tiny helper OR Atomics wait.
  // Prefer child process invoking tsx one-shot for reliability in sync callers.
  // Inline deploy via node -e using fetch (Node 20+)
  const domain = `${input.siteId}.${nativePublicBaseHost()}`;
  const productionUrl = nativeSiteUrl(input.siteId);
  const script = `
const token = process.env.HOSTING_PLANE_TOKEN || process.env.CRON_SECRET || '';
const base = process.env.HOSTING_PLANE_URL || 'http://127.0.0.1:8090';
const headers = { 'content-type': 'application/json' };
if (token) headers.authorization = 'Bearer ' + token;
const health = await fetch(base + '/healthz', { signal: AbortSignal.timeout(3000) }).catch(() => null);
if (!health || !health.ok) {
  console.log(JSON.stringify({ ok:false, detail:'hosting_plane_unavailable', failureClass:'HOSTING_PLANE_UNAVAILABLE' }));
  process.exit(2);
}
const res = await fetch(base + '/deploy', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    siteId: ${JSON.stringify(input.siteId)},
    appDir: ${JSON.stringify(`apps/${input.siteId}`)},
    version: new Date().toISOString(),
    reason: 'native_storefront_deploy',
    domain: ${JSON.stringify(domain)},
    env: {
      NEXT_PUBLIC_APP_URL: ${JSON.stringify(productionUrl)},
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
    },
  }),
  signal: AbortSignal.timeout(20 * 60_000),
});
const body = await res.json().catch(() => ({}));
console.log(JSON.stringify({ httpStatus: res.status, ...body }));
process.exit(body.ok ? 0 : 3);
`;
  const deploy = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      cwd: input.appRoot,
      encoding: "utf8",
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 21 * 60_000,
    },
  );
  const deployLog = `${deploy.stdout}\n${deploy.stderr}`.slice(0, 8000);
  let parsed: Record<string, unknown> = {};
  try {
    const line = (deploy.stdout || "")
      .trim()
      .split("\n")
      .filter(Boolean)
      .pop();
    parsed = line ? (JSON.parse(line) as Record<string, unknown>) : {};
  } catch {
    parsed = {};
  }

  if (deploy.status === 2 || parsed.failureClass === "HOSTING_PLANE_UNAVAILABLE") {
    return {
      ok: false,
      detail: "hosting plane unavailable — start revenueos-hosting-plane",
      deployLog,
      rollbackDir,
      failureClass: "HOSTING_PLANE_UNAVAILABLE",
    };
  }

  if (!parsed.ok) {
    const detail = String(parsed.detail ?? "native deploy failed");
    const failureClass = detail.startsWith("BUILD_FAILED")
      ? "BUILD_FAILED"
      : detail.startsWith("COMMERCIAL_VERIFY")
        ? "COMMERCIAL_VERIFY_FAILED"
        : "NATIVE_DEPLOY_FAILED";
    return {
      ok: false,
      detail,
      deployLog,
      rollbackDir,
      failureClass,
    };
  }

  const url = String(parsed.publicUrl ?? productionUrl).replace(/\/$/, "");
  return {
    ok: true,
    detail: "native_azure_static_deploy",
    productionUrl: url,
    deployLog,
    rollbackDir,
  };
}
