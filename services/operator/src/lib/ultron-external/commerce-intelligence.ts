/**
 * Market Intelligence OS + commercial scoring.
 *
 * Answers: which businesses deserve to exist / receive traffic.
 * Evidence classes: EVIDENCE_BACKED | INFERRED | UNKNOWN.
 * $10k/day figures are feasibility tests, not forecasts.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { recordWorldFact } from "../ultron-core/world-model.js";
import { applyCognitiveEscalation } from "./cognitive-escalation.js";
import { evaluateEconomicFeasibility } from "../titan-commercial-executive/economic-feasibility.js";

export type EvidenceClass = "EVIDENCE_BACKED" | "INFERRED" | "UNKNOWN";
export type PortfolioBand =
  | "HIGH_POTENTIAL"
  | "PROMISING"
  | "NEEDS_REPOSITIONING"
  | "WEAK"
  | "RETIRE_CANDIDATE";

export type TenKPath = "PLAUSIBLE" | "STRETCH" | "IMPLAUSIBLE" | "UNKNOWN";

type PortfolioProduct = {
  siteId: string;
  displayName: string;
  industry: string;
  brandVoice?: string;
  product: { name: string; priceUsd: number; marginEstimate: number; audience: string };
  businessModel: string;
};

function loadPortfolio(): PortfolioProduct[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const p = path.resolve(here, "../../portfolio-dynamic.json");
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf8")) as PortfolioProduct[];
  } catch {
    return [];
  }
}

const SLOP_RE =
  /revolutionize your|transform your workflow|unlock your potential|next-generation ai|powered by ai(?!\s+that)|cutting-edge solution|seamless experience|all-in-one platform/i;

export function tenKFeasibility(priceUsd: number): {
  path: TenKPath;
  customersPerDay: number;
  assumedConv: number;
  trafficPerDay: number;
  math: string;
} {
  const price = Math.max(1, priceUsd);
  const customersPerDay = 10000 / price;
  const assumedConv = 0.02; // ASSUMPTION for stress-test only
  const trafficPerDay = customersPerDay / assumedConv;
  let path: TenKPath = "UNKNOWN";
  if (customersPerDay > 200 || trafficPerDay > 50_000) path = "IMPLAUSIBLE";
  else if (customersPerDay > 50 || trafficPerDay > 10_000) path = "STRETCH";
  else path = "PLAUSIBLE";
  return {
    path,
    customersPerDay,
    assumedConv,
    trafficPerDay,
    math: `$10k/day ÷ $${price} = ${customersPerDay.toFixed(1)} sales/day; at 2% conv (assumption) ≈ ${Math.round(trafficPerDay)} visits/day`,
  };
}

export function bandFromScores(input: {
  quality: number;
  demand: number;
  trafficReady: boolean;
  tenK: TenKPath;
  purchases: number;
}): PortfolioBand {
  if (input.purchases > 0 && input.quality >= 60) return "HIGH_POTENTIAL";
  if (input.trafficReady && input.quality >= 55 && input.demand >= 40) return "PROMISING";
  if (input.tenK === "IMPLAUSIBLE" && input.quality < 40) return "RETIRE_CANDIDATE";
  if (input.quality < 35 || input.demand < 25) return "WEAK";
  if (input.tenK === "IMPLAUSIBLE" || input.tenK === "STRETCH") return "NEEDS_REPOSITIONING";
  return "PROMISING";
}

async function ensureTables(pool: pg.Pool): Promise<void> {
  await pool.query(`
    create table if not exists ros_buyer_models (
      business_id text primary key,
      buyer_type text,
      problem text,
      urgency text,
      current_workaround text,
      alternatives text,
      objections text,
      desired_outcome text,
      discovery_channels text,
      search_language text,
      price_sensitivity text,
      wtp_evidence text,
      evidence_class text not null default 'UNKNOWN',
      confidence numeric not null default 0.2,
      updated_at timestamptz not null default now(),
      meta jsonb not null default '{}'::jsonb
    );
    create table if not exists ros_business_scores (
      business_id text primary key,
      demand numeric not null default 0,
      pain numeric not null default 0,
      wtp numeric not null default 0,
      differentiation numeric not null default 0,
      distribution numeric not null default 0,
      trust numeric not null default 0,
      margin numeric not null default 0,
      scale numeric not null default 0,
      autonomy numeric not null default 0,
      tenk_path text not null default 'UNKNOWN',
      quality numeric not null default 0,
      band text not null default 'WEAK',
      traffic_ready boolean not null default false,
      key_weakness text not null default '',
      recommended_action text not null default 'IMPROVE',
      evidence jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
    create table if not exists ros_trust_defects (
      defect_id text primary key,
      business_id text not null,
      kind text not null,
      detail text not null,
      severity text not null default 'MEDIUM',
      status text not null default 'OPEN',
      created_at timestamptz not null default now()
    );
    create table if not exists ros_frontier_selection (
      selection_id text primary key,
      business_id text not null,
      why jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);
}

async function liveSiteSignals(url: string): Promise<{
  ok: boolean;
  title: string;
  hasPrice: boolean;
  hasCheckout: boolean;
  hasPrivacy: boolean;
  hasTerms: boolean;
  hasContact: boolean;
  slop: boolean;
  bodyLen: number;
}> {
  const empty = {
    ok: false, title: "", hasPrice: false, hasCheckout: false,
    hasPrivacy: false, hasTerms: false, hasContact: false, slop: false, bodyLen: 0,
  };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "RevenueOS-market-os/1.0" },
      signal: AbortSignal.timeout(5_000),
    });
    const html = (await res.text()).slice(0, 200_000);
    const title = (html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "").trim();
    return {
      ok: res.status >= 200 && res.status < 400,
      title,
      hasPrice: /\$\s?\d|pricing|price/i.test(html),
      hasCheckout: /checkout|stripe|buy now|purchase/i.test(html),
      hasPrivacy: /privacy/i.test(html),
      hasTerms: /terms/i.test(html),
      hasContact: /contact|mailto:/i.test(html),
      slop: SLOP_RE.test(html),
      bodyLen: html.length,
    };
  } catch {
    return empty;
  }
}

async function mapPool<T, R>(items: T[], n: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

export async function scorePortfolio(
  pool: pg.Pool,
  logger: Logger,
): Promise<{
  scored: number;
  bands: Record<string, number>;
  selected: string | null;
}> {
  await ensureTables(pool);
  const fresh = await pool.query(
    `select max(updated_at) as t from ros_business_scores`,
  );
  const last = fresh.rows[0]?.t ? new Date(fresh.rows[0].t).getTime() : 0;
  if (last && Date.now() - last < 25 * 60_000) {
    const selected = await latestFrontier(pool);
    const bandsQ = await pool.query(
      `select band, count(*)::int as n from ros_business_scores group by 1`,
    );
    const bands: Record<string, number> = {};
    for (const row of bandsQ.rows) bands[String(row.band)] = Number(row.n);
    const n = await pool.query(`select count(*)::int as n from ros_business_scores`);
    return {
      scored: Number(n.rows[0]?.n ?? 0),
      bands,
      selected: selected ? String(selected.business_id) : null,
    };
  }

  await applyCognitiveEscalation(pool, logger, {
    taskKind: "market_selection_portfolio_score",
    taskValueUsd: 50,
    novelty: 0.6,
    failureCount: 0,
    uncertainty: 0.7,
    architectureScope: false,
    risk: "MEDIUM",
    economicMilestone: "E5",
    modelCostUsd: 0,
    availableBudgetUsd: 5,
  });

  const portfolio = loadPortfolio();
  const biz = await pool.query(
    `select site_id, display_name, industry, app_url, status, metadata from ros_businesses
      where status in ('active','LAUNCHED','ACCEPTED','LIVE','LAUNCHING')
      limit 80`,
  );

  const bands: Record<string, number> = {
    HIGH_POTENTIAL: 0, PROMISING: 0, NEEDS_REPOSITIONING: 0, WEAK: 0, RETIRE_CANDIDATE: 0,
  };
  let scored = 0;

  const humansAll = await pool.query(
    `select business_id, count(*)::int as n from ros_traffic_events
      where class='VERIFIED_HUMAN_SIGNAL' group by 1`,
  ).catch(() => ({ rows: [] as Array<{ business_id: string; n: number }> }));
  const purchasesAll = await pool.query(
    `select business_id, count(*)::int as n from ros_customer_events
      where kind in ('PAYMENT_SUCCEEDED','CHECKOUT_COMPLETED') group by 1`,
  ).catch(() => ({ rows: [] as Array<{ business_id: string; n: number }> }));
  const actionsAll = await pool.query(
    `select business_id, count(*)::int as n from aq_distribution_receipts group by 1`,
  ).catch(() => ({ rows: [] as Array<{ business_id: string; n: number }> }));
  const humanMap = new Map(humansAll.rows.map((r) => [String(r.business_id), Number(r.n)]));
  const purchaseMap = new Map(purchasesAll.rows.map((r) => [String(r.business_id), Number(r.n)]));
  const actionMap = new Map(actionsAll.rows.map((r) => [String(r.business_id), Number(r.n)]));

  const liveByUrl = new Map<string, Awaited<ReturnType<typeof liveSiteSignals>>>();
  const urls = [...new Set(biz.rows.map((row) =>
    String(row.app_url ?? `https://${row.site_id}.130.131.15.68.sslip.io`),
  ))];
  await mapPool(urls, 6, async (url) => {
    liveByUrl.set(url, await liveSiteSignals(url));
    return url;
  });

  for (const row of biz.rows) {
    const siteId = String(row.site_id);
    const spec = portfolio.find((p) => p.siteId === siteId);
    const price = Number(spec?.product.priceUsd ?? 0) || 0;
    const margin = Number(spec?.product.marginEstimate ?? 0.9);
    const audience = spec?.product.audience ?? "UNKNOWN";
    const industry = String(row.industry ?? spec?.industry ?? "unknown");
    const url = String(row.app_url ?? `https://${siteId}.130.131.15.68.sslip.io`);

    const tenk = tenKFeasibility(price || 29);
    const feas = evaluateEconomicFeasibility({
      priceUsd: price || 29,
      revenueModel: spec?.businessModel ?? "one_shot",
      fulfillmentCostLow: spec?.businessModel === "digital_product",
      automationFit: 0.7,
    });
    const live = liveByUrl.get(url) ?? await liveSiteSignals(url);
    const commercialReady = live.ok && live.hasPrice && live.hasCheckout;

    const humanN = humanMap.get(siteId) ?? 0;
    const purchaseN = purchaseMap.get(siteId) ?? 0;
    const actionN = actionMap.get(siteId) ?? 0;

    // Demand: no search-volume API. INFERRED from B2B cash/ops industries + live offer.
    const b2bPain = /invoice|rfp|quote|bid|scope|receivable|contractor|payroll|bookkeep|vendor|procurement/i.test(
      `${industry} ${siteId} ${audience}`,
    );
    const tenkPath: TenKPath =
      feas.class === "CREDIBLE" || feas.class === "PLAUSIBLE" ? "PLAUSIBLE"
      : feas.class === "IMPLAUSIBLE" || feas.class === "WEAK" ? "IMPLAUSIBLE"
      : "STRETCH";
    const tenkUsed = tenk.customersPerDay > 200 ? "IMPLAUSIBLE" : tenkPath === "PLAUSIBLE" && tenk.path !== "PLAUSIBLE" ? tenk.path : tenkPath;
    const demandEvidence: EvidenceClass = purchaseN > 0 ? "EVIDENCE_BACKED" : "INFERRED";
    const demand = Math.min(
      100,
      (purchaseN > 0 ? 70 : 0) +
        (humanN > 0 ? 20 : 0) +
        (b2bPain ? 28 : 12) +
        (live.hasPrice ? 8 : 0) +
        (live.ok ? 6 : 0),
    );
    const pain = b2bPain ? 62 : 38;
    const wtp = price >= 70 ? 48 : price >= 40 ? 36 : 22;
    const differentiation = live.slop ? 15 : 28; // no unique evidence → low
    const distribution = actionN > 10 ? 40 : 22;
    let trust = 20;
    if (live.ok) trust += 15;
    if (live.hasPrivacy) trust += 10;
    if (live.hasTerms) trust += 8;
    if (live.hasContact) trust += 10;
    if (live.hasCheckout) trust += 10;
    if (live.slop) trust -= 15;
    trust = Math.max(0, Math.min(100, trust));
    const scale = spec?.businessModel === "digital_product" ? 70 : 40;
    const autonomy = 72; // digital pack, operator-hosted
    const quality = Math.round(
      0.14 * demand +
        0.1 * pain +
        0.12 * wtp +
        0.1 * differentiation +
        0.1 * distribution +
        0.14 * trust +
        0.08 * (margin * 100) +
        0.08 * scale +
        0.08 * autonomy +
        (tenkUsed === "PLAUSIBLE" ? 12 : tenkUsed === "STRETCH" ? 4 : 0),
    );

    const trafficReady =
      !!commercialReady &&
      live.ok &&
      live.hasPrice &&
      live.hasCheckout &&
      live.hasPrivacy &&
      live.hasContact &&
      !live.slop &&
      demand >= 35 &&
      trust >= 50;

    const band = bandFromScores({
      quality,
      demand,
      trafficReady,
      tenK: tenkUsed,
      purchases: purchaseN,
    });
    bands[band] = (bands[band] ?? 0) + 1;

    let weakness = "no_verified_demand";
    if (!live.ok) weakness = "site_unreachable";
    else if (live.slop) weakness = "generic_ai_copy";
    else if (!live.hasPrivacy || !live.hasContact) weakness = "trust_gap";
    else if (tenkUsed === "IMPLAUSIBLE") weakness = "price_volume_math_implausible_for_10k_day";
    else if (!trafficReady) weakness = "not_traffic_ready";

    const action =
      band === "RETIRE_CANDIDATE" ? "PAUSE"
      : band === "WEAK" ? "REPOSITION"
      : tenkUsed === "IMPLAUSIBLE" || tenkUsed === "STRETCH" ? "REPRICE"
      : trafficReady ? "DISTRIBUTE"
      : "IMPROVE";

    if (!live.hasPrivacy || !live.hasContact || live.slop) {
      await pool.query(
        `insert into ros_trust_defects (defect_id, business_id, kind, detail, severity)
         values ($1,$2,$3,$4,$5)
         on conflict (defect_id) do update set detail=excluded.detail, status='OPEN'`,
        [
          `td_${siteId}_${weakness}`.slice(0, 80),
          siteId,
          "TRUST_DEFECT",
          weakness,
          live.ok ? "MEDIUM" : "HIGH",
        ],
      );
    }

    await pool.query(
      `insert into ros_buyer_models
         (business_id, buyer_type, problem, urgency, current_workaround, alternatives, objections,
          desired_outcome, discovery_channels, search_language, price_sensitivity,
          wtp_evidence, evidence_class, confidence, meta, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb, now())
       on conflict (business_id) do update set
         buyer_type=excluded.buyer_type, problem=excluded.problem, urgency=excluded.urgency,
         current_workaround=excluded.current_workaround, alternatives=excluded.alternatives,
         objections=excluded.objections, desired_outcome=excluded.desired_outcome,
         discovery_channels=excluded.discovery_channels, search_language=excluded.search_language,
         price_sensitivity=excluded.price_sensitivity, wtp_evidence=excluded.wtp_evidence,
         evidence_class=excluded.evidence_class, confidence=excluded.confidence,
         meta=excluded.meta, updated_at=now()`,
      [
        siteId,
        audience,
        spec?.product.name ?? siteId,
        b2bPain ? "cash_or_ops_pain_inferred" : "UNKNOWN",
        "UNKNOWN",
        "UNKNOWN",
        "trust_price_and_generic_template",
        spec?.product.name ?? "UNKNOWN",
        "search_directories_communities_inferred",
        industry.replace(/_/g, " "),
        price >= 70 ? "mid_ticket_inferred" : "low_ticket_inferred",
        purchaseN > 0 ? `purchases=${purchaseN}` : "no_observed_spend",
        demandEvidence,
        demandEvidence === "EVIDENCE_BACKED" ? 0.7 : 0.28,
        JSON.stringify({
          source: "portfolio_spec+live_site",
          url,
          buyingTrigger: b2bPain ? "INFERRED_cash_or_deadline" : "UNKNOWN",
          purchaseFriction: "UNKNOWN",
          repeatPurchase: spec?.businessModel === "digital_product" ? "LOW_inferred" : "UNKNOWN",
          marketSize: "UNKNOWN",
        }),
      ],
    );

    await pool.query(
      `insert into ros_business_scores
         (business_id, demand, pain, wtp, differentiation, distribution, trust,
          margin, scale, autonomy, tenk_path, quality, band, traffic_ready,
          key_weakness, recommended_action, evidence, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb, now())
       on conflict (business_id) do update set
         demand=excluded.demand, pain=excluded.pain, wtp=excluded.wtp,
         differentiation=excluded.differentiation, distribution=excluded.distribution,
         trust=excluded.trust, margin=excluded.margin, scale=excluded.scale,
         autonomy=excluded.autonomy, tenk_path=excluded.tenk_path, quality=excluded.quality,
         band=excluded.band, traffic_ready=excluded.traffic_ready,
         key_weakness=excluded.key_weakness, recommended_action=excluded.recommended_action,
         evidence=excluded.evidence, updated_at=now()`,
      [
        siteId, demand, pain, wtp, differentiation, distribution, trust,
        Math.round(margin * 100), scale, autonomy, tenkUsed, quality, band, trafficReady,
        weakness, action,
        JSON.stringify({
          price, tenk, tenkUsed, feas, live, commercialReady,
          humans: humanN, purchases: purchaseN, actions: actionN,
          demandClass: demandEvidence,
        }),
      ],
    );

    await recordWorldFact(pool, {
      entityKind: "business",
      entityId: siteId,
      predicate: "business_quality",
      value: { quality, band, trafficReady, tenk: tenkUsed, weakness, action },
      source: "ultron.commerce-intelligence",
      confidence: demandEvidence === "EVIDENCE_BACKED" ? 0.75 : 0.4,
      ttlHours: 24,
    });
    scored++;
  }

  const selected = await selectFrontier(pool, logger);
  logger("info", "ultron.commerce.score", { scored, bands, selected });
  return { scored, bands, selected };
}

export async function selectFrontier(
  pool: pg.Pool,
  logger: Logger,
): Promise<string | null> {
  const r = await pool.query(
    `select business_id, quality, demand, trust, band, traffic_ready, tenk_path,
            recommended_action, key_weakness, evidence
       from ros_business_scores
      order by
        traffic_ready desc,
        (quality * demand * greatest(trust, 1) / 10000.0) desc,
        quality desc,
        demand desc
      limit 8`,
  );
  const winner = r.rows[0];
  if (!winner) return null;
  const why = {
    business: winner.business_id,
    quality: Number(winner.quality),
    demand: Number(winner.demand),
    trust: Number(winner.trust),
    band: winner.band,
    trafficReady: winner.traffic_ready,
    tenk: winner.tenk_path,
    action: winner.recommended_action,
    weakness: winner.key_weakness,
    note: "Selected by ros_business_scores rank, not Cursor. InvoiceChaser is not forced.",
  };
  await pool.query(
    `insert into ros_frontier_selection (selection_id, business_id, why, created_at)
     values ($1,$2,$3::jsonb, now())`,
    [`fs_${Date.now().toString(36)}`, winner.business_id, JSON.stringify(why)],
  );
  await recordWorldFact(pool, {
    entityKind: "portfolio",
    entityId: "frontier",
    predicate: "selected_business",
    value: why,
    source: "ultron.commerce-intelligence",
    confidence: 0.55,
    ttlHours: 12,
  });
  logger("info", "ultron.commerce.frontier", why);
  return String(winner.business_id);
}

export async function latestFrontier(pool: pg.Pool): Promise<Record<string, unknown> | null> {
  const r = await pool.query(
    `select business_id, why, created_at from ros_frontier_selection
      order by created_at desc limit 1`,
  );
  return r.rows[0] ?? null;
}

export async function listScores(pool: pg.Pool): Promise<Array<Record<string, unknown>>> {
  const r = await pool.query(
    `select s.*, b.display_name, b.industry
       from ros_business_scores s
       join ros_businesses b on b.site_id = s.business_id
      order by s.quality desc`,
  );
  return r.rows;
}
