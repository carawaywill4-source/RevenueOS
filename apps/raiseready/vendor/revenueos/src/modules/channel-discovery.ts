/**
 * Channel Discovery Engine.
 *
 * Per business: product → buyer → buyer intent → where buyers congregate →
 * permitted actions → experiment → conversion → revenue.
 *
 * Uses OpenAI + web search (same patterns as buyer-discovery / llm-strategist)
 * to discover surfaces *specific* to that business. ResumeForge ≠ TurnoverKit.
 *
 * Seeds/expands from the capability catalog — never a hardcoded "post every
 * business to Reddit every hour" loop. Never buy ads, listings, or engagement.
 */

import type { BusinessContext } from "../types";
import type { MechanismClass } from "./action-class";
import {
  CHANNEL_CAPABILITY_CATALOG,
  capabilityById,
  type ChannelCapability,
  type ChannelCategory,
} from "./channel-catalog";
import { callOpenAI, DEFAULT_MODELS, hasOpenAIKey } from "./openai-client";
import { queryWebForBuyingIntent, type WebSearchResult } from "./web-search";

export type ChannelCandidate = {
  platform: string;
  capabilityId?: string;
  category: ChannelCategory | string;
  audience: string;
  buyerIntent: "high" | "medium" | "low";
  intentScore: number;
  allowedActionGuess: string;
  suggestedAction?: string;
  actionTypes: string[];
  mechanism: MechanismClass;
  effortEstimate: number;
  evidenceUrls: string[];
  angle: string;
  postingRules: string[];
  contentFormats: string[];
  /** Why this surface fits THIS business (not a portfolio generic). */
  businessSpecificReason: string;
  /** Owned-domain asset idea when discovery points at long-tail intent. */
  ownedAssetIdea?: {
    kind:
      | "calculator"
      | "generator"
      | "template"
      | "comparison_tool"
      | "quiz"
      | "database"
      | "guide"
      | "widget";
    title: string;
    intentQuery: string;
  };
};

export type DiscoverChannelsInput = {
  context: BusinessContext;
  /** Optional long-tail queries (e.g. from GSC). */
  gscQueries?: string[];
  maxCandidates?: number;
  /** Injected for tests — skip live OpenAI. */
  llmOverride?: (args: {
    productName: string;
    industry: string;
    searchResults: WebSearchResult[];
  }) => Promise<ChannelCandidate[]> | ChannelCandidate[];
  /** Injected search results for tests. */
  searchOverride?: WebSearchResult[];
};

export type DiscoverChannelsOutput = {
  ok: boolean;
  candidates: ChannelCandidate[];
  reason?: string;
  catalogSeedCount: number;
  searchResultCount: number;
};

const CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      minItems: 0,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "platform",
          "audience",
          "buyerIntent",
          "intentScore",
          "allowedActionGuess",
          "effortEstimate",
          "evidenceUrls",
          "angle",
          "businessSpecificReason",
          "capabilityId",
        ],
        properties: {
          platform: { type: "string" },
          capabilityId: {
            type: "string",
            description: "Must match a catalog id when possible",
          },
          audience: { type: "string" },
          buyerIntent: { type: "string", enum: ["high", "medium", "low"] },
          intentScore: { type: "number", minimum: 0, maximum: 100 },
          allowedActionGuess: { type: "string" },
          suggestedAction: { type: "string" },
          effortEstimate: { type: "number", minimum: 1, maximum: 5 },
          evidenceUrls: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
          },
          angle: { type: "string" },
          businessSpecificReason: { type: "string" },
          ownedAssetIdea: {
            type: "object",
            additionalProperties: false,
            required: ["kind", "title", "intentQuery"],
            properties: {
              kind: {
                type: "string",
                enum: [
                  "calculator",
                  "generator",
                  "template",
                  "comparison_tool",
                  "quiz",
                  "database",
                  "guide",
                  "widget",
                ],
              },
              title: { type: "string" },
              intentQuery: { type: "string" },
            },
          },
        },
      },
    },
  },
};

type LlmCandidate = {
  platform: string;
  capabilityId?: string;
  audience: string;
  buyerIntent: "high" | "medium" | "low";
  intentScore: number;
  allowedActionGuess: string;
  suggestedAction?: string;
  effortEstimate: number;
  evidenceUrls: string[];
  angle: string;
  businessSpecificReason: string;
  ownedAssetIdea?: ChannelCandidate["ownedAssetIdea"];
};

