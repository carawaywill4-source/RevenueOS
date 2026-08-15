/**
 * E5 hunter — compile obtain_legitimate_audience_exposure into a real path
 * without hardcoding a platform. If no PERMITTED_PUBLISH surface exists,
 * records an honest capability gap.
 *
 * Does not push traffic at a business that is not TRAFFIC_READY.
 * Surface discovery still runs.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { compileExposurePaths, refreshExternalSurfaces } from "./surface-intelligence.js";
import { verifyPublicArtifactExists } from "./browser-operator.js";
import { isOwnedSurface } from "../traffic-classify.js";
import { latestFrontier } from "./commerce-intelligence.js";

export async function huntE5(
  pool: pg.Pool,
  logger: Logger,
): Promise<{
  attempted: boolean;
  e5: boolean;
  reason: string;
  surface?: string;
}> {
  await refreshExternalSurfaces(pool, logger);
  const frontier = await latestFrontier(pool).catch(() => null);
  const frontierId = frontier ? String(frontier.business_id) : null;
  let trafficReady = false;
  if (frontierId) {
    const r = await pool.query(
      `select traffic_ready from ros_business_scores where business_id=$1`,
      [frontierId],
    );
    trafficReady = Boolean(r.rows[0]?.traffic_ready);
  }
  if (!trafficReady) {
    logger("info", "ultron.e5.hunter.not_traffic_ready", { frontierId });
    await pool.query(
      `insert into ros_closed_loop_defects
         (defect_id, kind, subject, detail, severity, status, first_seen_at, last_seen_at)
       values ('def_e5_not_traffic_ready', 'BUSINESS_NOT_READY_FOR_TRAFFIC',
               'obtain_legitimate_audience_exposure', $1, 'HIGH', 'OPEN', now(), now())
       on conflict (defect_id) do update set detail = excluded.detail, last_seen_at = now()`,
      [`BUSINESS_READY_FOR_TRAFFIC=false frontier=${frontierId ?? "none"}; surface discovery continues`],
    );
  }
  const compiled = await compileExposurePaths(pool);
  if (!compiled.executable) {
    const recent = await pool.query(
      `select last_seen_at, hits from ros_failure_patterns
        where fingerprint like 'fp_%' and strategy='research_permitted_publish_surface'
          and business_id=$1
        order by last_seen_at desc limit 1`,
      [frontierId ?? "_"],
    ).catch(() => ({ rows: [] as Array<{ last_seen_at: string; hits: number }> }));
    const hits = Number(recent.rows[0]?.hits ?? 0);
    if (hits < 3 || hits % 10 === 0) {
      logger("info", "ultron.e5.hunter.blocked", { blocker: compiled.blocker, hits });
    }
    await pool.query(
      `insert into ros_closed_loop_defects
         (defect_id, kind, subject, detail, severity, status, first_seen_at, last_seen_at)
       values ('def_e5_no_permitted_surface', 'CAPABILITY_WITHOUT_EXECUTION',
               'obtain_legitimate_audience_exposure', $1, 'HIGH', 'OPEN', now(), now())
       on conflict (defect_id) do update set detail = excluded.detail, last_seen_at = now()`,
      [compiled.blocker],
    );
    return {
      attempted: false,
      e5: false,
      reason: `${compiled.blocker ?? "no_path"}; traffic_ready=${trafficReady}; deferred_to_cee_v4`,
    };
  }

  if (!trafficReady) {
    return {
      attempted: false,
      e5: false,
      reason: `BUSINESS_READY_FOR_TRAFFIC=false; permitted surfaces exist but destination is not ready frontier=${frontierId}`,
      surface: compiled.paths[0]?.url,
    };
  }

  const path = compiled.paths[0];
  if (isOwnedSurface(path.url)) {
    return { attempted: false, e5: false, reason: "compiler_returned_owned_surface_rejected" };
  }

  const verify = await verifyPublicArtifactExists(pool, logger, {
    url: path.url,
    sessionPurpose: "e5_third_party_surface_read",
  });
  if (!verify.ok) {
    return { attempted: true, e5: false, reason: `verify_failed:${verify.error}`, surface: path.url };
  }
  logger("info", "ultron.e5.hunter.read_ok", { url: path.url, platform: path.platform });
  return {
    attempted: true,
    e5: false,
    reason: `third_party_read_ok platform=${path.platform}; publish not executed because listing submit is not yet a registered permitted write skill`,
    surface: path.url,
  };
}
