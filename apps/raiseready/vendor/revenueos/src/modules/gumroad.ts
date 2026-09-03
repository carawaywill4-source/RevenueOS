/**
 * Gumroad marketplace limb — sync product listings + import sales.
 *
 * Auth: GUMROAD_ACCESS_TOKEN (personal access token). Never throws.
 * Missing token → clean skip detail so the operator can continue.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://api.gumroad.com/v2";
const USER_AGENT =
  process.env.GUMROAD_USER_AGENT || "RevenueOS-portfolio/0.1";

export function hasGumroadCreds(): boolean {
  return Boolean(process.env.GUMROAD_ACCESS_TOKEN?.trim());
}

function dataDir(rootDir: string): string {
  if (process.env.VERCEL || process.env.REVENUEOS_DATA_DIR) {
    const base = process.env.REVENUEOS_DATA_DIR || "/tmp/revenueos";
    return path.join(base, "gumroad");
  }
  return path.join(rootDir, ".data", "gumroad");
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(p: string, data: unknown) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2));
}

async function gumroadFetch(
  pathAndQuery: string,
  init?: RequestInit,
): Promise<{ ok: true; body: unknown } | { ok: false; reason: string }> {
  if (!hasGumroadCreds()) {
    return { ok: false, reason: "no_gumroad_token" };
  }
  const token = process.env.GUMROAD_ACCESS_TOKEN!.trim();
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const url = `${API}${pathAndQuery}${sep}access_token=${encodeURIComponent(token)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    if (!res.ok) {
      return {
        ok: false,
        reason: `gumroad ${res.status}: ${text.slice(0, 140)}`,
      };
    }
    return { ok: true, body };
  } catch (err) {
    return {
      ok: false,
      reason: `gumroad fetch: ${err instanceof Error ? err.message : "error"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

type GumroadProduct = {
  id?: string;
  name?: string;
  url?: string;
  short_url?: string;
  price?: number;
  description?: string;
};

/**
 * Ensure a Gumroad product exists for this brand. Creates one when missing;
 * otherwise records the match. Drafts to disk if the create call fails.
 */
export async function executeGumroadProductSync(input: {
  rootDir: string;
  siteId: string;
  productName: string;
  productDescription: string;
  productUrl: string;
  priceUsd: number;
}): Promise<{ ok: boolean; detail: string; url?: string }> {
  if (!hasGumroadCreds()) {
    return {
      ok: false,
      detail:
        "gumroad_product_sync skipped: GUMROAD_ACCESS_TOKEN missing",
    };
  }
  const listed = await gumroadFetch("/products");
  if (!listed.ok) {
    return { ok: false, detail: `gumroad_product_sync: ${listed.reason}` };
  }
  const products =
    ((listed.body as { products?: GumroadProduct[] })?.products ?? []) as GumroadProduct[];
  const needle = input.productName.toLowerCase();
  const match = products.find((p) =>
    (p.name ?? "").toLowerCase().includes(needle.slice(0, 24)),
  );
  if (match) {
    await writeJson(path.join(dataDir(input.rootDir), `${input.siteId}-product.json`), {
      syncedAt: new Date().toISOString(),
      product: match,
    });
    return {
      ok: true,
      detail: `gumroad_product_sync: matched existing "${match.name}"`,
      url: match.short_url || match.url,
    };
  }

  const priceCents = Math.max(100, Math.round(input.priceUsd * 100));
  const form = new URLSearchParams({
    name: input.productName.slice(0, 120),
    price: String(priceCents),
    description: input.productDescription.slice(0, 2000),
    url: input.productUrl,
  });
  const created = await gumroadFetch("/products", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!created.ok) {
    const draft = {
      draftedAt: new Date().toISOString(),
      siteId: input.siteId,
      name: input.productName,
      priceCents,
      description: input.productDescription,
      url: input.productUrl,
      reason: created.reason,
    };
    await writeJson(
      path.join(dataDir(input.rootDir), `${input.siteId}-draft.json`),
      draft,
    );
    return {
      ok: false,
      detail: `gumroad_product_sync: create failed (${created.reason}) — draft saved`,
    };
  }
  const product = (created.body as { product?: GumroadProduct })?.product;
  await writeJson(path.join(dataDir(input.rootDir), `${input.siteId}-product.json`), {
    syncedAt: new Date().toISOString(),
    product,
  });
  return {
    ok: true,
    detail: `gumroad_product_sync: created "${product?.name ?? input.productName}"`,
    url: product?.short_url || product?.url,
  };
}

/**
 * Pull recent Gumroad sales into `.data/gumroad/sales.json` for attribution.
 */
export async function executeGumroadSalesImport(input: {
  rootDir: string;
  siteId: string;
}): Promise<{ ok: boolean; detail: string; url?: string }> {
  if (!hasGumroadCreds()) {
    return {
      ok: false,
      detail: "gumroad_sales_import skipped: GUMROAD_ACCESS_TOKEN missing",
    };
  }
  const res = await gumroadFetch("/sales");
  if (!res.ok) {
    return { ok: false, detail: `gumroad_sales_import: ${res.reason}` };
  }
  const sales = (res.body as { sales?: unknown[] })?.sales ?? [];
  const file = path.join(dataDir(input.rootDir), "sales.json");
  const prior = await readJson<{ importedAt?: string; sales?: unknown[] }>(
    file,
    {},
  );
  await writeJson(file, {
    siteId: input.siteId,
    importedAt: new Date().toISOString(),
    priorImportedAt: prior.importedAt,
    count: sales.length,
    sales,
  });
  return {
    ok: true,
    detail: `gumroad_sales_import: ${sales.length} sales imported → ${file}`,
  };
}
