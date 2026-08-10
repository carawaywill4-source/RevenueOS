import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrandConfig } from "./types";

type PublishedDoor = {
  slug: string;
  title: string;
  intentQuery: string;
  publishedAt: string;
  indexNowAt?: string;
};

function dataRoot(rootDir: string) {
  // Vercel serverless FS is read-only except /tmp.
  if (process.env.VERCEL || process.env.REVENUEOS_DATA_DIR) {
    return process.env.REVENUEOS_DATA_DIR || "/tmp/revenueos";
  }
  return path.join(rootDir, ".data");
}

async function doorsPath(rootDir: string) {
  return path.join(dataRoot(rootDir), "published-doors.json");
}

export async function listPublishedDoors(rootDir: string): Promise<PublishedDoor[]> {
  try {
    return JSON.parse(await readFile(await doorsPath(rootDir), "utf8")) as PublishedDoor[];
  } catch {
    return [];
  }
}

export async function publishNextDiscoveryDoor(input: {
  brand: BrandConfig;
  rootDir: string;
  appUrl: string;
}): Promise<{ ok: boolean; detail: string; url?: string }> {
  const existing = await listPublishedDoors(input.rootDir);
  const published = new Set(existing.map((d) => d.slug));
  const next = input.brand.discoveryDoors.find((d) => !published.has(d.slug));
  if (!next) {
    // Re-feature the highest-intent door and re-ping
    const door = input.brand.discoveryDoors[0];
    if (!door) return { ok: false, detail: "No discovery doors configured" };
    const url = `${input.appUrl.replace(/\/$/, "")}/topics/${door.slug}`;
    const ping = await pingIndexNow({ url, appUrl: input.appUrl });
    return {
      ok: true,
      detail: `Re-featured door ${door.slug}; IndexNow ${ping.ok ? "ok" : ping.detail}`,
      url,
    };
  }
  const row: PublishedDoor = {
    slug: next.slug,
    title: next.title,
    intentQuery: next.intentQuery,
    publishedAt: new Date().toISOString(),
  };
  existing.unshift(row);
  await mkdir(path.dirname(await doorsPath(input.rootDir)), { recursive: true });
  await writeFile(await doorsPath(input.rootDir), JSON.stringify(existing, null, 2));
  const url = `${input.appUrl.replace(/\/$/, "")}/topics/${next.slug}`;
  const ping = await pingIndexNow({ url, appUrl: input.appUrl });
  row.indexNowAt = ping.ok ? new Date().toISOString() : undefined;
  await writeFile(await doorsPath(input.rootDir), JSON.stringify(existing, null, 2));
  return {
    ok: true,
    detail: `Published intent door "${next.title}" → ${url}. Audience: ${next.intentQuery}. IndexNow: ${ping.ok ? "submitted" : ping.detail}`,
    url,
  };
}

/**
 * IndexNow is distribution infrastructure — never block publish/discovery when
 * it fails. Bound retries for 429 and cool off the host so we don't hammer.
 */
const indexNowCooldownUntil = new Map<string, number>();

export type IndexNowCapabilityStatus = {
  status: "ok" | "degraded" | "unavailable";
  reason: string | null;
  cooldownHosts: string[];
};

export function getIndexNowCapabilityStatus(): IndexNowCapabilityStatus {
  const now = Date.now();
  const cooling = [...indexNowCooldownUntil.entries()]
    .filter(([, until]) => until > now)
    .map(([host]) => host);
  if (!process.env.INDEXNOW_KEY && !process.env.MENDHAUS_INDEXNOW_KEY) {
    return {
      status: "unavailable",
      reason: "INDEXNOW_KEY not set",
      cooldownHosts: cooling,
    };
  }
  if (cooling.length) {
    return {
      status: "degraded",
      reason: "IndexNow rate-limited; other acquisition channels continue",
      cooldownHosts: cooling,
    };
  }
  return { status: "ok", reason: null, cooldownHosts: [] };
}

export async function pingIndexNow(input: {
  url: string;
  appUrl: string;
}): Promise<{ ok: boolean; detail: string; degraded?: boolean }> {
  const key = process.env.INDEXNOW_KEY || process.env.MENDHAUS_INDEXNOW_KEY;
  if (!key) {
    return {
      ok: false,
      detail: "INDEXNOW_KEY not set — distribution logged only",
      degraded: true,
    };
  }
  let host: string;
  try {
    host = new URL(input.appUrl).host;
  } catch {
    return { ok: false, detail: "IndexNow: invalid appUrl", degraded: true };
  }

  const coolUntil = indexNowCooldownUntil.get(host) ?? 0;
  if (Date.now() < coolUntil) {
    return {
      ok: false,
      detail: `IndexNow cooldown until ${new Date(coolUntil).toISOString()} — publish continues without ping`,
      degraded: true,
    };
  }

  const endpoint = "https://api.indexnow.org/indexnow";
  const payload = {
    host,
    key,
    keyLocation: `${input.appUrl.replace(/\/$/, "")}/${key}.txt`,
    urlList: [input.url],
  };

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok || res.status === 202) {
        return { ok: true, detail: `IndexNow ${res.status}` };
      }
      if (res.status === 429) {
        // Bound backoff: 10m then 30m on repeated hits
        const coolMs = attempt === 1 ? 10 * 60_000 : 30 * 60_000;
        indexNowCooldownUntil.set(host, Date.now() + coolMs);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1_500 * attempt));
          continue;
        }
        return {
          ok: false,
          detail: `IndexNow HTTP 429 — cooling ${Math.round(coolMs / 60_000)}m; other channels unaffected`,
          degraded: true,
        };
      }
      return { ok: false, detail: `IndexNow HTTP ${res.status}`, degraded: true };
    } catch (e) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1_000 * attempt));
        continue;
      }
      return {
        ok: false,
        detail: (e as Error).message,
        degraded: true,
      };
    }
  }
  return { ok: false, detail: "IndexNow exhausted retries", degraded: true };
}

export function siteOpportunitiesFromBrand(brand: BrandConfig) {
  return brand.discoveryDoors.map((door, i) => ({
    id: `door-${door.slug}`,
    title: `Publish / distribute: ${door.title}`,
    metric: "landing_views",
    category: "acquisition" as const,
    action: `Get buyers searching "${door.intentQuery}" onto the offer`,
    expectedImpact: 9 - i,
    confidence: 0.55,
    effort: 1,
    safeActionType: i === 0 ? "discovery_attack" : "publish_intent_page",
    patternKey: `discovery:${door.slug}`,
    precursorMetric: "landing_views" as const,
  }));
}
