/**
 * YouTube executor — buying-intent discovery via YouTube Data API v3 +
 * community-reply drafts to discovered intent comments.
 *
 * Auth:
 *   - YOUTUBE_API_KEY (required, read-only) — key auth for search + commentThreads.
 *   - YOUTUBE_OAUTH_TOKEN (optional) — bearer token used to post via
 *     comments.insert. If missing, the community_reply_draft action always
 *     drafts for owner paste.
 *
 * Two actions:
 *   1. youtube_intent_discovery — search videos + top comments matching
 *      product buying-intent queries. LLM-gates each comment for intent and
 *      promotes hits to DurableBuyerLead entries with
 *      `reachMethod: "youtube_comment"`.
 *   2. youtube_community_reply_draft — LLM drafts a helpful reply for a
 *      previously discovered comment. Posts directly if YOUTUBE_OAUTH_TOKEN
 *      is set, else saves as draft.
 */

import { callOpenAI, hasOpenAIKey } from "./openai-client";
import { shouldAllowExternalContact } from "./compliance-guard";
import type { DurableBuyerLead } from "./buyer-discovery";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const YT_API = "https://www.googleapis.com/youtube/v3";
const USER_AGENT = process.env.YOUTUBE_USER_AGENT || "RevenueOS-portfolio/0.1";

export function hasYouTubeApiKey(): boolean {
  return Boolean(
    process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.length > 20,
  );
}

export function hasYouTubeOauthToken(): boolean {
  return Boolean(
    process.env.YOUTUBE_OAUTH_TOKEN &&
      process.env.YOUTUBE_OAUTH_TOKEN.length > 20,
  );
}

export function youtubeDailyDiscoveryCap(): number {
  const raw = process.env.YOUTUBE_DAILY_DISCOVERY_CAP;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.floor(n)) : 6;
}

