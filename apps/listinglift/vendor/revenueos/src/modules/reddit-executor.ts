/**
 * Reddit executor — OAuth script-app grant, permissionless helpful replies.
 *
 * Reddit is where a huge portion of our target buyers already ask their
 * questions in public. This module lets RevenueOS:
 *   1. Auth via script-app grant (username+password from env, no owner login)
 *   2. Search allowed subreddits for buying-intent threads
 *   3. Draft a genuinely helpful reply via LLM (no spam; soft mention only when
 *      the product IS the answer)
 *   4. Post with strict rate limits and per-sub rule checks
 *
 * Every unsafe branch fails closed: missing creds → skip; rules disallow →
 * skip; per-day cap → skip; low-karma → skip. Never throws.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function hasRedditCreds(): boolean {
  return Boolean(
    process.env.REDDIT_CLIENT_ID &&
      process.env.REDDIT_CLIENT_SECRET &&
      process.env.REDDIT_USERNAME &&
      process.env.REDDIT_PASSWORD,
  );
}

const USER_AGENT =
  process.env.REDDIT_USER_AGENT || "RevenueOS-portfolio/0.1";

/** Default allowlist if REDDIT_ALLOWED_SUBREDDITS isn't set. */
const DEFAULT_ALLOWED = [
  "SideProject",
  "indiehackers",
  "Entrepreneur",
  "smallbusiness",
];

export function allowedSubreddits(): string[] {
  const raw = process.env.REDDIT_ALLOWED_SUBREDDITS;
  if (!raw) return DEFAULT_ALLOWED;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function dailyActionCap(): number {
  const raw = process.env.REDDIT_DAILY_ACTION_CAP;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(50, Math.floor(n)) : 8;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(
  timeoutMs = 15_000,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return { ok: true, token: cachedToken.token };
  }
  if (!hasRedditCreds()) return { ok: false, reason: "creds missing" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const auth = Buffer.from(
      `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`,
    ).toString("base64");
    const body = new URLSearchParams({
      grant_type: "password",
      username: process.env.REDDIT_USERNAME!,
      password: process.env.REDDIT_PASSWORD!,
    });
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, reason: `reddit auth ${res.status}: ${text.slice(0, 120)}` };
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!data.access_token) {
      return { ok: false, reason: `reddit auth: ${data.error ?? "no token"}` };
    }
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return { ok: true, token: data.access_token };
  } catch (err) {
    return { ok: false, reason: `reddit auth fetch: ${(err as Error).message.slice(0, 120)}` };
  } finally {
    clearTimeout(timer);
  }
}

async function apiGet(path: string, timeoutMs = 20_000) {
  const auth = await getRedditToken();
  if (!auth.ok) return { ok: false as const, reason: auth.reason };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://oauth.reddit.com${path}`, {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false as const, reason: `reddit ${res.status}` };
    }
    return { ok: true as const, data: await res.json() };
  } catch (err) {
    return { ok: false as const, reason: `reddit fetch: ${(err as Error).message.slice(0, 100)}` };
  } finally {
    clearTimeout(t);
  }
}

async function apiPost(path: string, form: Record<string, string>, timeoutMs = 20_000) {
  const auth = await getRedditToken();
  if (!auth.ok) return { ok: false as const, reason: auth.reason };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://oauth.reddit.com${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams(form),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false as const, reason: `reddit post ${res.status}` };
    }
    return { ok: true as const, data: await res.json() };
  } catch (err) {
    return { ok: false as const, reason: `reddit post fetch: ${(err as Error).message.slice(0, 100)}` };
  } finally {
    clearTimeout(t);
  }
}

export type IntentThread = {
  id: string;
  subreddit: string;
  title: string;
  url: string;
  selftext: string;
  score: number;
  numComments: number;
  createdUtc: number;
};

/**
 * Search allowed subreddits for threads asking questions that our product may
 * genuinely answer. Uses Reddit's search API — no scraping.
 */