function catalogDigest(): string {
  return CHANNEL_CAPABILITY_CATALOG.map(
    (c) =>
      `${c.id}|${c.platform}|${c.category}|actions=${c.actionTypes.join(",")}|intent=${c.defaultBuyerIntent}`,
  ).join("\n");
}

function hydrateCandidate(raw: LlmCandidate): ChannelCandidate | null {
  if (!raw.platform?.trim() || !raw.businessSpecificReason?.trim()) return null;
  const cap: ChannelCapability | undefined = raw.capabilityId
    ? capabilityById(raw.capabilityId)
    : CHANNEL_CAPABILITY_CATALOG.find(
        (c) =>
          c.platform === raw.platform.toLowerCase() ||
          c.id === raw.platform.toLowerCase(),
      );
  const actionTypes = cap?.actionTypes ??
    (raw.suggestedAction ? [raw.suggestedAction] : ["buyer_discovery", "web_research"]);
  const suggested =
    raw.suggestedAction && actionTypes.includes(raw.suggestedAction)
      ? raw.suggestedAction
      : actionTypes[0];
  return {
    platform: (cap?.platform ?? raw.platform).toLowerCase(),
    capabilityId: cap?.id ?? raw.capabilityId,
    category: cap?.category ?? "communities",
    audience: raw.audience,
    buyerIntent: raw.buyerIntent,
    intentScore: Math.max(0, Math.min(100, Number(raw.intentScore) || 0)),
    allowedActionGuess: raw.allowedActionGuess,
    suggestedAction: suggested,
    actionTypes,
    mechanism: cap?.mechanism ?? "external_placement",
    effortEstimate: Math.max(1, Math.min(5, Number(raw.effortEstimate) || 2)),
    evidenceUrls: (raw.evidenceUrls ?? []).filter((u) => typeof u === "string").slice(0, 5),
    angle: raw.angle,
    postingRules: cap?.postingRules ?? ["Zero spend", "No spam", "Follow platform rules"],
    contentFormats: cap?.contentFormats ?? ["helpful_reply"],
    businessSpecificReason: raw.businessSpecificReason,
    ownedAssetIdea: raw.ownedAssetIdea,
  };
}

/** Deterministic catalog seeds when LLM/search unavailable — still business-tagged. */
export function seedCandidatesFromCatalog(input: {
  context: BusinessContext;
  limit?: number;
}): ChannelCandidate[] {
  const product = input.context.products[0];
  const audience =
    input.context.audienceSegments?.[0]?.label ??
    product?.name ??
    input.context.industry;
  const limit = input.limit ?? 8;
  // Prefer high-intent, low-effort capabilities first — not "every platform".
  const ranked = [...CHANNEL_CAPABILITY_CATALOG].sort((a, b) => {
    const intentRank = { high: 0, medium: 1, low: 2 } as const;
    return (
      intentRank[a.defaultBuyerIntent] - intentRank[b.defaultBuyerIntent] ||
      a.effortEstimate - b.effortEstimate
    );
  });
  return ranked.slice(0, limit).map((cap) => ({
    platform: cap.platform,
    capabilityId: cap.id,
    category: cap.category,
    audience,
    buyerIntent: cap.defaultBuyerIntent,
    intentScore:
      cap.defaultBuyerIntent === "high"
        ? 70
        : cap.defaultBuyerIntent === "medium"
          ? 50
          : 30,
    allowedActionGuess: cap.allowedActions[0] ?? "discover",
    suggestedAction: cap.actionTypes[0],
    actionTypes: cap.actionTypes,
    mechanism: cap.mechanism,
    effortEstimate: cap.effortEstimate,
    evidenceUrls: [],
    angle: `${input.context.displayName} × ${cap.label}`,
    postingRules: cap.postingRules,
    contentFormats: cap.contentFormats,
    businessSpecificReason: `${input.context.displayName} (${input.context.industry}) can use ${cap.label} for ${audience} buying ${product?.name ?? "the product"} — catalog seed pending live evidence.`,
    ownedAssetIdea:
      cap.id === "owned_intent_tools"
        ? {
            kind: "calculator",
            title: `${product?.name ?? input.context.displayName} quick calculator`,
            intentQuery: `${product?.name ?? input.context.industry} calculator`,
          }
        : undefined,
  }));
}

