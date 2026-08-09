/**
 * Hacker News executor — Show HN draft + buying-intent discovery.
 *
 * HN has no OAuth; reads use the public Firebase API at
 * `https://hacker-news.firebaseio.com/v0/`. Writes are optional and only
 * happen when `HN_USERNAME` + `HN_PASSWORD` are set (fragile — HN cookie flow
 * has no official API; we default to DRAFT).
 *
 * Two actions:
 *   1. hackernews_show_hn_draft — LLM-drafts a Show HN post, saved for owner
 *      paste at https://news.ycombinator.com/submit.
 *   2. hackernews_intent_discovery — pulls newstories + askstories, filters
 *      by keywords, LLM-gates each item for buying intent, and promotes hits
 *      to DurableBuyerLead entries with `reachMethod: "hackernews_comment"`.
 *
 * Fails soft everywhere. Never throws.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";
import { shouldAllowExternalContact } from "./compliance-guard";
import type { DurableBuyerLead } from "./buyer-discovery";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const HN_API = "https://hacker-news.firebaseio.com/v0";
const USER_AGENT = process.env.HN_USER_AGENT || "RevenueOS-portfolio/0.1";

export function hasHackerNewsWriteCreds(): boolean {
  return Boolean(process.env.HN_USERNAME && process.env.HN_PASSWORD);
}

export function hackerNewsDailyDiscoveryCap(): number {
  const raw = process.env.HN_DAILY_DISCOVERY_CAP;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 6;
}

type HnItem = {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  text?: string;
  url?: string;
  descendants?: number;
  score?: number;
  kids?: number[];
  parent?: number;
  dead?: boolean;
  deleted?: boolean;
};

function dataDir(rootDir: string): string {
  if (process.env.VERCEL || process.env.REVENUEOS_DATA_DIR) {
    const base = process.env.REVENUEOS_DATA_DIR || "/tmp/revenueos";
    return path.join(base, "hackernews");
  }
  return path.join(rootDir, ".data", "hackernews");
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

async function hnGet<T>(pathname: string, timeoutMs = 12_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${HN_API}${pathname}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchItemBatch(
  ids: number[],
  limit: number,
): Promise<HnItem[]> {
  const items: HnItem[] = [];
  const targets = ids.slice(0, Math.min(limit * 3, 100));
  const results = await Promise.all(
    targets.map((id) => hnGet<HnItem>(`/item/${id}.json`)),
  );
  for (const r of results) {
    if (!r) continue;
    if (r.deleted || r.dead) continue;
    items.push(r);
    if (items.length >= limit) break;
  }
  return items;
}

const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hasIntent", "reason", "score"],
  properties: {
    hasIntent: {
      type: "boolean",
      description:
        "True if the poster or a top commenter is explicitly seeking a solution our product provides. Otherwise false.",
    },
    reason: { type: "string" },
    score: {
      type: "number",
      minimum: 0,
      maximum: 100,
      description: "Confidence in the buying intent (0-100).",
    },
  },
};

async function gateItemForIntent(input: {
  item: HnItem;
  productName: string;
  productDescription: string;
}): Promise<{ ok: true; hasIntent: boolean; reason: string; score: number } | { ok: false; reason: string }> {
  if (!hasOpenAIKey()) return { ok: false, reason: "no openai key" };
  const res = await callOpenAI<{
    hasIntent: boolean;
    reason: string;
    score: number;
  }>({
    messages: [
      {
        role: "system",
        content:
          "You are the intent-detection limb of RevenueOS. You classify HN posts for buying intent — someone actively looking for a tool that solves a specific problem our product addresses. General curiosity does not qualify. Set hasIntent=true only when the connection is direct and specific.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            description: input.productDescription,
          },
          hn_item: {
            title: input.item.title,
            text: (input.item.text ?? "").slice(0, 1500),
            url: input.item.url,
            type: input.item.type,
          },
        }),
      },
    ],
    jsonSchema: INTENT_SCHEMA,
    temperature: 0.2,
    maxOutputTokens: 250,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  return {
    ok: true,
    hasIntent: res.data.hasIntent,
    reason: res.data.reason,
    score: res.data.score,
  };
}

/**
 * Discover buying-intent HN items and emit DurableBuyerLead[]. Never throws.
 * Compliance-checked before external contact. Falls back gracefully if the HN
 * API returns nothing.
 */