export async function discoverBuyingIntent(input: {
  productName: string;
  productKeywords: string[];
  subreddits?: string[];
  limit?: number;
}): Promise<{ ok: true; threads: IntentThread[] } | { ok: false; reason: string }> {
  if (!hasRedditCreds()) return { ok: false, reason: "creds missing" };
  const subs = input.subreddits ?? allowedSubreddits();
  const limit = Math.min(input.limit ?? 15, 25);
  const query = input.productKeywords.slice(0, 3).join(" OR ");
  const q = encodeURIComponent(query);
  const restrictSr = subs.length ? `+${subs.join("+")}` : "";
  const path = `/r/${subs.join("+")}/search?q=${q}&restrict_sr=1&sort=new&t=week&limit=${limit}`;
  const res = await apiGet(path);
  if (!res.ok) return { ok: false, reason: res.reason };
  const data = res.data as {
    data?: { children?: Array<{ data?: any }> };
  };
  const threads: IntentThread[] = [];
  for (const child of data?.data?.children ?? []) {
    const d = child.data;
    if (!d) continue;
    if (d.locked || d.archived || d.removed_by_category) continue;
    if ((d.num_comments ?? 0) > 100) continue;
    threads.push({
      id: `t3_${d.id}`,
      subreddit: d.subreddit,
      title: String(d.title ?? "").slice(0, 300),
      url: `https://www.reddit.com${d.permalink}`,
      selftext: String(d.selftext ?? "").slice(0, 2000),
      score: d.score ?? 0,
      numComments: d.num_comments ?? 0,
      createdUtc: d.created_utc ?? 0,
    });
  }
  return { ok: true, threads: threads.slice(0, limit) };
}

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shouldReply", "body", "reason"],
  properties: {
    shouldReply: {
      type: "boolean",
      description:
        "True ONLY if the product is genuinely the best answer to this thread. Default false.",
    },
    body: {
      type: "string",
      minLength: 60,
      maxLength: 1400,
      description:
        "A genuinely helpful reply. Address the poster's actual problem first. Only reference the product if it directly solves the problem. Include one soft link at the end, at most.",
    },
    reason: { type: "string" },
  },
};

/**
 * Ask the LLM whether to reply and, if so, draft a helpful comment. Enforces
 * the 9-1 rule (< 10% self-promo, so no reply unless it's clearly helpful).
 */
export async function draftRedditReply(input: {
  thread: IntentThread;
  productName: string;
  productPriceUsd: number;
  productUrl: string;
  brandVoice: string;
}): Promise<
  | { ok: true; reply: { shouldReply: boolean; body: string; reason: string } }
  | { ok: false; reason: string }
> {
  if (!hasOpenAIKey()) return { ok: false, reason: "no openai key" };
  const res = await callOpenAI<{
    shouldReply: boolean;
    body: string;
    reason: string;
  }>({
    messages: [
      {
        role: "system",
        content:
          "You are the community-participation limb of RevenueOS. Never post a reply that isn't genuinely useful. If the product isn't a real match, set shouldReply=false. Never claim credentials you don't have. Never invent testimonials. Follow Reddit's 9-1 rule: reply only when you'd reply as a helpful stranger, and mention the product only if it IS the answer. Use brand voice but never spam-adjacent copy.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            priceUsd: input.productPriceUsd,
            url: input.productUrl,
            voice: input.brandVoice,
          },
          thread: {
            subreddit: input.thread.subreddit,
            title: input.thread.title,
            body: input.thread.selftext.slice(0, 1200),
          },
        }),
      },
    ],
    jsonSchema: REPLY_SCHEMA,
    temperature: 0.6,
    maxOutputTokens: 700,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, reply: res.data };
}

