/**
 * CJ Dropshipping API v2 client.
 * Set CJ_API_KEY (and optionally CJ_EMAIL) from the CJ Authorization → API page.
 * If CJ_ACCESS_TOKEN is set, it is used directly; otherwise we exchange via apiKey.
 */

const CJ_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

export type CjProduct = {
  pid: string;
  productNameEn?: string;
  productName?: string;
  productImage?: string;
  productImageSet?: string[];
  sellPrice?: number;
  nowPrice?: number;
  listedNum?: number;
  categoryName?: string;
  sku?: string;
  verifiedWarehouse?: number;
  warehouseInventoryNum?: number;
  totalVerifiedInventory?: number;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function cjConfigured() {
  return Boolean(process.env.CJ_ACCESS_TOKEN?.trim() || process.env.CJ_API_KEY?.trim());
}

async function resolveAccessToken(): Promise<string> {
  const direct = process.env.CJ_ACCESS_TOKEN?.trim();
  if (direct) return direct;

  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const apiKey = process.env.CJ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Set CJ_ACCESS_TOKEN or CJ_API_KEY");
  }

  const email = process.env.CJ_EMAIL?.trim();
  const payload = email ? { email, apiKey } : { apiKey };

  const response = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as {
    code?: number | string;
    data?: { accessToken?: string; accessTokenExpiryDate?: string };
    message?: string;
  };
  const ok = body.code === 200 || body.code === "200";
  if (!ok || !body.data?.accessToken) {
    throw new Error(body.message || "CJ getAccessToken failed");
  }

  const expiresAt = body.data.accessTokenExpiryDate
    ? Date.parse(body.data.accessTokenExpiryDate)
    : Date.now() + 1000 * 60 * 60 * 24;
  cachedAccessToken = { token: body.data.accessToken, expiresAt };
  return body.data.accessToken;
}

async function cjFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await resolveAccessToken();
  const response = await fetch(`${CJ_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": token,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const body = (await response.json()) as {
    code?: number | string;
    result?: T;
    data?: T;
    message?: string;
  };

  const ok =
    body.code === 200 ||
    body.code === "200" ||
    body.code === 0 ||
    body.code === "0";

  if (!response.ok || !ok) {
    throw new Error(body.message || `CJ API error (${response.status})`);
  }

  return (body.data ?? body.result) as T;
}

function parsePrice(raw: unknown): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const s = String(raw);
  const nums = s.match(/(\d+(?:\.\d+)?)/g);
  if (!nums?.length) return undefined;
  // Prefer the low end of a range "1.40 -- 16.80"
  return Math.round(Number(nums[0]) * 100) / 100;
}

type CjListV2Item = {
  id?: string;
  nameEn?: string;
  sku?: string;
  bigImage?: string;
  sellPrice?: string | number;
  nowPrice?: string | number;
  listedNum?: number;
  verifiedWarehouse?: number;
  warehouseInventoryNum?: number;
  totalVerifiedInventory?: number;
  threeCategoryName?: string;
};

function normalizeV2Item(item: CjListV2Item): CjProduct | null {
  if (!item.id) return null;
  return {
    pid: item.id,
    productNameEn: item.nameEn,
    productName: item.nameEn,
    productImage: item.bigImage,
    productImageSet: item.bigImage ? [item.bigImage] : [],
    sellPrice: parsePrice(item.sellPrice),
    nowPrice: parsePrice(item.nowPrice ?? item.sellPrice),
    listedNum: item.listedNum,
    categoryName: item.threeCategoryName,
    sku: item.sku,
    verifiedWarehouse: item.verifiedWarehouse,
    warehouseInventoryNum: item.warehouseInventoryNum,
    totalVerifiedInventory: item.totalVerifiedInventory,
  };
}

function extractListV2(data: unknown): CjProduct[] {
  if (!data || typeof data !== "object") return [];
  const root = data as {
    content?: Array<{ productList?: CjListV2Item[] }>;
    list?: CjListV2Item[];
  };
  const out: CjProduct[] = [];
  for (const block of root.content || []) {
    for (const item of block.productList || []) {
      const n = normalizeV2Item(item);
      if (n) out.push(n);
    }
  }
  if (!out.length && Array.isArray(root.list)) {
    for (const item of root.list) {
      const n = normalizeV2Item(item);
      if (n) out.push(n);
    }
  }
  return out;
}

/** Search products via listV2 (correct nested shape). */
export async function searchCjProducts(query: string, pageSize = 20): Promise<CjProduct[]> {
  const size = String(Math.min(Math.max(pageSize, 1), 50));
  const keyWord = query.slice(0, 200);
  const params = new URLSearchParams({
    page: "1",
    size,
    keyWord,
  });
  const data = await cjFetch<unknown>(`/product/listV2?${params}`);
  return extractListV2(data);
}

export function scoreCjMatch(product: CjProduct, query: string): number {
  const name = (product.productNameEn || product.productName || "").toLowerCase();
  if (!name) return -1;
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  if (!tokens.length) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (name.includes(t)) hits += 1;
  }
  const coverage = hits / tokens.length;
  let score = coverage * 100;
  if ((product.totalVerifiedInventory ?? 0) > 0) score += 8;
  if ((product.verifiedWarehouse ?? 0) === 1) score += 5;
  if ((product.listedNum ?? 0) > 50) score += 3;
  const price = cjUnitCostUsd(product);
  if (price != null && price >= 1 && price <= 80) score += 6;
  if (price != null && price > 150) score -= 40;
  return score;
}

export function pickBestCjMatch(products: CjProduct[], query: string): CjProduct | null {
  const scored = products
    .map((p) => ({ p, score: scoreCjMatch(p, query) }))
    .filter((x) => x.score >= 45)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.p ?? null;
}

export function cjUnitCostUsd(product: CjProduct): number | undefined {
  const raw = product.nowPrice ?? product.sellPrice;
  if (raw == null || Number.isNaN(Number(raw))) return undefined;
  return Math.round(Number(raw) * 100) / 100;
}

export function cjImages(product: CjProduct): { hero?: string; gallery: string[] } {
  const gallery = [
    ...(product.productImage ? [product.productImage] : []),
    ...(product.productImageSet || []),
  ].filter(Boolean);
  const unique = [...new Set(gallery)];
  return { hero: unique[0], gallery: unique };
}
