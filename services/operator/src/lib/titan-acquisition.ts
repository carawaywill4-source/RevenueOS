/**
 * Titan customer acquisition — FIRST_HUMAN_MODE aware.
 *
 * Distinguishes RESEARCH / SEO_INDEXING / ASSET_CREATION / DISTRIBUTION /
 * MEASUREMENT. Self-HTTP probes are NEVER counted as customer traffic.
 */

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORTFOLIO_50_SPECS } from "@revenueos/core";
import type pg from "pg";
import { buildEvidencePack } from "./titan-evidence-pack.js";
import {
  completeAcquisitionExperiment,
  saveAcquisitionExperiment,
  saveCommercialLesson,
  upsertMoneyModel,
} from "./titan-world-store.js";

export const TITAN_ACQUISITION_VERSION = "titan-acquisition-v2";

export type AcquisitionActionClass =
  | "RESEARCH"
  | "ASSET_CREATION"
  | "DISTRIBUTION"
  | "DIRECT_OUTREACH"
  | "REFERRAL_PARTNERSHIP"
  | "SEO_INDEXING"
  | "COMMUNITY_PARTICIPATION"
  | "CONVERSION"
  | "MEASUREMENT";

export type AcquisitionMap = {
  businessId: string;
  bottleneck: string;
  funnelRung: string;
  highIntentEnvironments: string[];
  hypotheses: Array<{ id: string; text: string; channel: string }>;
  updatedAt: string;
};

const FIRST_HUMAN_PRIORITY = [
  "storelift",
  "bidforge",
  "invoicechaser",
  "scopesmith",
  "deckready",
];

function repoRoot(): string {
  return (
    process.env.REVENUEOS_REPO_ROOT ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
  );
}

function publicBase(): string {
  return (
    process.env.HOSTING_PUBLIC_BASE_HOST ||
    process.env.REVENUEOS_PUBLIC_BASE_HOST ||
    "130.131.15.68.sslip.io"
  );
}

function nativeUrl(siteId: string): string {
  return `https://${siteId}.${publicBase()}`;
}

async function ensureIndexNowKey(pool: pg.Pool): Promise<string> {
  const envKey = process.env.INDEXNOW_KEY?.trim();
  if (envKey && envKey.length >= 8) return envKey;
  const res = await pool.query(
    `select value->>'key' as key from ros_config_meta where key='indexnow_key' limit 1`,
  );
  const existing = String(res.rows[0]?.key ?? "").trim();
  if (existing) {
    process.env.INDEXNOW_KEY = existing;
    return existing;
  }
  const key = randomBytes(16).toString("hex");
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('indexnow_key', $1::jsonb, now(), 'NATIVE_POSTGRES')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [JSON.stringify({ key, createdAt: new Date().toISOString() })],
  );
  process.env.INDEXNOW_KEY = key;
  return key;
}

function publishIndexNowKeyFile(siteId: string, key: string): boolean {
  const artifact =
    process.env.HOSTING_DATA_DIR ||
    "/opt/revenueos/data/hosting-plane";
  const current = path.join(artifact, "artifacts", siteId, "current");
  // current may be a symlink to .../out
  const targets = [current, path.join(current, "out")].filter((p) =>
    existsSync(p),
  );
  let wrote = false;
  for (const dir of targets) {
    try {
      writeFileSync(path.join(dir, `${key}.txt`), key);
      wrote = true;
    } catch {
      /* ignore */
    }
  }
  // Also write into app public folder for future builds
  const appPublic = path.join(repoRoot(), "apps", siteId, "public");
  try {
    mkdirSync(appPublic, { recursive: true });
    writeFileSync(path.join(appPublic, `${key}.txt`), key);
    wrote = true;
  } catch {
    /* ignore */
  }
  return wrote;
}

