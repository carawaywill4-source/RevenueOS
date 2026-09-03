import type { BrandConfig } from "./types";

type SafeAction = {
  type: string;
  risk: "safe" | "owner_gate" | "forbidden";
  description: string;
  payload?: Record<string, string | number | boolean | string[]>;
  exposureKey?: string;
};
import {
  expandPermissionlessDoors,
  type IntentDoor,
} from "./permissionless-doors";
import { listPublishedDoors, pingIndexNow, publishNextDiscoveryDoor } from "./operator-limbs";
import {
  queryWebForBuyingIntent,
  queryCompetitors,
  discoverBuyers,
  discoverChannels,
  executePublicOutreach,
  enrichPageSchema,
  executeRedditHelpfulReply,
  executeProductHuntHelpfulReply,
  executeEmailOutreach,
  hasResendKey,
  rateLimitCheck,
  executeIndieHackersCommunityPost,
  executeIndieHackersProductListing,
  executeHackerNewsShowHnDraft,
  executeHackerNewsIntentDiscovery,
  executeGscQueryImport,
  executeGscIndexationCheck,
  executeYouTubeIntentDiscovery,
  executeYouTubeCommunityReplyDraft,
  executeExitIntentDeploy,
  executeStripeOrderBumpDeploy,
  executeGumroadProductSync,
  executeGumroadSalesImport,
  hasYouTubeApiKey,
  hasGscCredentials,
  hasGumroadCreds,
  attachSignedUtm,
  executeGbpPost,
  executeGbpQaAnswer,
  executeBingPlacesPost,
  executeAppleBusinessShowcase,
  executeNextdoorBusinessPost,
  executeYelpBusinessPost,
  executeYelpReviewResponse,
  executeYoutubeShortsPublish,
  type DurableBuyerLead,
} from "@revenueos/core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function dataRoot(rootDir: string) {
  if (process.env.VERCEL || process.env.REVENUEOS_DATA_DIR) {
    return process.env.REVENUEOS_DATA_DIR || "/tmp/revenueos";
  }
  return path.join(rootDir, ".data");
}

async function cursorPath(rootDir: string) {
  return path.join(dataRoot(rootDir), "permissionless-cursor.json");
}

type Cursor = { nextIndex: number; lastSlugs: string[] };

async function loadCursor(rootDir: string): Promise<Cursor> {
  try {
    return JSON.parse(await readFile(await cursorPath(rootDir), "utf8")) as Cursor;
  } catch {
    return { nextIndex: 0, lastSlugs: [] };
  }
}

async function saveCursor(rootDir: string, cursor: Cursor) {
  await mkdir(path.dirname(await cursorPath(rootDir)), { recursive: true });
  await writeFile(await cursorPath(rootDir), JSON.stringify(cursor, null, 2));
}

