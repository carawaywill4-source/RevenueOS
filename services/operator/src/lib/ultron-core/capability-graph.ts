/**
 * Organ 2 — CAPABILITY GRAPH + BUS.
 *
 * Reads authoritative capability truth from the existing
 * `ros_capability_registry` + `ros_distribution_capabilities` tables and
 * projects each row into the ULTRON contract (C0–C6 proof levels + shared
 * capability interface). Downstream reasoning consults this bus rather
 * than reading the raw registries directly.
 *
 * Proof-level derivation is grounded in *live evidence*:
 *   C0_DISCOVERED               — row exists
 *   C1_IMPLEMENTED              — state IMPLEMENTED / BUILT
 *   C2_TESTED                   — has recorded action + no failure_point
 *   C3_PRODUCTION_AVAILABLE     — authenticated + autonomous
 *   C4_EXTERNAL_ACTION_PROVEN   — at least one SENT/ACCEPTED receipt in 30d
 *   C5_EXTERNAL_EFFECT_PROVEN   — has published/verified public artifact
 *   C6_COMMERCIAL_EFFECT_PROVEN — attributed human traffic in 30d
 */

import type pg from "pg";
import type {
  Capability,
  CapabilityProofLevel,
  Logger,
} from "./types.js";

type CapabilityUnion = Capability & {
  successRate: number;
  ownerDependency: boolean;
  externalEvidence: string;
};

async function externalActionProof(pool: pg.Pool): Promise<Set<string>> {
  const r = await pool.query(
    `select distinct request_result->>'marker' as marker,
                     executor_type as platform
       from aq_distribution_receipts
      where status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED','PUBLISHED')
        and created_at > now() - interval '30 days'`,
  );
  const set = new Set<string>();
  for (const row of r.rows) {
    if (row.marker) set.add(String(row.marker));
    if (row.platform) set.add(`platform:${String(row.platform)}`);
  }
  return set;
}

async function externalEffectProof(pool: pg.Pool): Promise<Set<string>> {
  const r = await pool.query(
    `select distinct executor_type as platform
       from aq_distribution_receipts
      where status in ('PUBLISHED','EXPOSED','EXPOSURE_CONFIRMED')
        and created_at > now() - interval '60 days'`,
  );
  const set = new Set<string>();
  for (const row of r.rows) if (row.platform) set.add(String(row.platform));
  return set;
}

async function commercialProof(pool: pg.Pool): Promise<Set<string>> {
  const r = await pool.query(
    `select distinct business_id
       from ros_traffic_events
      where class in ('LIKELY_HUMAN','QUALIFIED')
        and coalesce(referer,'') <> ''
        and referer not ilike '%sslip.io%'
        and created_at > now() - interval '30 days'`,
  );
  const set = new Set<string>();
  for (const row of r.rows) if (row.business_id) set.add(String(row.business_id));
  return set;
}

function deriveProof(
  reg: {
    state: string;
    autonomous: boolean;
    authenticated: boolean;
    liveEvidence: string;
    failurePoint: string;
    domain: string;
    id: string;
  },
  actionProof: Set<string>,
  effectProof: Set<string>,
  commercialAnyBusiness: boolean,
): CapabilityProofLevel {
  const hasCommercial = commercialAnyBusiness;
  const hasEffect =
    effectProof.has(reg.domain) || effectProof.has(reg.id.replace(/^cap_/, ""));
  const hasAction =
    actionProof.has(reg.id) ||
    actionProof.has(`platform:${reg.domain}`) ||
    /SENT|ACCEPTED|PUBLISHED/i.test(reg.liveEvidence);

  if (hasCommercial && (hasAction || hasEffect)) return "C6_COMMERCIAL_EFFECT_PROVEN";
  if (hasEffect) return "C5_EXTERNAL_EFFECT_PROVEN";
  if (hasAction) return "C4_EXTERNAL_ACTION_PROVEN";
  if (reg.authenticated && reg.autonomous && reg.state === "IMPLEMENTED")
    return "C3_PRODUCTION_AVAILABLE";
  if (reg.state === "IMPLEMENTED" && !reg.failurePoint) return "C2_TESTED";
  if (reg.state === "IMPLEMENTED") return "C1_IMPLEMENTED";
  return "C0_DISCOVERED";
}

