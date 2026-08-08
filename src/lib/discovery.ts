import type {
  DiscoveryDoor,
  DiscoveryDoorMetrics,
} from "@revenueos/core";
import {
  growthStorageIsConfigured,
  isMissingGrowthStorageError,
} from "@/lib/growth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { readSearchConsoleDoorMetrics } from "@/lib/search-console";

const SITE_ID = "tributeready";
const BASE = "https://tributeready.org";

/**
 * Static high-intent pages managed as discovery doors. TributeReady does not
 * have a Mendhaus-style topic CMS — Phase 1 puts existing SEO pages under the
 * governor with honest on-site telemetry (landing_view.page).
 */
export type TributeDiscoveryPage = {
  /** Matches GrowthPageView / growth_events.metadata.page */
  pageKey: string;
  slug: string;
  path: string;
  query: string;
  clusterKey: string;
  /** Approximate first-publish for measurement windows. */
  publishedAt: string;
};

export const TRIBUTE_DISCOVERY_CATALOG: TributeDiscoveryPage[] = [
  {
    pageKey: "funeral_program",
    slug: "funeral-program-maker",
    path: "/funeral-program-maker",
    query: "funeral program maker",
    clusterKey: "funeral-program",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "obituary",
    slug: "obituary-writer",
    path: "/obituary-writer",
    query: "obituary writer",
    clusterKey: "obituary",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "celebration",
    slug: "celebration-of-life-program",
    path: "/celebration-of-life-program",
    query: "celebration of life program",
    clusterKey: "celebration",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "funeral_program_cost",
    slug: "funeral-program-cost",
    path: "/funeral-program-cost",
    query: "funeral program cost",
    clusterKey: "funeral-program",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "funeral_program_examples",
    slug: "funeral-program-examples",
    path: "/funeral-program-examples",
    query: "funeral program examples",
    clusterKey: "funeral-program",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "funeral_program_word",
    slug: "funeral-program-template-word",
    path: "/funeral-program-template-word",
    query: "funeral program template word",
    clusterKey: "funeral-program",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "funeral_program_google_docs",
    slug: "funeral-program-google-docs",
    path: "/funeral-program-google-docs",
    query: "funeral program google docs",
    clusterKey: "funeral-program",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "funeral_pamphlet",
    slug: "funeral-pamphlet-template",
    path: "/funeral-pamphlet-template",
    query: "funeral pamphlet template",
    clusterKey: "funeral-program",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "obituary_templates",
    slug: "obituary-templates",
    path: "/obituary-templates",
    query: "obituary templates",
    clusterKey: "obituary",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "order_of_service_templates",
    slug: "order-of-service-templates",
    path: "/order-of-service-templates",
    query: "order of service templates",
    clusterKey: "funeral-program",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "eulogy_examples",
    slug: "eulogy-examples",
    path: "/eulogy-examples",
    query: "eulogy examples",
    clusterKey: "eulogy",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "funeral_readings",
    slug: "funeral-readings",
    path: "/funeral-readings",
    query: "funeral readings",
    clusterKey: "readings",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "where_to_print",
    slug: "where-to-print-funeral-programs",
    path: "/where-to-print-funeral-programs",
    query: "where to print funeral programs",
    clusterKey: "print",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    pageKey: "resources",
    slug: "resources",
    path: "/resources",
    query: "funeral program resources",
    clusterKey: "resources",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
];

export function catalogEntryForDoor(door: DiscoveryDoor): TributeDiscoveryPage | undefined {
  return TRIBUTE_DISCOVERY_CATALOG.find(
    (entry) => entry.slug === door.slug || `door_${entry.slug}` === door.id,
  );
}

export function doorFromCatalog(entry: TributeDiscoveryPage): DiscoveryDoor {
  return {
    id: `door_${entry.slug}`,
    siteId: SITE_ID,
    slug: entry.slug,
    url: `${BASE}${entry.path}`,
    query: entry.query,
    clusterKey: entry.clusterKey,
    publishedAt: entry.publishedAt,
    status: "active",
    exposureKey: `intent-topic:${entry.slug}`,
  };
}

export function listCatalogDoors(): DiscoveryDoor[] {
  return TRIBUTE_DISCOVERY_CATALOG.map(doorFromCatalog);
}

/** Merge ledger doors with catalog defaults (catalog fills missing pages). */
export function mergeDiscoveryDoors(
  ledgerDoors: DiscoveryDoor[],
): DiscoveryDoor[] {
  const byId = new Map(ledgerDoors.map((door) => [door.id, door]));
  for (const entry of TRIBUTE_DISCOVERY_CATALOG) {
    const id = `door_${entry.slug}`;
    if (!byId.has(id)) byId.set(id, doorFromCatalog(entry));
  }
  return [...byId.values()].sort((a, b) =>
    a.publishedAt < b.publishedAt ? 1 : -1,
  );
}

/**
 * Measure one door from growth_events.landing_view.metadata.page.
 * Downstream funnel fields stay 0 unless page-scoped (avoid site-wide leaks).
 * SERP fields come from optional Search Console sensor (null until wired).
 */
export async function measureTributeDiscoveryDoor(
  door: DiscoveryDoor,
): Promise<DiscoveryDoorMetrics> {
  const entry = catalogEntryForDoor(door);
  const pageKey = entry?.pageKey;
  const since = door.publishedAt;
  let topicViews = 0;
  let submitted = Boolean(door.exposureKey);

  if (pageKey && growthStorageIsConfigured()) {
    try {
      const { count, error } = await getSupabaseAdmin()
        .from("growth_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "landing_view")
        .gte("created_at", since)
        .contains("metadata", { page: pageKey });
      if (error && !isMissingGrowthStorageError(error)) {
        console.warn("discovery door measure failed", error.code, error.message);
      } else {
        topicViews = count ?? 0;
      }
    } catch (error) {
      console.warn("discovery door measure unavailable", (error as Error).message);
    }
  }

  const serp = await readSearchConsoleDoorMetrics(door.url);

  return {
    submitted,
    topicViews,
    productViews: 0,
    addToCarts: 0,
    checkouts: 0,
    purchases: 0,
    revenueUsd: 0,
    indexed: serp.indexed,
    impressions: serp.impressions,
    clicks: serp.clicks,
  };
}

let lastSitemapPingAt = 0;
const SITEMAP_COOLDOWN_MS = 30 * 60 * 1000;

export async function pingTributeSitemap(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const since = Date.now() - lastSitemapPingAt;
  if (lastSitemapPingAt > 0 && since < SITEMAP_COOLDOWN_MS) {
    return {
      ok: true,
      detail: `Sitemap ping on cooldown (${Math.ceil((SITEMAP_COOLDOWN_MS - since) / 1000)}s left)`,
    };
  }
  const sitemap = encodeURIComponent(`${BASE}/sitemap.xml`);
  const targets = [
    `https://www.google.com/ping?sitemap=${sitemap}`,
    `https://www.bing.com/ping?sitemap=${sitemap}`,
  ];
  const results: string[] = [];
  let anyOk = false;
  for (const url of targets) {
    try {
      const response = await fetch(url, { method: "GET", cache: "no-store" });
      results.push(`${new URL(url).hostname} HTTP ${response.status}`);
      if (response.ok || response.status === 204) anyOk = true;
    } catch (error) {
      results.push(`${new URL(url).hostname} failed: ${(error as Error).message}`);
    }
  }
  lastSitemapPingAt = Date.now();
  return { ok: anyOk, detail: results.join("; ") };
}

/** Activate the next catalog door not yet active in the ledger (static "publish"). */
export function nextDoorToActivate(
  existing: DiscoveryDoor[],
): DiscoveryDoor | null {
  const activeOrHolding = new Set(
    existing
      .filter((d) => d.status === "active" || d.status === "holding" || d.status === "expanding")
      .map((d) => d.id),
  );
  for (const entry of TRIBUTE_DISCOVERY_CATALOG) {
    const door = doorFromCatalog(entry);
    if (!activeOrHolding.has(door.id)) {
      const prior = existing.find((d) => d.id === door.id);
      if (prior?.status === "killed") continue;
      return {
        ...door,
        publishedAt: new Date().toISOString(),
        status: "active",
      };
    }
  }
  return null;
}
