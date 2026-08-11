/**
 * Commercial readiness gate for admission + TITAN_MANAGED audit.
 *
 * System health (15m probation) is necessary but NOT sufficient.
 * A business must also be publicly sellable before TITAN_MANAGED.
 *
 * Never performs a real charge — only safe path/session probes.
 */

import type pg from "pg";

export const ADMISSION_GATE_VERSION = "commercial-readiness-v1";
export const COMMERCIAL_AUDIT_KEY = "commercial_readiness_audit";
export const COMMERCIAL_REPAIR_QUEUE_KEY = "commercial_repairs_queue";

export type CommercialFailureCode =
  | "NO_PUBLIC_STOREFRONT"
  | "NO_COMMERCIAL_OFFER"
  | "NO_CTA"
  | "BROKEN_CTA"
  | "NO_CHECKOUT_PATH"
  | "BROKEN_CHECKOUT"
  | "NO_PRICE_OR_PURCHASE_INSTRUCTIONS"
  | "BROKEN_ANALYTICS"
  | "WRONG_CANONICAL_URL"
  | "NON_INDEXABLE"
  | "STALE_DEPLOYMENT";

export type CommercialCheckSnapshot = {
  http: "pass" | "fail" | "unknown";
  offer: "pass" | "fail" | "unknown";
  cta: "pass" | "fail" | "unknown";
  checkoutPath: "pass" | "fail" | "unknown";
  analytics: "pass" | "fail" | "unknown";
  indexability: "pass" | "fail" | "unknown";
  canonicalUrl: "pass" | "fail" | "unknown";
};

export type CommercialFailure = {
  code: CommercialFailureCode;
  detail: string;
};

export type CommercialReadinessResult = {
  siteId: string;
  assessedAt: string;
  gateVersion: string;
  canonicalUrl: string;
  ready: boolean;
  status: "READY" | "REPAIR_REQUIRED" | "NOT_APPLICABLE";
  notApplicableReason?: string;
  failures: CommercialFailure[];
  checks: CommercialCheckSnapshot;
  /** 1 = buyer/payment path … 5 = cosmetic */
  repairPriority: number;
  evidence: {
    httpStatus: number | null;
    finalUrl: string | null;
    title: string | null;
    ctaHref: string | null;
    checkoutHref: string | null;
    hasPrice: boolean;
    robotsStatus: number | null;
    robotsDisallowAll: boolean;
  };
};

export type CommercialRepairItem = {
  siteId: string;
  queuedAt: string;
  failures: CommercialFailure[];
  priority: number;
  attempts: number;
  lastAttemptAt: string | null;
  status: "queued" | "in_progress" | "completed" | "blocked";
  note?: string;
};

const CTA_RE =
  /\b(buy|purchase|get\s*started|start\s*now|checkout|order\s*now|subscribe|claim|unlock|pay|pricing|add\s*to\s*cart|get\s*access)\b/i;
const OFFER_RE =
  /\b(pricing|price|plan|\$\s?\d|\d+\s*usd|per\s*month|one[- ]time|license|product)\b/i;
const CHECKOUT_HREF_RE =
  /(?:\/api\/checkout|\/checkout|buy\.stripe\.com|checkout\.stripe\.com|billing\.stripe\.com|lemonsqueezy\.com|gumroad\.com|\/\/pay\.|action=checkout)/i;
const ANALYTICS_RE =
  /(?:google-analytics|gtag\(|googletagmanager|plausible\.io|segment\.com|posthog|mixpanel|revenueos[_-]?beacon|\/api\/beacon|data-revenueos|analytics\.js|va\.vercel-scripts)/i;
const STALE_RE =
  /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|vercel\.app\/.*-[a-f0-9]{7,}|\.vercel\.app\/_next\/static\/development/i;

function defaultCanonicalUrl(siteId: string): string {
  return `https://${siteId}.vercel.app`;
}

export async function resolveCanonicalUrl(
  pool: pg.Pool | null,
  siteId: string,
): Promise<string> {
  if (pool) {
    try {
      const res = await pool.query(
        `select app_url from ros_businesses where site_id=$1`,
        [siteId],
      );
      const url = String(res.rows[0]?.app_url ?? "").trim();
      if (/^https?:\/\//i.test(url) && !/localhost|127\.0\.0\.1/i.test(url)) {
        return url.replace(/\/$/, "");
      }
    } catch {
      /* fall through */
    }
  }
  return defaultCanonicalUrl(siteId);
}

async function fetchText(
  url: string,
  timeoutMs = 12_000,
): Promise<{
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  body: string;
  error?: string;
}> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent": `RevenueOS-commercial-gate/${ADMISSION_GATE_VERSION}`,
        accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text();
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      finalUrl: res.url,
      body: body.slice(0, 250_000),
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      finalUrl: null,
      body: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim().slice(0, 160) ?? null;
}

