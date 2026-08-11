/**
 * Canonical public storefront deployment adapter.
 *
 * Portfolio storefronts are monorepo apps under apps/{siteId}, each linked to
 * a Vercel project. Public HTML changes require source mutation + `vercel --prod`.
 *
 * /api/owner/execute is NOT the canonical publish path for CTA/checkout HTML.
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

export type DeployAdapterResult = {
  ok: boolean;
  detail: string;
  productionUrl?: string;
  buildLog?: string;
  deployLog?: string;
  rollbackDir?: string;
};

function sh(
  cmd: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

export function resolveAppDir(appRoot: string, siteId: string): string {
  return path.join(appRoot, "apps", siteId);
}

/**
 * Rewrite vendored Core relative imports so Vercel Turbopack can resolve them.
 * Scoped to apps/{siteId}/vendor only — never touches packages/revenueos.
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
      // from "./foo.js" / '../foo.js' → extensionless (Turbopack resolves .ts)
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

export function ensureVercelProjectLink(input: {
  appRoot: string;
  siteId: string;
  projectId?: string;
  orgId?: string;
}): { ok: boolean; detail: string } {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  const vercelDir = path.join(appDir, ".vercel");
  const projectPath = path.join(vercelDir, "project.json");
  if (existsSync(projectPath)) {
    return { ok: true, detail: "project.json present" };
  }
  if (input.projectId && input.orgId) {
    mkdirSync(vercelDir, { recursive: true });
    writeFileSync(
      projectPath,
      JSON.stringify(
        {
          projectId: input.projectId,
          orgId: input.orgId,
          projectName: input.siteId,
        },
        null,
        2,
      ) + "\n",
    );
    return { ok: true, detail: "wrote project.json from known ids" };
  }
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return {
      ok: false,
      detail: "missing .vercel/project.json and VERCEL_TOKEN for link",
    };
  }
  const link = sh(
    "vercel",
    ["link", "--yes", "--project", input.siteId, "--token", token],
    appDir,
  );
  if (link.status !== 0) {
    return {
      ok: false,
      detail: `vercel link failed: ${(link.stderr || link.stdout).slice(0, 240)}`,
    };
  }
  return { ok: true, detail: "vercel link ok" };
}

export function snapshotStorefrontSources(input: {
  appRoot: string;
  siteId: string;
}): string {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(
    input.appRoot,
    ".data",
    "revenueos",
    "storefront-repair",
    input.siteId,
    "snapshots",
    stamp,
  );
  mkdirSync(dest, { recursive: true });
  const files = [
    "src/app/page.tsx",
    "src/components/CheckoutButton.tsx",
    "src/app/api/checkout/route.ts",
    "src/app/robots.ts",
    "src/lib/brand.ts",
  ];
  for (const rel of files) {
    const src = path.join(appDir, rel);
    if (!existsSync(src)) continue;
    const out = path.join(dest, rel);
    mkdirSync(path.dirname(out), { recursive: true });
    copyFileSync(src, out);
  }
  writeFileSync(
    path.join(dest, "manifest.json"),
    JSON.stringify({ siteId: input.siteId, at: stamp, files }, null, 2),
  );
  return dest;
}

export function validateStorefrontBuild(input: {
  appRoot: string;
  siteId: string;
}): { ok: boolean; detail: string; log: string } {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  if (!existsSync(appDir)) {
    return { ok: false, detail: "app dir missing", log: "" };
  }
  // Pre-deploy structural validation only.
  // Do NOT run npm install inside apps/* on the Azure monorepo host — workspaces
  // install can rewrite root node_modules (operator tsx) and hang for many minutes.
  // The authoritative compile gate is `vercel --prod` remote build; if that fails,
  // prepareAndDeployStorefront returns deploy failure and we keep REPAIR_REQUIRED.
  const required = [
    "package.json",
    "src/app/page.tsx",
    "src/app/api/checkout/route.ts",
    "src/components/CheckoutButton.tsx",
  ];
  const missing = required.filter((rel) => !existsSync(path.join(appDir, rel)));
  if (missing.length) {
    return {
      ok: false,
      detail: `missing required storefront files: ${missing.join(", ")}`,
      log: missing.join("\n"),
    };
  }
  // Soft local typecheck only when nested typescript already present.
  if (existsSync(path.join(appDir, "node_modules", "typescript"))) {
    const tc = sh("npm", ["run", "typecheck"], appDir);
    const log = `${tc.stdout}\n${tc.stderr}`.slice(0, 4000);
    if (tc.status !== 0) {
      return { ok: false, detail: "typecheck failed", log };
    }
    return { ok: true, detail: "typecheck ok", log };
  }
  return {
    ok: true,
    detail: "structural validation ok; compile deferred to vercel remote build",
    log: "skipped_local_npm_install",
  };
}

export function prepareAndDeployStorefront(input: {
  appRoot: string;
  siteId: string;
}): DeployAdapterResult {
  const appDir = resolveAppDir(input.appRoot, input.siteId);
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return {
      ok: false,
      detail: "VERCEL_TOKEN not set — cannot deploy public storefront",
    };
  }
  if (!existsSync(appDir)) {
    return { ok: false, detail: `missing apps/${input.siteId}` };
  }

  const link = ensureVercelProjectLink({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });
  if (!link.ok) return { ok: false, detail: link.detail };

  const rollbackDir = snapshotStorefrontSources({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });

  const prep = sh(
    "bash",
    [path.join(input.appRoot, "scripts/prepare-portfolio-deploy.sh"), input.siteId],
    input.appRoot,
  );
  if (prep.status !== 0) {
    return {
      ok: false,
      detail: "prepare-portfolio-deploy failed",
      deployLog: (prep.stderr || prep.stdout).slice(0, 2000),
      rollbackDir,
    };
  }

  // Vercel Turbopack cannot resolve TypeScript `from "./x.js"` → `x.ts` inside
  // vendored @revenueos/core. Rewrite extensionless imports in the app vendor
  // copy only (does not modify packages/ or AI governor policy).
  sanitizeVendoredCoreImports(appDir);

  const build = validateStorefrontBuild({
    appRoot: input.appRoot,
    siteId: input.siteId,
  });
  if (!build.ok) {
    return {
      ok: false,
      detail: build.detail,
      buildLog: build.log,
      rollbackDir,
    };
  }

  // Ensure canonical URL env (best-effort; do not fail deploy if env add fails).
  const canonical = `https://${input.siteId}.vercel.app`;
  spawnSync(
    "vercel",
    ["env", "rm", "NEXT_PUBLIC_APP_URL", "production", "--yes", "--token", token],
    { cwd: appDir, encoding: "utf8" },
  );
  spawnSync(
    "vercel",
    ["env", "add", "NEXT_PUBLIC_APP_URL", "production", "--token", token],
    { cwd: appDir, encoding: "utf8", input: `${canonical}\n` },
  );

  const deploy = sh(
    "vercel",
    ["--prod", "--yes", "--token", token],
    appDir,
  );
  const deployLog = `${deploy.stdout}\n${deploy.stderr}`.slice(0, 6000);
  if (deploy.status !== 0) {
    return {
      ok: false,
      detail: "vercel --prod failed",
      buildLog: build.log,
      deployLog,
      rollbackDir,
    };
  }

  // Prefer stable project alias (e.g. storelift-alpha.vercel.app) over
  // deployment host or assumed https://{siteId}.vercel.app — that hostname
  // may belong to an unrelated Vercel project.
  const aliased =
    deployLog.match(/Aliased\s+(https:\/\/[^\s]+)/i)?.[1] ||
    deployLog.match(/Production\s+(https:\/\/[^\s]+)/i)?.[1] ||
    canonical;

  const productionUrl = (aliased || canonical).replace(/\/$/, "");

  // Best-effort: attach preferred hostname {siteId}.vercel.app to this deployment.
  // If another project owns it, Vercel fails — we keep the project alias URL.
  let preferredUrl = productionUrl;
  const aliasArgs = [
    "alias",
    "set",
    productionUrl.replace(/^https:\/\//, ""),
    `${input.siteId}.vercel.app`,
    "--token",
    token,
    "--yes",
  ];
  const aliasTry = spawnSync("vercel", aliasArgs, {
    cwd: appDir,
    encoding: "utf8",
  });
  const aliasLog = `${aliasTry.stdout || ""}\n${aliasTry.stderr || ""}`;
  if (aliasTry.status === 0) {
    preferredUrl = canonical;
  }

  return {
    ok: true,
    detail:
      aliasTry.status === 0
        ? `vercel production deploy + alias ${input.siteId}.vercel.app`
        : `vercel production deploy completed (preferred alias unavailable: ${aliasLog.slice(0, 160)})`,
    productionUrl: preferredUrl,
    buildLog: build.log,
    deployLog: `${deployLog}\n--- alias ---\n${aliasLog}`.slice(0, 8000),
    rollbackDir,
  };
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