/**
 * Map owned-asset ideas onto concrete publish_* action candidates so the
 * registry can allocate reusable traffic machines on owned domains.
 */
export function ownedAssetCandidatesFromDiscovery(
  candidates: ChannelCandidate[],
): ChannelCandidate[] {
  const out: ChannelCandidate[] = [];
  for (const c of candidates) {
    if (!c.ownedAssetIdea) continue;
    const kind = c.ownedAssetIdea.kind;
    const actionType =
      kind === "calculator"
        ? "publish_calculator"
        : kind === "quiz" || kind === "generator" || kind === "widget"
          ? "publish_intent_tool"
          : kind === "comparison_tool"
            ? "publish_comparison_page"
            : kind === "template"
              ? "publish_template_landing"
              : "publish_free_resource";
    const cap = capabilityById("owned_intent_tools");
    out.push({
      platform: "owned_domain",
      capabilityId: "owned_intent_tools",
      category: "owned_tools",
      audience: c.audience,
      buyerIntent: "high",
      intentScore: Math.max(c.intentScore, 65),
      allowedActionGuess: "publish_tool",
      suggestedAction: actionType,
      actionTypes: cap?.actionTypes ?? [actionType],
      mechanism: "owned_content",
      effortEstimate: 2,
      evidenceUrls: c.evidenceUrls,
      angle: c.ownedAssetIdea.title,
      postingRules: cap?.postingRules ?? [],
      contentFormats: [kind],
      businessSpecificReason: `Owned ${kind} for intent “${c.ownedAssetIdea.intentQuery}”: ${c.businessSpecificReason}`,
      ownedAssetIdea: c.ownedAssetIdea,
    });
  }
  return out;
}

/**
 * Discover business-specific channel candidates.
 * Always returns catalog seeds; LLM+search refine and specialize them.
 */
