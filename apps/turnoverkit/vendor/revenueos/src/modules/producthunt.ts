/**
 * Product Hunt executor — discover product-intent discussions + post genuinely
 * helpful comments on active launches.
 *
 * Auth model: a Developer Token (never expires) that authenticates the PH
 * account owner directly against the v2 GraphQL API. No OAuth dance required,
 * so no owner login is needed at runtime.
 *
 * Fails soft everywhere:
 *   - Missing token  → executor short-circuits with a skip detail (no throw).
 *   - GraphQL error  → returns { ok:false, reason } without throwing.
 *   - Daily cap hit  → skips (file-based counter in `.data/producthunt/`).
 *
 * The LLM gate is identical to the reddit-executor: shouldReply must be true
 * AND the product must genuinely be the answer. Never advertise price unless
 * it is already public on the product's own page (we simply do not include
 * pricing in the comment body — the URL is the only pointer).
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const GRAPHQL_ENDPOINT = "https://api.producthunt.com/v2/api/graphql";
const USER_AGENT =
  process.env.PRODUCTHUNT_USER_AGENT || "RevenueOS-portfolio/0.1";

export function hasProductHuntToken(): boolean {
  return Boolean(process.env.PRODUCTHUNT_DEVELOPER_TOKEN);
}

export function producthuntDailyActionCap(): number {
  const raw = process.env.PRODUCTHUNT_DAILY_ACTION_CAP;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 4;
}

type GraphQLResponse<T> =
  | { data: T; errors?: undefined }
  | { data?: undefined; errors: Array<{ message?: string }> };

async function phGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  if (!hasProductHuntToken()) {
    return { ok: false, reason: "producthunt token missing" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PRODUCTHUNT_DEVELOPER_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `ph ${res.status}: ${text.slice(0, 140)}`,
      };
    }
    const body = (await res.json()) as GraphQLResponse<T>;
    if (body.errors && body.errors.length) {
      return {
        ok: false,
        reason: `ph gql: ${(body.errors[0].message ?? "error").slice(0, 140)}`,
      };
    }
    if (!body.data) {
      return { ok: false, reason: "ph gql: empty data" };
    }
    return { ok: true, data: body.data };
  } catch (err) {
    return {
      ok: false,
      reason: `ph fetch: ${(err as Error).message.slice(0, 120)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export type ProductHuntIntentThread = {
  /** GraphQL node id — passed straight to comments.create as subjectId. */
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  topics: string[];
};

const SEARCH_QUERY = /* GraphQL */ `
  query SearchIntent($first: Int!) {
    posts(first: $first, order: NEWEST, postedAfter: null) {
      edges {
        node {
          id
          slug
          name
          tagline
          description
          url
          votesCount
          commentsCount
          createdAt
          topics(first: 5) {
            edges {
              node {
                slug
                name
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Return recent posts whose text intersects any of the given keywords. PH v2
 * has no full-text search on the `posts` root, so we page the newest posts and
 * filter client-side. Cheap and predictable.
 */
export async function searchIntentDiscussions(input: {
  keywords: string[];
  limit?: number;
}): Promise<
  | { ok: true; threads: ProductHuntIntentThread[] }
  | { ok: false; reason: string }
> {
  const first = Math.min(Math.max(input.limit ?? 15, 5), 40);
  const res = await phGraphQL<{
    posts: {
      edges: Array<{
        node: {
          id: string;
          slug: string;
          name: string;
          tagline: string;
          description: string | null;
          url: string;
          votesCount: number;
          commentsCount: number;
          createdAt: string;
          topics: { edges: Array<{ node: { slug: string; name: string } }> };
        };
      }>;
    };
  }>(SEARCH_QUERY, { first });
  if (!res.ok) return { ok: false, reason: res.reason };

  const needles = input.keywords
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);

  const threads: ProductHuntIntentThread[] = [];
  for (const edge of res.data.posts.edges) {
    const n = edge.node;
    const hay =
      `${n.name} ${n.tagline} ${n.description ?? ""}`.toLowerCase();
    const topicNames = n.topics.edges.map((e) => e.node.name.toLowerCase());
    const matched = needles.length
      ? needles.some(
          (k) =>
            hay.includes(k) ||
            topicNames.some((t) => t.includes(k) || k.includes(t)),
        )
      : true;
    if (!matched) continue;
    threads.push({
      id: n.id,
      slug: n.slug,
      name: n.name,
      tagline: n.tagline,
      description: String(n.description ?? "").slice(0, 2000),
      url: n.url,
      votesCount: n.votesCount,
      commentsCount: n.commentsCount,
      createdAt: n.createdAt,
      topics: n.topics.edges.map((e) => e.node.slug),
    });
    if (threads.length >= (input.limit ?? 15)) break;
  }
  return { ok: true, threads };
}

const COMMENT_MUTATION = /* GraphQL */ `
  mutation CommentCreate($input: CommentCreateInput!) {
    commentCreate(input: $input) {
      node {
        id
        url
      }
      errors {
        field
        message
      }
    }
  }
