/**
 * Reusable AcquisitionOS executor types.
 * IndexNow / self-probes are recorded but NEVER count as distribution.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import type pg from "pg";
import { bumpSurfaceAttempt } from "./channel-graph.js";
import { writeDistributionReceipt } from "./receipts.js";
import type { ExecutorType } from "./types.js";

function repoRoot(): string {
  return (
    process.env.REVENUEOS_REPO_ROOT ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  );
}

function publicBase(): string {
  return (
    process.env.HOSTING_PUBLIC_BASE_HOST ||
    "130.131.15.68.sslip.io"
  );
}

function nativeUrl(siteId: string): string {
  return `https://${siteId}.${publicBase()}`;
}

function artifactCurrent(siteId: string): string | null {
  const root =
    process.env.HOSTING_DATA_DIR || "/opt/revenueos/data/hosting-plane";
  const current = path.join(root, "artifacts", siteId, "current");
  return existsSync(current) ? current : null;
}

function trackingParams(input: {
  businessId: string;
  surfaceId: string;
  campaign: string;
}): string {
  const p = new URLSearchParams({
    utm_source: "acquisitionos",
    utm_medium: input.campaign,
    utm_campaign: input.businessId,
    utm_content: input.surfaceId.slice(0, 24),
    ros_aq: input.surfaceId.slice(0, 16),
  });
  return p.toString();
}

async function ensureIndexNowKey(pool: pg.Pool): Promise<string> {
  const envKey = process.env.INDEXNOW_KEY?.trim();
  if (envKey && envKey.length >= 8) return envKey;
  const res = await pool.query(
    `select value->>'key' as key from ros_config_meta where key='indexnow_key' limit 1`,
  );
  const existing = String(res.rows[0]?.key ?? "").trim();
  if (existing) return existing;
  const key = randomBytes(16).toString("hex");
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('indexnow_key', $1::jsonb, now(), 'NATIVE_POSTGRES')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [JSON.stringify({ key, createdAt: new Date().toISOString() })],
  );
  return key;
}

export type ExecuteResult = {
  ok: boolean;
  countsAsDistribution: boolean;
  receiptId: string;
  detail: string;
  publicUrl?: string;
};

/** SEARCH_SUBMISSION — discovery infrastructure, NOT distribution. */
export async function execSearchSubmission(input: {
  pool: pg.Pool;
  businessId: string;
  surfaceId: string;
  urls: string[];
}): Promise<ExecuteResult> {
  const key = await ensureIndexNowKey(input.pool);
  const host = new URL(nativeUrl(input.businessId)).host;
  const keyLocation = `https://${host}/${key}.txt`;
  const dir = artifactCurrent(input.businessId);
  if (dir) {
    try {
      writeFileSync(path.join(dir, `${key}.txt`), key);
    } catch {
      /* ignore */
    }
  }
  let status: number | null = null;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        host,
        key,
        keyLocation,
        urlList: input.urls.slice(0, 10),
      }),
    });
    status = res.status;
  } catch {
    status = null;
  }
  const ok = status === 200 || status === 202;
  const receiptId = await writeDistributionReceipt(input.pool, {
    businessId: input.businessId,
    channelSurfaceId: input.surfaceId,
    hypothesis: "Search engines discover owned URLs via IndexNow",
    externalDestination: "https://api.indexnow.org/indexnow",
    externalAction: "indexnow_submit",
    executorType: "SEARCH_SUBMISSION",
    requestResult: { status, urlCount: input.urls.length, keyLocation },
    status: ok ? "ACCEPTED" : "FAILED",
    expectedExposure: "indexing_opportunity_not_impression",
    countsAsDistribution: false,
    kind: "indexnow_submit",
    referralTracking: { note: "search_discovery_only" },
  });
  await bumpSurfaceAttempt(input.pool, input.surfaceId, ok);
  return {
    ok,
    countsAsDistribution: false,
    receiptId,
    detail: `IndexNow status=${status} (search discovery, not traffic)`,
  };
}