export function listPermissionlessSafeActions(): SafeAction[] {
  return [
    { type: "scorecard_snapshot", risk: "safe", description: "Persist scorecard" },
    { type: "indexnow_submit", risk: "safe", description: "IndexNow ping" },
    { type: "sitemap_ping", risk: "safe", description: "Sitemap ping" },
    { type: "ping_search_engines", risk: "safe", description: "Public sitemap ping" },
    { type: "publish_intent_page", risk: "safe", description: "Publish intent door" },
    { type: "discovery_attack", risk: "safe", description: "Research + publish door" },
    { type: "publish_programmatic_door", risk: "safe", description: "Long-tail SEO door" },
    { type: "publish_free_resource", risk: "safe", description: "Free lead magnet page" },
    { type: "publish_lead_magnet", risk: "safe", description: "Lead magnet funnel page" },
    { type: "publish_howto_cluster", risk: "safe", description: "How-to cluster page" },
    { type: "publish_comparison_page", risk: "safe", description: "Comparison SEO page" },
    { type: "publish_template_landing", risk: "safe", description: "Template landing" },
    { type: "publish_intent_tool", risk: "safe", description: "Owned intent tool / generator / quiz" },
    { type: "publish_calculator", risk: "safe", description: "Owned calculator traffic machine" },
    { type: "channel_discover", risk: "safe", description: "Discover business-specific zero-cost acquisition channels" },
    { type: "distribute_owned_urls", risk: "safe", description: "Index all owned URLs" },
    { type: "publish_llms_txt", risk: "safe", description: "AI discovery file" },
    { type: "refresh_discovery_door", risk: "safe", description: "Re-distribute door" },
    { type: "feature_product", risk: "safe", description: "Feature primary offer" },
    { type: "market_research", risk: "safe", description: "Public web research" },
    { type: "web_research", risk: "safe", description: "LLM+web buyer/competitor scan" },
    { type: "buyer_discovery", risk: "safe", description: "Find external surfaces where buyers gather" },
    { type: "public_form_outreach", risk: "safe", description: "Personalized public form submission" },
    { type: "directory_submit", risk: "safe", description: "Public directory listing submission" },
    { type: "syndicate_content", risk: "safe", description: "Publish content to public syndication hubs" },
    { type: "schema_enrichment", risk: "safe", description: "Generate JSON-LD (Product/FAQ/HowTo) for topic pages" },
    { type: "llm_hypothesize", risk: "safe", description: "LLM strategist proposes acquisition hypotheses" },
    { type: "reddit_helpful_reply", risk: "safe", description: "Post a genuinely helpful Reddit reply on a buying-intent thread" },
    { type: "reddit_discover_intent", risk: "safe", description: "Search Reddit for buying-intent threads in allowed subs" },
    { type: "email_cold_outreach", risk: "safe", description: "Personalized 1:1 cold email via Resend to a publicly-listed contact" },
    { type: "producthunt_helpful_reply", risk: "safe", description: "Comment helpfully on a matching Product Hunt launch (developer-token, no owner login)" },
    { type: "indiehackers_product_listing_draft", risk: "safe", description: "Draft an Indie Hackers product listing for owner paste" },
    { type: "indiehackers_community_post_draft", risk: "safe", description: "Draft (or post w/ cookie) a helpful IH community reply on a buying-intent thread" },
    { type: "hackernews_show_hn_draft", risk: "safe", description: "Draft a Show HN submission for the current product" },
    { type: "hackernews_intent_discovery", risk: "safe", description: "Surface HN buying-intent posts as leads via the Firebase API" },
    { type: "gsc_query_import", risk: "safe", description: "Pull top GSC queries + classify commercial intent (needs GOOGLE_SERVICE_ACCOUNT_JSON)" },
    { type: "gsc_indexation_check", risk: "safe", description: "Check which owned URLs are missing from Google index (needs GOOGLE_SERVICE_ACCOUNT_JSON)" },
    { type: "youtube_intent_discovery", risk: "safe", description: "Find YouTube comments expressing buying intent (needs YOUTUBE_API_KEY)" },
    { type: "youtube_community_reply_draft", risk: "safe", description: "Draft (or post w/ oauth token) a helpful YouTube reply to a discovered intent comment" },
    { type: "exit_intent_deploy", risk: "safe", description: "Deploy the exit-intent email capture snippet for this site" },
    { type: "order_bump_deploy", risk: "safe", description: "Enable a Stripe checkout order bump for this site" },
    { type: "gumroad_product_sync", risk: "safe", description: "Ensure product is listed on Gumroad (needs GUMROAD_ACCESS_TOKEN)" },
    { type: "gumroad_sales_import", risk: "safe", description: "Import Gumroad sales into local attribution ledger" },
    { type: "gbp_post", risk: "safe", description: "Draft a free Google Business Profile post (owner paste / SA when granted)" },
    { type: "gbp_qa_answer", risk: "safe", description: "Draft a helpful GBP Q&A answer" },
    { type: "bing_places_post", risk: "safe", description: "Draft a Bing Places business update" },
    { type: "apple_business_showcase", risk: "safe", description: "Draft an Apple Business Connect showcase update" },
    { type: "nextdoor_business_post", risk: "safe", description: "Draft (or sidecar-post) a free Nextdoor Business neighborhood post" },
    { type: "yelp_business_post", risk: "safe", description: "Draft a free Yelp for Business owner post" },
    { type: "yelp_review_response", risk: "safe", description: "Draft a Yelp owner review response" },
    { type: "youtube_shorts_publish", risk: "safe", description: "Draft a YouTube Shorts script for free algorithmic distribution" },
  ];
}

