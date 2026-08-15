/**
 * BuildManager — produce deployable static artifact.
 * Default: lightweight brand→HTML (fits small Azure VMs).
 * Optional: HOSTING_FORCE_NEXT_BUILD=1 for full Next export.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { buildStaticFromBrand } from "./static-brand-build.js";
import { nativeSiteUrl } from "./public-domain.js";

export type BuildResult =
  | {
      ok: true;
      appDir: string;
      artifactDir: string;
      version: string;
      durationMs: number;
      mode: "static";
      fingerprint?: string;
    }
  | { ok: false; error: string; durationMs: number };

export async function buildSite(input: {
  repoRoot: string;
  siteId: string;
  appRelPath: string;
  version: string;
  artifactRoot: string;
}): Promise<BuildResult> {
  const started = Date.now();
  const appDir = path.join(input.repoRoot, input.appRelPath);
  if (!existsSync(appDir)) {
    return {
      ok: false,
      error: `missing_app:${input.appRelPath}`,
      durationMs: Date.now() - started,
    };
  }

  const forceNext = process.env.HOSTING_FORCE_NEXT_BUILD === "1";
  if (!forceNext) {
    const built = buildStaticFromBrand({
      repoRoot: input.repoRoot,
      siteId: input.siteId,
      version: input.version,
      artifactRoot: input.artifactRoot,
      canonicalUrl: nativeSiteUrl(input.siteId),
    });
    if (!built.ok) {
      return {
        ok: false,
        error: built.error,
        durationMs: built.durationMs,
      };
    }
    return {
      ok: true,
      appDir,
      artifactDir: built.artifactDir,
      version: input.version,
      durationMs: built.durationMs,
      mode: "static",
      fingerprint: built.fingerprint,
    };
  }

  return {
    ok: false,
    error: "next_build_disabled_on_small_vm_set_HOSTING_FORCE_NEXT_BUILD_only_with_enough_ram",
    durationMs: Date.now() - started,
  };
}