export async function discoverChannels(
  input: DiscoverChannelsInput,
): Promise<DiscoverChannelsOutput> {
  const maxCandidates = Math.max(3, Math.min(input.maxCandidates ?? 8, 10));
  const seeds = seedCandidatesFromCatalog({
    context: input.context,
    limit: maxCandidates,
  });
  const product = input.context.products[0];
  const productName = product?.name ?? input.context.displayName;
  const topicBits = [
    productName,
    input.context.industry,
    ...(input.context.audienceSegments?.map((s) => s.label) ?? []),
    ...(input.gscQueries ?? []).slice(0, 5),
  ]
    .filter(Boolean)
    .join(" ");

  // Test override path — fully deterministic for regression tests.
  if (input.llmOverride) {
    const searchResults = input.searchOverride ?? [];
    const raw = await input.llmOverride({
      productName,
      industry: input.context.industry,
      searchResults,
    });
    const hydrated = raw
      .map(hydrateCandidate)
      .filter((c): c is ChannelCandidate => Boolean(c));
    const owned = ownedAssetCandidatesFromDiscovery(hydrated);
    const merged = dedupeCandidates([...hydrated, ...owned, ...seeds]).slice(
      0,
      maxCandidates,
    );
    return {
      ok: true,
      candidates: merged,
      catalogSeedCount: seeds.length,
      searchResultCount: searchResults.length,
    };
  }

  if (!hasOpenAIKey()) {
    return {
      ok: true,
      candidates: seeds,
      reason: "no OPENAI_API_KEY — catalog seeds only",
      catalogSeedCount: seeds.length,
      searchResultCount: 0,
    };
  }

  let searchResults: WebSearchResult[] = input.searchOverride ?? [];
  if (!input.searchOverride) {
    const web = await queryWebForBuyingIntent({
      topic: topicBits || productName,
      industry: input.context.industry,
      personas: input.context.audienceSegments?.map((s) => s.label),
      maxResults: 10,
    });
    if (web.ok) searchResults = web.results;
  }

  const system = {
    role: "system" as const,
    content:
      "You are the Channel Discovery Engine for RevenueOS. Given ONE business and web evidence, propose specific zero-cost acquisition channels where THAT business's buyers already congregate. ResumeForge buyers ≠ TurnoverKit buyers — be specific. Never propose paid ads, paid listings, fake engagement, purchased backlinks, or spam account creation. Google login is auth convenience, not permission to spam-create accounts. Prefer channels that can produce attributable gross profit. Map each candidate to a capabilityId from the catalog when possible. Include owned-domain asset ideas (calculators/tools) when long-tail intent is clear.",
  };
  const user = {
    role: "user" as const,
    content: [
      `Business: ${input.context.displayName}`,
      `SiteId: ${input.context.siteId}`,
      `Industry: ${input.context.industry}`,
      `Product: ${productName} ($${(product as { priceUsd?: number } | undefined)?.priceUsd ?? "?"})`,
      `Brand voice: ${input.context.brandVoice}`,
      `Personas: ${(input.context.audienceSegments ?? []).map((s) => s.label).join(", ") || "n/a"}`,
      `GSC queries: ${(input.gscQueries ?? []).slice(0, 8).join(" | ") || "n/a"}`,
      ``,
      `Capability catalog (id|platform|category|actions|intent):`,
      catalogDigest(),
      ``,
      `Web evidence (JSON):`,
      JSON.stringify(searchResults.slice(0, 10), null, 2),
      ``,
      `Return up to ${maxCandidates} business-SPECIFIC channel candidates with evidenceUrls and capabilityId.`,
    ].join("\n"),
  };

  try {
    const res = await callOpenAI<{ candidates: LlmCandidate[] }>({
      model: DEFAULT_MODELS.strategist,
      messages: [system, user],
      jsonSchema: CANDIDATE_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 2000,
      timeoutMs: 35_000,
    });
    if (!res.ok) {
      return {
        ok: true,
        candidates: seeds,
        reason: res.reason,
        catalogSeedCount: seeds.length,
        searchResultCount: searchResults.length,
      };
    }
    const hydrated = (res.data.candidates ?? [])
      .map(hydrateCandidate)
      .filter((c): c is ChannelCandidate => Boolean(c));
    // Reject generic portfolio spam: reason must mention this business or product.
    const specific = hydrated.filter((c) => {
      const blob = `${c.businessSpecificReason} ${c.angle} ${c.audience}`.toLowerCase();
      const markers = [
        input.context.displayName.toLowerCase(),
        productName.toLowerCase(),
        input.context.industry.toLowerCase(),
        input.context.siteId.toLowerCase(),
      ].filter((m) => m.length >= 3);
      return markers.some((m) => blob.includes(m));
    });
    const owned = ownedAssetCandidatesFromDiscovery(specific.length ? specific : hydrated);
    const merged = dedupeCandidates([
      ...(specific.length ? specific : hydrated),
      ...owned,
      ...seeds,
    ]).slice(0, maxCandidates);
    return {
      ok: true,
      candidates: merged,
      catalogSeedCount: seeds.length,
      searchResultCount: searchResults.length,
    };
  } catch (err) {
    return {
      ok: true,
      candidates: seeds,
      reason: err instanceof Error ? err.message : "discovery failed",
      catalogSeedCount: seeds.length,
      searchResultCount: searchResults.length,
    };
  }
}

function dedupeCandidates(items: ChannelCandidate[]): ChannelCandidate[] {
  const seen = new Set<string>();
  const out: ChannelCandidate[] = [];
  for (const c of items) {
    const key = `${c.platform}::${c.capabilityId ?? c.angle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  // Prefer higher intentScore
  out.sort((a, b) => b.intentScore - a.intentScore);
  return out;
}

/**
 * Should we run (expensive) LLM discovery this cycle?
 * True when registry is thin, stale, or all top channels are paused.
 */
export function shouldRunChannelDiscovery(input: {
  channelCount: number;
  lastDiscoveryAt?: string | null;
  pausedRatio?: number;
  now?: Date;
  minIntervalMs?: number;
}): boolean {
  const now = input.now ?? new Date();
  const minInterval = input.minIntervalMs ?? 6 * 3_600_000; // 6h
  if (input.channelCount < 4) return true;
  if ((input.pausedRatio ?? 0) >= 0.6) return true;
  if (!input.lastDiscoveryAt) return true;
  const age = now.getTime() - Date.parse(input.lastDiscoveryAt);
  return !Number.isFinite(age) || age >= minInterval;
}
