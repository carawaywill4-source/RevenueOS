/**
 * Pre-mutation diagnosis for storefront commercial failures.
 * Prefer smallest safe repair (alias/canonical) over full rebuild when possible.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import {
  mapCommercialCode,
  newId,
  type RepairFailureCategory,
  type RepairPlan,
  type StructuredFailure,
} from "./repair-taxonomy.js";
import type { CommercialFailure } from "./commercial-readiness.js";
import { resolveCanonicalUrl } from "./commercial-readiness.js";

export type DiagnosisResult = {
  businessId: string;
  diagnosedAt: string;
  failures: StructuredFailure[];
  rootCause: string;
  smallestRepair: string;
  plan: RepairPlan;
  evidence: {
    canonicalUrl: string;
    httpStatus: number | null;
    title: string | null;
    brandDisplayName: string | null;
    identityMatch: boolean;
    hasCheckoutRouteSource: boolean;
    hasCheckoutButtonSource: boolean;
    vercelProjectLinked: boolean;
    observedCheckoutStatus: number | null;
  };
};

async function fetchMeta(url: string): Promise<{
  status: number | null;
  title: string | null;
  bodyHead: string;
}> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": "RevenueOS-repair-diagnoser/1" },
    });
    const body = (await res.text()).slice(0, 80_000);
    const title = (body.match(/<title[^>]*>([^<]+)/i) || [])[1]?.trim() ?? null;
    return { status: res.status, title, bodyHead: body.slice(0, 2000) };
  } catch {
    return { status: null, title: null, bodyHead: "" };
  }
}

function readBrandName(appRoot: string, siteId: string): string | null {
  const p = path.join(appRoot, "apps", siteId, "src/lib/brand.ts");
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, "utf8");
  const m = raw.match(/displayName"\s*:\s*"([^"]+)"/) || raw.match(/displayName:\s*"([^"]+)"/);
  return m?.[1] ?? null;
}

/**
 * Diagnose commercial gate failures into structured root cause + plan.
 */