export async function executeHackerNewsIntentDiscovery(input: {
  rootDir: string;
  productName: string;
  productDescription: string;
  productKeywords: string[];
  productUrl: string;
  now?: Date;
}): Promise<
  | { ok: true; detail: string; leads: DurableBuyerLead[] }
  | { ok: false; detail: string }
> {
  const compliance = await shouldAllowExternalContact({
    targetUrl: `${HN_API}/newstories.json`,
    action: "http_get",
    userAgent: USER_AGENT,
  });
  if (!compliance.allowed) {
    return {
      ok: false,
      detail: `hackernews_intent_discovery blocked by compliance-guard: ${compliance.reasons.join(",")}`,
    };
  }
  const cap = hackerNewsDailyDiscoveryCap();
  const [newIds, askIds] = await Promise.all([
    hnGet<number[]>("/newstories.json"),
    hnGet<number[]>("/askstories.json"),
  ]);
  const ids = [
    ...(Array.isArray(askIds) ? askIds.slice(0, 25) : []),
    ...(Array.isArray(newIds) ? newIds.slice(0, 30) : []),
  ];
  if (!ids.length) {
    return {
      ok: false,
      detail: "hackernews_intent_discovery: firebase API returned no story IDs",
    };
  }
  const items = await fetchItemBatch(ids, 30);
  const needles = input.productKeywords
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);
  const filtered = items.filter((it) => {
    if (!needles.length) return true;
    const hay = `${it.title ?? ""} ${it.text ?? ""}`.toLowerCase();
    return needles.some((k) => hay.includes(k));
  });
  const leads: DurableBuyerLead[] = [];
  for (const item of filtered) {
    if (leads.length >= cap) break;
    const gated = await gateItemForIntent({
      item,
      productName: input.productName,
      productDescription: input.productDescription,
    });
    if (!gated.ok) continue;
    if (!gated.hasIntent) continue;
    if (gated.score < 50) continue;
    leads.push({
      url: `https://news.ycombinator.com/item?id=${item.id}`,
      surface: item.type === "story" ? "hackernews_ask" : "hackernews_story",
      segment: input.productName + " target audience",
      whyMatch: gated.reason.slice(0, 240),
      reachMethod: "hackernews_comment",
      score: gated.score,
      name: item.by,
      reasonToReach: gated.reason.slice(0, 240),
    });
  }
  // Persist a diagnostic snapshot alongside caller-side leads.
  const snap = path.join(dataDir(input.rootDir), "intent-latest.json");
  await writeJson(snap, {
    at: new Date().toISOString(),
    total: filtered.length,
    kept: leads.length,
    ids: leads.map((l) => l.url),
  });
  if (leads.length === 0) {
    return {
      ok: false,
      detail: `hackernews_intent_discovery: 0/${filtered.length} items qualified for buying intent`,
    };
  }
  return {
    ok: true,
    detail: `hackernews_intent_discovery: +${leads.length} buying-intent leads (of ${filtered.length} keyword hits)`,
    leads,
  };
}

const SHOW_HN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body", "demoUrl"],
  properties: {
    title: {
      type: "string",
      minLength: 15,
      maxLength: 80,
      description:
        "Must begin with 'Show HN: ' and follow the format 'Show HN: <product> – <one-line value prop>'.",
    },
    body: {
      type: "string",
      minLength: 200,
      maxLength: 2500,
      description:
        "HN-appropriate technical/humble intro. Explain what it does, how it's built, tradeoffs. No marketing fluff. Link to demo, not landing page.",
    },
    demoUrl: {
      type: "string",
      description: "The direct demo URL to include in the submission.",
    },
  },
};

