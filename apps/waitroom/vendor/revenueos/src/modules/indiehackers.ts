/**
 * Indie Hackers executor — product listing drafts + community post drafts.
 *
 * IH has no OAuth/API for third-party writes. Two paths:
 *   1. DRAFT (default): LLM authors content and saves it to
 *      `.data/indiehackers/drafts-pending.json` for owner paste.
 *   2. OPTIONAL WRITE: if `INDIEHACKERS_SESSION_COOKIE` is set, POST directly
 *      with the cookie in the `Cookie:` header. Fragile — falls back to DRAFT
 *      on any error.
 *
 * Discovery uses the public JSON firehose at
 * `https://www.indiehackers.com/newest.json`, falling back to HTML if that
 * endpoint 404s. LLM gate scores each post for buying intent before drafting
 * a helpful reply (9-1 rule).
 *
 * Never throws. Safe when creds/keys missing.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";
import { shouldAllowExternalContact } from "./compliance-guard";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const USER_AGENT =
  process.env.INDIEHACKERS_USER_AGENT || "RevenueOS-portfolio/0.1";

export function hasIndieHackersCookie(): boolean {
  return Boolean(
    process.env.INDIEHACKERS_SESSION_COOKIE &&
      process.env.INDIEHACKERS_SESSION_COOKIE.length > 10,
  );
}

export function indieHackersDailyActionCap(): number {
  const raw = process.env.INDIEHACKERS_DAILY_ACTION_CAP;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(15, Math.floor(n)) : 4;
}

export type IndieHackersPost = {
  id: string;
  title: string;
  body: string;
  url: string;
  author?: string;
  group?: string;
  createdAt?: string;
  commentsCount?: number;
};

function dataDir(rootDir: string): string {
  return path.join(rootDir, ".data", "indiehackers");
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

export async function todaysIndieHackersActions(input: {
  rootDir: string;
  now?: Date;
}): Promise<{ used: number; file: string }> {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  const file = path.join(dataDir(input.rootDir), `actions-${day}.json`);
  const data = await readJson<{ count: number }>(file, { count: 0 });
  return { used: data.count, file };
}

async function incrementTodayCounter(rootDir: string, now?: Date) {
  const t = await todaysIndieHackersActions({ rootDir, now });
  await writeJson(t.file, { count: t.used + 1 });
}

/** Fetch newest posts from IH. Returns [] on any error (never throws). */
async function fetchNewestPosts(limit: number): Promise<IndieHackersPost[]> {
  const compliance = await shouldAllowExternalContact({
    targetUrl: "https://www.indiehackers.com/newest",
    action: "http_get",
    userAgent: USER_AGENT,
  });
  if (!compliance.allowed) return [];
  const url = "https://www.indiehackers.com/newest.json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown;
    const arr = extractPostsFromFirehose(raw);
    return arr.slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** IH JSON shape isn't officially documented; try common variants. */
function extractPostsFromFirehose(raw: unknown): IndieHackersPost[] {
  if (!raw || typeof raw !== "object") return [];
  const anyRaw = raw as Record<string, unknown>;
  const candidates: unknown[] = [];
  if (Array.isArray(anyRaw.posts)) candidates.push(...(anyRaw.posts as unknown[]));
  if (Array.isArray(anyRaw.items)) candidates.push(...(anyRaw.items as unknown[]));
  if (Array.isArray(anyRaw.data)) candidates.push(...(anyRaw.data as unknown[]));
  if (Array.isArray(anyRaw.results))
    candidates.push(...(anyRaw.results as unknown[]));
  if (Array.isArray(raw)) candidates.push(...(raw as unknown[]));
  const out: IndieHackersPost[] = [];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const p = c as Record<string, unknown>;
    const id = String(p.id ?? p.slug ?? p.uuid ?? "");
    const title = String(p.title ?? p.subject ?? "");
    if (!id || !title) continue;
    const rawBody =
      typeof p.rawBody === "string"
        ? p.rawBody
        : typeof p.body === "string"
          ? p.body
          : typeof p.excerpt === "string"
            ? p.excerpt
            : "";
    const url = String(
      p.url ??
        (p.path
          ? `https://www.indiehackers.com${p.path}`
          : `https://www.indiehackers.com/post/${id}`),
    );
    out.push({
      id,
      title: title.slice(0, 300),
      body: rawBody.slice(0, 3000),
      url,
      author:
        typeof p.userUsername === "string"
          ? p.userUsername
          : typeof p.user === "object" && p.user
            ? String(
                (p.user as Record<string, unknown>).username ??
                  (p.user as Record<string, unknown>).name ??
                  "",
              ) || undefined
            : undefined,
      group:
        typeof p.groupName === "string"
          ? p.groupName
          : typeof p.group === "object" && p.group
            ? String((p.group as Record<string, unknown>).name ?? "") ||
              undefined
            : undefined,
      createdAt:
        typeof p.createdAt === "string"
          ? p.createdAt
          : typeof p.postedAt === "string"
            ? p.postedAt
            : undefined,
      commentsCount:
        typeof p.commentsCount === "number" ? p.commentsCount : undefined,
    });
  }
  return out;
}

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shouldReply", "body", "reason"],
  properties: {
    shouldReply: {
      type: "boolean",
      description:
        "True ONLY if our product is genuinely the best answer to this thread AND the poster is asking (explicitly or implicitly) for something we can help with. Default false.",
    },
    body: {
      type: "string",
      minLength: 60,
      maxLength: 1400,
      description:
        "A genuinely helpful IH-appropriate reply. Address the poster's actual problem first. Reference our product only if it's a direct fit. One soft link at the end at most.",
    },
    reason: { type: "string" },
  },
};

