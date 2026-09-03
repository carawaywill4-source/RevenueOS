import { toPortableLesson } from "../memory/portable";
import type {
  DiscoveryDoor,
  DiscoveryDoorMetrics,
  DiscoveryDoorScore,
  DiscoveryDoorStage,
  DiscoveryDoorVerdict,
  GovernorDecision,
  Lesson,
  Opportunity,
} from "../types";

export const DISCOVERY_WINDOWS_DAYS = [3, 7] as const;
export const MAX_ACTIVE_DOORS = 12;
export const MAX_PUBLISHES_PER_DAY = 4;
export const MAX_OVERDUE_UNSCORED = 3;

export function clusterKeyFromQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function classifyDiscoveryStage(
  metrics: DiscoveryDoorMetrics,
): DiscoveryDoorStage {
  if (metrics.revenueUsd > 0 || metrics.purchases > 0) {
    return metrics.revenueUsd > 0 ? "revenue" : "purchase";
  }
  if (metrics.addToCarts > 0 || metrics.checkouts > 0) return "cart";
  if (metrics.productViews > 0) return "product";
  if (metrics.topicViews > 0) return "visited";
  if (metrics.submitted) return "submitted";
  return "dead_on_arrival";
}

export function verdictForStage(
  stage: DiscoveryDoorStage,
  door: DiscoveryDoor,
  windowDays: number,
): { verdict: DiscoveryDoorVerdict; reason: string } {
  switch (stage) {
    case "revenue":
    case "purchase":
      return {
        verdict: "expand",
        reason: `Door reached ${stage} within ${windowDays}d — expand the query cluster.`,
      };
    case "cart":
      return {
        verdict: "hold",
        reason: `Visitors carted but did not purchase in ${windowDays}d — conversion levers own the next move; do not clone this page.`,
      };
    case "product":
      return {
        verdict: "hold",
        reason: `Product views without carts in ${windowDays}d — offer/presentation issue, not more topic clones.`,
      };
    case "visited": {
      const investigates = door.investigateCount ?? 0;
      if (investigates < 1) {
        return {
          verdict: "investigate",
          reason: `Topic visits without product views in ${windowDays}d — intent/page mismatch; rewrite once before killing.`,
        };
      }
      return {
        verdict: "kill",
        reason: `Still no product views after investigate rewrite — kill cluster ${door.clusterKey}.`,
      };
    }
    case "submitted":
    case "dead_on_arrival":
      if (windowDays < 7) {
        return {
          verdict: "hold",
          reason: `No on-site visits after ${windowDays}d — hold until the 7d window before killing (indexing lag).`,
        };
      }
      return {
        verdict: "kill",
        reason: `Dead on arrival after ${windowDays}d — zero topic visits. Stop cloning ${door.clusterKey}.`,
      };
    default:
      return { verdict: "hold", reason: "Insufficient signal." };
  }
}

export function scoreDiscoveryDoor(input: {
  door: DiscoveryDoor;
  metrics: DiscoveryDoorMetrics;
  windowDays: number;
  now?: Date;
}): DiscoveryDoorScore {
  const now = input.now ?? new Date();
  const stage = classifyDiscoveryStage(input.metrics);
  const { verdict, reason } = verdictForStage(stage, input.door, input.windowDays);
  return {
    scoredAt: now.toISOString(),
    windowDays: input.windowDays,
    metrics: input.metrics,
    stage,
    verdict,
    reason,
  };
}

export function doorAgeDays(door: DiscoveryDoor, now = new Date()): number {
  const published = Date.parse(door.publishedAt);
  if (!Number.isFinite(published)) return 0;
  return (now.getTime() - published) / (24 * 60 * 60 * 1000);
}

export function dueDiscoveryWindows(
  door: DiscoveryDoor,
  now = new Date(),
): number[] {
  if (door.status === "killed" || door.status === "graduated") return [];
  const age = doorAgeDays(door, now);
  const lastWindow = door.lastScore?.windowDays ?? 0;
  return DISCOVERY_WINDOWS_DAYS.filter((w) => age >= w && lastWindow < w);
}

export function applyDoorScore(
  door: DiscoveryDoor,
  score: DiscoveryDoorScore,
): DiscoveryDoor {
  let status = door.status;
  let investigateCount = door.investigateCount ?? 0;
  if (score.verdict === "expand") status = "expanding";
  else if (score.verdict === "hold") status = "holding";
  else if (score.verdict === "investigate") {
    status = "holding";
    investigateCount += 1;
  } else if (score.verdict === "kill") {
    status = "killed";
  }
  return {
    ...door,
    status,
    investigateCount,
    lastScore: score,
    killedAt: status === "killed" ? score.scoredAt : door.killedAt,
    killReason: status === "killed" ? score.reason : door.killReason,
  };
}

