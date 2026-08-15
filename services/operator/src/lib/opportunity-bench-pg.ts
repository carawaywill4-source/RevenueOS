/**
 * Dynamic Opportunity Bench — live world intelligence + priors as fallback.
 */

import type pg from "pg";
import type { BusinessOpportunity } from "@revenueos/core";

export const BENCH_VERSION = "opportunity-bench-v1";

export type OpportunityOrigin =
  | "OPPORTUNITY_PRIOR"
  | "PORTFOLIO_50_SPEC"
  | "OPEN_WORLD_DISCOVERED"
  | "REPLACEMENT_RESEARCH";

export type OpportunityBenchStatus =
  | "DISCOVERED"
  | "RESEARCHING"
  | "VALIDATED_FOR_ARCHITECTURE"
  | "REJECTED"
  | "ARCHITECTED"
  | "BUILDING"
  | "DEPLOYED"
  | "IN_ADMISSION"
  | "ACCEPTED"
  | "FAILED";

export type OpportunityBenchEntry = {
  opportunity_id: string;
  siteId: string;
  discovered_at: string;
  origin: OpportunityOrigin;
  source_evidence: string[];
  market: string;
  target_customer: string;
  pain: string;
  urgency: string;
  current_alternatives: string[];
  competitors: string[];
  competitive_weaknesses: string[];
  business_model: string;
  offer: string;
  pricing_hypothesis: number | null;
  revenue_mechanics: string;
  customer_acquisition_paths: string[];
  fulfillment_model: string;
  automation_feasibility: string;
  startup_requirements: string[];
  risk: string;
  market_confidence: number;
  customer_confidence: number;
  money_model: string;
  path_to_10k_day: string;
  expected_time_to_first_customer_days: number | null;
  expected_value: number;
  why_now: string;
  similar_portfolio_businesses: string[];
  duplicate_cannibalization_risk: "low" | "medium" | "high";
  status: OpportunityBenchStatus;
  falsification: string;
  displayName?: string;
  productDescription?: string;
  bullets?: string[];
  brandVoice?: string;
  intentKeywords?: string[];
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 28) || `opp${Date.now().toString(36)}`;
}

export async function upsertOpportunityBench(
  pool: pg.Pool,
  entry: OpportunityBenchEntry,
): Promise<void> {
  await pool.query(
    `insert into titan_opportunity_models (id, title, document, score, updated_at)
     values ($1,$2,$3::jsonb,$4,now())
     on conflict (id) do update set
       title=excluded.title,
       document=excluded.document,
       score=excluded.score,
       updated_at=now()`,
    [
      entry.opportunity_id,
      entry.offer || entry.siteId,
      JSON.stringify({ ...entry, benchVersion: BENCH_VERSION }),
      entry.expected_value,
    ],
  );
}

export async function listOpportunityBench(
  pool: pg.Pool,
  opts?: { minStatus?: OpportunityBenchStatus; origin?: OpportunityOrigin },
): Promise<OpportunityBenchEntry[]> {
  const res = await pool.query(
    `select id, title, document, score from titan_opportunity_models
     order by coalesce(score,0) desc, updated_at desc
     limit 80`,
  );
  const out: OpportunityBenchEntry[] = [];
  for (const row of res.rows) {
    const doc = row.document as OpportunityBenchEntry;
    if (!doc || typeof doc !== "object") continue;
    if (opts?.origin && doc.origin !== opts.origin) continue;
    out.push({
      ...doc,
      opportunity_id: doc.opportunity_id ?? String(row.id),
      expected_value: Number(row.score ?? doc.expected_value ?? 0),
    });
  }
  return out;
}

export async function bestBenchOpportunity(
  pool: pg.Pool,
  excludeSiteIds: string[],
): Promise<OpportunityBenchEntry | null> {
  const taken = new Set(excludeSiteIds);
  const bench = await listOpportunityBench(pool);
  const eligible = bench.filter(
    (b) =>
      !taken.has(b.siteId) &&
      !["REJECTED", "FAILED", "ACCEPTED"].includes(b.status) &&
      b.expected_value >= 62 &&
      b.duplicate_cannibalization_risk !== "high",
  );
  // Prefer open-world over priors when score is close.
  eligible.sort((a, b) => {
    const originBoost = (o: OpportunityOrigin) =>
      o === "OPEN_WORLD_DISCOVERED" ? 8 : o === "REPLACEMENT_RESEARCH" ? 5 : 0;
    return (
      b.expected_value +
      originBoost(b.origin) -
      (a.expected_value + originBoost(a.origin))
    );
  });
  return eligible[0] ?? null;
}

