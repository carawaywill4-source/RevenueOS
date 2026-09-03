import { randomBytes } from "node:crypto";
import type pg from "pg";
import { listHumanActionSurfaces } from "./channel-graph.js";
import { buildBuyerHabitat } from "./buyer-habitat.js";

function eid(): string {
  return `own_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export async function enqueueOwnerActionsForBusiness(input: {
  pool: pg.Pool;
  businessId: string;
  limit?: number;
}): Promise<number> {
  const habitat = buildBuyerHabitat(input.businessId);
  const surfaces = await listHumanActionSurfaces(
    input.pool,
    input.businessId,
    input.limit ?? 5,
  );
  let n = 0;
  const base = `https://${input.businessId}.${process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io"}`;
  const tracked = `${base}/?utm_source=owner_action&utm_medium=${encodeURIComponent("manual")}&utm_campaign=${input.businessId}`;

  for (const s of surfaces) {
    const exists = await input.pool.query(
      `select 1 from aq_owner_actions
       where business_id=$1 and channel_surface_id=$2 and status='PENDING' limit 1`,
      [input.businessId, s.channelSurfaceId],
    );
    if (exists.rows[0]) continue;

    const prepared = [
      `Business: ${input.businessId}`,
      `Buyer: ${habitat.buyerPersona}`,
      `Problem: ${habitat.problem}`,
      `Surface: ${s.surfaceName}`,
      `URL: ${s.surfaceUrl}`,
      ``,
      `Suggested value-first post/listing:`,
      `I built a practical resource for ${habitat.buyerRole.replace(/_/g, " ")}s dealing with: ${habitat.problem}.`,
      `Free useful entry: ${habitat.searchQueries[0] ?? "checklist"} → ${tracked}`,
      `Paid pack only if useful — no hype.`,
      ``,
      `Rules check: value-first, no spam, follow community promotion policy, disclose affiliation if linking.`,
    ].join("\n");

    await input.pool.query(
      `insert into aq_owner_actions (
         id, business_id, channel_surface_id, platform, action_title, why_it_matters,
         expected_value, exact_action, prepared_content, link, estimated_minutes,
         status, priority, meta
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDING',$12,$13::jsonb)`,
      [
        eid(),
        input.businessId,
        s.channelSurfaceId,
        s.platform,
        `List/participate on ${s.surfaceName}`,
        `High-fit ${s.channelFamily} surface for ${habitat.buyerRole}; Titan cannot bypass account/CAPTCHA.`,
        `Potential qualified visits from ${habitat.buyerPersona}`,
        `Create/login to ${s.platform} if needed → submit listing or value-first reply with tracked link → mark done in RevenueOS`,
        prepared,
        s.surfaceUrl,
        8,
        Math.round((1 - s.fitScore) * 40 + 10),
        JSON.stringify({ fitScore: s.fitScore, trackedUrl: tracked }),
      ],
    );
    n++;
  }
  return n;
}

export async function listPendingOwnerActions(
  pool: pg.Pool,
  limit = 20,
): Promise<
  Array<{
    id: string;
    businessId: string;
    platform: string;
    actionTitle: string;
    why: string;
    expectedValue: string;
    link: string;
    estimatedMinutes: number;
  }>
> {
  const res = await pool.query(
    `select id, business_id, platform, action_title, why_it_matters, expected_value, link, estimated_minutes
     from aq_owner_actions where status='PENDING'
     order by priority asc, created_at asc limit $1`,
    [limit],
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    businessId: String(r.business_id),
    platform: String(r.platform ?? ""),
    actionTitle: String(r.action_title),
    why: String(r.why_it_matters ?? ""),
    expectedValue: String(r.expected_value ?? ""),
    link: String(r.link ?? ""),
    estimatedMinutes: Number(r.estimated_minutes ?? 5),
  }));
}