export function governorPublishGate(input: {
  doors: DiscoveryDoor[];
  publishesToday: number;
  now?: Date;
}): { allowPublish: boolean; reason: string; overdueUnscored: number } {
  const now = input.now ?? new Date();
  const active = input.doors.filter(
    (d) => d.status === "active" || d.status === "holding" || d.status === "expanding",
  );
  const overdueUnscored = active.filter((d) => {
    const age = doorAgeDays(d, now);
    return age >= 3 && !d.lastScore;
  }).length;

  if (input.publishesToday >= MAX_PUBLISHES_PER_DAY) {
    return {
      allowPublish: false,
      reason: `Daily publish cap reached (${MAX_PUBLISHES_PER_DAY}). Score existing doors before minting more.`,
      overdueUnscored,
    };
  }
  if (active.length >= MAX_ACTIVE_DOORS) {
    return {
      allowPublish: false,
      reason: `Active door cap reached (${MAX_ACTIVE_DOORS}). Kill or graduate before publishing.`,
      overdueUnscored,
    };
  }
  if (overdueUnscored >= MAX_OVERDUE_UNSCORED) {
    return {
      allowPublish: false,
      reason: `${overdueUnscored} doors overdue for scoring — governor refuses more content until outcomes are measured.`,
      overdueUnscored,
    };
  }
  return { allowPublish: true, reason: "Publish capacity available.", overdueUnscored };
}

export function killedClusterKeys(doors: DiscoveryDoor[]): Set<string> {
  return new Set(
    doors.filter((d) => d.status === "killed").map((d) => d.clusterKey),
  );
}

export function expandingClusterKeys(doors: DiscoveryDoor[]): Set<string> {
  return new Set(
    doors.filter((d) => d.status === "expanding").map((d) => d.clusterKey),
  );
}

/** Suppress publish opportunities for killed clusters; boost expanding ones. */
export function applyGovernorToOpportunities(
  opportunities: Opportunity[],
  doors: DiscoveryDoor[],
  allowPublish: boolean,
): Opportunity[] {
  const killed = killedClusterKeys(doors);
  const expanding = expandingClusterKeys(doors);
  return opportunities
    .filter((opp) => {
      const cluster = opp.patternKey?.includes("discovery:")
        ? opp.patternKey.replace(/^discovery:/, "")
        : opp.patternKey;
      if (
        !allowPublish &&
        (opp.safeActionType === "publish_intent_page" ||
          opp.safeActionType === "discovery_attack")
      ) {
        return false;
      }
      if (cluster && killed.has(cluster)) return false;
      if (opp.id.startsWith("acq-") && cluster && killed.has(cluster)) return false;
      return true;
    })
    .map((opp) => {
      const cluster = opp.patternKey ?? "";
      if (
        expanding.has(cluster) ||
        [...expanding].some((key) => cluster.includes(key) || key.includes(cluster))
      ) {
        return { ...opp, score: Number((opp.score * 1.35).toFixed(2)) };
      }
      return opp;
    })
    .sort((a, b) => b.score - a.score);
}

export function lessonFromGovernorDecision(input: {
  siteId: string;
  industry?: string;
  decision: GovernorDecision;
  now?: Date;
}): Lesson {
  return toPortableLesson({
    siteId: input.siteId,
    industry: input.industry,
    now: input.now,
    lesson: {
      patternKey: `discovery:${input.decision.verdict}:${input.decision.clusterKey}`,
      summary: input.decision.reason,
      evidenceCount: 1,
      transferable: true,
      sentiment:
        input.decision.verdict === "expand"
          ? "positive"
          : input.decision.verdict === "kill"
            ? "negative"
            : "neutral",
      rankingWeight:
        input.decision.verdict === "kill"
          ? 0.55
          : input.decision.verdict === "expand"
            ? 1.35
            : 1,
    },
  });
}

export function decisionsFromScoredDoors(
  before: DiscoveryDoor[],
  after: DiscoveryDoor[],
): GovernorDecision[] {
  const beforeById = new Map(before.map((d) => [d.id, d]));
  const decisions: GovernorDecision[] = [];
  for (const door of after) {
    const prev = beforeById.get(door.id);
    const score = door.lastScore;
    if (!score) continue;
    if (prev?.lastScore?.scoredAt === score.scoredAt) continue;
    decisions.push({
      doorId: door.id,
      clusterKey: door.clusterKey,
      verdict: score.verdict,
      stage: score.stage,
      reason: score.reason,
      suppressPublish: score.verdict === "kill",
    });
  }
  return decisions;
}