function dataDir(rootDir: string): string {
  return path.join(rootDir, ".data", "youtube");
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

async function ytGet<T>(
  pathname: string,
  params: Record<string, string>,
  timeoutMs = 15_000,
): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  if (!hasYouTubeApiKey()) {
    return { ok: false, reason: "no_youtube_api_key" };
  }
  const query = new URLSearchParams({
    ...params,
    key: process.env.YOUTUBE_API_KEY!,
  });
  const target = `${YT_API}${pathname}?${query.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `yt ${res.status}: ${text.slice(0, 140)}`,
      };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return {
      ok: false,
      reason: `yt fetch: ${(err as Error).message.slice(0, 120)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

type YtSearchResponse = {
  items?: Array<{
    id?: { videoId?: string; kind?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
    };
  }>;
};

type YtCommentThread = {
  id?: string;
  snippet?: {
    topLevelComment?: {
      id?: string;
      snippet?: {
        textDisplay?: string;
        authorDisplayName?: string;
        authorChannelId?: { value?: string };
        likeCount?: number;
        publishedAt?: string;
      };
    };
    videoId?: string;
  };
};

async function searchVideos(input: {
  query: string;
  limit: number;
}): Promise<
  | {
      ok: true;
      videos: Array<{
        videoId: string;
        title: string;
        description: string;
        channelTitle?: string;
      }>;
    }
  | { ok: false; reason: string }
> {
  const compliance = await shouldAllowExternalContact({
    targetUrl: `${YT_API}/search`,
    action: "http_get",
    userAgent: USER_AGENT,
  });
  if (!compliance.allowed) {
    return {
      ok: false,
      reason: `compliance_blocked: ${compliance.reasons.join(",")}`,
    };
  }
  const res = await ytGet<YtSearchResponse>("/search", {
    part: "snippet",
    q: input.query,
    type: "video",
    order: "date",
    maxResults: String(Math.min(input.limit, 25)),
    relevanceLanguage: "en",
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  const videos = (res.data.items ?? [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: it.snippet?.title ?? "",
      description: (it.snippet?.description ?? "").slice(0, 800),
      channelTitle: it.snippet?.channelTitle,
    }));
  return { ok: true, videos };
}

async function listCommentThreads(input: {
  videoId: string;
  limit: number;
}): Promise<
  | {
      ok: true;
      comments: Array<{
        commentId: string;
        text: string;
        author: string;
        likeCount: number;
        videoId: string;
      }>;
    }
  | { ok: false; reason: string }
> {
  const res = await ytGet<{ items?: YtCommentThread[] }>("/commentThreads", {
    part: "snippet",
    videoId: input.videoId,
    maxResults: String(Math.min(input.limit, 30)),
    order: "relevance",
    textFormat: "plainText",
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  const comments = (res.data.items ?? [])
    .map((it) => {
      const top = it.snippet?.topLevelComment;
      const s = top?.snippet;
      if (!top?.id || !s?.textDisplay) return null;
      return {
        commentId: top.id,
        text: s.textDisplay.slice(0, 1500),
        author: s.authorDisplayName ?? "",
        likeCount: s.likeCount ?? 0,
        videoId: input.videoId,
      };
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  return { ok: true, comments };
}

const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hasIntent", "reason", "score"],
  properties: {
    hasIntent: {
      type: "boolean",
      description:
        "True ONLY if the commenter is expressing a need our product could solve. General praise/questions don't qualify.",
    },
    reason: { type: "string" },
    score: { type: "number", minimum: 0, maximum: 100 },
  },
};

async function gateCommentForIntent(input: {
  comment: string;
  productName: string;
  productDescription: string;
}): Promise<
  | { ok: true; hasIntent: boolean; reason: string; score: number }
  | { ok: false; reason: string }
> {
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
          "You classify YouTube comments for buying intent — someone actively looking for a tool that solves a specific problem our product addresses. Fandom/support comments don't count. Set hasIntent=true only when the connection is direct.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            description: input.productDescription,
          },
          comment: input.comment.slice(0, 1200),
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
 * End-to-end YouTube intent discovery. Never throws.
 */
export async function executeYouTubeIntentDiscovery(input: {
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
  if (!hasYouTubeApiKey()) {
    return {
      ok: false,
      detail:
        "youtube_intent_discovery skipped: YOUTUBE_API_KEY missing (read-only key required)",
    };
  }
  const cap = youtubeDailyDiscoveryCap();
  const queries = input.productKeywords.slice(0, 3);
  if (queries.length === 0) {
    return {
      ok: false,
      detail: "youtube_intent_discovery: no product keywords supplied",
    };
  }
  const leads: DurableBuyerLead[] = [];
  const seenCommentIds = new Set<string>();
  outer: for (const q of queries) {
    const vids = await searchVideos({ query: q, limit: 6 });
    if (!vids.ok) continue;
    for (const video of vids.videos) {
      if (leads.length >= cap) break outer;
      const threads = await listCommentThreads({
        videoId: video.videoId,
        limit: 10,
      });
      if (!threads.ok) continue;
      for (const c of threads.comments) {
        if (leads.length >= cap) break outer;
        if (seenCommentIds.has(c.commentId)) continue;
        seenCommentIds.add(c.commentId);
        const gated = await gateCommentForIntent({
          comment: c.text,
          productName: input.productName,
          productDescription: input.productDescription,
        });
        if (!gated.ok) continue;
        if (!gated.hasIntent) continue;
        if (gated.score < 55) continue;
        leads.push({
          url: `https://www.youtube.com/watch?v=${video.videoId}&lc=${c.commentId}`,
          surface: `youtube_video:${video.videoId}`,
          segment: input.productName + " intent viewer",
          whyMatch: gated.reason.slice(0, 240),
          reachMethod: "youtube_comment",
          score: gated.score,
          name: c.author,
          reasonToReach: gated.reason.slice(0, 240),
        });
      }
    }
  }
  const snap = path.join(dataDir(input.rootDir), "intent-latest.json");
  await writeJson(snap, {
    at: (input.now ?? new Date()).toISOString(),
    queries,
    kept: leads.length,
  });
  if (leads.length === 0) {
    return {
      ok: false,
      detail: "youtube_intent_discovery: 0 comments qualified for buying intent",
    };
  }
  return {
    ok: true,
    detail: `youtube_intent_discovery: +${leads.length} buying-intent leads (comment surfaces)`,
    leads,
  };
}

const REPLY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shouldReply", "body", "reason"],
  properties: {
    shouldReply: {
      type: "boolean",
      description:
        "True ONLY if the product is a direct answer to the commenter's expressed need. Default false.",
    },
    body: {
      type: "string",
      minLength: 40,
      maxLength: 1000,
      description:
        "A genuinely helpful reply. Address the actual need first. Mention product only if it fits. YouTube-appropriate tone.",
    },
    reason: { type: "string" },
  },
};

async function draftYouTubeReply(input: {
  comment: { text: string; author: string; videoId: string; commentId: string };
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
          "You are the community-participation limb of RevenueOS commenting on YouTube. YouTube comment norms: short-ish, respectful, no spam. Follow the 9-1 rule — reply only if genuinely helpful, and only mention the product if it directly answers the commenter's stated need. Never mass-market talk.",
      },
      {
        role: "user",
        content: JSON.stringify({
          product: {
            name: input.productName,
            url: input.productUrl,
            voice: input.brandVoice,
          },
          youtube_comment: {
            author: input.comment.author,
            text: input.comment.text.slice(0, 1200),
            videoId: input.comment.videoId,
          },
        }),
      },
    ],
    jsonSchema: REPLY_SCHEMA,
    temperature: 0.55,
    maxOutputTokens: 500,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, reply: res.data };
}

async function postYouTubeReply(input: {
  parentCommentId: string;
  body: string;
}): Promise<{ ok: true; id?: string } | { ok: false; reason: string }> {
  if (!hasYouTubeOauthToken()) {
    return { ok: false, reason: "no_youtube_oauth_token" };
  }
  const compliance = await shouldAllowExternalContact({
    targetUrl: `${YT_API}/comments`,
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
    const res = await fetch(`${YT_API}/comments?part=snippet`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.YOUTUBE_OAUTH_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        snippet: {
          parentId: input.parentCommentId,
          textOriginal: input.body,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        reason: `yt post ${res.status}: ${text.slice(0, 140)}`,
      };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      reason: `yt post fetch: ${(err as Error).message.slice(0, 120)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function saveYouTubeDraft(input: {
  rootDir: string;
  videoId: string;
  commentId: string;
  parentAuthor: string;
  parentText: string;
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
      kind: "youtube_reply_draft",
      at: new Date().toISOString(),
      videoId: input.videoId,
      parentCommentId: input.commentId,
      parentAuthor: input.parentAuthor,
      parentText: input.parentText,
      body: input.body,
      reason: input.reason,
      productName: input.productName,
      pasteAt: `https://www.youtube.com/watch?v=${input.videoId}&lc=${input.commentId}`,
      status: "awaiting_owner_post",
    },
    ...data.drafts,
  ].slice(0, 50);
  await writeJson(file, data);
}

/**
 * Draft (or post if oauth token set) a helpful reply to a previously
 * discovered intent comment. Accepts either an explicit comment or falls back
 * to the most recent stored intent lead.
 */
export async function executeYouTubeCommunityReplyDraft(input: {
  rootDir: string;
  productName: string;
  productUrl: string;
  brandVoice: string;
  targetComment?: {
    videoId: string;
    commentId: string;
    author: string;
    text: string;
  };
  now?: Date;
}): Promise<
  | { ok: true; detail: string; url?: string; mode: "posted" | "drafted" }
  | { ok: false; detail: string }
> {
  if (!hasYouTubeApiKey() && !input.targetComment) {
    return {
      ok: false,
      detail:
        "youtube_community_reply_draft skipped: YOUTUBE_API_KEY missing and no target comment supplied",
    };
  }
  const target = input.targetComment;
  if (!target) {
    return {
      ok: false,
      detail:
        "youtube_community_reply_draft: no target comment supplied — run youtube_intent_discovery first and pass the top lead",
    };
  }
  const drafted = await draftYouTubeReply({
    comment: {
      text: target.text,
      author: target.author,
      videoId: target.videoId,
      commentId: target.commentId,
    },
    productName: input.productName,
    productUrl: input.productUrl,
    brandVoice: input.brandVoice,
  });
  if (!drafted.ok)
    return {
      ok: false,
      detail: `youtube_community_reply_draft: ${drafted.reason}`,
    };
  if (!drafted.reply.shouldReply) {
    return {
      ok: false,
      detail: "youtube_community_reply_draft: LLM gate decided the fit was too weak to reply",
    };
  }
  if (hasYouTubeOauthToken()) {
    const posted = await postYouTubeReply({
      parentCommentId: target.commentId,
      body: drafted.reply.body,
    });
    if (posted.ok) {
      return {
        ok: true,
        mode: "posted",
        detail: `youtube_community_reply_draft: posted reply on video ${target.videoId} — ${drafted.reply.reason.slice(0, 100)}`,
        url: `https://www.youtube.com/watch?v=${target.videoId}&lc=${target.commentId}`,
      };
    }
    // fall through to DRAFT
  }
  await saveYouTubeDraft({
    rootDir: input.rootDir,
    videoId: target.videoId,
    commentId: target.commentId,
    parentAuthor: target.author,
    parentText: target.text,
    body: drafted.reply.body,
    reason: drafted.reply.reason,
    productName: input.productName,
  });
  return {
    ok: true,
    mode: "drafted",
    detail: `youtube_community_reply_draft: DRAFT saved for video ${target.videoId} (paste at .data/youtube/drafts-pending.json)`,
    url: `https://www.youtube.com/watch?v=${target.videoId}&lc=${target.commentId}`,
  };
}