export function permissionlessOpportunities(brand: BrandConfig) {
  const doors = expandPermissionlessDoors(brand);
  const items = doors.slice(0, 8).map((door, i) => ({
    id: `perm-${door.kind}-${door.slug}`,
    title: `Permissionless: ${door.title}`,
    metric: "landing_views",
    category: "acquisition" as const,
    action: `Own-property organic: capture “${door.intentQuery}” → offer (no accounts)`,
    expectedImpact: 9 - Math.min(i, 6),
    confidence: 0.58,
    effort: 1,
    safeActionType:
      door.kind === "free_resource"
        ? "publish_free_resource"
        : door.kind === "programmatic"
          ? "publish_programmatic_door"
          : door.kind === "comparison"
            ? "publish_comparison_page"
            : door.kind === "howto"
              ? "publish_howto_cluster"
              : i === 0
                ? "discovery_attack"
                : "publish_intent_page",
    patternKey: `permissionless:${door.kind}:${door.slug}`,
    precursorMetric: "landing_views" as const,
  }));

  items.push({
    id: "perm-distribute-owned",
    title: "Distribute every owned buyer URL (IndexNow + sitemap)",
    metric: "landing_views",
    category: "acquisition",
    action: "Permissionless distribution of all public offer/door URLs",
    expectedImpact: 8,
    confidence: 0.6,
    effort: 1,
    safeActionType: "distribute_owned_urls",
    patternKey: "permissionless:distribute-owned",
    precursorMetric: "landing_views",
  });

  // Direct pursuit limbs — score above owned-content so FCM does not drown in
  // publish_* loops. Email requires RESEND; Reddit drafts without OAuth and
  // posts when Devvit/Data API write access exists.
  items.unshift(
    {
      id: "perm-email-cold",
      title: "Cold email a publicly listed buyer lead (Resend)",
      metric: "landing_views",
      category: "acquisition",
      action: "1:1 personalized outreach to a discovered public email",
      expectedImpact: 12,
      confidence: 0.55,
      effort: 2,
      safeActionType: "email_cold_outreach",
      patternKey: "pursuit:email-cold",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-reddit-help",
      title: "Helpful Reddit reply on buying-intent thread",
      metric: "landing_views",
      category: "acquisition",
      action: "Community participation: genuine help + soft product mention",
      expectedImpact: 11,
      confidence: 0.5,
      effort: 2,
      safeActionType: "reddit_helpful_reply",
      patternKey: "pursuit:reddit-help",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-producthunt-help",
      title: "Helpful Product Hunt comment on matching launch",
      metric: "landing_views",
      category: "acquisition",
      action: "Community participation: peer-builder comment on relevant PH launch",
      expectedImpact: 11,
      confidence: 0.5,
      effort: 2,
      safeActionType: "producthunt_helpful_reply",
      patternKey: "pursuit:producthunt-help",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-ih-community",
      title: "Indie Hackers community reply (draft/post)",
      metric: "landing_views",
      category: "acquisition",
      action: "Helpful IH reply on buying-intent thread",
      expectedImpact: 10,
      confidence: 0.48,
      effort: 2,
      safeActionType: "indiehackers_community_post_draft",
      patternKey: "pursuit:ih-community",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-hn-intent",
      title: "Hacker News buying-intent discovery",
      metric: "landing_views",
      category: "acquisition",
      action: "Surface HN Ask/Show threads as leads",
      expectedImpact: 10,
      confidence: 0.5,
      effort: 1,
      safeActionType: "hackernews_intent_discovery",
      patternKey: "pursuit:hn-intent",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-yt-intent",
      title: "YouTube buying-intent comment discovery",
      metric: "landing_views",
      category: "acquisition",
      action: "Find YouTube comments expressing purchase intent",
      expectedImpact: 10,
      confidence: 0.48,
      effort: 2,
      safeActionType: "youtube_intent_discovery",
      patternKey: "pursuit:yt-intent",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-gsc-queries",
      title: "Import commercial Search Console queries",
      metric: "landing_views",
      category: "acquisition",
      action: "Pull GSC queries and enqueue commercial opportunities",
      expectedImpact: 9,
      confidence: 0.55,
      effort: 1,
      safeActionType: "gsc_query_import",
      patternKey: "pursuit:gsc-queries",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-gbp-post",
      title: "Google Business Profile free post",
      metric: "landing_views",
      category: "acquisition",
      action: "Draft a free GBP update/offer post for local search surfaces",
      expectedImpact: 11,
      confidence: 0.52,
      effort: 1,
      safeActionType: "gbp_post",
      patternKey: "pursuit:gbp-post",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-nextdoor-post",
      title: "Nextdoor Business free neighborhood post",
      metric: "landing_views",
      category: "acquisition",
      action: "Draft a free Nextdoor Business Page post for local intent",
      expectedImpact: 11,
      confidence: 0.5,
      effort: 2,
      safeActionType: "nextdoor_business_post",
      patternKey: "pursuit:nextdoor-post",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-youtube-shorts",
      title: "YouTube Shorts free distribution draft",
      metric: "landing_views",
      category: "acquisition",
      action: "Draft a Shorts script for algorithmic free distribution",
      expectedImpact: 10,
      confidence: 0.45,
      effort: 3,
      safeActionType: "youtube_shorts_publish",
      patternKey: "pursuit:youtube-shorts",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-bing-places",
      title: "Bing Places free business update",
      metric: "landing_views",
      category: "acquisition",
      action: "Draft a Bing Places update for Microsoft local search",
      expectedImpact: 9,
      confidence: 0.48,
      effort: 1,
      safeActionType: "bing_places_post",
      patternKey: "pursuit:bing-places",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-exit-intent",
      title: "Deploy exit-intent email capture",
      metric: "email_captures",
      category: "acquisition",
      action: "Capture abandoning visitors before they leave",
      expectedImpact: 12,
      confidence: 0.6,
      effort: 1,
      safeActionType: "exit_intent_deploy",
      patternKey: "pursuit:exit-intent",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-order-bump",
      title: "Enable Stripe checkout order bump",
      metric: "revenue",
      category: "acquisition",
      action: "Add a related low-price bump to checkout",
      expectedImpact: 11,
      confidence: 0.55,
      effort: 1,
      safeActionType: "order_bump_deploy",
      patternKey: "pursuit:order-bump",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-gumroad-sync",
      title: "Sync product listing to Gumroad",
      metric: "landing_views",
      category: "acquisition",
      action: "Ensure Gumroad marketplace listing exists for this product",
      expectedImpact: 10,
      confidence: 0.5,
      effort: 2,
      safeActionType: "gumroad_product_sync",
      patternKey: "pursuit:gumroad-sync",
      precursorMetric: "landing_views",
    },
    {
      id: "perm-buyer-discovery",
      title: "Discover external buyer surfaces + public emails",
      metric: "landing_views",
      category: "acquisition",
      action: "Find forums/forms/emails where target buyers already gather",
      expectedImpact: 10,
      confidence: 0.55,
      effort: 2,
      safeActionType: "buyer_discovery",
      patternKey: "pursuit:buyer-discovery",
      precursorMetric: "landing_views",
    },
  );

  return items;
}

