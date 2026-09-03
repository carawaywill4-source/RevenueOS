import type pg from "pg";
import type { FunnelRung } from "./types.js";

export async function computeFunnelState(
  pool: pg.Pool,
  businessId: string,
): Promise<{
  rung: FunnelRung;
  bottleneck: string;
  readiness: number;
  coverage: Record<string, number>;
  firstHumanMode: boolean;
  zeroTrafficIncident: boolean;
}> {
  const dist = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true`,
    [businessId],
  );
  const distN = Number(dist.rows[0]?.n ?? 0);

  const traffic = await pool.query(
    `select
       count(*) filter (where class='LIKELY_HUMAN')::int as human,
       count(*) filter (where class='QUALIFIED')::int as qualified
     from ros_traffic_events
     where business_id=$1 and created_at > now() - interval '30 days'`,
    [businessId],
  );
  const human = Number(traffic.rows[0]?.human ?? 0);
  const qualified = Number(traffic.rows[0]?.qualified ?? 0);

  const surfaces = await pool.query(
    `select
       count(*)::int as total,
       count(*) filter (where s.execution_class='AUTO_EXECUTABLE')::int as auto_n,
       count(distinct s.channel_family)::int as families
     from aq_business_surfaces b
     join aq_channel_surfaces s on s.channel_surface_id=b.channel_surface_id
     where b.business_id=$1`,
    [businessId],
  );
  const totalSurf = Number(surfaces.rows[0]?.total ?? 0);
  const autoN = Number(surfaces.rows[0]?.auto_n ?? 0);
  const families = Number(surfaces.rows[0]?.families ?? 0);

  const habitat = await pool.query(
    `select clarity_score from aq_buyer_habitats where business_id=$1`,
    [businessId],
  );
  const clarity = Number(habitat.rows[0]?.clarity_score ?? 0);

  let rung: FunnelRung = "RUNG_0_NO_DISTRIBUTION";
  if (qualified > 0) rung = "RUNG_4_QUALIFIED_VISIT";
  else if (human > 0) rung = "RUNG_3_HUMAN_VISIT";
  else if (distN > 0) rung = "RUNG_1_DISTRIBUTED";

  let bottleneck = "NO_DISTRIBUTION";
  if (rung === "RUNG_1_DISTRIBUTED") bottleneck = "NO_IMPRESSIONS_OR_VISITS";
  if (rung === "RUNG_3_HUMAN_VISIT") bottleneck = "NO_QUALIFIED_ENGAGEMENT";
  if (rung === "RUNG_4_QUALIFIED_VISIT") bottleneck = "CONVERSION";

  const readiness = Math.min(
    1,
    clarity * 0.25 +
      Math.min(1, families / 6) * 0.2 +
      Math.min(1, autoN / 5) * 0.15 +
      Math.min(1, distN / 3) * 0.2 +
      (human > 0 ? 0.1 : 0) +
      (qualified > 0 ? 0.1 : 0),
  );

  const firstHumanMode = qualified === 0;
  const recentDist = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true
       and created_at > now() - interval '12 hours'`,
    [businessId],
  );
  const zeroTrafficIncident =
    firstHumanMode &&
    Number(recentDist.rows[0]?.n ?? 0) >= 2 &&
    human === 0;

  const coverage = {
    surfaces: totalSurf,
    autoExecutable: autoN,
    families,
    distributionActions: distN,
    humanVisits: human,
    qualifiedVisits: qualified,
    buyerClarity: clarity,
  };

  await pool.query(
    `insert into aq_funnel_state (
       business_id, rung, bottleneck, acquisition_readiness, coverage,
       first_human_mode, zero_traffic_incident, updated_at
     ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,now())
     on conflict (business_id) do update set
       rung=excluded.rung, bottleneck=excluded.bottleneck,
       acquisition_readiness=excluded.acquisition_readiness,
       coverage=excluded.coverage, first_human_mode=excluded.first_human_mode,
       zero_traffic_incident=excluded.zero_traffic_incident, updated_at=now()`,
    [
      businessId,
      rung,
      bottleneck,
      readiness,
      JSON.stringify(coverage),
      firstHumanMode,
      zeroTrafficIncident,
    ],
  );

  if (zeroTrafficIncident) {
    await pool.query(
      `insert into aq_incidents (id, business_id, kind, diagnosis, status)
       select $1,$2,'ZERO_TRAFFIC_INCIDENT',$3::jsonb,'OPEN'
       where not exists (
         select 1 from aq_incidents
         where business_id=$2 and kind='ZERO_TRAFFIC_INCIDENT' and status='OPEN'
           and created_at > now() - interval '6 hours'
       )`,
      [
        `inc_${businessId}_${Date.now().toString(36)}`,
        businessId,
        JSON.stringify({
          rung,
          bottleneck,
          recentDistribution: Number(recentDist.rows[0]?.n ?? 0),
          human,
          note: "Escalate channels; do not wait passively",
        }),
      ],
    );
  }

  return {
    rung,
    bottleneck,
    readiness,
    coverage,
    firstHumanMode,
    zeroTrafficIncident,
  };
}
