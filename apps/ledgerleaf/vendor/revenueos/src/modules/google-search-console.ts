/**
 * Google Search Console executor — read-only signal ingestion.
 *
 * Auth: a service-account JSON blob in GOOGLE_SERVICE_ACCOUNT_JSON. If it's
 * missing, both actions log `skipped: no_gsc_credentials` cleanly and never
 * throw. `MECHANISM_UNLOCKS.owned_distribution` recommends the setup path.
 *
 * Two actions:
 *   1. gsc_query_import — top queries for a site → LLM commercial-intent
 *      classification → high-intent queries become new opportunities via
 *      `revenue-priority.ts`.
 *   2. gsc_indexation_check — inspects a small batch of URLs and returns the
 *      subset that isn't indexed; caller can then hand those off to IndexNow.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";
import { shouldAllowExternalContact } from "./compliance-guard";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const OAUTH_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const USER_AGENT = process.env.GSC_USER_AGENT || "RevenueOS-portfolio/0.1";

export function hasGscCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON &&
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim().startsWith("{"),
  );
}

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
  type?: string;
};

function parseServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** RS256 JWT signer using Node's built-in crypto — no external deps. */
async function signJwtRs256(input: {
  privateKey: string;
  header: Record<string, string>;
  payload: Record<string, unknown>;
}): Promise<string> {
  const crypto = await import("node:crypto");
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  const encHeader = b64(input.header);
  const encPayload = b64(input.payload);
  const signingInput = `${encHeader}.${encPayload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer
    .sign(input.privateKey)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${signingInput}.${signature}`;
}

let cachedGscToken: { token: string; expiresAt: number } | null = null;