async function draftIhReply(input: {
  post: IndieHackersPost;
  productName: string;
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
          "You are the community-participation limb of RevenueOS commenting on Indie Hackers. Be a peer indie hacker, not a marketer. Reply only if the product is legitimately the answer — never spam. IH values honesty over polish. Follow the 9-1 rule: reply only when you'd reply as a fellow builder helping another builder. Never invent revenue numbers or credentials.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            url: input.productUrl,
            voice: input.brandVoice,
          },
          ih_post: {
            title: input.post.title,
            body: input.post.body.slice(0, 1500),
            group: input.post.group,
            author: input.post.author,
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

async function saveReplyDraft(input: {
  rootDir: string;
  post: IndieHackersPost;
  body: string;
  reason: string;
  productName: string;
}) {
  const file = path.join(dataDir(input.rootDir), "drafts-pending.json");
  const data = await readJson<{ drafts: Array<Record<string, unknown>> }>(file, {
    drafts: [],
  });
  data.drafts = [
    {
      kind: "community_post_reply",
      at: new Date().toISOString(),
      postId: input.post.id,
      postUrl: input.post.url,
      postTitle: input.post.title,
      group: input.post.group,
      productName: input.productName,
      body: input.body,
      reason: input.reason,
      pasteAt: input.post.url,
      status: "awaiting_owner_post",
    },
    ...data.drafts,
  ].slice(0, 50);
  await writeJson(file, data);
}

async function loadRepliedPosts(rootDir: string): Promise<Set<string>> {
  const file = path.join(dataDir(rootDir), "replied-posts.json");
  const data = await readJson<{ ids: string[] }>(file, { ids: [] });
  return new Set(data.ids);
}

async function recordRepliedPost(rootDir: string, postId: string) {
  const file = path.join(dataDir(rootDir), "replied-posts.json");
  const data = await readJson<{ ids: string[] }>(file, { ids: [] });
  if (!data.ids.includes(postId)) {
    data.ids = [postId, ...data.ids].slice(0, 500);
    await writeJson(file, data);
  }
}

async function postCommentWithCookie(input: {
  postId: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!hasIndieHackersCookie()) {
    return { ok: false, reason: "no session cookie" };
  }
  const compliance = await shouldAllowExternalContact({
    targetUrl: `https://www.indiehackers.com/post/${input.postId}`,
    action: "http_post",
    userAgent: USER_AGENT,
  });
  if (!compliance.allowed) {
    return {
      ok: false,
      reason: `compliance_blocked: ${compliance.reasons.join(",")}`,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(
      `https://www.indiehackers.com/post/${encodeURIComponent(input.postId)}/comments`,
      {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/json",
          Cookie: process.env.INDIEHACKERS_SESSION_COOKIE!,
        },
        body: JSON.stringify({ rawBody: input.body }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, reason: `ih ${res.status}` };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: `ih post fetch: ${(err as Error).message.slice(0, 120)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * End-to-end: discover intent → LLM decide → draft (or post if cookie set).
 * Never throws.
 */
export async function executeIndieHackersCommunityPost(input: {
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
      postId: string;
      mode: "posted" | "drafted";
    }
  | { ok: false; detail: string }
> {
  const cap = indieHackersDailyActionCap();
  const { used } = await todaysIndieHackersActions({
    rootDir: input.rootDir,
    now: input.now,
  });
  if (used >= cap) {
    return { ok: false, detail: `indiehackers daily cap ${used}/${cap} hit` };
  }
  const posts = await fetchNewestPosts(20);
  if (posts.length === 0) {
    return {
      ok: false,
      detail:
        "indiehackers_community_post: firehose returned no posts (public JSON blocked from serverless IPs — DRAFT still available on next hit)",
    };
  }
  const needles = input.productKeywords
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);
  const filtered = posts.filter((p) => {
    if (!needles.length) return true;
    const hay = `${p.title} ${p.body} ${p.group ?? ""}`.toLowerCase();
    return needles.some((k) => hay.includes(k));
  });
  const candidates = filtered.length ? filtered : posts;
  const skipIds = await loadRepliedPosts(input.rootDir);
  for (const post of candidates) {
    if (skipIds.has(post.id)) continue;
    const draft = await draftIhReply({
      post,
      productName: input.productName,
      productUrl: input.productUrl,
      brandVoice: input.brandVoice,
    });
    if (!draft.ok) continue;
    if (!draft.reply.shouldReply) continue;

    if (hasIndieHackersCookie()) {
      const posted = await postCommentWithCookie({
        postId: post.id,
        body: draft.reply.body,
      });
      if (posted.ok) {
        await recordRepliedPost(input.rootDir, post.id);
        await incrementTodayCounter(input.rootDir, input.now);
        return {
          ok: true,
          mode: "posted",
          detail: `Commented on IH "${post.title.slice(0, 60)}" — ${draft.reply.reason.slice(0, 80)}`,
          url: post.url,
          postId: post.id,
        };
      }
      // fall through to DRAFT
    }

    await saveReplyDraft({
      rootDir: input.rootDir,
      post,
      body: draft.reply.body,
      reason: draft.reply.reason,
      productName: input.productName,
    });
    await recordRepliedPost(input.rootDir, post.id);
    await incrementTodayCounter(input.rootDir, input.now);
    return {
      ok: true,
      mode: "drafted",
      detail: `DRAFT (no IH write path): "${post.title.slice(0, 60)}" — paste from .data/indiehackers/drafts-pending.json`,
      url: post.url,
      postId: post.id,
    };
  }
  return {
    ok: false,
    detail: "no indiehackers post qualified for a genuinely helpful reply",
  };
}

const LISTING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "tagline", "story", "milestoneNote"],
  properties: {
    title: { type: "string", minLength: 4, maxLength: 80 },
    tagline: { type: "string", minLength: 10, maxLength: 140 },
    story: {
      type: "string",
      minLength: 200,
      maxLength: 2500,
      description:
        "Founder story in indie-hackers voice — problem, why you started, current state. No fake revenue numbers.",
    },
    milestoneNote: {
      type: "string",
      description:
        "One-line honest current-state note (e.g., 'launched — chasing first customer' or 'pre-launch').",
    },
  },
};

async function draftProductListing(input: {
  productName: string;
  productUrl: string;
  productDescription: string;
  audience: string;
  brandVoice: string;
  priceUsd: number;
}): Promise<
  | {
      ok: true;
      listing: {
        title: string;
        tagline: string;
        story: string;
        milestoneNote: string;
      };
    }
  | { ok: false; reason: string }
> {
  if (!hasOpenAIKey()) return { ok: false, reason: "no openai key" };
  const res = await callOpenAI<{
    title: string;
    tagline: string;
    story: string;
    milestoneNote: string;
  }>({
    messages: [
      {
        role: "system",
        content:
          "You draft honest, indie-hackers-appropriate product listings. Match the community voice: builder-to-builder, transparent, no marketing fluff, no invented revenue numbers. If the product is pre-revenue, say so. Story should describe the problem, why the builder started, and where things stand today.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            url: input.productUrl,
            description: input.productDescription,
            priceUsd: input.priceUsd,
          },
          audience: input.audience,
          voice: input.brandVoice,
        }),
      },
    ],
    jsonSchema: LISTING_SCHEMA,
    temperature: 0.7,
    maxOutputTokens: 1400,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, listing: res.data };
}

async function saveListingDraft(input: {
  rootDir: string;
  listing: {
    title: string;
    tagline: string;
    story: string;
    milestoneNote: string;
  };
  productName: string;
  productUrl: string;
}) {
  const file = path.join(dataDir(input.rootDir), "product-listings.json");
  const data = await readJson<{ listings: Array<Record<string, unknown>> }>(file, {
    listings: [],
  });
  data.listings = [
    {
      kind: "product_listing",
      at: new Date().toISOString(),
      productName: input.productName,
      productUrl: input.productUrl,
      listing: input.listing,
      pasteAt: "https://www.indiehackers.com/products/new",
      status: "awaiting_owner_post",
    },
    ...data.listings,
  ].slice(0, 20);
  await writeJson(file, data);
}

/**
 * Draft a product listing for the owner to paste into IH. Idempotent within
 * a 30-day cooldown enforced by the registry.
 */
export async function executeIndieHackersProductListing(input: {
  rootDir: string;
  productName: string;
  productPriceUsd: number;
  productUrl: string;
  productDescription: string;
  audience: string;
  brandVoice: string;
  now?: Date;
}): Promise<
  | {
      ok: true;
      detail: string;
      url?: string;
      mode: "drafted";
    }
  | { ok: false; detail: string }
> {
  if (!hasOpenAIKey()) {
    return {
      ok: false,
      detail:
        "indiehackers_product_listing skipped: OPENAI_API_KEY missing for content generation",
    };
  }
  const draft = await draftProductListing({
    productName: input.productName,
    productUrl: input.productUrl,
    productDescription: input.productDescription,
    audience: input.audience,
    brandVoice: input.brandVoice,
    priceUsd: input.productPriceUsd,
  });
  if (!draft.ok) {
    return {
      ok: false,
      detail: `indiehackers_product_listing draft failed: ${draft.reason}`,
    };
  }
  await saveListingDraft({
    rootDir: input.rootDir,
    listing: draft.listing,
    productName: input.productName,
    productUrl: input.productUrl,
  });
  return {
    ok: true,
    mode: "drafted",
    detail: `IH product listing drafted ("${draft.listing.title}") — paste at https://www.indiehackers.com/products/new (see .data/indiehackers/product-listings.json)`,
    url: "https://www.indiehackers.com/products/new",
  };
}