/** CONTENT_PUBLISH — publish owned intent door (asset). Distribution only after external reach. */
export async function execContentPublish(input: {
  pool: pg.Pool;
  businessId: string;
  surfaceId: string;
  surfaceUrl: string;
  surfaceName: string;
}): Promise<ExecuteResult> {
  const dir = artifactCurrent(input.businessId);
  let slug = "";
  try {
    slug = new URL(input.surfaceUrl).pathname.replace(/^\/|\/$/g, "");
  } catch {
    slug = input.surfaceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
  }
  if (!dir || !slug || slug.includes("google.com") || slug.includes("bing.com")) {
    // Google/Bing SERP surfaces: ensure local door from brand intents instead
    const brandPath = path.join(
      repoRoot(),
      "apps",
      input.businessId,
      "src/lib/brand.ts",
    );
    if (!existsSync(brandPath) || !dir) {
      const receiptId = await writeDistributionReceipt(input.pool, {
        businessId: input.businessId,
        channelSurfaceId: input.surfaceId,
        hypothesis: "Publish owned intent asset",
        externalDestination: input.surfaceUrl,
        externalAction: "content_publish_skipped",
        executorType: "CONTENT_PUBLISH",
        requestResult: { reason: "not_owned_or_missing_artifact" },
        status: "SKIPPED",
        expectedExposure: "none",
        countsAsDistribution: false,
        kind: "asset_generation_unpublished",
      });
      return {
        ok: false,
        countsAsDistribution: false,
        receiptId,
        detail: "skipped non-owned or missing artifact",
      };
    }
  }

  const pageDir = path.join(dir!, slug || "intent");
  mkdirSync(pageDir, { recursive: true });
  const canonical = `${nativeUrl(input.businessId)}/${slug || "intent"}/`;
  const track = trackingParams({
    businessId: input.businessId,
    surfaceId: input.surfaceId,
    campaign: "intent_page",
  });
  const title = input.surfaceName.replace(/^Owned intent page:\s*/i, "");
  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title} — ${input.businessId}</title>
<meta name="description" content="${title}"/>
<link rel="canonical" href="${canonical}"/>
</head><body style="font-family:Georgia,serif;max-width:40rem;margin:2rem auto;padding:0 1rem">
<p><a href="/?${track}">${input.businessId}</a></p>
<h1>${title}</h1>
<p>Practical resource for buyers researching: <strong>${title}</strong>.</p>
<p><a href="/?${track}#buy">Get the pack — instant download</a></p>
</body></html>`;
  writeFileSync(path.join(pageDir, "index.html"), html);

  const assetId = `asset_${input.businessId}_${slug || "intent"}`;
  await input.pool.query(
    `insert into aq_assets (asset_id, business_id, buyer, asset_type, purpose, channel_family, title, public_url, status, published_at, meta)
     values ($1,$2,$3,'intent_page','first_human_search','content',$4,$5,'PUBLISHED',now(),'{}'::jsonb)
     on conflict (asset_id) do update set public_url=excluded.public_url, status='PUBLISHED', published_at=now()`,
    [assetId, input.businessId, "intent_searcher", title, canonical],
  );

  const receiptId = await writeDistributionReceipt(input.pool, {
    businessId: input.businessId,
    channelSurfaceId: input.surfaceId,
    assetId,
    hypothesis: "Owned high-intent page earns organic discovery over time",
    externalDestination: canonical,
    externalAction: "publish_owned_intent_page",
    executorType: "CONTENT_PUBLISH",
    requestResult: { published: true, path: slug },
    publicUrl: canonical,
    status: "PUBLISHED",
    expectedExposure: "search_or_shared_link_over_time",
    countsAsDistribution: false,
    kind: "asset_generation_unpublished",
    referralTracking: { utm: track },
  });
  // Asset publish alone is NOT distribution — needs external surface reach.
  await bumpSurfaceAttempt(input.pool, input.surfaceId, true);
  return {
    ok: true,
    countsAsDistribution: false,
    receiptId,
    detail: `published owned intent page ${canonical}`,
    publicUrl: canonical,
  };
}

/** FEED_PUBLISH + WEBSUB — publish RSS then ping external hub (counts as weak distribution). */
export async function execFeedPublish(input: {
  pool: pg.Pool;
  businessId: string;
  surfaceId: string;
}): Promise<ExecuteResult> {
  const dir = artifactCurrent(input.businessId);
  const feedUrl = `${nativeUrl(input.businessId)}/rss.xml`;
  if (!dir) {
    const receiptId = await writeDistributionReceipt(input.pool, {
      businessId: input.businessId,
      channelSurfaceId: input.surfaceId,
      hypothesis: "RSS + WebSub for aggregator discovery",
      externalDestination: feedUrl,
      externalAction: "feed_publish",
      executorType: "FEED_PUBLISH",
      requestResult: { reason: "artifact_missing" },
      status: "FAILED",
      expectedExposure: "feed_subscribers",
      countsAsDistribution: false,
    });
    return { ok: false, countsAsDistribution: false, receiptId, detail: "no artifact" };
  }

  const track = trackingParams({
    businessId: input.businessId,
    surfaceId: input.surfaceId,
    campaign: "rss",
  });
  const home = `${nativeUrl(input.businessId)}/?${track}`;
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>${input.businessId} updates</title>
<link>${home}</link>
<description>Practical resources from ${input.businessId}</description>
<item>
  <title>${input.businessId} — buyer resource pack</title>
  <link>${home}</link>
  <guid>${home}</guid>
  <pubDate>${new Date().toUTCString()}</pubDate>
  <description>High-intent resource for buyers of ${input.businessId}</description>
</item>
</channel></rss>`;
  writeFileSync(path.join(dir, "rss.xml"), rss);

  // External hub ping — leaves RevenueOS
  let hubStatus: number | null = null;
  try {
    const hub = `https://pubsubhubbub.appspot.com/`;
    const body = new URLSearchParams({
      "hub.mode": "publish",
      "hub.url": feedUrl,
    });
    const res = await fetch(hub, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });
    hubStatus = res.status;
  } catch {
    hubStatus = null;
  }

  const ok = hubStatus !== null && hubStatus >= 200 && hubStatus < 400;
  const receiptId = await writeDistributionReceipt(input.pool, {
    businessId: input.businessId,
    channelSurfaceId: input.surfaceId,
    hypothesis: "WebSub notify aggregators of new RSS content",
    externalDestination: "https://pubsubhubbub.appspot.com/",
    externalAction: "websub_publish",
    executorType: "WEBSUB_PING",
    requestResult: { hubStatus, feedUrl },
    publicUrl: feedUrl,
    platformReceipt: hubStatus != null ? `http_${hubStatus}` : null,
    status: ok ? "ACCEPTED" : "FAILED",
    expectedExposure: "feed_infrastructure_not_new_audience",
    // WebSub alone is NOT new-audience distribution (Commercial Executive contract).
    countsAsDistribution: false,
    referralTracking: { utm: track, feedUrl, newAudience: false },
  });
  await bumpSurfaceAttempt(input.pool, input.surfaceId, ok);
  return {
    ok,
    countsAsDistribution: false,
    receiptId,
    detail: `RSS published; WebSub hub status=${hubStatus} (infra, not new-audience)`,
    publicUrl: feedUrl,
  };
}