async function getGscAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  if (cachedGscToken && cachedGscToken.expiresAt > Date.now() + 30_000) {
    return { ok: true, token: cachedGscToken.token };
  }
  const sa = parseServiceAccount();
  if (!sa) return { ok: false, reason: "no_gsc_credentials" };
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || OAUTH_TOKEN_URL;
  let jwt: string;
  try {
    jwt = await signJwtRs256({
      privateKey: sa.private_key,
      header: { alg: "RS256", typ: "JWT" },
      payload: {
        iss: sa.client_email,
        scope: OAUTH_SCOPE,
        aud: tokenUri,
        iat: now,
        exp: now + 3600,
      },
    });
  } catch (err) {
    return {
      ok: false,
      reason: `gsc jwt sign: ${(err as Error).message.slice(0, 120)}`,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    });
    const res = await fetch(tokenUri, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `gsc token ${res.status}: ${text.slice(0, 140)}`,
      };
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return { ok: false, reason: "gsc token: empty" };
    cachedGscToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return { ok: true, token: data.access_token };
  } catch (err) {
    return {
      ok: false,
      reason: `gsc token fetch: ${(err as Error).message.slice(0, 120)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function gscPost<T>(
  pathname: string,
  body: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  const auth = await getGscAccessToken();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const target = `${GSC_BASE}${pathname}`;
  const compliance = await shouldAllowExternalContact({
    targetUrl: target,
    action: "http_get",
    userAgent: USER_AGENT,
  });
  if (!compliance.allowed) {
    return {
      ok: false,
      reason: `compliance_blocked: ${compliance.reasons.join(",")}`,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `gsc ${res.status}: ${text.slice(0, 140)}` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return {
      ok: false,
      reason: `gsc fetch: ${(err as Error).message.slice(0, 120)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type GscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Pull top queries for a verified GSC property. `siteUrl` should be exactly as
 * registered in GSC (e.g. `sc-domain:example.com` or `https://example.com/`).
 */
export async function fetchGscTopQueries(input: {
  siteUrl: string;
  days?: number;
  limit?: number;
}): Promise<
  | { ok: true; rows: GscQueryRow[] }
  | { ok: false; reason: string }
> {
  if (!hasGscCredentials()) {
    return { ok: false, reason: "no_gsc_credentials" };
  }
  const days = Math.max(1, Math.min(input.days ?? 28, 90));
  const rowLimit = Math.max(5, Math.min(input.limit ?? 25, 100));
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const encoded = encodeURIComponent(input.siteUrl);
  const res = await gscPost<{
    rows?: Array<{
      keys?: string[];
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
  }>(`/sites/${encoded}/searchAnalytics/query`, {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    dimensions: ["query"],
    rowLimit,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  const rows: GscQueryRow[] = (res.data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
  return { ok: true, rows };
}

const INTENT_CLASSIFIER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["classifications"],
  properties: {
    classifications: {
      type: "array",
      minItems: 0,
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["query", "intent", "score", "reason"],
        properties: {
          query: { type: "string" },
          intent: {
            type: "string",
            enum: ["informational", "navigational", "commercial", "transactional"],
          },
          score: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description:
              "Buyer-conversion likelihood (0-100). Transactional + commercial score higher.",
          },
          reason: { type: "string" },
        },
      },
    },
  },
};

export type ClassifiedQuery = GscQueryRow & {
  intent: "informational" | "navigational" | "commercial" | "transactional";
  score: number;
  reason: string;
};

async function classifyQueryIntent(input: {
  rows: GscQueryRow[];
  productName: string;
  productDescription: string;
}): Promise<
  | { ok: true; classifications: ClassifiedQuery[] }
  | { ok: false; reason: string }
> {
  if (!hasOpenAIKey()) return { ok: false, reason: "no openai key" };
  const res = await callOpenAI<{
    classifications: Array<{
      query: string;
      intent: ClassifiedQuery["intent"];
      score: number;
      reason: string;
    }>;
  }>({
    messages: [
      {
        role: "system",
        content:
          "You classify search queries by buyer intent for a specific product. Return exactly one classification per query. Score 0-100 by likelihood the searcher wants to buy something like this today.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            description: input.productDescription,
          },
          queries: input.rows.map((r) => r.query),
        }),
      },
    ],
    jsonSchema: INTENT_CLASSIFIER_SCHEMA,
    temperature: 0.2,
    maxOutputTokens: 1400,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  const byQuery = new Map(input.rows.map((r) => [r.query, r]));
  const out: ClassifiedQuery[] = [];
  for (const c of res.data.classifications ?? []) {
    const base = byQuery.get(c.query);
    if (!base) continue;
    out.push({ ...base, intent: c.intent, score: c.score, reason: c.reason });
  }
  return { ok: true, classifications: out };
}

function dataDir(rootDir: string): string {
  if (process.env.VERCEL || process.env.REVENUEOS_DATA_DIR) {
    const base = process.env.REVENUEOS_DATA_DIR || "/tmp/revenueos";
    return path.join(base, "gsc");
  }
  return path.join(rootDir, ".data", "gsc");
}

async function writeJson(p: string, data: unknown) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2));
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export type GscOpportunity = {
  id: string;
  query: string;
  intent: ClassifiedQuery["intent"];
  impressions: number;
  clicks: number;
  score: number;
  reason: string;
  createdAt: string;
};

/**
 * End-to-end query import: fetch GSC top queries → LLM classify → keep the
 * top commercial/transactional queries as opportunities. Persists a snapshot
 * so downstream planners can pull it later.
 */
export async function executeGscQueryImport(input: {
  rootDir: string;
  siteUrl: string;
  productName: string;
  productDescription: string;
  days?: number;
  now?: Date;
}): Promise<
  | {
      ok: true;
      detail: string;
      opportunities: GscOpportunity[];
    }
  | { ok: false; detail: string }
> {
  if (!hasGscCredentials()) {
    return {
      ok: false,
      detail:
        "gsc_query_import skipped: no_gsc_credentials (set GOOGLE_SERVICE_ACCOUNT_JSON + add service account to Search Console as Owner)",
    };
  }
  const rows = await fetchGscTopQueries({
    siteUrl: input.siteUrl,
    days: input.days,
    limit: 40,
  });
  if (!rows.ok) return { ok: false, detail: `gsc_query_import: ${rows.reason}` };
  if (rows.rows.length === 0) {
    return {
      ok: false,
      detail: "gsc_query_import: no queries returned (property may be new)",
    };
  }
  const classified = await classifyQueryIntent({
    rows: rows.rows,
    productName: input.productName,
    productDescription: input.productDescription,
  });
  if (!classified.ok) {
    return { ok: false, detail: `gsc_query_import classify: ${classified.reason}` };
  }
  const now = input.now ?? new Date();
  const opportunities: GscOpportunity[] = classified.classifications
    .filter(
      (c) =>
        (c.intent === "commercial" || c.intent === "transactional") &&
        c.score >= 55,
    )
    .sort((a, b) => b.score * b.impressions - a.score * a.impressions)
    .slice(0, 12)
    .map((c, i) => ({
      id: `gsc-${now.getTime().toString(36)}-${i}`,
      query: c.query,
      intent: c.intent,
      impressions: c.impressions,
      clicks: c.clicks,
      score: c.score,
      reason: c.reason,
      createdAt: now.toISOString(),
    }));
  const file = path.join(dataDir(input.rootDir), "opportunities-latest.json");
  await writeJson(file, {
    at: now.toISOString(),
    siteUrl: input.siteUrl,
    total: classified.classifications.length,
    kept: opportunities.length,
    opportunities,
  });
  return {
    ok: true,
    detail: `gsc_query_import: ${opportunities.length}/${classified.classifications.length} queries flagged commercial/transactional → ${file}`,
    opportunities,
  };
}

type UrlInspectionResult = {
  inspectionResult?: {
    indexStatusResult?: {
      coverageState?: string;
      verdict?: string;
      lastCrawlTime?: string;
    };
  };
};

/**
 * Ask the URL Inspection API whether each candidate URL is indexed. Returns
 * the subset that ISN'T (so the caller can hand them off to IndexNow etc).
 * Note: URL Inspection lives on a different host than webmasters/v3.
 */
export async function executeGscIndexationCheck(input: {
  rootDir: string;
  siteUrl: string;
  urls: string[];
  now?: Date;
}): Promise<
  | {
      ok: true;
      detail: string;
      indexed: string[];
      notIndexed: string[];
    }
  | { ok: false; detail: string }
> {
  if (!hasGscCredentials()) {
    return {
      ok: false,
      detail:
        "gsc_indexation_check skipped: no_gsc_credentials (set GOOGLE_SERVICE_ACCOUNT_JSON + add service account to Search Console as Owner)",
    };
  }
  if (input.urls.length === 0) {
    return { ok: false, detail: "gsc_indexation_check: no urls provided" };
  }
  const auth = await getGscAccessToken();
  if (!auth.ok)
    return { ok: false, detail: `gsc_indexation_check auth: ${auth.reason}` };
  const indexed: string[] = [];
  const notIndexed: string[] = [];
  const target = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
  const compliance = await shouldAllowExternalContact({
    targetUrl: target,
    action: "http_get",
    userAgent: USER_AGENT,
  });
  if (!compliance.allowed) {
    return {
      ok: false,
      detail: `gsc_indexation_check compliance: ${compliance.reasons.join(",")}`,
    };
  }
  for (const url of input.urls.slice(0, 20)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: input.siteUrl }),
        signal: controller.signal,
      });
      if (!res.ok) {
        notIndexed.push(url);
        continue;
      }
      const data = (await res.json()) as UrlInspectionResult;
      const verdict = data.inspectionResult?.indexStatusResult?.verdict ?? "";
      if (verdict === "PASS") indexed.push(url);
      else notIndexed.push(url);
    } catch {
      notIndexed.push(url);
    } finally {
      clearTimeout(timer);
    }
  }
  const now = input.now ?? new Date();
  await writeJson(path.join(dataDir(input.rootDir), "indexation-latest.json"), {
    at: now.toISOString(),
    siteUrl: input.siteUrl,
    indexed,
    notIndexed,
  });
  return {
    ok: true,
    detail: `gsc_indexation_check: ${indexed.length} indexed, ${notIndexed.length} missing (hand missing to IndexNow)`,
    indexed,
    notIndexed,
  };
}