`;

/**
 * Post a top-level comment on a PH post. Requires `write` scope on the token.
 * Fails soft if the token isn't set or the API rejects the write.
 */
export async function submitProductComment(input: {
  postId: string;
  body: string;
}): Promise<
  | { ok: true; commentId: string; url?: string }
  | { ok: false; reason: string }
> {
  if (!hasProductHuntToken()) {
    return { ok: false, reason: "producthunt token missing" };
  }
  const trimmed = input.body.trim();
  if (trimmed.length < 40) {
    return { ok: false, reason: "comment body too short (<40 chars)" };
  }
  const res = await phGraphQL<{
    commentCreate: {
      node?: { id: string; url?: string };
      errors?: Array<{ field?: string; message?: string }>;
    };
  }>(COMMENT_MUTATION, {
    input: { subjectId: input.postId, body: trimmed },
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  const errs = res.data.commentCreate.errors ?? [];
  if (errs.length) {
    return {
      ok: false,
      reason: `ph commentCreate: ${(errs[0].message ?? "error").slice(0, 140)}`,
    };
  }
  const node = res.data.commentCreate.node;
  if (!node?.id) {
    return { ok: false, reason: "ph commentCreate: no node returned" };
  }
  return { ok: true, commentId: node.id, url: node.url };
}

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shouldReply", "body", "reason"],
  properties: {
    shouldReply: {
      type: "boolean",
      description:
        "True ONLY if our product is genuinely the best answer to a real question raised by this launch (or if the maker is explicitly soliciting feedback that our product would inform). Default false.",
    },
    body: {
      type: "string",
      minLength: 60,
      maxLength: 1200,
      description:
        "Congratulate the maker briefly, then leave a specific, useful observation about their product. Only mention our product if it directly complements or addresses a stated user need. Do NOT quote a price. Include at most one soft link at the end.",
    },
    reason: { type: "string" },
  },
};

async function draftProductComment(input: {
  thread: ProductHuntIntentThread;
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
          "You are the community-participation limb of RevenueOS commenting on a Product Hunt launch. Be a peer builder, never a marketer. Congratulate genuinely, then only add value if you can. Post a self-link ONLY when our product is a legitimate answer to a need the maker or the community would recognize. Never mention pricing (we cannot verify what is publicly listed). No emojis unless the brand voice explicitly uses them. No overclaiming. If in doubt, set shouldReply=false.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            url: input.productUrl,
            voice: input.brandVoice,
          },
          producthunt_post: {
            name: input.thread.name,
            tagline: input.thread.tagline,
            description: input.thread.description.slice(0, 1200),
            topics: input.thread.topics,
            url: input.thread.url,
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

function dataDir(rootDir: string): string {
  return path.join(rootDir, ".data", "producthunt");
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

export async function todaysProductHuntActions(input: {
  rootDir: string;
  now?: Date;
}): Promise<{ used: number; file: string }> {
  const day = (input.now ?? new Date()).toISOString().slice(0, 10);
  const file = path.join(dataDir(input.rootDir), `actions-${day}.json`);
  const data = await readJson<{ count: number }>(file, { count: 0 });
  return { used: data.count, file };
}

async function incrementTodayCounter(rootDir: string, now?: Date) {
  const t = await todaysProductHuntActions({ rootDir, now });
  await writeJson(t.file, { count: t.used + 1 });
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

/**
 * End-to-end: discover intent → LLM decide → comment. One post per call. Never
 * throws; caller relays the detail up to the drain report.
 */
export async function executeProductHuntHelpfulReply(input: {
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
      slug: string;
      mode: "posted" | "drafted";
    }
  | { ok: false; detail: string }
> {
  if (!hasProductHuntToken()) {
    return {
      ok: false,
      detail: "producthunt_helpful_reply skipped: PRODUCTHUNT_DEVELOPER_TOKEN missing",
    };
  }
  const cap = producthuntDailyActionCap();
  const { used } = await todaysProductHuntActions({
    rootDir: input.rootDir,
    now: input.now,
  });
  if (used >= cap) {
    return { ok: false, detail: `producthunt daily cap ${used}/${cap} hit` };
  }
  const disc = await searchIntentDiscussions({
    keywords: input.productKeywords,
    limit: 15,
  });
  if (!disc.ok) {
    return { ok: false, detail: `discover: ${disc.reason}` };
  }
  if (disc.threads.length === 0) {
    return { ok: false, detail: "no producthunt threads matched keywords" };
  }
  const skipIds = await loadRepliedPosts(input.rootDir);
  for (const thread of disc.threads) {
    if (skipIds.has(thread.id)) continue;
    const draft = await draftProductComment({
      thread,
      productName: input.productName,
      productUrl: input.productUrl,
      brandVoice: input.brandVoice,
    });
    if (!draft.ok) continue;
    if (!draft.reply.shouldReply) continue;

    const posted = await submitProductComment({
      postId: thread.id,
      body: draft.reply.body,
    });
    if (!posted.ok) {
      // If the token lacks write scope PH returns a clear error; surface it so
      // the operator can request approval without us silently retrying.
      return {
        ok: false,
        detail: `producthunt post failed: ${posted.reason}`,
      };
    }
    await recordRepliedPost(input.rootDir, thread.id);
    await incrementTodayCounter(input.rootDir, input.now);
    return {
      ok: true,
      mode: "posted",
      detail: `Commented on PH launch "${thread.name.slice(0, 60)}" — ${draft.reply.reason.slice(0, 100)}`,
      url: posted.url ?? thread.url,
      postId: thread.id,
      slug: thread.slug,
    };
  }
  return {
    ok: false,
    detail: "no producthunt thread qualified for a genuinely helpful comment",
  };
}