export async function refreshCapabilityGraph(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ capabilities: number; byProof: Record<string, number> }> {
  const [actionProof, effectProof, commercialProofSet] = await Promise.all([
    externalActionProof(pool),
    externalEffectProof(pool),
    commercialProof(pool),
  ]);
  const commercialAnyBusiness = commercialProofSet.size > 0;

  const rows = await pool.query(
    `select capability_id, name, domain, state, autonomous, authenticated,
            owner_authority, live_evidence, failure_point, updated_at
       from ros_capability_registry`,
  );

  const byProof: Record<string, number> = {};
  for (const r of rows.rows) {
    const proof = deriveProof(
      {
        id: String(r.capability_id),
        state: String(r.state),
        autonomous: !!r.autonomous,
        authenticated: !!r.authenticated,
        liveEvidence: String(r.live_evidence ?? ""),
        failurePoint: String(r.failure_point ?? ""),
        domain: String(r.domain),
      },
      actionProof,
      effectProof,
      commercialAnyBusiness && String(r.domain) === "commercial",
    );
    byProof[proof] = (byProof[proof] ?? 0) + 1;
    await pool.query(
      `insert into ros_capability_graph
         (capability_id, name, domain, description, proof_level,
          success_rate, last_verified_at, owner_dependency, registry_ref,
          meta, updated_at)
       values ($1,$2,$3,$4,$5,$6, now(), $7, $8, $9::jsonb, now())
       on conflict (capability_id) do update set
         name=excluded.name,
         domain=excluded.domain,
         description=excluded.description,
         proof_level=excluded.proof_level,
         success_rate=excluded.success_rate,
         last_verified_at=now(),
         owner_dependency=excluded.owner_dependency,
         meta=excluded.meta,
         updated_at=now()`,
      [
        r.capability_id,
        r.name,
        r.domain,
        String(r.live_evidence ?? "").slice(0, 500),
        proof,
        proof === "C6_COMMERCIAL_EFFECT_PROVEN"
          ? 1
          : proof === "C5_EXTERNAL_EFFECT_PROVEN"
            ? 0.75
            : proof === "C4_EXTERNAL_ACTION_PROVEN"
              ? 0.5
              : proof === "C3_PRODUCTION_AVAILABLE"
                ? 0.3
                : 0.1,
        !!r.owner_authority,
        `ros_capability_registry:${r.capability_id}`,
        JSON.stringify({
          state: r.state,
          autonomous: r.autonomous,
          authenticated: r.authenticated,
          failurePoint: r.failure_point,
        }),
      ],
    );
  }

  logger("info", "ultron.capability_graph.refresh", {
    capabilities: rows.rowCount,
    byProof,
  });
  return { capabilities: rows.rowCount ?? 0, byProof };
}

/**
 * Query the bus for capabilities that can plausibly satisfy an effect.
 * The compiler uses this — planners should NOT bypass the bus.
 */
export async function queryCapabilities(
  pool: pg.Pool,
  opts: {
    minProof?: CapabilityProofLevel;
    domain?: string;
    excludeOwnerRequired?: boolean;
  },
): Promise<CapabilityUnion[]> {
  const rank: Record<CapabilityProofLevel, number> = {
    C0_DISCOVERED: 0,
    C1_IMPLEMENTED: 1,
    C2_TESTED: 2,
    C3_PRODUCTION_AVAILABLE: 3,
    C4_EXTERNAL_ACTION_PROVEN: 4,
    C5_EXTERNAL_EFFECT_PROVEN: 5,
    C6_COMMERCIAL_EFFECT_PROVEN: 6,
  };
  const minRank = rank[opts.minProof ?? "C0_DISCOVERED"];

  const conds: string[] = [];
  const args: unknown[] = [];
  if (opts.domain) {
    args.push(opts.domain);
    conds.push(`domain = $${args.length}`);
  }
  if (opts.excludeOwnerRequired) conds.push(`owner_dependency = false`);
  const where = conds.length ? `where ${conds.join(" and ")}` : "";

  const rows = await pool.query(
    `select capability_id, name, domain, description, proof_level,
            success_rate, last_verified_at, owner_dependency, registry_ref,
            meta
       from ros_capability_graph
       ${where}
       order by updated_at desc
       limit 200`,
    args,
  );
  return rows.rows
    .map((r) => ({
      id: String(r.capability_id),
      name: String(r.name),
      domain: String(r.domain),
      description: String(r.description),
      proofLevel: r.proof_level as CapabilityProofLevel,
      successRate: Number(r.success_rate ?? 0),
      lastVerifiedAt: r.last_verified_at?.toISOString?.() ?? null,
      ownerDependency: !!r.owner_dependency,
      registryRef: r.registry_ref ?? null,
      externalEvidence: String(r.description ?? ""),
    }))
    .filter((c) => rank[c.proofLevel] >= minRank);
}

export async function capabilityProofSummary(
  pool: pg.Pool,
): Promise<Record<CapabilityProofLevel, number>> {
  const r = await pool.query(
    `select proof_level, count(*)::int as n
       from ros_capability_graph
       group by 1`,
  );
  const out: Record<string, number> = {
    C0_DISCOVERED: 0,
    C1_IMPLEMENTED: 0,
    C2_TESTED: 0,
    C3_PRODUCTION_AVAILABLE: 0,
    C4_EXTERNAL_ACTION_PROVEN: 0,
    C5_EXTERNAL_EFFECT_PROVEN: 0,
    C6_COMMERCIAL_EFFECT_PROVEN: 0,
  };
  for (const row of r.rows) out[String(row.proof_level)] = Number(row.n);
  return out as Record<CapabilityProofLevel, number>;
}