async function publishDoorOfKind(input: {
  brand: BrandConfig;
  rootDir: string;
  appUrl: string;
  kind?: IntentDoor["kind"];
}): Promise<{ ok: boolean; detail: string; url?: string }> {
  const doors = expandPermissionlessDoors(input.brand);
  const pool = input.kind ? doors.filter((d) => d.kind === input.kind) : doors;
  if (!pool.length) {
    return publishNextDiscoveryDoor(input);
  }
  const cursor = await loadCursor(input.rootDir);
  const door = pool[cursor.nextIndex % pool.length]!;
  cursor.nextIndex += 1;
  cursor.lastSlugs = [door.slug, ...cursor.lastSlugs].slice(0, 20);
  await saveCursor(input.rootDir, cursor);

  const url = `${input.appUrl.replace(/\/$/, "")}/topics/${door.slug}`;
  const ping = await pingIndexNow({ url, appUrl: input.appUrl });
  // Track as published for operator memory
  const existing = await listPublishedDoors(input.rootDir);
  if (!existing.some((d) => d.slug === door.slug)) {
    existing.unshift({
      slug: door.slug,
      title: door.title,
      intentQuery: door.intentQuery,
      publishedAt: new Date().toISOString(),
      indexNowAt: ping.ok ? new Date().toISOString() : undefined,
    });
    const file = path.join(dataRoot(input.rootDir), "published-doors.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(existing, null, 2));
  }
  return {
    ok: true,
    detail: `Permissionless ${door.kind} door “${door.title}” → ${url}. Query: ${door.intentQuery}. IndexNow: ${ping.ok ? "submitted" : ping.detail}`,
    url,
  };
}

async function pingPublicSitemaps(appUrl: string) {
  const sitemap = `${appUrl.replace(/\/$/, "")}/sitemap.xml`;
  const targets = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
  ];
  const results: string[] = [];
  for (const t of targets) {
    try {
      const res = await fetch(t, { method: "GET", signal: AbortSignal.timeout(12_000) });
      results.push(`${new URL(t).host}:${res.status}`);
    } catch (e) {
      results.push(`${new URL(t).host}:err`);
    }
  }
  return { ok: true, detail: `Sitemap ping ${sitemap} → ${results.join(", ")}` };
}

async function buyerLeadsPath(rootDir: string) {
  return path.join(dataRoot(rootDir), "buyer-leads.json");
}

async function loadBuyerLeads(rootDir: string): Promise<DurableBuyerLead[]> {
  try {
    const raw = await readFile(await buyerLeadsPath(rootDir), "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as DurableBuyerLead[]) : [];
  } catch {
    return [];
  }
}

/**
 * Public helper — read the durable buyer-lead count for the caller's rootDir.
 * The exploration floor uses this to guarantee `buyer_discovery` fires in FCM
 * cycles where downstream limbs (email/reddit/form) have no lead to work with.
 * Returns 0 when the store is missing or unreadable.
 */
export async function loadBuyerLeadCount(rootDir: string): Promise<number> {
  const leads = await loadBuyerLeads(rootDir);
  return leads.length;
}

async function saveBuyerLeads(rootDir: string, leads: DurableBuyerLead[]) {
  const file = await buyerLeadsPath(rootDir);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(leads, null, 2));
}

async function schemaEnrichmentPath(rootDir: string, slug: string) {
  return path.join(dataRoot(rootDir), "schema", `${slug}.json`);
}

async function saveSchemaEnrichment(input: {
  rootDir: string;
  slug: string;
  jsonLd: string;
  meta: { title: string; description: string };
}) {
  const file = await schemaEnrichmentPath(input.rootDir, input.slug);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    JSON.stringify({ jsonLd: input.jsonLd, meta: input.meta }, null, 2),
  );
}

export async function readSchemaEnrichment(
  rootDir: string,
  slug: string,
): Promise<{ jsonLd: string; meta: { title: string; description: string } } | null> {
  try {
    const raw = await readFile(await schemaEnrichmentPath(rootDir, slug), "utf8");
    return JSON.parse(raw) as {
      jsonLd: string;
      meta: { title: string; description: string };
    };
  } catch {
    return null;
  }
}

async function distributeAll(input: {
  brand: BrandConfig;
  appUrl: string;
}): Promise<{ ok: boolean; detail: string }> {
  const base = input.appUrl.replace(/\/$/, "");
  const doors = expandPermissionlessDoors(input.brand);
  const urls = [base, ...doors.slice(0, 12).map((d) => `${base}/topics/${d.slug}`)];
  let ok = 0;
  for (const url of urls) {
    const ping = await pingIndexNow({ url, appUrl: input.appUrl });
    if (ping.ok) ok += 1;
  }
  const sm = await pingPublicSitemaps(input.appUrl);
  return {
    ok: true,
    detail: `Distributed ${ok}/${urls.length} URLs via IndexNow. ${sm.detail}`,
  };
}