/** Portfolio cross-links — owned distribution with attribution. */
export async function execPortfolioCrosslink(input: {
  pool: pg.Pool;
  businessId: string;
  surfaceId: string;
  peers: string[];
}): Promise<ExecuteResult> {
  const dir = artifactCurrent(input.businessId);
  if (!dir) {
    const receiptId = await writeDistributionReceipt(input.pool, {
      businessId: input.businessId,
      channelSurfaceId: input.surfaceId,
      hypothesis: "Relevant portfolio cross-discovery",
      externalDestination: nativeUrl(input.businessId),
      externalAction: "portfolio_crosslink",
      executorType: "PORTFOLIO_CROSSLINK",
      requestResult: { reason: "artifact_missing" },
      status: "FAILED",
      expectedExposure: "portfolio_visitors",
      countsAsDistribution: false,
    });
    return { ok: false, countsAsDistribution: false, receiptId, detail: "no artifact" };
  }

  const resourcesDir = path.join(dir, "resources");
  mkdirSync(resourcesDir, { recursive: true });
  const peers = input.peers.filter((p) => p !== input.businessId).slice(0, 5);
  const links = peers
    .map((p) => {
      const track = trackingParams({
        businessId: p,
        surfaceId: input.surfaceId,
        campaign: `cross_${input.businessId}`,
      });
      return `<li><a href="https://${p}.${publicBase()}/?${track}">${p}</a> — related buyer resource</li>`;
    })
    .join("\n");
  const pageUrl = `${nativeUrl(input.businessId)}/resources/`;
  writeFileSync(
    path.join(resourcesDir, "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"/><title>Resources — ${input.businessId}</title>
<link rel="canonical" href="${pageUrl}"/></head>
<body style="font-family:Georgia,serif;max-width:40rem;margin:2rem auto">
<h1>Related resources</h1>
<p> complementary tools for the same buyer journey (relevant only).</p>
<ul>${links}</ul>
<p><a href="/">Back to ${input.businessId}</a></p>
</body></html>`,
  );

  // Portfolio crosslinks are owned network — NOT new-audience distribution.
  const receiptId = await writeDistributionReceipt(input.pool, {
    businessId: input.businessId,
    channelSurfaceId: input.surfaceId,
    hypothesis: "Complementary portfolio businesses share overlapping buyers",
    externalDestination: pageUrl,
    externalAction: "portfolio_crosslink_publish",
    executorType: "PORTFOLIO_CROSSLINK",
    requestResult: { peers },
    publicUrl: pageUrl,
    status: "PUBLISHED",
    expectedExposure: "owned_portfolio_only",
    countsAsDistribution: false,
    referralTracking: { peers, medium: "owned_portfolio", newAudience: false },
  });
  await bumpSurfaceAttempt(input.pool, input.surfaceId, true);
  return {
    ok: true,
    countsAsDistribution: false,
    receiptId,
    detail: `cross-linked ${peers.length} peers at ${pageUrl} (owned, not new-audience)`,
    publicUrl: pageUrl,
  };
}

export async function runExecutor(input: {
  pool: pg.Pool;
  businessId: string;
  surfaceId: string;
  executorType: ExecutorType;
  surfaceUrl: string;
  surfaceName: string;
  peerBusinessIds?: string[];
}): Promise<ExecuteResult> {
  switch (input.executorType) {
    case "SEARCH_SUBMISSION":
      return execSearchSubmission({
        pool: input.pool,
        businessId: input.businessId,
        surfaceId: input.surfaceId,
        urls: [
          nativeUrl(input.businessId) + "/",
          ...(await listDoorUrls(input.businessId)),
        ],
      });
    case "CONTENT_PUBLISH":
      return execContentPublish({
        pool: input.pool,
        businessId: input.businessId,
        surfaceId: input.surfaceId,
        surfaceUrl: input.surfaceUrl,
        surfaceName: input.surfaceName,
      });
    case "FEED_PUBLISH":
    case "WEBSUB_PING":
      return execFeedPublish({
        pool: input.pool,
        businessId: input.businessId,
        surfaceId: input.surfaceId,
      });
    case "PORTFOLIO_CROSSLINK":
      return execPortfolioCrosslink({
        pool: input.pool,
        businessId: input.businessId,
        surfaceId: input.surfaceId,
        peers: input.peerBusinessIds ?? [],
      });
    default:
      {
        // Generic PUBLIC_FORM / DIRECTORY / RESOURCE — attempt legitimate form submit
        if (
          input.executorType === "DIRECTORY_LISTING" ||
          input.executorType === "RESOURCE_PITCH" ||
          input.executorType === "HTTP_SUBMISSION" ||
          input.executorType === "PUBLIC_FORM_PREP" ||
          input.executorType === "MARKETPLACE_LISTING"
        ) {
          return execGenericPublicFormOrDirectory({
            pool: input.pool,
            businessId: input.businessId,
            surfaceId: input.surfaceId,
            surfaceUrl: input.surfaceUrl,
            surfaceName: input.surfaceName,
            executorType: input.executorType,
          });
        }
        const receiptId = await writeDistributionReceipt(input.pool, {
          businessId: input.businessId,
          channelSurfaceId: input.surfaceId,
          hypothesis: "Executor type not auto-runnable yet",
          externalDestination: input.surfaceUrl,
          externalAction: "executor_gap",
          executorType: input.executorType,
          requestResult: { gap: true },
          status: "CAPABILITY_GAP",
          expectedExposure: "none_until_executor_exists",
          countsAsDistribution: false,
        });
        return {
          ok: false,
          countsAsDistribution: false,
          receiptId,
          detail: `capability gap: ${input.executorType}`,
        };
      }
  }
}

async function execGenericPublicFormOrDirectory(input: {
  pool: pg.Pool;
  businessId: string;
  surfaceId: string;
  surfaceUrl: string;
  surfaceName: string;
  executorType: ExecutorType;
}): Promise<ExecuteResult> {
  const link = `${nativeUrl(input.businessId)}/?utm_source=acquisitionos&utm_medium=directory&utm_campaign=${input.businessId}`;
  let html = "";
  try {
    const res = await fetch(input.surfaceUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "user-agent": "RevenueOSTitanOutreach/1.0 (+legitimate-commercial)",
        accept: "text/html",
      },
    });
    if (res.ok) html = (await res.text()).slice(0, 180_000);
  } catch {
    /* fall through */
  }

  if (!html || /recaptcha|hcaptcha|cf-turnstile/i.test(html)) {
    const receiptId = await writeDistributionReceipt(input.pool, {
      businessId: input.businessId,
      channelSurfaceId: input.surfaceId,
      hypothesis: "Directory/resource surface blocked or captcha",
      externalDestination: input.surfaceUrl,
      externalAction: "directory_or_resource_blocked",
      executorType: input.executorType,
      requestResult: { captchaOrEmpty: true },
      status: "SKIPPED",
      expectedExposure: "none",
      countsAsDistribution: false,
    });
    await bumpSurfaceAttempt(input.pool, input.surfaceId, false);
    return {
      ok: false,
      countsAsDistribution: false,
      receiptId,
      detail: "captcha_or_unreachable",
    };
  }

  const m = html.match(/<form[^>]+action=["']([^"']+)["'][^>]*>/i);
  let action: string | null = null;
  if (m?.[1]) {
    try {
      action = new URL(m[1], input.surfaceUrl).toString();
    } catch {
      action = null;
    }
  }
  if (!action || !/^https?:/i.test(action)) {
    const receiptId = await writeDistributionReceipt(input.pool, {
      businessId: input.businessId,
      channelSurfaceId: input.surfaceId,
      hypothesis: "No public form action on directory/resource page",
      externalDestination: input.surfaceUrl,
      externalAction: "no_form_action",
      executorType: input.executorType,
      requestResult: { noForm: true },
      status: "SKIPPED",
      expectedExposure: "none",
      countsAsDistribution: false,
    });
    return {
      ok: false,
      countsAsDistribution: false,
      receiptId,
      detail: "no_form_action",
    };
  }

  try {
    const params = new URLSearchParams({
      name: `${input.businessId} Titan`,
      email: process.env.OUTREACH_REPLY_EMAIL || "care@revenueos.local",
      message: `Resource/listing suggestion for ${input.surfaceName}: ${link}`,
      url: link,
      website: link,
      title: input.businessId,
    });
    const res = await fetch(action, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "RevenueOSTitanOutreach/1.0",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    const ok = res.status >= 200 && res.status < 400;
    const receiptId = await writeDistributionReceipt(input.pool, {
      businessId: input.businessId,
      channelSurfaceId: input.surfaceId,
      hypothesis: `Generic ${input.executorType} form submit`,
      externalDestination: action,
      externalAction: "public_form_resource_pitch",
      executorType: input.executorType,
      requestResult: { status: res.status, page: input.surfaceUrl },
      publicUrl: link,
      status: ok ? "SUBMITTED" : "FAILED",
      expectedExposure: "directory_or_curator_review",
      countsAsDistribution: ok,
      kind: "public_form_resource_pitch",
    });
    if (ok) {
      await input.pool.query(
        `update aq_distribution_receipts set is_new_audience=true where action_id=$1`,
        [receiptId],
      );
      await bumpSurfaceAttempt(input.pool, input.surfaceId, true);
    } else {
      await bumpSurfaceAttempt(input.pool, input.surfaceId, false);
    }
    return {
      ok,
      countsAsDistribution: ok,
      receiptId,
      detail: `form ${res.status}`,
      publicUrl: link,
    };
  } catch (e) {
    const receiptId = await writeDistributionReceipt(input.pool, {
      businessId: input.businessId,
      channelSurfaceId: input.surfaceId,
      hypothesis: "Form submit failed",
      externalDestination: action,
      externalAction: "public_form_failed",
      executorType: input.executorType,
      requestResult: {
        error: e instanceof Error ? e.message : String(e),
      },
      status: "FAILED",
      expectedExposure: "none",
      countsAsDistribution: false,
    });
    return {
      ok: false,
      countsAsDistribution: false,
      receiptId,
      detail: "submit_error",
    };
  }
}

async function listDoorUrls(businessId: string): Promise<string[]> {
  const brandPath = path.join(
    repoRoot(),
    "apps",
    businessId,
    "src/lib/brand.ts",
  );
  if (!existsSync(brandPath)) return [];
  const src = readFileSync(brandPath, "utf8");
  const slugs = [...src.matchAll(/"slug"\s*:\s*"([^"]+)"/g)].map((m) => m[1]!);
  return slugs
    .slice(0, 5)
    .map((s) => `${nativeUrl(businessId)}/${s}/`);
}