function extractLinks(
  html: string,
  baseUrl: string,
): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  const re =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 80) {
    const rawHref = m[1]!.trim();
    const text = m[2]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    try {
      const abs = new URL(rawHref, baseUrl).toString();
      out.push({ href: abs, text });
    } catch {
      /* skip bad href */
    }
  }
  // Also button-like forms
  const formRe =
    /<form\b[^>]*action\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = formRe.exec(html)) && out.length < 100) {
    try {
      out.push({
        href: new URL(m[1]!.trim(), baseUrl).toString(),
        text: "form",
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Safe path existence: 2xx/3xx, or API method/auth rejects (not 404/5xx). */
function pathLooksAlive(status: number | null): boolean {
  if (status == null) return false;
  if (status === 404 || status >= 500) return false;
  // 405/400/401/403/402/409/422 often mean checkout route exists without charging.
  return true;
}

function pickCta(
  links: Array<{ href: string; text: string }>,
  html: string,
  canonicalUrl: string,
): { href: string; text: string } | null {
  for (const l of links) {
    if (CTA_RE.test(l.text) || CHECKOUT_HREF_RE.test(l.href)) return l;
  }
  for (const l of links) {
    if (CHECKOUT_HREF_RE.test(l.href)) return l;
  }
  // Button CTAs (RevenueOS storefronts often use <button>, not <a>).
  const btnRe = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  let m: RegExpExecArray | null;
  while ((m = btnRe.exec(html))) {
    const text = stripTags(m[1] ?? "");
    if (CTA_RE.test(text)) {
      return {
        href: `${canonicalUrl.replace(/\/$/, "")}/api/checkout`,
        text,
      };
    }
  }
  // data-cta attributes
  const dataCta = html.match(
    /data-(?:cta|checkout)(?:-href|-url)?\s*=\s*["']([^"']+)["']/i,
  );
  if (dataCta?.[1]) {
    try {
      return {
        href: new URL(dataCta[1], canonicalUrl).toString(),
        text: "data-cta",
      };
    } catch {
      /* ignore */
    }
  }
  return null;
}

function pickCheckoutHref(
  links: Array<{ href: string; text: string }>,
  html: string,
): string | null {
  for (const l of links) {
    if (CHECKOUT_HREF_RE.test(l.href)) return l.href;
  }
  const m = html.match(
    /(?:href|action|data-checkout-url)\s*=\s*["']([^"']*(?:checkout|stripe|gumroad|lemonsqueezy)[^"']*)["']/i,
  );
  return m?.[1] ?? null;
}

function repairPriorityFor(failures: CommercialFailure[]): number {
  const codes = new Set(failures.map((f) => f.code));
  if (
    codes.has("NO_CHECKOUT_PATH") ||
    codes.has("BROKEN_CHECKOUT") ||
    codes.has("NO_PUBLIC_STOREFRONT")
  ) {
    return 1;
  }
  if (codes.has("NO_CTA") || codes.has("BROKEN_CTA")) return 2;
  if (codes.has("WRONG_CANONICAL_URL") || codes.has("STALE_DEPLOYMENT")) {
    return 3;
  }
  if (codes.has("BROKEN_ANALYTICS")) return 4;
  if (codes.has("NON_INDEXABLE") || codes.has("NO_COMMERCIAL_OFFER")) return 5;
  if (codes.has("NO_PRICE_OR_PURCHASE_INSTRUCTIONS")) return 5;
  return 5;
}

/**
 * Assess public commercial readiness for one business.
 * Safe: no real payment is completed.
 */
export async function assessCommercialReadiness(input: {
  siteId: string;
  canonicalUrl?: string;
  pool?: pg.Pool | null;
}): Promise<CommercialReadinessResult> {
  const siteId = input.siteId;
  const canonicalUrl = (
    input.canonicalUrl ?? (await resolveCanonicalUrl(input.pool ?? null, siteId))
  ).replace(/\/$/, "");
  const assessedAt = new Date().toISOString();
  const failures: CommercialFailure[] = [];
  const checks: CommercialCheckSnapshot = {
    http: "unknown",
    offer: "unknown",
    cta: "unknown",
    checkoutPath: "unknown",
    analytics: "unknown",
    indexability: "unknown",
    canonicalUrl: "unknown",
  };

  if (STALE_RE.test(canonicalUrl) || /localhost|127\.0\.0\.1/i.test(canonicalUrl)) {
    failures.push({
      code: "WRONG_CANONICAL_URL",
      detail: `canonical URL is not a public production host: ${canonicalUrl}`,
    });
    checks.canonicalUrl = "fail";
  } else if (!canonicalUrl.toLowerCase().includes(siteId.toLowerCase())) {
    // Soft warning — many brands use custom domains; only fail if clearly wrong preview.
    checks.canonicalUrl = "pass";
  } else {
    checks.canonicalUrl = "pass";
  }

  const page = await fetchText(canonicalUrl);
  const evidence = {
    httpStatus: page.status,
    finalUrl: page.finalUrl,
    title: page.body ? extractTitle(page.body) : null,
    ctaHref: null as string | null,
    checkoutHref: null as string | null,
    hasPrice: false,
    robotsStatus: null as number | null,
    robotsDisallowAll: false,
  };

  if (!page.ok) {
    failures.push({
      code: "NO_PUBLIC_STOREFRONT",
      detail: page.error
        ? `fetch failed: ${page.error}`
        : `HTTP ${page.status ?? "?"} for ${canonicalUrl}`,
    });
    checks.http = "fail";
    return finalize(siteId, assessedAt, canonicalUrl, failures, checks, evidence);
  }
  checks.http = "pass";

  if (
    STALE_RE.test(page.body) ||
    (page.finalUrl && STALE_RE.test(page.finalUrl))
  ) {
    failures.push({
      code: "STALE_DEPLOYMENT",
      detail: "page or final URL references localhost/stale preview markers",
    });
  }

  const html = page.body;
  const base = page.finalUrl || canonicalUrl;
  const links = extractLinks(html, base);
  const hasOffer = OFFER_RE.test(html) || /\$\s?\d/.test(html);
  evidence.hasPrice = /\$\s?\d|\d+\s*usd/i.test(html);

  if (!hasOffer) {
    failures.push({
      code: "NO_COMMERCIAL_OFFER",
      detail: "no visible pricing/plan/product commercial offer language",
    });
    checks.offer = "fail";
  } else {
    checks.offer = "pass";
  }

  if (!evidence.hasPrice && hasOffer) {
    failures.push({
      code: "NO_PRICE_OR_PURCHASE_INSTRUCTIONS",
      detail: "offer language present but no clear price/purchase instructions",
    });
  }

  const cta = pickCta(links, html, canonicalUrl);
  if (!cta) {
    failures.push({
      code: "NO_CTA",
      detail: "no buyer CTA (Buy / Get started / Checkout / Pricing) found",
    });
    checks.cta = "fail";
  } else {
    evidence.ctaHref = cta.href;
    if (
      /localhost|127\.0\.0\.1|javascript:/i.test(cta.href) ||
      (/#($|\s)/i.test(cta.href) &&
        !/#pricing|#buy|#plans/i.test(cta.href) &&
        !CHECKOUT_HREF_RE.test(cta.href))
    ) {
      failures.push({
        code: "BROKEN_CTA",
        detail: `CTA href is not a usable buyer destination: ${cta.href}`,
      });
      checks.cta = "fail";
    } else if (
      cta.href === base ||
      cta.href === `${base}/` ||
      /#pricing|#buy|#plans/i.test(cta.href)
    ) {
      checks.cta = "pass";
    } else {
      const ctaProbe = await fetchText(cta.href, 10_000);
      if (!pathLooksAlive(ctaProbe.status)) {
        failures.push({
          code: "BROKEN_CTA",
          detail: `CTA destination failed HTTP ${ctaProbe.status ?? "?"} (${cta.href})`,
        });
        checks.cta = "fail";
      } else {
        checks.cta = "pass";
      }
    }
  }

  const checkoutHref = pickCheckoutHref(links, html);
  evidence.checkoutHref = checkoutHref;
  if (!checkoutHref) {
    // Safe path probe: common checkout endpoints on same origin
    const candidates = [
      `${canonicalUrl}/api/checkout`,
      `${canonicalUrl}/checkout`,
      `${canonicalUrl}/api/stripe/checkout`,
    ];
    let found = false;
    for (const u of candidates) {
      const probe = await fetchText(u, 8_000);
      // 405/400/401/303 can still mean route exists; 404 means missing
      if (pathLooksAlive(probe.status)) {
        evidence.checkoutHref = u;
        found = true;
        break;
      }
    }
    if (!found) {
      failures.push({
        code: "NO_CHECKOUT_PATH",
        detail:
          "no checkout/payment path discovered (link, Stripe/Gumroad, or /api/checkout)",
      });
      checks.checkoutPath = "fail";
    } else {
      checks.checkoutPath = "pass";
    }
  } else if (/localhost|127\.0\.0\.1/i.test(checkoutHref)) {
    failures.push({
      code: "BROKEN_CHECKOUT",
      detail: `checkout path points at localhost: ${checkoutHref}`,
    });
    checks.checkoutPath = "fail";
  } else {
    // Safe probe — do not complete payment. HEAD/GET that must not 404.
    const probe = await fetchText(checkoutHref, 10_000);
    if (!pathLooksAlive(probe.status)) {
      failures.push({
        code: "BROKEN_CHECKOUT",
        detail: `checkout destination HTTP ${probe.status ?? "?"}: ${checkoutHref}`,
      });
      checks.checkoutPath = "fail";
    } else {
      checks.checkoutPath = "pass";
    }
  }

  if (ANALYTICS_RE.test(html)) {
    checks.analytics = "pass";
  } else {
    failures.push({
      code: "BROKEN_ANALYTICS",
      detail:
        "no analytics/beacon markers found — cannot observe visit→CTA→checkout→purchase",
    });
    checks.analytics = "fail";
  }

  const robots = await fetchText(`${canonicalUrl}/robots.txt`, 8_000);
  evidence.robotsStatus = robots.status;
  if (!robots.ok || robots.status === 404) {
    // Missing robots is a soft indexability issue for organic businesses.
    failures.push({
      code: "NON_INDEXABLE",
      detail: `robots.txt missing or unreachable (HTTP ${robots.status ?? "?"})`,
    });
    checks.indexability = "fail";
  } else if (/^\s*Disallow:\s*\/\s*$/m.test(robots.body)) {
    evidence.robotsDisallowAll = true;
    failures.push({
      code: "NON_INDEXABLE",
      detail: "robots.txt Disallow: / blocks organic indexing",
    });
    checks.indexability = "fail";
  } else {
    checks.indexability = "pass";
  }

  return finalize(siteId, assessedAt, canonicalUrl, failures, checks, evidence);
}

function finalize(
  siteId: string,
  assessedAt: string,
  canonicalUrl: string,
  failures: CommercialFailure[],
  checks: CommercialCheckSnapshot,
  evidence: CommercialReadinessResult["evidence"],
): CommercialReadinessResult {
  // Hard blockers for admission — analytics/indexability alone should not
  // block first acceptance if buyer path works, but still mark REPAIR_REQUIRED
  // for managed audit. For admission (ready), require buyer path essentials.
  const hard = new Set<CommercialFailureCode>([
    "NO_PUBLIC_STOREFRONT",
    "NO_COMMERCIAL_OFFER",
    "NO_CTA",
    "BROKEN_CTA",
    "NO_CHECKOUT_PATH",
    "BROKEN_CHECKOUT",
    "WRONG_CANONICAL_URL",
    "STALE_DEPLOYMENT",
    "NO_PRICE_OR_PURCHASE_INSTRUCTIONS",
  ]);
  const hardFails = failures.filter((f) => hard.has(f.code));
  const ready = hardFails.length === 0;
  return {
    siteId,
    assessedAt,
    gateVersion: ADMISSION_GATE_VERSION,
    canonicalUrl,
    ready,
    status: ready
      ? failures.length === 0
        ? "READY"
        : "REPAIR_REQUIRED"
      : "REPAIR_REQUIRED",
    failures,
    checks,
    repairPriority: repairPriorityFor(failures),
    evidence,
  };
}

/** Admission uses stricter ready=true (hard buyer-path failures absent). */
export function admissionAllowed(result: CommercialReadinessResult): boolean {
  return result.ready;
}

export async function persistCommercialAudit(
  pool: pg.Pool,
  results: CommercialReadinessResult[],
): Promise<void> {
  const doc = {
    gateVersion: ADMISSION_GATE_VERSION,
    assessedAt: new Date().toISOString(),
    results,
    readyCount: results.filter((r) => r.status === "READY").length,
    repairRequiredCount: results.filter((r) => r.status === "REPAIR_REQUIRED")
      .length,
  };
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'COMMERCIAL_AUDIT')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='COMMERCIAL_AUDIT'`,
    [COMMERCIAL_AUDIT_KEY, JSON.stringify(doc)],
  );
}

export async function enqueueCommercialRepairs(
  pool: pg.Pool,
  results: CommercialReadinessResult[],
): Promise<CommercialRepairItem[]> {
  const existingRes = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [COMMERCIAL_REPAIR_QUEUE_KEY],
  );
  const existing = (existingRes.rows[0]?.value ?? {}) as {
    items?: CommercialRepairItem[];
  };
  const items = Array.isArray(existing.items) ? [...existing.items] : [];
  const byId = new Map(items.map((i) => [i.siteId, i]));
  const queued: CommercialRepairItem[] = [];
  for (const r of results) {
    if (r.status !== "REPAIR_REQUIRED" || r.failures.length === 0) continue;
    const prev = byId.get(r.siteId);
    if (prev && (prev.status === "queued" || prev.status === "in_progress")) {
      prev.failures = r.failures;
      prev.priority = r.repairPriority;
      continue;
    }
    const item: CommercialRepairItem = {
      siteId: r.siteId,
      queuedAt: new Date().toISOString(),
      failures: r.failures,
      priority: r.repairPriority,
      attempts: 0,
      lastAttemptAt: null,
      status: "queued",
      note: "non-destructive audit queue — no demotion",
    };
    byId.set(r.siteId, item);
    queued.push(item);
  }
  const next = [...byId.values()].sort((a, b) => a.priority - b.priority);
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'COMMERCIAL_REPAIR_QUEUE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(),
       provenance='COMMERCIAL_REPAIR_QUEUE'`,
    [
      COMMERCIAL_REPAIR_QUEUE_KEY,
      JSON.stringify({
        gateVersion: ADMISSION_GATE_VERSION,
        updatedAt: new Date().toISOString(),
        items: next,
      }),
    ],
  );
  return queued;
}

/**
 * Lightweight metadata/canonical helper only.
 * Public HTML repairs are owned by storefront-repair-executor
 * (source mutation → vercel --prod → public verify).
 * Never uses /api/owner/execute for CTA/checkout publish.
 */
export async function attemptCommercialRepair(input: {
  pool: pg.Pool;
  siteId: string;
  failures: CommercialFailure[];
  appRoot: string;
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<{ attempted: boolean; completed: boolean; detail: string }> {
  void input.appRoot;
  const codes = new Set(input.failures.map((f) => f.code));
  const url = await resolveCanonicalUrl(input.pool, input.siteId);

  if (codes.has("WRONG_CANONICAL_URL") || codes.has("STALE_DEPLOYMENT")) {
    await input.pool.query(
      `update ros_businesses
       set app_url = $2, updated_at = now(),
           metadata = coalesce(metadata,'{}'::jsonb) || $3::jsonb
       where site_id = $1`,
      [
        input.siteId,
        url.startsWith("http") ? url : defaultCanonicalUrl(input.siteId),
        JSON.stringify({
          commercialRepair: {
            at: new Date().toISOString(),
            action: "set_canonical_app_url",
            url: defaultCanonicalUrl(input.siteId),
          },
        }),
      ],
    );
    input.logger?.("info", "commercial.repair.canonical_url", {
      siteId: input.siteId,
      url: defaultCanonicalUrl(input.siteId),
    });
  }

  await input.pool.query(
    `update ros_businesses
     set metadata = coalesce(metadata,'{}'::jsonb) || $2::jsonb, updated_at=now()
     where site_id=$1`,
    [
      input.siteId,
      JSON.stringify({
        commercialRepair: {
          at: new Date().toISOString(),
          action: "queued_for_storefront_repair_executor",
          failures: [...codes],
          note: "public deploy via vercel_cli_prod — not owner/execute",
        },
      }),
    ],
  );

  return {
    attempted: true,
    completed: false,
    detail:
      "queued for storefront-repair-executor (source→vercel--prod→public verify)",
  };
}

export async function auditManagedBusinesses(input: {
  pool: pg.Pool;
  siteIds: string[];
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<CommercialReadinessResult[]> {
  const results: CommercialReadinessResult[] = [];
  for (const siteId of input.siteIds) {
    const r = await assessCommercialReadiness({ siteId, pool: input.pool });
    // Never demote — audit classification only.
    results.push(r);
    input.logger?.("info", "commercial.audit.business", {
      siteId,
      status: r.status,
      ready: r.ready,
      failures: r.failures.map((f) => f.code),
    });
  }
  await persistCommercialAudit(input.pool, results);
  const queued = await enqueueCommercialRepairs(input.pool, results);
  input.logger?.("info", "commercial.audit.complete", {
    gateVersion: ADMISSION_GATE_VERSION,
    ready: results.filter((r) => r.status === "READY").length,
    repairRequired: results.filter((r) => r.status === "REPAIR_REQUIRED").length,
    repairsQueued: queued.length,
  });
  return results;
}
