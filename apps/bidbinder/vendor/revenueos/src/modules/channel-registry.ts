/**
 * Channel Registry — durable, compounding channel knowledge.
 *
 * Persists per-(business, platform, account) channel records with commercial
 * outcomes and allocates autonomous effort via Thompson sampling over
 * revenue_per_action + confidence. Untested channels keep exploration mass.
 *
 * Cross-portfolio transfer: a winning channel pattern on Business A becomes a
 * hypothesis for compatible businesses — never a hardcoded "post everywhere"
 * loop. Allocation prefers revenue produced per hour of effort.
 *
 * Scoreboard: $0 spend → qualified traffic → customers → gross profit → learning → next action
 */

import { newId, type ExperimentStore } from "../ledger/store";
import type {
  BusinessContext,
  ChannelRecord,
  Opportunity,
  PursuitEvent,
} from "../types";
import type { MechanismClass } from "./action-class";
import {
  CHANNEL_CAPABILITY_CATALOG,
  capabilityById,
  capabilityCredentialMode,
  type ChannelCapability,
} from "./channel-catalog";
import type { ChannelCandidate } from "./channel-discovery";
import type { PortfolioSignal } from "./revenue-priority";

export type { ChannelRecord };

const CHANNEL_KIND = "channel_record";

export type ChannelAllowedAction =
  | "discover"
  | "draft"
  | "publish"
  | "reply"
  | "list"
  | "outreach"
  | "measure"
  | "optimize";

