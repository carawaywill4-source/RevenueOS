/**
 * Storefront evolution executor.
 *
 * Deploys a materially different landing-page copy to the hosting-plane and
 * externally verifies that the new copy is present at the public URL. This
 * is the "engineering as commercial experiment" pattern: it must produce a
 * publicly-verifiable change, not just a local file mutation.
 *
 * Verification: PUBLIC_HTTP fetch of the site's root; the response body
 * must contain the new headline substring. If the site is unreachable or
 * the body doesn't reflect the mutation, we return verified=false.
 */

import type pg from "pg";
import type { CommercialExperiment } from "@revenueos/core";
import { createHostingPlaneClient } from "../../hosting-plane-client.js";
import {
  evolveCopyFromBrand,
  evolveStorefrontForSale,
} from "../../commercial-execution-v4/storefront-evolve.js";

export type StorefrontExecutorResult = {
  ok: boolean;
  externalActionType: "storefront_public_deploy";
  publicUrl?: string;
  externalId?: string;
  verificationMethod: "PUBLIC_HTTP" | "PLATFORM_API" | "NONE";
  verified: boolean;
  evidence: Record<string, unknown>;
  error?: string;
};

function siteHost(): string {
  return (
    process.env.HOSTING_PUBLIC_BASE_HOST ||
    process.env.REVENUEOS_PUBLIC_BASE_HOST ||
    "130.131.15.68.sslip.io"
  );
}

function publicUrlFor(siteId: string): string {
  return `https://${siteId}.${siteHost()}/`;
}

async function verifyContains(url: string, needle: string): Promise<{
  reachable: boolean;
  status?: number;
  contains?: boolean;
  bodySample?: string;
  error?: string;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "RevenueOS-external-verifier/0.1 (+https://revenueos.local)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const text = await res.text().catch(() => "");
    const lc = text.toLowerCase();
    const contains = needle ? lc.includes(needle.toLowerCase()) : true;
    return {
      reachable: res.ok,
      status: res.status,
      contains,
      bodySample: text.slice(0, 400),
    };
  } catch (err) {
    return {
      reachable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function executeStorefrontEvolutionExperiment(input: {
  experiment: CommercialExperiment;
  pool: pg.Pool;
  logger: (
    level: "info" | "warn" | "error",
    event: string,
    payload: Record<string, unknown>,
  ) => void;
}): Promise<StorefrontExecutorResult> {
  const businessId = input.experiment.businessId?.trim() || "buildgrid";
  const priceUsd = 29;
  input.logger("info", "executor.storefront.evolve.start", {
    experimentId: input.experiment.id,
    businessId,
  });
  const evolution = await evolveStorefrontForSale({
    pool: input.pool,
    logger: (lvl, event, payload) => input.logger(lvl, event, payload ?? {}),
    businessId,
    purchases: 0,
  });
  // Determine the new headline we'll look for in the public HTML.
  const copy = evolveCopyFromBrand(businessId, priceUsd);
  const needle = (copy.headline || "").slice(0, 24);
  // Deploy via hosting-plane.
  const hosting = createHostingPlaneClient();
  const available = await hosting.available().catch(() => false);
  if (!available) {
    return {
      ok: false,
      externalActionType: "storefront_public_deploy",
      publicUrl: publicUrlFor(businessId),
      verificationMethod: "NONE",
      verified: false,
      evidence: { evolution, hostingPlaneAvailable: false },
      error: "hosting_plane_unavailable",
    };
  }
  const deployReason = input.experiment.hypothesis?.slice(0, 200) || "mission_experiment";
  const deployRes = await hosting
    .deploy({
      siteId: businessId,
      reason: deployReason,
      hypothesis: input.experiment.hypothesis?.slice(0, 500),
    })
    .catch((err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  input.logger("info", "executor.storefront.deploy.response", {
    experimentId: input.experiment.id,
    businessId,
    deployRes,
  });
  const url = publicUrlFor(businessId);
  // Give the deploy a moment to become live.
  await new Promise((r) => setTimeout(r, 3_000));
  const verification = await verifyContains(url, needle);
  if (!verification.reachable) {
    return {
      ok: false,
      externalActionType: "storefront_public_deploy",
      publicUrl: url,
      verificationMethod: "PLATFORM_API",
      verified: false,
      evidence: { evolution, deployRes, verification, needle },
      error: `site_unreachable: status=${verification.status ?? "n/a"} ${verification.error ?? ""}`.trim(),
    };
  }
  const verified = Boolean(verification.contains);
  input.logger(verified ? "info" : "warn", "executor.storefront.evolve.verify", {
    experimentId: input.experiment.id,
    url,
    status: verification.status,
    contains: verification.contains,
    needle,
  });
  return {
    ok: verified,
    externalActionType: "storefront_public_deploy",
    publicUrl: url,
    externalId: businessId,
    verificationMethod: "PUBLIC_HTTP",
    verified,
    evidence: { evolution, deployRes, verification, needle },
    error: verified
      ? undefined
      : `public_html_missing_needle: needle="${needle}"`,
  };
}
