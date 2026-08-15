/**
 * Market Intelligence OS — demand, buyer, competitor facts into the
 * existing Titan world store + ros_world_facts. Not a second brain.
 */

import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { recordWorldFact } from "../ultron-core/world-model.js";
import { runTitanResearch } from "../titan-research-engine.js";
import { applyCognitiveEscalation } from "./cognitive-escalation.js";

async function ensureCompetitorTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_competitor_intel (
      competitor_id text primary key,
      business_id text not null,
      competitor text not null,
      offer text,
      pricing text,
      target_market text,
      strengths text,
      weaknesses text,
      opportunity text,
      source_url text,
      evidence_class text not null default 'INFERRED',
      confidence numeric not null default 0.25,
      updated_at timestamptz not null default now()
    )
  `);
}

export async function researchMarketForBusiness(
  pool: pg.Pool,
  logger: Logger,
  input: {
    businessId: string;
    industry: string;
    productName: string;
    audience: string;
    problem?: string;
  },
): Promise<{ claims: number; competitors: number; demandSignals: number }> {
  await ensureCompetitorTable(pool);
  const fresh = await pool.query(
    `select last_verified_at from ros_world_facts
      where entity_kind='business' and entity_id=$1 and predicate='market_research'
        and last_verified_at > now() - interval '6 hours'`,
    [input.businessId],
  ).catch(() => ({ rows: [] as unknown[] }));
  if (fresh.rows[0]) {
    logger("info", "ultron.market.skipped_fresh", { businessId: input.businessId });
    return { claims: 0, competitors: 0, demandSignals: 0 };
  }
  await applyCognitiveEscalation(pool, logger, {
    taskKind: "market_selection_demand_research",
    taskValueUsd: 80,
    novelty: 0.7,
    failureCount: 0,
    uncertainty: 0.75,
    architectureScope: false,
    risk: "MEDIUM",
    economicMilestone: "E5",
    modelCostUsd: 0,
    availableBudgetUsd: 5,
  });

  const topic = `${input.productName} ${input.industry}`.slice(0, 80);
  const queries = [
    `${input.audience} ${input.industry} buy OR pricing OR alternative`,
    `${input.productName} vs competitors complaints`,
    `how to ${input.industry.replace(/_/g, " ")} software directory`,
  ];

  const research = await runTitanResearch({
    pool,
    question: `What are buyers currently trying to buy/solve for ${topic}?`,
    businessId: input.businessId,
    purpose: "market_intelligence_demand",
    queries,
    budget: { maxSearches: 3, maxPages: 5, maxMs: 22_000 },
    logger,
  }).catch((e) => {
    logger("warn", "ultron.market.research_failed", { e: String(e) });
    return null;
  });

  const claims = research?.claims ?? [];
  let demandSignals = 0;
  for (const c of claims.slice(0, 8)) {
    await recordWorldFact(pool, {
      entityKind: "market",
      entityId: input.industry,
      predicate: "demand_signal",
      value: {
        claim: c.claim,
        status: c.status,
        url: c.url ?? null,
        businessId: input.businessId,
        buyerSegment: input.audience,
        evidenceClass: c.status === "CORROBORATED" ? "EVIDENCE_BACKED" : "INFERRED",
      },
      source: c.url ?? "titan.research",
      confidence: c.status === "CORROBORATED" ? 0.55 : 0.3,
      ttlHours: 72,
    });
    demandSignals++;
  }

  let competitors = 0;
  for (const c of claims.filter((x) => /vs\.?|alternative|competitor|pricing/i.test(x.claim)).slice(0, 5)) {
    const id = `ci_${input.businessId}_${competitors}`;
    await pool.query(
      `insert into ros_competitor_intel
         (competitor_id, business_id, competitor, offer, pricing, opportunity, source_url, evidence_class, confidence, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,'INFERRED',0.28, now())
       on conflict (competitor_id) do update set
         offer=excluded.offer, source_url=excluded.source_url, updated_at=now()`,
      [
        id,
        input.businessId,
        "unverified_named_alternative",
        c.claim.slice(0, 400),
        "UNKNOWN",
        "find a reason to win — not copy",
        c.url ?? null,
      ],
    );
    competitors++;
  }

  await recordWorldFact(pool, {
    entityKind: "business",
    entityId: input.businessId,
    predicate: "market_research",
    value: {
      claims: claims.length,
      demandSignals,
      competitors,
      summary: research?.summary ?? "research_unavailable",
      gaps: research?.knowledgeGapsRemaining ?? ["no_live_research"],
    },
    source: "ultron.market-intelligence",
    confidence: claims.length > 0 ? 0.4 : 0.15,
    ttlHours: 24,
  });

  logger("info", "ultron.market.researched", {
    businessId: input.businessId,
    claims: claims.length,
    demandSignals,
    competitors,
  });
  return { claims: claims.length, competitors, demandSignals };
}