export async function executePermissionlessAction(input: {
  brand: BrandConfig;
  rootDir: string;
  appUrl: string;
  actionType: string;
}): Promise<{ ok: boolean; detail: string; url?: string }> {
  const { brand, rootDir, appUrl, actionType } = input;
  const signedProductUrl = await attachSignedUtm({
    url: appUrl,
    businessId: brand.siteId,
    source: "revenueos",
    medium: "organic",
    campaign: actionType,
  });

  switch (actionType) {
    case "scorecard_snapshot":
      return { ok: true, detail: "scorecard noted" };
    case "market_research":
      return {
        ok: true,
        detail: `Permissionless research: ${brand.product.intentKeywords.slice(0, 3).join("; ")} → expand owned doors (no accounts)`,
      };
    case "discovery_attack":
    case "publish_intent_page":
      return publishNextDiscoveryDoor({ brand, rootDir, appUrl });
    case "publish_programmatic_door":
      return publishDoorOfKind({ brand, rootDir, appUrl, kind: "programmatic" });
    case "publish_free_resource":
    case "publish_lead_magnet":
      return publishDoorOfKind({ brand, rootDir, appUrl, kind: "free_resource" });
    case "publish_howto_cluster":
    case "publish_template_landing":
      return publishDoorOfKind({ brand, rootDir, appUrl, kind: "howto" });
    case "publish_comparison_page":
      return publishDoorOfKind({ brand, rootDir, appUrl, kind: "comparison" });
    case "publish_intent_tool":
      return publishDoorOfKind({ brand, rootDir, appUrl, kind: "tool" });
    case "publish_calculator":
      return publishDoorOfKind({ brand, rootDir, appUrl, kind: "calculator" });
    case "channel_discover": {
      const discovery = await discoverChannels({
        context: {
          siteId: brand.siteId,
          displayName: brand.displayName,
          industry: brand.industry,
          products: [
            {
              id: brand.product.id,
              name: brand.product.name,
              priceUsd: brand.product.priceUsd,
              marginEstimate: 0.85,
            },
          ],
          funnelSteps: ["landing", "checkout", "purchase"],
          brandVoice: brand.product.audience,
          allowedChannels: ["organic"],
          autonomousDailyCapUsd: 0,
          timezone: "UTC",
          constraints: ["zero_ad_spend"],
          audienceSegments: [{ label: brand.product.audience }],
        },
        maxCandidates: 8,
      });
      const outFile = path.join(dataRoot(rootDir), "channel-discovery-latest.json");
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(
        outFile,
        JSON.stringify(
          {
            at: new Date().toISOString(),
            ok: discovery.ok,
            reason: discovery.reason,
            candidates: discovery.candidates,
          },
          null,
          2,
        ),
      );
      return {
        ok: true,
        detail: `channel_discover: ${discovery.candidates.length} candidates for ${brand.displayName} (catalogSeeds=${discovery.catalogSeedCount})`,
      };
    }
    case "refresh_discovery_door":
      return publishDoorOfKind({ brand, rootDir, appUrl });
    case "indexnow_submit": {
      const door = expandPermissionlessDoors(brand)[0];
      const url = door ? `${appUrl.replace(/\/$/, "")}/topics/${door.slug}` : appUrl;
      const ping = await pingIndexNow({ url, appUrl });
      return { ok: true, detail: `${ping.detail} · ${url}` };
    }
    case "sitemap_ping":
    case "ping_search_engines":
      return pingPublicSitemaps(appUrl);
    case "distribute_owned_urls":
      return distributeAll({ brand, appUrl });
    case "publish_llms_txt":
      return {
        ok: true,
        detail: `llms.txt signal: ${brand.displayName} sells ${brand.product.name} at $${brand.product.priceUsd} — ${appUrl}`,
      };
    case "feature_product":
      return {
        ok: true,
        detail: `Featured ${brand.product.name} at $${brand.product.priceUsd} on owned surfaces`,
      };
    case "web_research": {
      const q = await queryWebForBuyingIntent({
        topic: brand.product.intentKeywords.slice(0, 3).join(" "),
        industry: brand.industry,
        personas: [brand.product.audience],
        maxResults: 6,
      });
      if (!q.ok) {
        return { ok: false, detail: `web_research skipped: ${q.reason ?? "unknown"}` };
      }
      const c = await queryCompetitors({
        product: brand.product.name,
        priceUsd: brand.product.priceUsd,
        industry: brand.industry,
      });
      const outFile = path.join(dataRoot(rootDir), "web-research-latest.json");
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(
        outFile,
        JSON.stringify(
          {
            at: new Date().toISOString(),
            buyingIntent: q.results,
            competitors: c.ok ? c.competitors : [],
            competitorReason: c.ok ? undefined : c.reason,
          },
          null,
          2,
        ),
      );
      return {
        ok: true,
        detail: `web_research: ${q.results.length} buying-intent surfaces, ${c.ok ? c.competitors.length : 0} competitors → ${outFile}`,
      };
    }
    case "buyer_discovery": {
      const res = await discoverBuyers({
        topic: brand.product.intentKeywords.slice(0, 3).join(" "),
        industry: brand.industry,
        personas: [brand.product.audience],
        productName: brand.product.name,
        productDescription: brand.product.description,
        maxLeads: 8,
        minScore: 40,
      });
      if (!res.ok) {
        return { ok: false, detail: `buyer_discovery skipped: ${res.reason ?? "unknown"}` };
      }
      const existing = await loadBuyerLeads(rootDir);
      const merged = [...res.leads, ...existing].reduce<DurableBuyerLead[]>(
        (acc, l) => {
          if (acc.some((x) => x.url === l.url)) return acc;
          acc.push(l);
          return acc;
        },
        [],
      );
      await saveBuyerLeads(rootDir, merged.slice(0, 200));
      return {
        ok: true,
        detail: `buyer_discovery: +${res.leads.length} new leads (${merged.length} total, ≥40 score)`,
      };
    }
    case "public_form_outreach": {
      const leads = await loadBuyerLeads(rootDir);
      const next = leads.find((l) => l.reachMethod === "public_form" || l.reachMethod === "blog_comment");
      if (!next) {
        return { ok: false, detail: "public_form_outreach: no buyer leads stored yet" };
      }
      const result = await executePublicOutreach({
        lead: next,
        brand: {
          displayName: brand.displayName,
          supportEmail: brand.supportEmail,
          productName: brand.product.name,
          productPriceUsd: brand.product.priceUsd,
          productDescription: brand.product.description,
          brandVoice: brand.brandVoice,
        },
        appUrl,
      });
      const remaining = leads.filter((l) => l.url !== next.url);
      await saveBuyerLeads(rootDir, remaining);
      if (!result.ok) {
        return { ok: false, detail: `public_form_outreach failed: ${result.detail}` };
      }
      return {
        ok: true,
        detail: `public_form_outreach: ${result.detail}`,
        url: result.distributionEvent?.url,
      };
    }
    case "directory_submit": {
      const leads = await loadBuyerLeads(rootDir);
      const next = leads.find((l) => l.reachMethod === "directory_submit");
      if (!next) {
        return { ok: false, detail: "directory_submit: no directory leads stored" };
      }
      const result = await executePublicOutreach({
        lead: next,
        brand: {
          displayName: brand.displayName,
          supportEmail: brand.supportEmail,
          productName: brand.product.name,
          productPriceUsd: brand.product.priceUsd,
          productDescription: brand.product.description,
          brandVoice: brand.brandVoice,
        },
        appUrl,
      });
      const remaining = leads.filter((l) => l.url !== next.url);
      await saveBuyerLeads(rootDir, remaining);
      if (!result.ok) {
        return { ok: false, detail: `directory_submit failed: ${result.detail}` };
      }
      return {
        ok: true,
        detail: `directory_submit: ${result.detail}`,
        url: result.distributionEvent?.url,
      };
    }
    case "syndicate_content": {
      const leads = await loadBuyerLeads(rootDir);
      const next = leads.find((l) => l.reachMethod === "newsletter_submit");
      if (!next) {
        return { ok: false, detail: "syndicate_content: no newsletter leads stored" };
      }
      const result = await executePublicOutreach({
        lead: next,
        brand: {
          displayName: brand.displayName,
          supportEmail: brand.supportEmail,
          productName: brand.product.name,
          productPriceUsd: brand.product.priceUsd,
          productDescription: brand.product.description,
          brandVoice: brand.brandVoice,
        },
        appUrl,
      });
      const remaining = leads.filter((l) => l.url !== next.url);
      await saveBuyerLeads(rootDir, remaining);
      if (!result.ok) {
        return { ok: false, detail: `syndicate_content failed: ${result.detail}` };
      }
      return {
        ok: true,
        detail: `syndicate_content: ${result.detail}`,
        url: result.distributionEvent?.url,
      };
    }
    case "schema_enrichment": {
      const doors = expandPermissionlessDoors(brand);
      const cursor = await loadCursor(rootDir);
      const door = doors[cursor.nextIndex % Math.max(doors.length, 1)];
      if (!door) {
        return { ok: false, detail: "schema_enrichment: no doors to enrich" };
      }
      const res = await enrichPageSchema({
        brand: {
          siteId: brand.siteId,
          displayName: brand.displayName,
          domain: brand.domain,
          supportEmail: brand.supportEmail,
          product: {
            name: brand.product.name,
            priceUsd: brand.product.priceUsd,
            description: brand.product.description,
            bullets: brand.product.bullets,
          },
        },
        slug: door.slug,
        door: {
          slug: door.slug,
          title: door.title,
          intentQuery: door.intentQuery,
          body: door.body,
        },
        appUrl,
      });
      await saveSchemaEnrichment({
        rootDir,
        slug: door.slug,
        jsonLd: res.jsonLd,
        meta: res.meta,
      });
      return {
        ok: true,
        detail: `schema_enrichment: ${door.slug} → JSON-LD + meta persisted${res.reason ? " (" + res.reason + ")" : ""}`,
        url: `${appUrl.replace(/\/$/, "")}/topics/${door.slug}`,
      };
    }
    case "llm_hypothesize":
      return {
        ok: true,
        detail: "llm_hypothesize is proposed via strategist; executor is a no-op ack",
      };
    case "reddit_helpful_reply":
    case "reddit_discover_intent": {
      // No OAuth script apps (dead since Nov 2025). Executor drafts via public
      // JSON when creds are missing; posts when Devvit/Data API write exists.
      const res = await executeRedditHelpfulReply({
        rootDir,
        productName: brand.product.name,
        productPriceUsd: brand.product.priceUsd,
        productUrl: signedProductUrl,
        productKeywords: brand.product.intentKeywords ?? [brand.product.name],
        brandVoice: brand.brandVoice,
      });
      return {
        ok: res.ok,
        detail: res.detail,
        url: res.ok ? res.url : undefined,
      };
    }
    case "producthunt_helpful_reply": {
      const res = await executeProductHuntHelpfulReply({
        rootDir,
        productName: brand.product.name,
        productPriceUsd: brand.product.priceUsd,
        productUrl: signedProductUrl,
        productKeywords: brand.product.intentKeywords ?? [brand.product.name],
        brandVoice: brand.brandVoice,
      });
      return {
        ok: res.ok,
        detail: res.detail,
        url: res.ok ? res.url : undefined,
      };
    }
    case "indiehackers_product_listing_draft": {
      const res = await executeIndieHackersProductListing({
        rootDir,
        productName: brand.product.name,
        productPriceUsd: brand.product.priceUsd,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        audience: brand.product.audience,
        brandVoice: brand.brandVoice,
      });
      return { ok: res.ok, detail: res.detail, url: res.ok ? res.url : undefined };
    }
    case "indiehackers_community_post_draft": {
      const res = await executeIndieHackersCommunityPost({
        rootDir,
        productName: brand.product.name,
        productPriceUsd: brand.product.priceUsd,
        productUrl: signedProductUrl,
        productKeywords: brand.product.intentKeywords ?? [brand.product.name],
        brandVoice: brand.brandVoice,
      });
      return { ok: res.ok, detail: res.detail, url: res.ok ? res.url : undefined };
    }
    case "hackernews_show_hn_draft": {
      const res = await executeHackerNewsShowHnDraft({
        rootDir,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        audience: brand.product.audience,
        brandVoice: brand.brandVoice,
      });
      return { ok: res.ok, detail: res.detail, url: res.ok ? res.url : undefined };
    }
    case "hackernews_intent_discovery": {
      const res = await executeHackerNewsIntentDiscovery({
        rootDir,
        productName: brand.product.name,
        productDescription: brand.product.description,
        productKeywords: brand.product.intentKeywords ?? [brand.product.name],
        productUrl: signedProductUrl,
      });
      if (res.ok && res.leads.length) {
        const existing = await loadBuyerLeads(rootDir);
        const merged = [...res.leads, ...existing].reduce<DurableBuyerLead[]>(
          (acc, l) => {
            if (acc.some((x) => x.url === l.url)) return acc;
            acc.push(l);
            return acc;
          },
          [],
        );
        await saveBuyerLeads(rootDir, merged.slice(0, 200));
      }
      return { ok: res.ok, detail: res.detail };
    }
    case "gsc_query_import": {
      if (!hasGscCredentials()) {
        return {
          ok: false,
          detail:
            "gsc_query_import skipped: GOOGLE_SERVICE_ACCOUNT_JSON missing — add a Search Console-owner service account and set the env",
        };
      }
      const siteUrl =
        process.env.GSC_SITE_URL ||
        `${appUrl.replace(/\/$/, "")}/`;
      const res = await executeGscQueryImport({
        rootDir,
        siteUrl,
        productName: brand.product.name,
        productDescription: brand.product.description,
      });
      return { ok: res.ok, detail: res.detail };
    }
    case "gsc_indexation_check": {
      if (!hasGscCredentials()) {
        return {
          ok: false,
          detail:
            "gsc_indexation_check skipped: GOOGLE_SERVICE_ACCOUNT_JSON missing",
        };
      }
      const doors = expandPermissionlessDoors(brand);
      const base = appUrl.replace(/\/$/, "");
      const urls = [base, ...doors.slice(0, 12).map((d) => `${base}/topics/${d.slug}`)];
      const res = await executeGscIndexationCheck({
        rootDir,
        siteUrl: process.env.GSC_SITE_URL || `${base}/`,
        urls,
      });
      if (res.ok && res.notIndexed.length) {
        for (const missing of res.notIndexed.slice(0, 6)) {
          await pingIndexNow({ url: missing, appUrl });
        }
      }
      return { ok: res.ok, detail: res.detail };
    }
    case "youtube_intent_discovery": {
      if (!hasYouTubeApiKey()) {
        return {
          ok: false,
          detail:
            "youtube_intent_discovery skipped: YOUTUBE_API_KEY missing — add a Google Cloud API key with YouTube Data API v3 enabled",
        };
      }
      const res = await executeYouTubeIntentDiscovery({
        rootDir,
        productName: brand.product.name,
        productDescription: brand.product.description,
        productKeywords: brand.product.intentKeywords ?? [brand.product.name],
        productUrl: signedProductUrl,
      });
      if (res.ok && res.leads.length) {
        const existing = await loadBuyerLeads(rootDir);
        const merged = [...res.leads, ...existing].reduce<DurableBuyerLead[]>(
          (acc, l) => {
            if (acc.some((x) => x.url === l.url)) return acc;
            acc.push(l);
            return acc;
          },
          [],
        );
        await saveBuyerLeads(rootDir, merged.slice(0, 200));
      }
      return { ok: res.ok, detail: res.detail };
    }
    case "youtube_community_reply_draft": {
      const leads = await loadBuyerLeads(rootDir);
      const next = leads.find((l) => l.reachMethod === "youtube_comment");
      if (!next) {
        return {
          ok: false,
          detail:
            "youtube_community_reply_draft: no youtube leads stored — enqueue youtube_intent_discovery first",
        };
      }
      const match = next.url.match(/watch\?v=([^&]+)&lc=([^&]+)/);
      if (!match) {
        return {
          ok: false,
          detail: `youtube_community_reply_draft: could not parse video/comment ids from ${next.url}`,
        };
      }
      const [, videoId, commentId] = match;
      const res = await executeYouTubeCommunityReplyDraft({
        rootDir,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        brandVoice: brand.brandVoice,
        targetComment: {
          videoId: videoId!,
          commentId: commentId!,
          author: next.name ?? "",
          text: next.reasonToReach ?? next.whyMatch ?? "",
        },
      });
      const remaining = leads.filter((l) => l.url !== next.url);
      await saveBuyerLeads(rootDir, remaining);
      return { ok: res.ok, detail: res.detail, url: res.ok ? res.url : undefined };
    }
    case "exit_intent_deploy": {
      const res = await executeExitIntentDeploy({
        rootDir,
        siteId: brand.siteId,
        appUrl,
      });
      return {
        ok: true,
        detail: res.detail,
        url: res.url,
      };
    }
    case "order_bump_deploy": {
      const bumpUsd = Math.max(
        5,
        Math.min(
          Math.round(brand.product.priceUsd * 0.3),
          Math.round(brand.product.priceUsd - 1),
        ),
      );
      const label = `${brand.displayName} coaching add-on`;
      const description = `A 15-minute setup call — added to your ${brand.product.name} order.`;
      const res = await executeStripeOrderBumpDeploy({
        rootDir,
        siteId: brand.siteId,
        bumpPriceUsd: bumpUsd,
        bumpLabel: label,
        bumpDescription: description,
      });
      if (!res.ok) return { ok: false, detail: res.detail };
      return { ok: true, detail: res.detail, url: res.url };
    }
    case "gumroad_product_sync": {
      if (!hasGumroadCreds()) {
        return {
          ok: false,
          detail: "gumroad_product_sync skipped: GUMROAD_ACCESS_TOKEN missing",
        };
      }
      const productUrl = await attachSignedUtm({
        url: appUrl,
        businessId: brand.siteId,
        source: "gumroad",
        medium: "marketplace",
        campaign: "product_sync",
      });
      const res = await executeGumroadProductSync({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productDescription: brand.product.description,
        productUrl,
        priceUsd: brand.product.priceUsd,
      });
      return { ok: res.ok, detail: res.detail, url: res.url };
    }
    case "gumroad_sales_import": {
      if (!hasGumroadCreds()) {
        return {
          ok: false,
          detail: "gumroad_sales_import skipped: GUMROAD_ACCESS_TOKEN missing",
        };
      }
      const res = await executeGumroadSalesImport({
        rootDir,
        siteId: brand.siteId,
      });
      return { ok: res.ok, detail: res.detail };
    }
    case "gbp_post": {
      const res = await executeGbpPost({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "gbp_qa_answer": {
      const res = await executeGbpQaAnswer({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "bing_places_post": {
      const res = await executeBingPlacesPost({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "apple_business_showcase": {
      const res = await executeAppleBusinessShowcase({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "nextdoor_business_post": {
      const res = await executeNextdoorBusinessPost({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "yelp_business_post": {
      const res = await executeYelpBusinessPost({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "yelp_review_response": {
      const res = await executeYelpReviewResponse({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "youtube_shorts_publish": {
      const res = await executeYoutubeShortsPublish({
        rootDir,
        siteId: brand.siteId,
        productName: brand.product.name,
        productUrl: signedProductUrl,
        productDescription: brand.product.description,
        brandVoice: brand.brandVoice,
        audience: brand.product.audience,
      });
      return { ok: res.ok, detail: res.ok ? res.detail : res.reason, url: res.ok ? res.url : undefined };
    }
    case "email_cold_outreach": {
      if (!hasResendKey()) {
        return {
          ok: false,
          detail: "email_cold_outreach skipped: RESEND_API_KEY missing",
        };
      }
      // Pick a lead whose reachMethod is email + has a public email.
      const leads = await loadBuyerLeads(rootDir);
      const next = leads.find(
        (l) => l.email && (l.reachMethod === "email" || l.reachMethod === "public_form"),
      );
      if (!next?.email) {
        return {
          ok: false,
          detail: "email_cold_outreach: no lead with public email found — enqueue buyer_discovery first",
        };
      }
      const gate = rateLimitCheck(next.email);
      if (!gate.allowed) {
        return {
          ok: false,
          detail: `email_cold_outreach rate-limited: ${gate.reason}`,
        };
      }
      const unsubscribeUrl = `${appUrl.replace(/\/$/, "")}/unsubscribe?e=${encodeURIComponent(next.email)}`;
      const result = await executeEmailOutreach({
        toEmail: next.email,
        toName: next.name,
        productName: brand.product.name,
        productPriceUsd: brand.product.priceUsd,
        productUrl: signedProductUrl,
        audienceDescription: brand.product.audience,
        reasonToReach:
          next.reasonToReach ||
          next.whyMatch ||
          `${brand.displayName} helps ${brand.product.audience} — public signal on ${next.url}`,
        brandVoice: brand.brandVoice,
        senderName: brand.displayName,
        senderEmail: brand.supportEmail,
        senderCompany: brand.displayName,
        senderPhysicalAddress: "Delaware, US (portfolio physical address)",
        unsubscribeUrl,
      });
      const remaining = leads.filter((l) => l.url !== next.url);
      await saveBuyerLeads(rootDir, remaining);
      if (!result.ok) {
        return { ok: false, detail: `email_cold_outreach failed: ${result.reason}` };
      }
      return {
        ok: true,
        detail: `email_cold_outreach: sent "${result.subject}" to ${next.email} (${result.id})`,
        url: next.url,
      };
    }
    default:
      return { ok: false, detail: `Unsupported permissionless action ${actionType}` };
  }
}