async function draftShowHn(input: {
  productName: string;
  productUrl: string;
  productDescription: string;
  audience: string;
  brandVoice: string;
}): Promise<
  | {
      ok: true;
      draft: { title: string; body: string; demoUrl: string };
    }
  | { ok: false; reason: string }
> {
  if (!hasOpenAIKey()) return { ok: false, reason: "no openai key" };
  const res = await callOpenAI<{
    title: string;
    body: string;
    demoUrl: string;
  }>({
    messages: [
      {
        role: "system",
        content:
          "You draft Show HN submissions. HN norms: technical, humble, honest tradeoffs, link to a live demo (not a marketing landing page). Title must start 'Show HN:' and be ≤ 80 chars. Body should describe what it does, how it's built, what's interesting/hard, and invite feedback. Never write 'the best', 'revolutionary', 'game-changing'. Never invent metrics.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            url: input.productUrl,
            description: input.productDescription,
          },
          audience: input.audience,
          voice: input.brandVoice,
        }),
      },
    ],
    jsonSchema: SHOW_HN_SCHEMA,
    temperature: 0.65,
    maxOutputTokens: 1400,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  const draft = res.data;
  // Enforce Show HN prefix defensively.
  if (!draft.title.toLowerCase().startsWith("show hn")) {
    draft.title = `Show HN: ${draft.title}`.slice(0, 80);
  }
  return { ok: true, draft };
}

async function saveShowHnDraft(input: {
  rootDir: string;
  draft: { title: string; body: string; demoUrl: string };
  productName: string;
}) {
  const file = path.join(dataDir(input.rootDir), "show-hn-drafts.json");
  const data = await readJson<{ drafts: Array<Record<string, unknown>> }>(file, {
    drafts: [],
  });
  data.drafts = [
    {
      kind: "show_hn_draft",
      at: new Date().toISOString(),
      productName: input.productName,
      title: input.draft.title,
      body: input.draft.body,
      demoUrl: input.draft.demoUrl,
      pasteAt: "https://news.ycombinator.com/submit",
      status: "awaiting_owner_post",
    },
    ...data.drafts,
  ].slice(0, 10);
  await writeJson(file, data);
}

/**
 * Draft a Show HN submission and save for owner paste. The registry enforces a
 * 30-day per-product cooldown so we don't spam duplicates.
 */
export async function executeHackerNewsShowHnDraft(input: {
  rootDir: string;
  productName: string;
  productUrl: string;
  productDescription: string;
  audience: string;
  brandVoice: string;
  now?: Date;
}): Promise<
  | { ok: true; detail: string; url?: string; mode: "drafted" }
  | { ok: false; detail: string }
> {
  if (!hasOpenAIKey()) {
    return {
      ok: false,
      detail:
        "hackernews_show_hn_draft skipped: OPENAI_API_KEY missing for content generation",
    };
  }
  const drafted = await draftShowHn({
    productName: input.productName,
    productUrl: input.productUrl,
    productDescription: input.productDescription,
    audience: input.audience,
    brandVoice: input.brandVoice,
  });
  if (!drafted.ok) {
    return {
      ok: false,
      detail: `hackernews_show_hn_draft: ${drafted.reason}`,
    };
  }
  await saveShowHnDraft({
    rootDir: input.rootDir,
    draft: drafted.draft,
    productName: input.productName,
  });
  return {
    ok: true,
    mode: "drafted",
    detail: `Show HN drafted: "${drafted.draft.title}" — paste at https://news.ycombinator.com/submit (see .data/hackernews/show-hn-drafts.json)`,
    url: "https://news.ycombinator.com/submit",
  };
}
