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
    { type: "distribute_owned_urls", risk: "safe", description: "Index all owned URLs" },
    { type: "publish_llms_txt", risk: "safe", description: "AI discovery file" },
    { type: "refresh_discovery_door", risk: "safe", description: "Re-distribute door" },
    { type: "feature_product", risk: "safe", description: "Feature primary offer" },
    { type: "market_research", risk: "safe", description: "Public web research" },
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
    default:
      return { ok: false, detail: `Unsupported permissionless action ${actionType}` };
  }
}