function publishDiscoveryDoors(siteId: string): {
  ok: boolean;
  pages: string[];
  detail: string;
} {
  const brandPath = path.join(
    repoRoot(),
    "apps",
    siteId,
    "src/lib/brand.ts",
  );
  if (!existsSync(brandPath)) {
    return { ok: false, pages: [], detail: "brand_missing" };
  }
  const src = readFileSync(brandPath, "utf8");
  const doors: Array<{ slug: string; title: string; body?: string }> = [];
  const doorRe =
    /\{\s*["']slug["']\s*:\s*["']([^"']+)["']\s*,\s*["']title["']\s*:\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = doorRe.exec(src)) && doors.length < 5) {
    doors.push({ slug: m[1]!, title: m[2]! });
  }
  if (!doors.length) {
    return { ok: false, pages: [], detail: "no_discovery_doors" };
  }
  const artifactRoot =
    process.env.HOSTING_DATA_DIR || "/opt/revenueos/data/hosting-plane";
  const current = path.join(artifactRoot, "artifacts", siteId, "current");
  if (!existsSync(current)) {
    return { ok: false, pages: [], detail: "artifact_missing" };
  }
  const published: string[] = [];
  const canonical = nativeUrl(siteId);
  for (const d of doors) {
    const dir = path.join(current, d.slug);
    mkdirSync(dir, { recursive: true });
    const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${d.title} — ${siteId}</title>
<meta name="description" content="${d.title}"/>
<link rel="canonical" href="${canonical}/${d.slug}/"/>
</head><body style="font-family:Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1rem">
<p><a href="/">${siteId}</a></p>
<h1>${d.title}</h1>
<p>Practical guide for buyers searching: <strong>${d.title}</strong>.</p>
<p><a href="/#buy">Get the pack — instant download</a></p>
</body></html>`;
    writeFileSync(path.join(dir, "index.html"), html);
    published.push(`${canonical}/${d.slug}/`);
  }
  // Expand sitemap
  try {
    const locs = [
      `<url><loc>${canonical}/</loc></url>`,
      ...published.map((u) => `<url><loc>${u}</loc></url>`),
    ].join("");
    writeFileSync(
      path.join(current, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs}</urlset>`,
    );
  } catch {
    /* ignore */
  }
  return { ok: true, pages: published, detail: `published_${published.length}` };
}

async function pingSitemap(canonical: string): Promise<{
  bing: number | null;
  google: number | null;
}> {
  const sitemap = `${canonical.replace(/\/$/, "")}/sitemap.xml`;
  let bing: number | null = null;
  let google: number | null = null;
  try {
    const r = await fetch(
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    bing = r.status;
  } catch {
    bing = null;
  }
  try {
    const r = await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    google = r.status;
  } catch {
    google = null;
  }
  return { bing, google };
}

async function loadHumanVisitCount(
  pool: pg.Pool,
  businessId: string,
): Promise<number | null> {
  try {
    const res = await pool.query(
      `select count(*)::int as n from ros_traffic_events
       where business_id=$1 and class='LIKELY_HUMAN'
         and created_at > now() - interval '30 days'`,
      [businessId],
    );
    return Number(res.rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

export async function analyzeAcquisitionBottleneck(input: {
  pool: pg.Pool;
  businessId: string;
  runtime?: {
    lastExecuted?: number | null;
    lastOk?: boolean | null;
    ticks?: number;
  };
}): Promise<AcquisitionMap> {
  const spec = PORTFOLIO_50_SPECS.find((s) => s.siteId === input.businessId);
  const humanVisits = await loadHumanVisitCount(input.pool, input.businessId);
  const funnelRung =
    humanVisits === null
      ? "MEASUREMENT_UNKNOWN"
      : humanVisits === 0
        ? "NO_HUMAN_VISIT"
        : "HAS_HUMAN_VISIT";
  const bottleneck =
    humanVisits === 0 || humanVisits === null
      ? "NO_DISTRIBUTION"
      : "qualified_acquisition";

  return {
    businessId: input.businessId,
    bottleneck,
    funnelRung,
    highIntentEnvironments: [
      `Search intent: ${(spec?.intentKeywords ?? []).slice(0, 3).join(", ") || "unknown"}`,
      "Niche directories / comparison lists (manual or API-permitted)",
      "Buyer communities where promotion is allowed",
      "Useful free tool / preview entry points on owned domain",
    ],
    hypotheses: [
      {
        id: "first_human_owned_surfaces",
        text: "Until one likely-human visit exists, prioritize crawlable discovery doors + IndexNow/sitemap pings over checkout micro-optimization.",
        channel: "first_human_distribution",
      },
      {
        id: "seo_owned_urls",
        text: "Distributing owned canonical URLs to IndexNow/sitemaps increases qualified discovery for high-intent queries.",
        channel: "owned_search_distribution",
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Execute a bounded zero-cost acquisition action for an accepted business.
 * Does not fabricate traffic/revenue — records measured probe results only.
 */
export async function runAcquisitionExperiment(input: {
  pool: pg.Pool;
  businessId: string;
  canonicalUrl?: string;
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<{
  experimentId: string;
  ok: boolean;
  bottleneck: string;
  hypothesis: string;
  action: string;
  actionClass: AcquisitionActionClass;
  metrics: Record<string, unknown>;
  result: string;
}> {
  const map = await analyzeAcquisitionBottleneck({
    pool: input.pool,
    businessId: input.businessId,
  });
  const pack = await buildEvidencePack({
    pool: input.pool,
    businessId: input.businessId,
    purpose: "ACQUISITION",
    logger: input.logger,
  });

  const firstHumanMode =
    map.funnelRung === "NO_HUMAN_VISIT" ||
    map.funnelRung === "MEASUREMENT_UNKNOWN" ||
    FIRST_HUMAN_PRIORITY.includes(input.businessId);

  const hypothesis = firstHumanMode
    ? map.hypotheses[0]!.text
    : map.hypotheses[1]?.text ?? map.hypotheses[0]!.text;
  const canonical =
    input.canonicalUrl ?? nativeUrl(input.businessId);

  const action = firstHumanMode
    ? "first_human_distribution_bundle"
    : "owned_url_discovery_probe";
  const actionClass: AcquisitionActionClass = firstHumanMode
    ? "DISTRIBUTION"
    : "SEO_INDEXING";

  const experimentId = await saveAcquisitionExperiment(input.pool, {
    businessId: input.businessId,
    hypothesis,
    action,
    channel: firstHumanMode
      ? "first_human_distribution"
      : "owned_search_distribution",
    status: "RUNNING",
    meta: {
      version: TITAN_ACQUISITION_VERSION,
      bottleneck: map.bottleneck,
      funnelRung: map.funnelRung,
      actionClass,
      firstHumanMode,
      evidencePackFacts: pack.facts.slice(0, 5),
      note: "Self-HTTP probes are MEASUREMENT only — not customer traffic",
    },
  });

  // MEASUREMENT only — Titan probe. Never counted as human traffic.
  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  try {
    const res = await fetch(canonical, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "user-agent": "RevenueOSTitanAcquisition/2.0" },
    });
    httpStatus = res.status;
    finalUrl = res.url;
  } catch {
    httpStatus = null;
  }

  const indexNowKey = await ensureIndexNowKey(input.pool);
  const keyPublished = publishIndexNowKeyFile(input.businessId, indexNowKey);
  const doors = firstHumanMode
    ? publishDiscoveryDoors(input.businessId)
    : { ok: false, pages: [] as string[], detail: "skipped_not_first_human" };

  let indexNowStatus: number | null = null;
  let indexNowSkipped = false;
  let indexNowSkipReason: string | null = null;
  const urlList = [canonical, ...doors.pages].slice(0, 10);
  try {
    // Only count IndexNow failures that occurred after a key file was published.
    const failCountRes = await input.pool.query(
      `select count(*)::int as n from titan_acquisition_experiments
       where channel in ('owned_search_distribution','first_human_distribution')
         and created_at > now() - interval '24 hours'
         and (metrics->>'indexNowKeyPublished') = 'true'
         and (metrics->>'indexNowStatus') in ('400','401','403','422')`,
    );
    const recentIndexNowFails = Number(failCountRes.rows[0]?.n ?? 0);
    if (!keyPublished) {
      indexNowSkipped = true;
      indexNowSkipReason = "indexnow_key_file_not_published";
    } else if (recentIndexNowFails >= 8) {
      indexNowSkipped = true;
      indexNowSkipReason = `downgraded_after_${recentIndexNowFails}_http_failures_24h`;
    } else {
      const host = new URL(canonical).host;
      const keyLocation = `https://${host}/${indexNowKey}.txt`;
      const ping = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          host,
          key: indexNowKey,
          keyLocation,
          urlList,
        }),
      });
      indexNowStatus = ping.status;
    }
  } catch {
    indexNowStatus = null;
  }

  const sitemapPing = firstHumanMode
    ? await pingSitemap(canonical)
    : { bing: null, google: null };

  const metrics = {
    actionClass,
    firstHumanMode,
    funnelRung: map.funnelRung,
    storefrontHttpStatus: httpStatus,
    finalUrl,
    indexNowStatus,
    indexNowSkipped,
    indexNowSkipReason,
    indexNowKeyPublished: keyPublished,
    discoveryDoors: doors,
    sitemapPing,
    urlListSubmitted: urlList,
    note: "Titan probe ≠ human traffic. IndexNow/sitemap = SEO_INDEXING. Discovery doors = ASSET_CREATION+DISTRIBUTION prep.",
    measuredPurchases: null,
    measuredVisits: null,
    selfProbeClass: "INTERNAL_TITAN_PROBE",
  };

  const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 400;
  const distributed =
    (!indexNowSkipped &&
      indexNowStatus !== null &&
      (indexNowStatus === 200 || indexNowStatus === 202)) ||
    doors.ok ||
    sitemapPing.bing === 200;

  const result = ok
    ? firstHumanMode
      ? `FIRST_HUMAN_MODE: storefront OK (${httpStatus}). doors=${doors.detail}. IndexNow=${
          indexNowSkipped
            ? `skipped(${indexNowSkipReason})`
            : String(indexNowStatus)
        }. sitemapPing bing=${sitemapPing.bing} google=${sitemapPing.google}. Human visits still UNKNOWN/0 until external traffic arrives.`
      : `Storefront reachable (${httpStatus}). IndexNow ${
          indexNowSkipped
            ? `skipped (${indexNowSkipReason})`
            : `status=${indexNowStatus ?? "unavailable"}`
        }.`
    : `Storefront probe failed (status=${httpStatus}). Fix exposure before distribution.`;

  await completeAcquisitionExperiment(input.pool, experimentId, {
    status: ok ? "MEASURED" : "FAILED",
    metrics,
    result,
  });

  await saveCommercialLesson(input.pool, {
    scope: "CHANNEL",
    lesson: !ok
      ? `${input.businessId}: unreachable storefront — distribution blocked.`
      : !distributed
        ? `${input.businessId}: reachability probes alone do not create customers. Prefer discovery-door assets + IndexNow with published key + sitemap pings; stop repeating IndexNow-less probes.`
        : `${input.businessId}: FIRST_HUMAN distribution surfaces published/pinged. Success = likely-human visit, not IndexNow HTTP code.`,
    businessIds: [input.businessId],
    confidence: 0.78,
    evidence: [{ experimentId, metrics, actionClass }],
  });

  // Activate FIRST_HUMAN_MODE flag in config (portfolio-wide list)
  if (firstHumanMode) {
    try {
      const prev = await input.pool.query(
        `select value from ros_config_meta where key='first_human_mode' limit 1`,
      );
      const doc = (prev.rows[0]?.value as Record<string, unknown>) ?? {
        businesses: {},
      };
      const businesses = {
        ...((doc.businesses as Record<string, unknown>) ?? {}),
        [input.businessId]: {
          activatedAt: new Date().toISOString(),
          funnelRung: map.funnelRung,
          lastExperimentId: experimentId,
          objective: "GET_ONE_LIKELY_HUMAN_VISIT",
        },
      };
      await input.pool.query(
        `insert into ros_config_meta (key, value, updated_at, provenance)
         values ('first_human_mode', $1::jsonb, now(), 'NATIVE_POSTGRES')
         on conflict (key) do update set value=excluded.value, updated_at=now()`,
        [JSON.stringify({ businesses, updatedAt: new Date().toISOString() })],
      );
    } catch {
      /* ignore */
    }
  }

  await upsertMoneyModel(input.pool, input.businessId, {
    business_id: input.businessId,
    daily_target: 10000,
    current_bottleneck: map.bottleneck,
    funnel_rung: map.funnelRung,
    first_human_mode: firstHumanMode,
    current_growth_thesis: hypothesis,
    next_highest_value_action: ok
      ? firstHumanMode
        ? "await_or_force_external_distribution_then_measure_likely_human_visits"
        : "measure_qualified_visits_after_distribution"
      : "repair_public_storefront_exposure",
    last_acquisition_experiment_id: experimentId,
    updatedAt: new Date().toISOString(),
  });

  input.logger?.("info", "titan.acquisition.experiment", {
    businessId: input.businessId,
    experimentId,
    ok,
    action,
    actionClass,
    firstHumanMode,
    httpStatus,
    indexNowStatus,
    doors: doors.detail,
  });

  return {
    experimentId,
    ok,
    bottleneck: map.bottleneck,
    hypothesis,
    action,
    actionClass,
    metrics,
    result,
  };
}

export { FIRST_HUMAN_PRIORITY };