export function benchEntryToOpportunity(
  entry: OpportunityBenchEntry,
): BusinessOpportunity {
  const now = new Date().toISOString();
  return {
    id: entry.opportunity_id,
    siteId: entry.siteId,
    displayName:
      entry.displayName ??
      (entry.offer.replace(/\s+/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 24) ||
        entry.siteId),
    title: entry.offer,
    industry: entry.market,
    buyer: entry.target_customer,
    problem: entry.pain,
    productName: entry.offer,
    productDescription:
      entry.productDescription ??
      `${entry.offer} — ${entry.pain}. Digital delivery.`,
    bullets: entry.bullets ?? [
      entry.pain.slice(0, 80),
      entry.why_now.slice(0, 80),
      "Instant digital fulfillment",
    ],
    priceUsd: entry.pricing_hypothesis ?? 49,
    fulfillment: entry.fulfillment_model.includes("download")
      ? "digital_download"
      : "digital_download",
    brandVoice: entry.brandVoice ?? "direct, practical, credible",
    primaryColor: "#1C2541",
    accentColor: "#5BC0BE",
    fontDisplay: "Fraunces",
    fontBody: "Source Sans 3",
    intentKeywords: entry.intentKeywords ?? entry.customer_acquisition_paths.slice(0, 3),
    acquisitionHypothesis: entry.customer_acquisition_paths[0] ?? entry.why_now,
    expectedEconomics: {
      marginEstimate: 0.9,
      timeToFirstSaleDays: entry.expected_time_to_first_customer_days ?? 21,
      supportBurden: "low",
      organicPotential: "high",
    },
    requiresOwnerSpend: false,
    evidence: [
      ...(entry.source_evidence ?? []),
      `origin:${entry.origin}`,
      `bench:${entry.opportunity_id}`,
    ],
    score: entry.expected_value,
    rejectReasons: [],
    lifecycle: "launch_candidate",
    createdAt: entry.discovered_at || now,
  };
}

export function createOpenWorldEntry(input: {
  title: string;
  market: string;
  buyer: string;
  pain: string;
  offer: string;
  whyNow: string;
  evidence: string[];
  pricing?: number;
  expectedValue: number;
  pathTo10k: string;
  falsification: string;
  similar?: string[];
  acquisitionPaths?: string[];
}): OpportunityBenchEntry {
  const siteId = slugify(input.title);
  return {
    opportunity_id: `ow_${siteId}_${Date.now().toString(36)}`,
    siteId,
    discovered_at: new Date().toISOString(),
    origin: "OPEN_WORLD_DISCOVERED",
    source_evidence: input.evidence,
    market: input.market,
    target_customer: input.buyer,
    pain: input.pain,
    urgency: "high_when_workflow_blocked",
    current_alternatives: ["generic templates", "manual process", "agency"],
    competitors: [],
    competitive_weaknesses: ["poor UX", "not packaged for instant purchase"],
    business_model: "digital_product_commerce",
    offer: input.offer,
    pricing_hypothesis: input.pricing ?? 49,
    revenue_mechanics: "one_time_checkout_with_upsell_path",
    customer_acquisition_paths: input.acquisitionPaths ?? [
      "permissionless SEO on high-intent queries",
      "comparison pages vs free docs",
    ],
    fulfillment_model: "digital_download",
    automation_feasibility: "high",
    startup_requirements: ["storefront", "stripe", "content pack"],
    risk: "demand_uncertainty",
    market_confidence: Math.min(0.9, input.expectedValue / 100),
    customer_confidence: Math.min(0.9, input.expectedValue / 100),
    money_model: "high_margin_digital",
    path_to_10k_day: input.pathTo10k,
    expected_time_to_first_customer_days: 21,
    expected_value: input.expectedValue,
    why_now: input.whyNow,
    similar_portfolio_businesses: input.similar ?? [],
    duplicate_cannibalization_risk:
      (input.similar?.length ?? 0) > 2 ? "medium" : "low",
    status: "DISCOVERED",
    falsification: input.falsification,
    displayName: input.title.replace(/\s+/g, "").slice(0, 24),
  };
}