export type ChannelArm = {
  channel: ChannelRecord;
  sample: number;
  score: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function sampleBeta(alpha: number, beta: number, rand: () => number): number {
  const x = sampleGamma(alpha, rand);
  const y = sampleGamma(beta, rand);
  const sum = x + y;
  return sum > 0 ? x / sum : 0;
}

function sampleGamma(k: number, rand: () => number): number {
  if (k < 1) {
    const c = 1 + k;
    const u = rand();
    return sampleGamma(c, rand) * Math.pow(u, 1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x = 0;
    let v = 0;
    do {
      x = normal(rand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function normal(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Confidence from Beta posterior concentration. */
export function channelConfidence(alpha: number, beta: number): number {
  const n = alpha + beta;
  // Maps concentration to (0,1); untested (~2) → ~0.2, strong (~50) → ~0.9
  return clamp(1 - 2 / Math.max(n, 2), 0.05, 0.98);
}

export function computeRevenuePerAction(channel: {
  revenue: number;
  experimentsRun: number;
  purchases: number;
}): number {
  const actions = Math.max(1, channel.experimentsRun);
  // Prefer revenue; fall back to purchase count as weak signal.
  if (channel.revenue > 0) return channel.revenue / actions;
  if (channel.purchases > 0) return (channel.purchases * 10) / actions;
  return 0;
}

export function computeConversionRate(channel: {
  purchases: number;
  qualifiedVisitors: number;
  trafficGenerated: number;
}): number {
  const denom = Math.max(
    channel.qualifiedVisitors,
    channel.trafficGenerated * 0.25,
    1,
  );
  return clamp(channel.purchases / denom, 0, 1);
}

function emptyChannel(partial: Partial<ChannelRecord> & {
  siteId: string;
  platform: string;
  business: string;
}): ChannelRecord {
  const now = new Date().toISOString();
  const alpha = partial.alpha ?? 1;
  const beta = partial.beta ?? 1;
  const experimentsRun = partial.experimentsRun ?? 0;
  const revenue = partial.revenue ?? 0;
  const purchases = partial.purchases ?? 0;
  const base = {
    id: partial.id ?? newId("ch"),
    siteId: partial.siteId,
    platform: partial.platform,
    capabilityId: partial.capabilityId,
    account: partial.account ?? "default",
    business: partial.business,
    audience: partial.audience ?? "",
    buyerIntent: partial.buyerIntent ?? "medium",
    allowedActions: partial.allowedActions ?? ["discover", "draft"],
    postingRules: partial.postingRules ?? [],
    rateLimits: partial.rateLimits ?? {
      cooldownMinutes: 60,
      maxActionsPerDay: 8,
    },
    contentFormats: partial.contentFormats ?? [],
    lastAction: partial.lastAction ?? null,
    lastActionAt: partial.lastActionAt ?? null,
    trafficGenerated: partial.trafficGenerated ?? 0,
    qualifiedVisitors: partial.qualifiedVisitors ?? 0,
    checkoutStarts: partial.checkoutStarts ?? 0,
    purchases,
    revenue,
    conversionRate: 0,
    revenuePerAction: 0,
    alpha,
    beta,
    confidence: channelConfidence(alpha, beta),
    experimentsRun,
    winningAngles: partial.winningAngles ?? [],
    losingAngles: partial.losingAngles ?? [],
    nextAction: partial.nextAction ?? null,
    mechanism: partial.mechanism ?? "unknown",
    actionTypes: partial.actionTypes ?? [],
    evidenceUrls: partial.evidenceUrls ?? [],
    intentScore: partial.intentScore ?? 50,
    effortEstimate: partial.effortEstimate ?? 2,
    untested: partial.untested ?? experimentsRun === 0,
    status: partial.status ?? "active",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  return {
    ...base,
    conversionRate: computeConversionRate(base),
    revenuePerAction: computeRevenuePerAction(base),
  };
}

export function channelFromCapability(input: {
  siteId: string;
  business: string;
  audience?: string;
  capability: ChannelCapability;
  account?: string;
}): ChannelRecord {
  const mode = capabilityCredentialMode(input.capability);
  const nextAction =
    mode === "draft"
      ? input.capability.actionTypes.find((t) => t.includes("discover") || t.includes("draft")) ??
        input.capability.actionTypes[0] ??
        null
      : input.capability.actionTypes[0] ?? null;
  return emptyChannel({
    siteId: input.siteId,
    platform: input.capability.platform,
    capabilityId: input.capability.id,
    account: input.account ?? mode,
    business: input.business,
    audience: input.audience ?? "",
    buyerIntent: input.capability.defaultBuyerIntent,
    allowedActions: [
      "discover",
      "draft",
      ...(mode === "write" ? (["publish", "reply", "list", "outreach"] as ChannelAllowedAction[]) : []),
      "measure",
    ],
    postingRules: input.capability.postingRules,
    rateLimits: {
      cooldownMinutes: input.capability.defaultCooldownMinutes,
      maxActionsPerDay: Math.max(1, Math.floor(24 * 60 / Math.max(input.capability.defaultCooldownMinutes, 30))),
    },
    contentFormats: input.capability.contentFormats,
    mechanism: input.capability.mechanism,
    actionTypes: input.capability.actionTypes,
    nextAction,
    intentScore:
      input.capability.defaultBuyerIntent === "high"
        ? 75
        : input.capability.defaultBuyerIntent === "medium"
          ? 55
          : 35,
    effortEstimate: input.capability.effortEstimate,
    untested: true,
  });
}

export function channelFromCandidate(input: {
  siteId: string;
  business: string;
  candidate: ChannelCandidate;
}): ChannelRecord {
  const cap = input.candidate.capabilityId
    ? capabilityById(input.candidate.capabilityId)
    : undefined;
  const seeded = cap
    ? channelFromCapability({
        siteId: input.siteId,
        business: input.business,
        audience: input.candidate.audience,
        capability: cap,
      })
    : emptyChannel({
        siteId: input.siteId,
        platform: input.candidate.platform,
        business: input.business,
        audience: input.candidate.audience,
        buyerIntent: input.candidate.buyerIntent,
        mechanism: input.candidate.mechanism,
        actionTypes: input.candidate.actionTypes,
        postingRules: input.candidate.postingRules,
        contentFormats: input.candidate.contentFormats,
        intentScore: input.candidate.intentScore,
        effortEstimate: input.candidate.effortEstimate,
        nextAction: input.candidate.actionTypes[0] ?? null,
      });
  return {
    ...seeded,
    evidenceUrls: uniqueStrings([
      ...seeded.evidenceUrls,
      ...input.candidate.evidenceUrls,
    ]),
    intentScore: Math.max(seeded.intentScore, input.candidate.intentScore),
    winningAngles: uniqueStrings([
      ...seeded.winningAngles,
      ...(input.candidate.angle ? [input.candidate.angle] : []),
    ]),
    nextAction: input.candidate.suggestedAction ?? seeded.nextAction,
    updatedAt: new Date().toISOString(),
  };
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))].slice(0, 24);
}

function channelKey(ch: Pick<ChannelRecord, "siteId" | "platform" | "account" | "capabilityId">) {
  return `${ch.siteId}::${ch.platform}::${ch.account}::${ch.capabilityId ?? "custom"}`;
}

/** Seed registry from catalog for a business (idempotent merge). */
export function seedChannelsFromCatalog(input: {
  context: BusinessContext;
  existing?: ChannelRecord[];
}): ChannelRecord[] {
  const existing = input.existing ?? [];
  const byKey = new Map(existing.map((c) => [channelKey(c), c]));
  const audience =
    input.context.audienceSegments?.[0]?.label ??
    input.context.products[0]?.name ??
    input.context.industry;
  for (const cap of CHANNEL_CAPABILITY_CATALOG) {
    const draft = channelFromCapability({
      siteId: input.context.siteId,
      business: input.context.displayName,
      audience,
      capability: cap,
    });
    const key = channelKey(draft);
    if (!byKey.has(key)) byKey.set(key, draft);
  }
  return [...byKey.values()];
}

/** Merge discovery candidates into the registry without wiping learned posteriors. */
export function mergeChannelCandidates(input: {
  existing: ChannelRecord[];
  candidates: ChannelCandidate[];
  siteId: string;
  business: string;
}): ChannelRecord[] {
  const byKey = new Map(input.existing.map((c) => [channelKey(c), c]));
  const now = new Date().toISOString();
  for (const cand of input.candidates) {
    const fresh = channelFromCandidate({
      siteId: input.siteId,
      business: input.business,
      candidate: cand,
    });
    const key = channelKey(fresh);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, fresh);
      continue;
    }
    byKey.set(key, {
      ...prev,
      audience: cand.audience || prev.audience,
      buyerIntent: cand.buyerIntent,
      intentScore: Math.max(prev.intentScore, cand.intentScore),
      evidenceUrls: uniqueStrings([...prev.evidenceUrls, ...cand.evidenceUrls]),
      actionTypes: uniqueStrings([...prev.actionTypes, ...cand.actionTypes]),
      contentFormats: uniqueStrings([
        ...prev.contentFormats,
        ...cand.contentFormats,
      ]),
      postingRules: uniqueStrings([...prev.postingRules, ...cand.postingRules]),
      winningAngles: uniqueStrings([
        ...prev.winningAngles,
        ...(cand.angle ? [cand.angle] : []),
      ]),
      nextAction: cand.suggestedAction ?? prev.nextAction,
      effortEstimate: Math.min(prev.effortEstimate, cand.effortEstimate),
      updatedAt: now,
    });
  }
  return [...byKey.values()];
}

export type ChannelOutcomeSignal = {
  platform?: string;
  capabilityId?: string;
  actionType?: string;
  traffic?: number;
  qualifiedVisitors?: number;
  checkouts?: number;
  purchases?: number;
  revenueUsd?: number;
  angle?: string;
  success?: boolean;
};

/**
 * Update Beta posteriors from a commercial outcome signal.
 * Positive commercial signal raises α; dry attempts raise β.
 */
export function updateChannelPosterior(
  channel: ChannelRecord,
  signal: ChannelOutcomeSignal,
): ChannelRecord {
  const traffic = signal.traffic ?? 0;
  const qualified = signal.qualifiedVisitors ?? 0;
  const checkouts = signal.checkouts ?? 0;
  const purchases = signal.purchases ?? 0;
  const revenue = signal.revenueUsd ?? 0;
  const commercial =
    purchases * 4 + revenue / 25 + checkouts * 0.5 + qualified * 0.15 + traffic * 0.02;
  const success = signal.success ?? commercial > 0;
  let alpha = channel.alpha;
  let beta = channel.beta;
  if (success && commercial > 0) {
    alpha += commercial;
  } else {
    beta += 1;
  }
  const experimentsRun = channel.experimentsRun + 1;
  const next: ChannelRecord = {
    ...channel,
    trafficGenerated: channel.trafficGenerated + traffic,
    qualifiedVisitors: channel.qualifiedVisitors + qualified,
    checkoutStarts: channel.checkoutStarts + checkouts,
    purchases: channel.purchases + purchases,
    revenue: Number((channel.revenue + revenue).toFixed(2)),
    experimentsRun,
    alpha,
    beta,
    confidence: channelConfidence(alpha, beta),
    untested: false,
    lastAction: signal.actionType ?? channel.lastAction,
    lastActionAt: new Date().toISOString(),
    winningAngles:
      success && signal.angle
        ? uniqueStrings([...channel.winningAngles, signal.angle])
        : channel.winningAngles,
    losingAngles:
      !success && signal.angle
        ? uniqueStrings([...channel.losingAngles, signal.angle])
        : channel.losingAngles,
    updatedAt: new Date().toISOString(),
  };
  next.conversionRate = computeConversionRate(next);
  next.revenuePerAction = computeRevenuePerAction(next);

  // Stagnation: same family with no commercial signal after enough tries → pause.
  if (
    next.experimentsRun >= 5 &&
    next.revenue <= 0 &&
    next.purchases <= 0 &&
    next.checkoutStarts <= 0 &&
    next.qualifiedVisitors <= 0
  ) {
    next.status = "paused";
    next.nextAction = null;
  }
  return next;
}

/**
 * Apply pursuit-event commercial crumbs onto matching channels.
 */
export function applyEventSignalsToChannels(input: {
  channels: ChannelRecord[];
  events: Array<{
    eventType: string;
    detail?: Record<string, unknown>;
    createdAt?: string;
  }>;
}): ChannelRecord[] {
  const byPlatform = new Map<string, ChannelRecord>();
  for (const ch of input.channels) {
    byPlatform.set(`${ch.platform}::${ch.capabilityId ?? ""}`, ch);
    byPlatform.set(ch.platform, ch);
    if (ch.capabilityId) byPlatform.set(ch.capabilityId, ch);
  }
  let channels = [...input.channels];
  const indexById = new Map(channels.map((c, i) => [c.id, i]));

  for (const ev of input.events) {
    const detail = ev.detail ?? {};
    const actionType =
      typeof detail.actionType === "string" ? detail.actionType : undefined;
    const patternKey =
      typeof detail.patternKey === "string" ? detail.patternKey : "";
    const platformGuess =
      (typeof detail.platform === "string" && detail.platform) ||
      (typeof detail.surface === "string" && detail.surface) ||
      actionType?.split("_")[0] ||
      patternKey.split(":")[1] ||
      "";
    if (!platformGuess && !actionType) continue;

    let target =
      byPlatform.get(platformGuess) ||
      channels.find((c) =>
        actionType ? c.actionTypes.includes(actionType) : false,
      );
    if (!target && actionType) {
      const caps = CHANNEL_CAPABILITY_CATALOG.filter((c) =>
        c.actionTypes.includes(actionType),
      );
      target = channels.find((c) => caps.some((cap) => cap.id === c.capabilityId));
    }
    if (!target) continue;

    const revenueUsd =
      typeof detail.revenueUsd === "number"
        ? detail.revenueUsd
        : typeof detail.revenue === "number"
          ? detail.revenue
          : 0;
    const purchases =
      typeof detail.purchases === "number"
        ? detail.purchases
        : ev.eventType === "commercial" || detail.outcome === "commercial"
          ? 1
          : 0;
    const qualified =
      typeof detail.qualifiedVisitors === "number"
        ? detail.qualifiedVisitors
        : ev.eventType === "intent" || detail.outcome === "intent"
          ? 1
          : 0;
    const traffic =
      typeof detail.traffic === "number"
        ? detail.traffic
        : ev.eventType === "verified_exposure" ||
            detail.outcome === "verified_exposure"
          ? 1
          : 0;
    const checkouts =
      typeof detail.checkouts === "number" ? detail.checkouts : 0;

    // Skip pure enqueue noise without outcome crumbs.
    if (
      ev.eventType === "enqueued" &&
      revenueUsd + purchases + qualified + traffic + checkouts === 0
    ) {
      continue;
    }

    const updated = updateChannelPosterior(target, {
      actionType,
      revenueUsd,
      purchases,
      qualifiedVisitors: qualified,
      traffic,
      checkouts,
      angle:
        typeof detail.angle === "string"
          ? detail.angle
          : typeof detail.title === "string"
            ? detail.title
            : undefined,
      success:
        revenueUsd + purchases + checkouts + qualified > 0 ||
        ev.eventType === "succeeded",
    });
    const idx = indexById.get(target.id);
    if (idx != null) {
      channels[idx] = updated;
      byPlatform.set(`${updated.platform}::${updated.capabilityId ?? ""}`, updated);
      byPlatform.set(updated.platform, updated);
    }
  }
  return channels;
}

/**
 * Thompson-sample channel allocation. Ranking optimizes for
 * revenue_per_action × sample, with exploration mass for untested channels.
 */
export function allocateChannelEffort(input: {
  channels: ChannelRecord[];
  rand?: () => number;
  limit?: number;
}): ChannelArm[] {
  const rand = input.rand ?? Math.random;
  const limit = input.limit ?? 6;
  const arms: ChannelArm[] = [];
  for (const channel of input.channels) {
    if (channel.status === "banned") continue;
    // Paused channels keep a tiny exploration chance so they can be rediscovered.
    const exploreMul = channel.status === "paused" ? 0.05 : 1;
    const alpha = channel.untested
      ? Math.max(channel.alpha, 1.5)
      : channel.alpha;
    // Untested: slightly lower β so exploration sample stays competitive.
    const beta = channel.untested
      ? Math.max(0.6, channel.beta * 0.7)
      : channel.beta;
    const sample = sampleBeta(alpha, beta, rand) * exploreMul;
    const rpa = Math.max(channel.revenuePerAction, channel.untested ? 0.35 : 0);
    const intentBoost =
      channel.buyerIntent === "high" ? 1.35 : channel.buyerIntent === "medium" ? 1 : 0.7;
    const effort = Math.max(channel.effortEstimate, 0.5);
    // revenue per hour of autonomous effort
    const score = ((rpa + 0.15) * sample * intentBoost * (0.5 + channel.intentScore / 100)) / effort;
    arms.push({ channel, sample, score: Number(score.toFixed(4)) });
  }
  arms.sort((a, b) => b.score - a.score);
  return arms.slice(0, limit);
}

/**
 * Transfer winning channel patterns from portfolio signal / peer channels as
 * hypotheses for this business. Does NOT enqueue spam — only raises priors /
 * seeds candidate next_action when platforms are compatible.
 */
export function transferChannelHypotheses(input: {
  local: ChannelRecord[];
  peerChannels?: ChannelRecord[];
  portfolioSignal?: PortfolioSignal;
  context: BusinessContext;
}): ChannelRecord[] {
  const now = new Date().toISOString();
  const byKey = new Map(input.local.map((c) => [channelKey(c), { ...c }]));

  const peers = (input.peerChannels ?? []).filter(
    (p) =>
      p.siteId !== input.context.siteId &&
      p.revenuePerAction > 0 &&
      (p.purchases > 0 || p.revenue > 0),
  );

  for (const peer of peers) {
    // Compatibility: same industry tag in audience/business OR shared mechanism
    // with high intent — never blind copy of every platform.
    const industry = input.context.industry.toLowerCase();
    const peerBlob = `${peer.audience} ${peer.business}`.toLowerCase();
    const compatible =
      peerBlob.includes(industry) ||
      peer.mechanism === "owned_content" ||
      peer.mechanism === "conversion_optimization" ||
      peer.buyerIntent === "high";
    if (!compatible) continue;

    const local = [...byKey.values()].find(
      (c) =>
        c.platform === peer.platform ||
        (peer.capabilityId && c.capabilityId === peer.capabilityId),
    );
    if (local) {
      // Raise prior mildly — portfolio evidence is weaker than own.
      local.alpha += Math.min(2, peer.revenuePerAction / 10 + 0.25);
      local.confidence = channelConfidence(local.alpha, local.beta);
      local.winningAngles = uniqueStrings([
        ...local.winningAngles,
        ...peer.winningAngles.map((a) => `transfer:${a}`),
      ]);
      if (!local.nextAction && peer.nextAction) local.nextAction = peer.nextAction;
      if (local.status === "paused" && peer.revenuePerAction > 1) {
        local.status = "active";
      }
      local.updatedAt = now;
      byKey.set(channelKey(local), local);
    } else if (peer.capabilityId) {
      const cap = capabilityById(peer.capabilityId);
      if (!cap) continue;
      const seeded = channelFromCapability({
        siteId: input.context.siteId,
        business: input.context.displayName,
        audience: input.context.audienceSegments?.[0]?.label,
        capability: cap,
      });
      seeded.alpha = 1.25;
      seeded.winningAngles = peer.winningAngles
        .slice(0, 3)
        .map((a) => `transfer:${a}`);
      seeded.nextAction = peer.nextAction ?? seeded.nextAction;
      byKey.set(channelKey(seeded), seeded);
    }
  }

  // Mechanism-level portfolio signal → nudge matching channels.
  if (input.portfolioSignal) {
    for (const ch of byKey.values()) {
      const sig = input.portfolioSignal.mechanismSignal.get(
        ch.mechanism as MechanismClass,
      );
      if (!sig) continue;
      if (sig.commercial > 0) {
        ch.alpha += Math.min(1.5, sig.commercial * 0.25);
        ch.confidence = channelConfidence(ch.alpha, ch.beta);
        ch.updatedAt = now;
      }
    }
  }

  return [...byKey.values()];
}

/** Convert allocated channels into Opportunities for the pursuit planner. */
export function channelsToOpportunities(input: {
  arms: ChannelArm[];
  context: BusinessContext;
}): Opportunity[] {
  return input.arms
    .filter((a) => a.channel.status === "active" && a.channel.nextAction)
    .map((arm, i) => {
      const ch = arm.channel;
      const actionType = ch.nextAction!;
      const intentMul =
        ch.buyerIntent === "high" ? 1.2 : ch.buyerIntent === "medium" ? 1 : 0.8;
      return {
        id: `channel-${ch.id}-${actionType}`,
        title: `Channel: ${ch.platform} → ${actionType}`,
        metric: ch.purchases > 0 ? "purchases" : "landing_views",
        category: "acquisition" as const,
        action: `${ch.platform} (${ch.audience || input.context.industry}): ${actionType}. Evidence: ${ch.evidenceUrls[0] ?? "catalog"}. Optimize for attributable gross profit, not volume.`,
        expectedImpact: Number(
          (6 + arm.score * 4 + ch.intentScore / 20).toFixed(2),
        ),
        confidence: ch.confidence,
        effort: ch.effortEstimate,
        score: Number((arm.score * 10 * intentMul + (8 - i)).toFixed(2)),
        safeActionType: actionType,
        patternKey: `channel:${ch.platform}:${ch.capabilityId ?? "x"}:${actionType}`,
        precursorMetric: "landing_views" as const,
      };
    });
}

/** Pick / refresh next_action for each active channel from its actionTypes. */
export function refreshChannelNextActions(channels: ChannelRecord[]): ChannelRecord[] {
  return channels.map((ch) => {
    if (ch.status !== "active") return ch;
    if (ch.nextAction && ch.actionTypes.includes(ch.nextAction)) return ch;
    // Prefer discover/measure when untested; else first action type.
    const preferred =
      ch.actionTypes.find((t) => t.includes("discover") || t.includes("import")) ??
      ch.actionTypes.find((t) => t.includes("draft")) ??
      ch.actionTypes[0] ??
      null;
    return { ...ch, nextAction: preferred, updatedAt: new Date().toISOString() };
  });
}

// —— Persistence (native store methods OR pursuit-event snapshot fallback) ——

function isChannelSnapshotEvent(event: PursuitEvent): boolean {
  return (
    typeof event.detail === "object" &&
    event.detail !== null &&
    (event.detail as { kind?: unknown }).kind === CHANNEL_KIND
  );
}

function channelFromEvent(event: PursuitEvent): ChannelRecord | null {
  if (!isChannelSnapshotEvent(event)) return null;
  const ch = (event.detail as { channel?: ChannelRecord }).channel;
  return ch?.platform ? ch : null;
}

export async function loadChannels(
  store: ExperimentStore,
  siteId: string,
): Promise<ChannelRecord[]> {
  if (store.listChannels) {
    return store.listChannels(siteId);
  }
  if (!store.listPursuitEvents) return [];
  // Load a wide window — channel snapshots are compact and overwrite logically.
  const events = await store.listPursuitEvents(siteId, { limit: 500 });
  const latest = new Map<string, ChannelRecord>();
  // Events are newest-first in file-store; keep first seen per id.
  for (const ev of events) {
    const ch = channelFromEvent(ev);
    if (!ch) continue;
    if (!latest.has(ch.id)) latest.set(ch.id, ch);
  }
  return [...latest.values()];
}

export async function saveChannel(
  store: ExperimentStore,
  channel: ChannelRecord,
): Promise<void> {
  if (store.saveChannel) {
    await store.saveChannel(channel);
    return;
  }
  if (!store.appendPursuitEvent) return;
  const evt: PursuitEvent = {
    id: newId("chsnap"),
    pursuitId: `channel:${channel.id}`,
    siteId: channel.siteId,
    eventType: "learned",
    detail: {
      kind: CHANNEL_KIND,
      channelKey: channelKey(channel),
      channel,
    },
    createdAt: channel.updatedAt || new Date().toISOString(),
  };
  await store.appendPursuitEvent(evt);
}

export async function saveChannels(
  store: ExperimentStore,
  channels: ChannelRecord[],
): Promise<void> {
  for (const ch of channels) {
    await saveChannel(store, ch);
  }
}

/**
 * Full registry tick used by the planner:
 * seed → merge outcomes → transfer → refresh next actions → allocate.
 */
export async function runChannelRegistryTick(input: {
  store: ExperimentStore;
  context: BusinessContext;
  candidates?: ChannelCandidate[];
  events?: Array<{
    eventType: string;
    detail?: Record<string, unknown>;
    createdAt?: string;
  }>;
  peerChannels?: ChannelRecord[];
  portfolioSignal?: PortfolioSignal;
  rand?: () => number;
  persist?: boolean;
}): Promise<{
  channels: ChannelRecord[];
  arms: ChannelArm[];
  opportunities: Opportunity[];
}> {
  let channels = await loadChannels(input.store, input.context.siteId);
  channels = seedChannelsFromCatalog({ context: input.context, existing: channels });
  if (input.candidates?.length) {
    channels = mergeChannelCandidates({
      existing: channels,
      candidates: input.candidates,
      siteId: input.context.siteId,
      business: input.context.displayName,
    });
  }
  if (input.events?.length) {
    channels = applyEventSignalsToChannels({
      channels,
      events: input.events,
    });
  }
  channels = transferChannelHypotheses({
    local: channels,
    peerChannels: input.peerChannels,
    portfolioSignal: input.portfolioSignal,
    context: input.context,
  });
  channels = refreshChannelNextActions(channels);
  const arms = allocateChannelEffort({
    channels,
    rand: input.rand,
    limit: 8,
  });
  // Stamp next_action from top arms so opportunities stay coherent.
  const armIds = new Set(arms.map((a) => a.channel.id));
  channels = channels.map((ch) => {
    if (!armIds.has(ch.id)) return ch;
    return {
      ...ch,
      updatedAt: new Date().toISOString(),
    };
  });
  if (input.persist !== false) {
    await saveChannels(input.store, channels);
  }
  const opportunities = channelsToOpportunities({
    arms,
    context: input.context,
  });
  return { channels, arms, opportunities };
}
