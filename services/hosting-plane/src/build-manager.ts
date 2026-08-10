/**
 * BuildManager — produce a deployable Next.js artifact for a site.
 * Does not route traffic. Failures → DEPLOYMENT_FAILED only.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export type BuildResult =
  | { ok: true; appDir: string; version: string; durationMs: number }
  | { ok: false; error: string; durationMs: number };

export async function buildSite(input: {
  repoRoot: string;
  siteId: string;
  appRelPath: string;
  version: string;
}): Promise<BuildResult> {
  const started = Date.now();
  const appDir = path.join(input.repoRoot, input.appRelPath);
  if (!existsSync(appDir)) {
    return { ok: false, error: `missing_app:${input.appRelPath}`, durationMs: Date.now() - started };
  }

  // Install from monorepo root so workspace hoisting resolves (e.g. @tailwindcss/postcss).
  // Installing only inside apps/<site> breaks Next CSS tooling in this repo.
  const workspaceName = `@portfolio/${input.siteId}`;
  const install = spawnSync(
    "npm",
    [
      "install",
      "--workspace",
      workspaceName,
      "--include=dev",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd: input.repoRoot,
      encoding: "utf8",
      env: { ...process.env, CI: "1" },
      timeout: 10 * 60_000,
    },
  );
  if (install.status !== 0) {
    return {
      ok: false,
      error: `install_failed:${(install.stderr || install.stdout || "").slice(0, 280)}`,
      durationMs: Date.now() - started,
    };
  }

  const build = spawnSync("npx", ["next", "build"], {
    cwd: appDir,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_PATH: [
        path.join(input.repoRoot, "node_modules"),
        path.join(appDir, "node_modules"),
        process.env.NODE_PATH ?? "",
      ]
        .filter(Boolean)
        .join(path.delimiter),
    },
    timeout: 15 * 60_000,
  });
  if (build.status !== 0) {
    return {
      ok: false,
      error: `build_failed:${(build.stderr || build.stdout || "").slice(0, 400)}`,
      durationMs: Date.now() - started,
    };
  }

  return {
    ok: true,
    appDir,
    version: input.version,
    durationMs: Date.now() - started,
  };
}