export async function diagnoseStorefrontFailure(input: {
  pool: pg.Pool;
  appRoot: string;
  siteId: string;
  commercialFailures: CommercialFailure[];
  source?: string;
}): Promise<DiagnosisResult> {
  const siteId = input.siteId;
  const canonicalUrl = await resolveCanonicalUrl(input.pool, siteId);
  const page = await fetchMeta(canonicalUrl);
  const checkout = await fetchMeta(`${canonicalUrl.replace(/\/$/, "")}/api/checkout`);
  const brand = readBrandName(input.appRoot, siteId);
  const appDir = path.join(input.appRoot, "apps", siteId);
  const hasCheckoutRoute = existsSync(
    path.join(appDir, "src/app/api/checkout/route.ts"),
  );
  const hasCheckoutButton = existsSync(
    path.join(appDir, "src/components/CheckoutButton.tsx"),
  );
  const vercelLinked = existsSync(path.join(appDir, ".vercel/project.json"));

  const identityMatch = Boolean(
    brand &&
      page.title &&
      (page.title.toLowerCase().includes(brand.toLowerCase()) ||
        page.title.toLowerCase().includes(siteId.toLowerCase()) ||
        /Buy|instant download|CheckoutButton/i.test(page.bodyHead)),
  );

  const structured: StructuredFailure[] = [];
  const now = new Date().toISOString();

  // Identity / wrong deployment is higher priority than leaf commercial codes.
  if (page.status && page.status >= 200 && page.status < 400 && !identityMatch) {
    structured.push({
      failureId: newId("fail"),
      businessId: siteId,
      category: "WRONG_SITE_IDENTITY",
      severity: "critical",
      detectedAt: now,
      source: input.source ?? "commercial_gate",
      expected: brand ? `${brand} RevenueOS storefront` : `siteId=${siteId}`,
      observed: page.title ?? `HTTP ${page.status} unknown title`,
      url: canonicalUrl,
      httpStatus: page.status,
      evidence: {
        brand,
        title: page.title,
        bodyHead: page.bodyHead.slice(0, 400),
      },
      relatedDeployment: null,
      repairableAutomatically: true,
      repairStrategy: "RESTORE_PUBLIC_STOREFRONT",
      status: "DIAGNOSING",
    });
  }

  if (checkout.status === 404 && hasCheckoutRouteSource(hasCheckoutRoute)) {
    structured.push({
      failureId: newId("fail"),
      businessId: siteId,
      category: "CHECKOUT_ROUTE_404",
      severity: "critical",
      detectedAt: now,
      source: input.source ?? "commercial_gate",
      expected: "/api/checkout exists (non-404)",
      observed: `HTTP ${checkout.status}`,
      url: `${canonicalUrl}/api/checkout`,
      httpStatus: checkout.status,
      evidence: { hasCheckoutRouteSource: hasCheckoutRoute },
      repairableAutomatically: true,
      repairStrategy: "RESTORE_PUBLIC_STOREFRONT",
      status: "DIAGNOSING",
    });
  }

  for (const cf of input.commercialFailures) {
    const mapped = mapCommercialCode(cf.code);
    // Skip leaf duplicates when identity restore already covers them.
    if (
      structured.some((s) => s.category === "WRONG_SITE_IDENTITY") &&
      (mapped.category === "NO_CTA" ||
        mapped.category === "NO_CHECKOUT_PATH" ||
        mapped.category === "BROKEN_ANALYTICS" ||
        mapped.category === "NON_INDEXABLE")
    ) {
      continue;
    }
    structured.push({
      failureId: newId("fail"),
      businessId: siteId,
      category: mapped.category,
      severity: mapped.severity,
      detectedAt: now,
      source: input.source ?? "commercial_gate",
      expected: `commercial-readiness pass for ${cf.code}`,
      observed: cf.detail,
      url: canonicalUrl,
      httpStatus: page.status,
      evidence: { commercialCode: cf.code },
      repairableAutomatically: true,
      repairStrategy: mapped.strategy,
      status: "DIAGNOSING",
    });
  }

  if (structured.length === 0) {
    structured.push({
      failureId: newId("fail"),
      businessId: siteId,
      category: "UNKNOWN_FAILURE",
      severity: "medium",
      detectedAt: now,
      source: input.source ?? "commercial_gate",
      expected: "commercial ready",
      observed: "unclassified commercial failure",
      url: canonicalUrl,
      httpStatus: page.status,
      evidence: {},
      repairableAutomatically: true,
      repairStrategy: "RESTORE_PUBLIC_STOREFRONT",
      status: "DIAGNOSING",
    });
  }

  const primary = structured[0]!;
  const rootCause = !identityMatch
    ? `Public URL serves wrong identity (title="${page.title}") vs brand "${brand}"; source app has buyer surface=${hasCheckoutButton && hasCheckoutRoute}`
    : primary.observed;

  const smallestRepair =
    primary.category === "WRONG_SITE_IDENTITY" ||
    primary.category === "CHECKOUT_ROUTE_404" ||
    primary.category === "WRONG_DEPLOYMENT"
      ? "RESTORE_PUBLIC_STOREFRONT"
      : primary.repairStrategy;

  const plan: RepairPlan = {
    repairPlanId: newId("plan"),
    businessId: siteId,
    failureIds: structured.map((f) => f.failureId),
    repairType: smallestRepair,
    steps: [
      "snapshot local storefront sources",
      "ensure CheckoutButton + /api/checkout in apps/{siteId}",
      "prepare-portfolio-deploy + sanitize vendored imports",
      "native Azure hosting-plane deploy",
      "prefer native public URL; update ros_businesses.app_url",
      "attempt native site route when safe",
      "public verify + commercial-readiness-v1",
    ],
    risk: "medium",
    expectedOutcome:
      "Public buyer path: offer, CTA, checkout, analytics, robots; commercial gate PASS",
    rollbackPlan: "restore source snapshot; redeploy previous if needed",
    requiresSpend: false,
    requiresHuman: false,
    createdAt: now,
  };

  for (const f of structured) f.status = "PLANNED";

  return {
    businessId: siteId,
    diagnosedAt: now,
    failures: structured,
    rootCause,
    smallestRepair,
    plan,
    evidence: {
      canonicalUrl,
      httpStatus: page.status,
      title: page.title,
      brandDisplayName: brand,
      identityMatch,
      hasCheckoutRouteSource: hasCheckoutRoute,
      hasCheckoutButtonSource: hasCheckoutButton,
      vercelProjectLinked: vercelLinked,
      observedCheckoutStatus: checkout.status,
    },
  };
}

function hasCheckoutRouteSource(v: boolean): boolean {
  return v;
}

export function primaryCategory(
  failures: StructuredFailure[],
): RepairFailureCategory {
  return failures[0]?.category ?? "UNKNOWN_FAILURE";
}
