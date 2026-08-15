/**
 * AcquisitionOS primary tick — discover → rank → execute → measure → learn.
 * Priority over empty IndexNow-only loops.
 */

import type pg from "pg";
import { channelUniverseStats } from "./channel-graph.js";
import {
  discoverChannelsForBusiness,
  expandPortfolioChannelUniverse,
} from "./discovery.js";
import { runExecutor } from "./executors.js";
import { computeFunnelState } from "./funnel.js";
import { enqueueOwnerActionsForBusiness } from "./owner-queue.js";
import { ensureAcquisitionOsTables } from "./schema.js";
import { ACQUISITIONOS_VERSION } from "./types.js";
import { saveCommercialLesson } from "../titan-world-store.js";
import { ACQUISITION_FRONTIER } from "../titan-commercial-executive/zero-traffic-war-room.js";
import { executeNewAudienceBet } from "../titan-commercial-executive/new-audience.js";

export const FIRST_HUMAN_WAR_ROOM = [
  ...ACQUISITION_FRONTIER,
  "storelift",
  "merchantbrain",
] as const;

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

let discoveryCursor = 0;
let executeCursor = 0;
let bootstrapped = false;

export async function runAcquisitionOsTick(input: {
  pool: pg.Pool;
  logger: Logger;
  managedSiteIds: string[];
}): Promise<{
  discovered: number;
  executed: number;
  distributionActions: number;
  ownerActionsQueued: number;
}> {
  await ensureAcquisitionOsTables(input.pool);

  // Bootstrap large universe once (top5 + sample of managed).
  if (!bootstrapped) {
    const seedIds = [
      ...FIRST_HUMAN_WAR_ROOM,
      ...input.managedSiteIds
        .filter((s) => !(FIRST_HUMAN_WAR_ROOM as readonly string[]).includes(s))
        .slice(0, 12),
    ];
    const exp = await expandPortfolioChannelUniverse({
      pool: input.pool,
      businessIds: seedIds,
      openWorldPerBusiness: 2,
    });
    bootstrapped = true;
    input.logger("info", "acquisitionos.bootstrap", {
      version: ACQUISITIONOS_VERSION,
      ...exp,
    });
  }

  // Prefer war-room / zero-traffic frontier for discovery refresh + execution.
  let zeroTrafficCritical = true;
  try {
    const zt = await input.pool.query(
      `select value->>'status' as st from ros_config_meta where key='zero_traffic_war_room'`,
    );
    zeroTrafficCritical = zt.rows[0]?.st !== "CLEARED";
  } catch {
    zeroTrafficCritical = true;
  }
  const frontier = ACQUISITION_FRONTIER.filter((s) =>
    input.managedSiteIds.includes(s),
  );
  const ordered = zeroTrafficCritical
    ? [
        ...frontier,
        ...input.managedSiteIds.filter((s) => !frontier.includes(s as never)),
      ]
    : [
        ...FIRST_HUMAN_WAR_ROOM.filter((s) => input.managedSiteIds.includes(s)),
        ...input.managedSiteIds.filter(
          (s) => !(FIRST_HUMAN_WAR_ROOM as readonly string[]).includes(s),
        ),
      ];
  if (!ordered.length) {
    return { discovered: 0, executed: 0, distributionActions: 0, ownerActionsQueued: 0 };
  }

  // ZERO TRAFFIC CRITICAL: skip owned CONTENT_PUBLISH theater; force third-party bets
  if (zeroTrafficCritical && frontier.length) {
    const biz = frontier[executeCursor % frontier.length]!;
    executeCursor++;
    let executed = 0;
    let distributionActions = 0;
    for (const family of ["directories", "creators", "earned", "communities"]) {
      const bet = await executeNewAudienceBet({
        pool: input.pool,
        businessId: biz,
        preferFamily: family,
        banPublicForms: true,
      });
      executed++;
      if (bet.newAudience) distributionActions++;
    }
    // Still allow IndexNow/search for frontier only (not content farms)
    const searchSurf = await input.pool.query(
      `select s.channel_surface_id, s.surface_name, s.surface_url, s.channel_family,
              s.execution_class, s.executor_type, s.status, b.fit_score
       from aq_business_surfaces b
       join aq_channel_surfaces s on s.channel_surface_id=b.channel_surface_id
       where b.business_id=$1
         and s.executor_type in ('SEARCH_SUBMISSION','WEBSUB_PING')
         and s.execution_class='AUTO_EXECUTABLE'
       order by b.fit_score desc limit 1`,
      [biz],
    );
    for (const r of searchSurf.rows) {
      const result = await runExecutor({
        pool: input.pool,
        businessId: biz,
        surfaceId: String(r.channel_surface_id),
        executorType: String(r.executor_type) as
          | "SEARCH_SUBMISSION"
          | "WEBSUB_PING",
        surfaceUrl: String(r.surface_url),
        surfaceName: String(r.surface_name),
      });
      executed++;
      if (result.countsAsDistribution) distributionActions++;
    }
    input.logger("info", "acquisitionos.zero_traffic_tick", {
      businessId: biz,
      executed,
      distributionActions,
      note: "owned_content_publish_suppressed_while_zero_humans",
    });
    return {
      discovered: 0,
      executed,
      distributionActions,
      ownerActionsQueued: 0,
    };
  }

  // 1) Discover/expand one business
  const discoverBiz = ordered[discoveryCursor % ordered.length]!;
  discoveryCursor++;
  const disc = await discoverChannelsForBusiness({
    pool: input.pool,
    businessId: discoverBiz,
    openWorldSearches: FIRST_HUMAN_WAR_ROOM.includes(
      discoverBiz as (typeof FIRST_HUMAN_WAR_ROOM)[number],
    )
      ? 3
      : 1,
  });

  // 2) Execute AUTO surfaces for war-room biz (up to 3 differentiated executors)
  const execBiz = ordered[executeCursor % Math.min(ordered.length, 8)]!;
  executeCursor++;
  // Pull one surface per executor type so content pages don't starve feed/IndexNow/crosslinks.
  const typeRes = await input.pool.query(
    `select distinct on (s.executor_type)
            s.channel_surface_id, s.surface_name, s.surface_url, s.channel_family,
            s.execution_class, s.executor_type, s.status, b.fit_score
     from aq_business_surfaces b
     join aq_channel_surfaces s on s.channel_surface_id = b.channel_surface_id
     where b.business_id=$1
       and s.status not in ('DEAD','PROHIBITED','PAUSED','BLOCKED')
       and s.execution_class = 'AUTO_EXECUTABLE'
       and (s.last_used_at is null or s.last_used_at < now() - interval '3 hours')
     order by s.executor_type, b.fit_score desc`,
    [execBiz],
  );
  const preferOrder = [
    "FEED_PUBLISH",
    "WEBSUB_PING",
    "PORTFOLIO_CROSSLINK",
    "SEARCH_SUBMISSION",
    "CONTENT_PUBLISH",
  ];
  const byType = new Map(
    typeRes.rows.map((r) => [
      String(r.executor_type),
      {
        channelSurfaceId: String(r.channel_surface_id),
        surfaceName: String(r.surface_name),
        surfaceUrl: String(r.surface_url),
        channelFamily: r.channel_family,
        executionClass: r.execution_class,
        executorType: r.executor_type,
        status: r.status,
        fitScore: Number(r.fit_score ?? 0),
      },
    ]),
  );
  const picked = [];
  for (const t of preferOrder) {
    const s = byType.get(t);
    if (s) picked.push(s);
    if (picked.length >= 3) break;
  }
  if (picked.length < 3) {
    for (const s of byType.values()) {
      if (picked.some((p) => p.executorType === s.executorType)) continue;
      picked.push(s);
      if (picked.length >= 3) break;
    }
  }
  let executed = 0;
  let distributionActions = 0;
  for (const s of picked) {
    const result = await runExecutor({
      pool: input.pool,
      businessId: execBiz,
      surfaceId: s.channelSurfaceId,
      executorType: s.executorType,
      surfaceUrl: s.surfaceUrl,
      surfaceName: s.surfaceName,
      peerBusinessIds: FIRST_HUMAN_WAR_ROOM as unknown as string[],
    });
    executed++;
    if (result.countsAsDistribution) distributionActions++;
    input.logger("info", "acquisitionos.execute", {
      businessId: execBiz,
      surface: s.surfaceName,
      executorType: s.executorType,
      ok: result.ok,
      countsAsDistribution: result.countsAsDistribution,
      detail: result.detail.slice(0, 200),
    });
  }

  // 3) Funnel + owner queue for exec business
  const funnel = await computeFunnelState(input.pool, execBiz);
  let ownerActionsQueued = 0;
  if (funnel.firstHumanMode) {
    ownerActionsQueued = await enqueueOwnerActionsForBusiness({
      pool: input.pool,
      businessId: execBiz,
      limit: 4,
    });
  }

  if (funnel.zeroTrafficIncident) {
    await saveCommercialLesson(input.pool, {
      scope: "CHANNEL",
      lesson: `${execBiz}: ZERO_TRAFFIC_INCIDENT — distribution attempted but no human visits. Escalate to different executor types / owner-action surfaces; do not repeat IndexNow-only loops.`,
      businessIds: [execBiz],
      confidence: 0.85,
      evidence: [{ funnel, version: ACQUISITIONOS_VERSION }],
    });
    input.logger("warn", "acquisitionos.zero_traffic_incident", {
      businessId: execBiz,
      funnel,
    });
  }

  // Also refresh funnel for discover biz
  await computeFunnelState(input.pool, discoverBiz);

  const stats = await channelUniverseStats(input.pool);
  input.logger("info", "acquisitionos.tick", {
    version: ACQUISITIONOS_VERSION,
    discoverBiz,
    execBiz,
    disc,
    executed,
    distributionActions,
    ownerActionsQueued,
    universe: stats.total,
    rung: funnel.rung,
  });

  return {
    discovered: disc.created,
    executed,
    distributionActions,
    ownerActionsQueued,
  };
}
