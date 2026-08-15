/**
 * Gumroad marketplace executor.
 *
 * Contract for the executor-bridge:
 *   input:  { experiment, missionId, appRoot }
 *   output: { verified: true, publicUrl, externalId, evidence } on success,
 *           { verified: false, error, evidence }                on failure.
 *
 * Success requires:
 *   1. Gumroad API accepts the product create/list call.
 *   2. A public URL is returned.
 *   3. That URL responds with HTTP 200 unauthenticated (external HTTP proof).
 *
 * A local file write is NOT success. A Gumroad API 200 with a URL that
 * doesn't actually load publicly is NOT success. Both must hold.
 */

import { executeGumroadProductSync, hasGumroadCreds } from "@revenueos/core";
import type { CommercialExperiment } from "@revenueos/core";

export type MarketplaceExecutorResult = {
  ok: boolean;
  externalActionType: "gumroad_product_publish";
  publicUrl?: string;
  externalId?: string;
  verificationMethod: "PROVIDER_RECEIPT" | "PUBLIC_HTTP" | "NONE";
  verified: boolean;
  evidence: Record<string, unknown>;
  error?: string;
};

/**
 * Simple public reachability probe. Follows redirects (Gumroad short URLs
 * redirect to a hosted product page). Any 2xx counts as reachable.
 */
async function verifyPublic(url: string): Promise<{
  reachable: boolean;
  status?: number;
  finalUrl?: string;
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
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    const text = await res.text().catch(() => "");
    return {
      reachable: res.ok,
      status: res.status,
      finalUrl: res.url,
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

const PRODUCT_DEFAULTS: Record<
  string,
  { name: string; description: string; url: string; priceUsd: number }
> = {
  buildgrid: {
    name: "BuildGrid — RFI Log Lite (Free preview pack)",
    description:
      "A working RFI log spreadsheet + submittal tracker preview from BuildGrid. Free download so you can see the format before paying for the full pack. Real deliverables. No logins. No subscriptions.",
    url: "https://buildgrid.example",
    priceUsd: 0,
  },
  invoicechaser: {
    name: "InvoiceChaser — 3-email nudge pack (Free preview)",
    description:
      "The three plain-English follow-up emails InvoiceChaser sends before an invoice ages past 30 days. Paste into your billing sequence today.",
    url: "https://invoicechaser.example",
    priceUsd: 0,
  },
  resumeforge: {
    name: "ResumeForge — Career pivot resume kit (Free preview)",
    description:
      "Two resume templates from ResumeForge tuned for career pivots (individual contributor → manager, IC → founder). Yours as .docx.",
    url: "https://resumeforge.example",
    priceUsd: 0,
  },
};

function buildProductInput(experiment: CommercialExperiment): {
  productName: string;
  productDescription: string;
  productUrl: string;
  priceUsd: number;
} {
  const key = experiment.businessId?.trim() || "buildgrid";
  const defaults = PRODUCT_DEFAULTS[key] ?? PRODUCT_DEFAULTS.buildgrid;
  const offerHint = experiment.offer?.trim();
  const hypothesis = experiment.hypothesis?.trim();
  const description = [
    defaults.description,
    offerHint ? `\n\nOffer: ${offerHint}` : "",
    hypothesis ? `\n\nWhy this exists: ${hypothesis}` : "",
  ]
    .join("")
    .trim();
  return {
    productName: defaults.name,
    productDescription: description.slice(0, 2000),
    productUrl: defaults.url,
    priceUsd: defaults.priceUsd,
  };
}

export async function executeGumroadMarketplaceExperiment(input: {
  experiment: CommercialExperiment;
  appRoot: string;
  logger: (
    level: "info" | "warn" | "error",
    event: string,
    payload: Record<string, unknown>,
  ) => void;
}): Promise<MarketplaceExecutorResult> {
  if (!hasGumroadCreds()) {
    return {
      ok: false,
      externalActionType: "gumroad_product_publish",
      verificationMethod: "NONE",
      verified: false,
      evidence: { reason: "no_gumroad_access_token" },
      error: "no_gumroad_access_token",
    };
  }
  const productInput = buildProductInput(input.experiment);
  input.logger("info", "executor.gumroad.publish.start", {
    experimentId: input.experiment.id,
    businessId: input.experiment.businessId,
    productName: productInput.productName,
  });
  const sync = await executeGumroadProductSync({
    rootDir: input.appRoot,
    siteId: input.experiment.businessId || "buildgrid",
    productName: productInput.productName,
    productDescription: productInput.productDescription,
    productUrl: productInput.productUrl,
    priceUsd: productInput.priceUsd,
  });
  if (!sync.ok || !sync.url) {
    return {
      ok: false,
      externalActionType: "gumroad_product_publish",
      verificationMethod: "NONE",
      verified: false,
      evidence: { sync },
      error: sync.detail,
    };
  }
  // Publisher accepted us; now prove the URL is publicly reachable.
  const reachable = await verifyPublic(sync.url);
  if (!reachable.reachable) {
    return {
      ok: false,
      externalActionType: "gumroad_product_publish",
      publicUrl: sync.url,
      verificationMethod: "PROVIDER_RECEIPT",
      verified: false,
      evidence: { sync, reachable },
      error: `public_url_unreachable: status=${reachable.status ?? "n/a"} ${reachable.error ?? ""}`.trim(),
    };
  }
  input.logger("info", "executor.gumroad.publish.verified", {
    experimentId: input.experiment.id,
    publicUrl: sync.url,
    status: reachable.status,
    distributionClassification: "LIMITED",
    distributionNote:
      "Gumroad Discover does not automatically surface fresh listings. Public URL is externally accessible but not a stranger-facing discovery surface. External action = YES, Distribution opportunity = LIMITED. No DistributionReceipt emitted.",
  });
  return {
    ok: true,
    externalActionType: "gumroad_product_publish",
    publicUrl: reachable.finalUrl ?? sync.url,
    externalId: sync.url.split("/").pop(),
    verificationMethod: "PUBLIC_HTTP",
    verified: true,
    evidence: {
      providerDetail: sync.detail,
      httpStatus: reachable.status,
      finalUrl: reachable.finalUrl,
      bodySample: reachable.bodySample,
      distributionClassification: "LIMITED",
      distributionRationale:
        "Fresh Gumroad listings are not automatically surfaced by Gumroad Discover; publication alone does not create a discovery surface.",
    },
    // NOTE: intentionally no `distribution` field. Bridge will NOT write a
    // DistributionReceipt for this executor unless/until Gumroad Discover
    // eligibility is proven, or an external channel (Pinterest, Etsy,
    // email, etc.) points at the URL. This is per the "storefront is not
    // distribution" rule extended to any surface that does not itself
    // deliver strangers.
  };
}