/** Post a comment reply to a Reddit thread. */
export async function postRedditReply(input: {
  parentFullname: string; // e.g. "t3_abc123"
  body: string;
}): Promise<{ ok: true; commentId?: string } | { ok: false; reason: string }> {
  if (!hasRedditCreds()) return { ok: false, reason: "creds missing" };
  const res = await apiPost("/api/comment", {
    api_type: "json",
    thing_id: input.parentFullname,
    text: input.body,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  const data = res.data as {
    json?: { errors?: any[]; data?: { things?: Array<{ data?: { id?: string } }> } };
  };
  if (data?.json?.errors?.length) {
    return { ok: false, reason: `reddit errors: ${JSON.stringify(data.json.errors).slice(0, 200)}` };
  }
  const commentId = data?.json?.data?.things?.[0]?.data?.id;
  return { ok: true, commentId };
}

function dataDir(rootDir: string): string {
  return path.join(rootDir, ".data", "reddit");
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

/** Count today's Reddit actions from a per-day file (no store dependency). */
export async function todaysRedditActions(input: {
  rootDir: string;
  now?: Date;
}): Promise<{ used: number; file: string }> {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  const file = path.join(dataDir(input.rootDir), `actions-${day}.json`);
  const data = await readJson<{ count: number }>(file, { count: 0 });
  return { used: data.count, file };
}

async function incrementTodayCounter(rootDir: string, now?: Date) {
  const t = await todaysRedditActions({ rootDir, now });
  await writeJson(t.file, { count: t.used + 1 });
}

async function loadRepliedThreads(rootDir: string): Promise<Set<string>> {
  const file = path.join(dataDir(rootDir), "replied-threads.json");
  const data = await readJson<{ ids: string[] }>(file, { ids: [] });
  return new Set(data.ids);
}

async function recordRepliedThread(rootDir: string, threadId: string) {
  const file = path.join(dataDir(rootDir), "replied-threads.json");
  const data = await readJson<{ ids: string[] }>(file, { ids: [] });
  if (!data.ids.includes(threadId)) {
    data.ids = [threadId, ...data.ids].slice(0, 500);
    await writeJson(file, data);
  }
}

/**
 * End-to-end: search intent → LLM decide → post → record. One thread per call
 * so cycles produce distinct signal per attempt.
 */
export async function executeRedditHelpfulReply(input: {
  rootDir: string;
  productName: string;
  productPriceUsd: number;
  productUrl: string;
  productKeywords: string[];
  brandVoice: string;
  now?: Date;
}): Promise<
  | {
      ok: true;
      detail: string;
      url?: string;
      threadId: string;
      subreddit: string;
    }
  | { ok: false; detail: string }
> {
  if (!hasRedditCreds()) return { ok: false, detail: "reddit creds missing" };
  const cap = dailyActionCap();
  const { used } = await todaysRedditActions({ rootDir: input.rootDir, now: input.now });
  if (used >= cap) {
    return { ok: false, detail: `reddit daily cap ${used}/${cap} hit` };
  }
  const disc = await discoverBuyingIntent({
    productName: input.productName,
    productKeywords: input.productKeywords,
  });
  if (!disc.ok) return { ok: false, detail: `discover: ${disc.reason}` };
  if (disc.threads.length === 0) {
    return { ok: false, detail: "no intent threads found this window" };
  }
  const skipIds = await loadRepliedThreads(input.rootDir);
  for (const thread of disc.threads) {
    if (skipIds.has(thread.id)) continue;
    const draft = await draftRedditReply({
      thread,
      productName: input.productName,
      productPriceUsd: input.productPriceUsd,
      productUrl: input.productUrl,
      brandVoice: input.brandVoice,
    });
    if (!draft.ok) continue;
    if (!draft.reply.shouldReply) continue;
    const posted = await postRedditReply({
      parentFullname: thread.id,
      body: draft.reply.body,
    });
    if (!posted.ok) {
      return { ok: false, detail: `post failed: ${posted.reason}` };
    }
    await recordRepliedThread(input.rootDir, thread.id);
    await incrementTodayCounter(input.rootDir, input.now);
    return {
      ok: true,
      detail: `Replied in r/${thread.subreddit} on "${thread.title.slice(0, 80)}" (${draft.reply.reason.slice(0, 80)})`,
      url: thread.url,
      threadId: thread.id,
      subreddit: thread.subreddit,
    };
  }
  return { ok: false, detail: "no thread qualified for a genuinely helpful reply" };
}
