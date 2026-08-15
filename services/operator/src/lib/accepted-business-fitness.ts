/**
 * Accepted-business economic fitness from REAL durable telemetry.
 * UNKNOWN stays UNKNOWN — never invent purchases/traffic as zero.
 */

import type pg from "pg";
import { assessCommercialReadiness } from "./commercial-readiness.js";

export const FITNESS_VERSION = "accepted-fitness-v1";
export const FITNESS_SNAPSHOTS_KEY = "portfolio_fitness_snapshots";
export const FITNESS_CHALLENGE_KEY = "accepted_business_challenge_state";

export type Unknownable = number | "UNKNOWN";

export type FitnessState =
  | "HEALTHY"
  | "PROMISING"
  | "UNPROVEN"
  | "REPAIR_REQUIRED"
  | "PIVOT_CANDIDATE"
  | "RETIREMENT_CANDIDATE"
  | "ECONOMICALLY_FAILED";

export type BusinessFitnessRecord = {
  business_id: string;
  version: string;
  age_days: Unknownable;
  commercial_ready: boolean | "UNKNOWN";
  public_reachability: boolean | "UNKNOWN";
  offer_quality: "pass" | "fail" | "UNKNOWN";
  buyer_path_health: "pass" | "fail" | "UNKNOWN";
  checkout_health: "pass" | "fail" | "UNKNOWN";
  traffic: Unknownable;
  qualified_visits: Unknownable;
  search_impressions: Unknownable;
  search_clicks: Unknownable;
  organic_distribution_actions: Unknownable;
  outreach_results: Unknownable;
  leads: Unknownable;
  checkout_starts: Unknownable;
  purchases: Unknownable;
  revenue: Unknownable;
  conversion_rate: Unknownable;
  pricing: Unknownable;
  customer_model_strength: Unknownable;
  money_model_judgment: string | "UNKNOWN";
  market_confidence: Unknownable;
  acquisition_experiments_attempted: number;
  experiment_outcomes: {
    measured: number;
    failed: number;
    pending: number;
  };
  commercial_lessons: number;
  repair_attempts: number;
  pivot_attempts: number;
  code_evolution_attempts: number;
  recent_trend: "improving" | "flat" | "worsening" | "UNKNOWN";
  resource_cost: "low" | "medium" | "high" | "UNKNOWN";
  titan_confidence: number;
  path_to_10k_day: "credible" | "weak" | "implausible" | "UNKNOWN";
  fitness_state: FitnessState;
  bottleneck: string | null;
  evidence: string[];
  last_evaluated_at: string;
};

function numOrUnknown(v: unknown): Unknownable {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return "UNKNOWN";
}

function known(v: Unknownable): v is number {
  return typeof v === "number";
}

async function loadAdmitMeta(
  pool: pg.Pool,
  siteId: string,
): Promise<{ acceptedAt?: string; titanManagedAt?: string }> {
  const res = await pool.query(
    `select metadata from ros_businesses where site_id=$1`,
    [siteId],
  );
  const meta = (res.rows[0]?.metadata ?? {}) as {
    admit?: { acceptedAt?: string; titanManagedAt?: string };
  };
  return {
    acceptedAt: meta.admit?.acceptedAt,
    titanManagedAt: meta.admit?.titanManagedAt,
  };
}

function ageDaysFrom(iso?: string): Unknownable {
  if (!iso) return "UNKNOWN";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "UNKNOWN";
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export async function loadBusinessFitnessSignals(
  pool: pg.Pool,
  siteId: string,
): Promise<Omit<BusinessFitnessRecord, "fitness_state" | "bottleneck" | "evidence" | "titan_confidence" | "path_to_10k_day" | "recent_trend" | "resource_cost">> {
  const admit = await loadAdmitMeta(pool, siteId);
  const age_days = ageDaysFrom(admit.acceptedAt ?? admit.titanManagedAt);

  let commercial_ready: boolean | "UNKNOWN" = "UNKNOWN";
  let public_reachability: boolean | "UNKNOWN" = "UNKNOWN";
  let offer_quality: "pass" | "fail" | "UNKNOWN" = "UNKNOWN";
  let buyer_path_health: "pass" | "fail" | "UNKNOWN" = "UNKNOWN";
  let checkout_health: "pass" | "fail" | "UNKNOWN" = "UNKNOWN";

  // Prefer durable commercial_readiness_audit (no mass HTTP). Live probe only as fallback.
  let usedAudit = false;
  try {
    const auditRes = await pool.query(
      `select value from ros_config_meta where key='commercial_readiness_audit'`,
    );
    const audit = (auditRes.rows[0]?.value ?? {}) as {
      results?: Array<{
        siteId?: string;
        ready?: boolean;
        status?: string;
        checks?: Record<string, string>;
        failures?: Array<{ code?: string }>;
        assessedAt?: string;
      }>;
    };
    const row = (audit.results ?? []).find((r) => r.siteId === siteId);
    const age = row?.assessedAt
      ? Date.now() - Date.parse(row.assessedAt)
      : Number.POSITIVE_INFINITY;
    if (row && age < 6 * 60 * 60_000) {
      usedAudit = true;
      commercial_ready =
        row.ready === true || row.status === "READY"
          ? true
          : row.ready === false || row.status === "REPAIR_REQUIRED"
            ? false
            : "UNKNOWN";
      public_reachability = !(row.failures ?? []).some(
        (f) => f.code === "NO_PUBLIC_STOREFRONT",
      );
      const check = (key: string): "pass" | "fail" | "UNKNOWN" => {
        const v = row.checks?.[key];
        if (v === "pass" || v === "fail") return v;
        return "UNKNOWN";
      };
      offer_quality = check("offer");
      buyer_path_health = check("cta");
      checkout_health = check("checkoutPath");
    }
  } catch {
    /* */
  }

  if (!usedAudit) {
    try {
      const gate = await assessCommercialReadiness({ siteId, pool });
      commercial_ready = gate.status === "READY";
      public_reachability = !gate.failures.some(
        (f) => f.code === "NO_PUBLIC_STOREFRONT",
      );
      const check = (key: string): "pass" | "fail" | "UNKNOWN" => {
        const v = (gate.checks as Record<string, string> | undefined)?.[key];
        if (v === "pass" || v === "fail") return v;
        return "UNKNOWN";
      };
      offer_quality = check("offer");
      buyer_path_health = check("cta");
      checkout_health = check("checkoutPath");
    } catch {
      /* keep UNKNOWN */
    }
  }

  // Avoid ros_events / ros_experiments full-table site scans (multi-second each).
  // Prefer small Titan tables + money models. UNKNOWN stays UNKNOWN.
  const traffic: Unknownable = "UNKNOWN";
  const qualified_visits: Unknownable = "UNKNOWN";
  let purchases: Unknownable = "UNKNOWN";
  let checkout_starts: Unknownable = "UNKNOWN";

  const moneyPurchaseRes = await pool.query(
    `select document from titan_business_money_models where business_id=$1 limit 1`,
    [siteId],
  );
  const moneyProbe = moneyPurchaseRes.rows[0]?.document as
    | { purchases?: number; checkoutStarts?: number; revenueUsd?: number }
    | undefined;
  if (moneyProbe && typeof moneyProbe.purchases === "number") {
    purchases = moneyProbe.purchases;
  }
  if (moneyProbe && typeof moneyProbe.checkoutStarts === "number") {
    checkout_starts = moneyProbe.checkoutStarts;
  }

  // Authoritative purchase count from native Stripe persistence (when present).
  let revenueFromPurchases: number | null = null;
  try {
    const purchRes = await pool.query(
      `select count(*)::int as n, coalesce(sum(amount_cents),0)::bigint as cents
       from ros_purchases where business_id=$1`,
      [siteId],
    );
    if (purchRes.rows[0] && Number(purchRes.rows[0].n) > 0) {
      purchases = Number(purchRes.rows[0].n);
      revenueFromPurchases = Number(purchRes.rows[0].cents) / 100;
    }
  } catch {
    /* table may not exist yet on older cores */
  }

  const acqRes = await pool.query(
    `select status, count(*)::int as n from titan_acquisition_experiments
     where business_id=$1 group by status`,
    [siteId],
  );
  let acqAttempted = 0;
  let acqMeasured = 0;
  let acqFailed = 0;
  let acqPending = 0;
  for (const row of acqRes.rows) {
    const n = Number(row.n ?? 0);
    acqAttempted += n;
    const st = String(row.status ?? "");
    if (st === "MEASURED" || st === "SUCCESS") acqMeasured += n;
    else if (st === "FAILED") acqFailed += n;
    else acqPending += n;
  }

  const decRes = await pool.query(
    `select status, result, count(*)::int as n from titan_decision_experiments
     where business_id=$1 group by status, result`,
    [siteId],
  );
  for (const row of decRes.rows) {
    const n = Number(row.n ?? 0);
    if (String(row.result) === "FAIL" || String(row.status) === "FAILED") {
      acqFailed += n;
    } else if (String(row.status) === "MEASURED") {
      acqMeasured += n;
    }
  }

  const lessonRes = await pool.query(
    `select count(*)::int as n from titan_commercial_lessons
     where $1 = any(business_ids)`,
    [siteId],
  );

  const custRes = await pool.query(
    `select count(*)::int as n,
            max(coalesce((document->>'confidence')::numeric, 0.5)) as conf
     from titan_customer_models where business_id=$1`,
    [siteId],
  );
  const custN = Number(custRes.rows[0]?.n ?? 0);
  const customer_model_strength: Unknownable =
    custN > 0 ? Number(custRes.rows[0]?.conf ?? 0.5) : "UNKNOWN";

  const moneyRes = await pool.query(
    `select document from titan_business_money_models where business_id=$1
     order by updated_at desc nulls last limit 1`,
    [siteId],
  );
  const moneyDoc = moneyRes.rows[0]?.document as
    | { judgment?: string; pricingUsd?: number; pathTo10k?: string }
    | undefined;
  const money_model_judgment = moneyDoc?.judgment
    ? String(moneyDoc.judgment)
    : "UNKNOWN";
  const pricing = numOrUnknown(moneyDoc?.pricingUsd);

  const marketRes = await pool.query(
    `select coalesce((document->>'confidence')::numeric, null) as confidence
     from titan_market_models
     where document->>'businessId'=$1 or id like $2
     order by updated_at desc nulls last limit 1`,
    [siteId, `%${siteId}%`],
  );
  const market_confidence = numOrUnknown(
    marketRes.rows[0]?.confidence != null
      ? Number(marketRes.rows[0].confidence)
      : undefined,
  );

  const evoRes = await pool.query(
    `select value from ros_config_meta where key='code_evolution_receipts'`,
  );
  const evoDoc = (evoRes.rows[0]?.value ?? { receipts: [] }) as {
    receipts?: Array<{ siteId?: string }>;
  };
  const code_evolution_attempts = (evoDoc.receipts ?? []).filter(
    (r) => r.siteId === siteId,
  ).length;

  const challengeRes = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [FITNESS_CHALLENGE_KEY],
  );
  const challengeDoc = (challengeRes.rows[0]?.value ?? { bySite: {} }) as {
    bySite?: Record<
      string,
      { repairAttempts?: number; pivotAttempts?: number }
    >;
  };
  const ch = challengeDoc.bySite?.[siteId] ?? {};

  return {
    business_id: siteId,
    version: FITNESS_VERSION,
    age_days,
    commercial_ready,
    public_reachability,
    offer_quality,
    buyer_path_health,
    checkout_health,
    traffic,
    qualified_visits,
    search_impressions: "UNKNOWN",
    search_clicks: "UNKNOWN",
    organic_distribution_actions: acqAttempted > 0 ? acqAttempted : "UNKNOWN",
    outreach_results: "UNKNOWN",
    leads: "UNKNOWN",
    checkout_starts,
    purchases,
    revenue:
      revenueFromPurchases != null
        ? revenueFromPurchases
        : typeof moneyProbe?.revenueUsd === "number"
          ? moneyProbe.revenueUsd
          : known(purchases) && purchases === 0
            ? 0
            : "UNKNOWN",
    conversion_rate: "UNKNOWN",
    pricing,
    customer_model_strength,
    money_model_judgment,
    market_confidence,
    acquisition_experiments_attempted: acqAttempted,
    experiment_outcomes: {
      measured: acqMeasured,
      failed: acqFailed,
      pending: acqPending,
    },
    commercial_lessons: Number(lessonRes.rows[0]?.n ?? 0),
    repair_attempts: Number(ch.repairAttempts ?? 0),
    pivot_attempts: Number(ch.pivotAttempts ?? 0),
    code_evolution_attempts,
    last_evaluated_at: new Date().toISOString(),
  };
}

export function judgeFitness(
  signals: Awaited<ReturnType<typeof loadBusinessFitnessSignals>>,
  input?: {
    strongerOpportunityScore?: number | null;
    ownOpportunityScore?: number | null;
  },
): BusinessFitnessRecord {
  const evidence: string[] = [];
  let bottleneck: string | null = null;
  let state: FitnessState = "UNPROVEN";
  let confidence = 55;
  let path: BusinessFitnessRecord["path_to_10k_day"] = "UNKNOWN";

  const implBroken =
    signals.commercial_ready === false ||
    signals.public_reachability === false ||
    signals.offer_quality === "fail" ||
    signals.buyer_path_health === "fail" ||
    signals.checkout_health === "fail";

  if (implBroken) {
    state = "REPAIR_REQUIRED";
    bottleneck = "implementation_or_buyer_path";
    evidence.push("commercial_gate_or_path_unhealthy");
    confidence = 40;
  }

  const purchasesKnown = known(signals.purchases);
  const hasPurchase = purchasesKnown && signals.purchases > 0;
  const ageKnown = known(signals.age_days);
  const mature = ageKnown && signals.age_days >= 14;
  const experiments =
    signals.acquisition_experiments_attempted +
    signals.code_evolution_attempts +
    signals.commercial_lessons;

  if (hasPurchase) {
    state = signals.purchases! >= 3 ? "HEALTHY" : "PROMISING";
    evidence.push(`purchases=${signals.purchases}`);
    confidence = 78;
    path = "credible";
  } else if (!implBroken) {
    if (
      mature &&
      experiments >= 4 &&
      known(signals.checkout_starts) &&
      signals.checkout_starts === 0 &&
      known(signals.traffic) === false
    ) {
      // Mature, experimented, no checkouts, no known traffic — weak demand signal
      state = "PIVOT_CANDIDATE";
      bottleneck = "demand_or_positioning";
      evidence.push("mature_no_checkout_no_traffic_signal");
      confidence = 48;
      path = "weak";
    } else if (mature && experiments >= 8 && purchasesKnown && signals.purchases === 0) {
      state = "RETIREMENT_CANDIDATE";
      bottleneck = "opportunity_quality";
      evidence.push("mature_many_experiments_zero_purchases");
      confidence = 42;
      path = "weak";
    } else if (
      signals.acquisition_experiments_attempted >= 2 ||
      signals.code_evolution_attempts >= 1 ||
      (known(signals.traffic) && signals.traffic > 0)
    ) {
      state = "PROMISING";
      evidence.push("learning_velocity_present");
      confidence = 62;
      path = "credible";
    } else {
      state = "UNPROVEN";
      evidence.push("insufficient_commercial_evidence");
      confidence = 58;
      path = "UNKNOWN";
    }
  }

  // Opportunity cost — only escalate to retirement when a much stronger opp exists
  // AND the business is already weak, not merely young/unproven.
  const stronger = input?.strongerOpportunityScore;
  const own = input?.ownOpportunityScore ?? 50;
  if (
    typeof stronger === "number" &&
    stronger >= own + 18 &&
    (state === "RETIREMENT_CANDIDATE" ||
      state === "PIVOT_CANDIDATE" ||
      (state === "REPAIR_REQUIRED" && signals.repair_attempts >= 3))
  ) {
    if (state !== "ECONOMICALLY_FAILED") {
      state = "RETIREMENT_CANDIDATE";
      evidence.push(
        `opportunity_cost:stronger=${stronger}_own=${own}`,
      );
      bottleneck = bottleneck ?? "opportunity_cost";
      confidence = Math.min(confidence, 45);
    }
  }

  // Bounded repair exhaustion → economic failure
  if (
    state === "REPAIR_REQUIRED" &&
    signals.repair_attempts >= 4 &&
    signals.pivot_attempts >= 1 &&
    mature
  ) {
    state = "ECONOMICALLY_FAILED";
    evidence.push("repair_and_pivot_exhausted");
    confidence = 35;
    path = "implausible";
  }

  if (
    state === "RETIREMENT_CANDIDATE" &&
    signals.pivot_attempts >= 1 &&
    signals.repair_attempts >= 2 &&
    mature &&
    purchasesKnown &&
    signals.purchases === 0 &&
    experiments >= 10
  ) {
    state = "ECONOMICALLY_FAILED";
    evidence.push("repeated_failure_with_opportunity_doubt");
    path = "implausible";
  }

  const recent_trend: BusinessFitnessRecord["recent_trend"] =
    hasPurchase
      ? "improving"
      : signals.experiment_outcomes.failed >
          signals.experiment_outcomes.measured
        ? "worsening"
        : experiments > 0
          ? "flat"
          : "UNKNOWN";

  const resource_cost: BusinessFitnessRecord["resource_cost"] =
    signals.repair_attempts >= 3 || signals.code_evolution_attempts >= 3
      ? "high"
      : experiments >= 3
        ? "medium"
        : "low";

  return {
    ...signals,
    recent_trend,
    resource_cost,
    titan_confidence: confidence,
    path_to_10k_day: path,
    fitness_state: state,
    bottleneck,
    evidence,
  };
}

export async function evaluateBusinessFitness(
  pool: pg.Pool,
  siteId: string,
  opts?: {
    strongerOpportunityScore?: number | null;
    ownOpportunityScore?: number | null;
  },
): Promise<BusinessFitnessRecord> {
  const signals = await loadBusinessFitnessSignals(pool, siteId);
  return judgeFitness(signals, opts);
}

export async function persistFitnessSnapshots(
  pool: pg.Pool,
  records: BusinessFitnessRecord[],
): Promise<void> {
  const byId: Record<string, BusinessFitnessRecord> = {};
  for (const r of records) byId[r.business_id] = r;
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'ACCEPTED_FITNESS')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='ACCEPTED_FITNESS'`,
    [
      FITNESS_SNAPSHOTS_KEY,
      JSON.stringify({
        version: FITNESS_VERSION,
        updatedAt: new Date().toISOString(),
        bySite: byId,
        summary: summarizeFitness(records),
      }),
    ],
  );
}

export function summarizeFitness(records: BusinessFitnessRecord[]): Record<
  FitnessState,
  number
> {
  const out: Record<FitnessState, number> = {
    HEALTHY: 0,
    PROMISING: 0,
    UNPROVEN: 0,
    REPAIR_REQUIRED: 0,
    PIVOT_CANDIDATE: 0,
    RETIREMENT_CANDIDATE: 0,
    ECONOMICALLY_FAILED: 0,
  };
  for (const r of records) out[r.fitness_state] += 1;
  return out;
}

/** Architect-cycle telemetry: use known numbers; never invent purchases as 0 when unknown. */
export function fitnessToArchitectTelemetry(r: BusinessFitnessRecord): {
  siteId: string;
  purchases: number;
  revenueUsd: number;
  landingViews: number;
  checkoutStarts: number;
  ageDays: number;
  experimentCount: number;
  ownerLocked: boolean;
  engineeringBlocked: boolean;
} {
  return {
    siteId: r.business_id,
    // Only feed purchases when known; unknown → -1 sentinel so evaluateRetirement
    // (purchases === 0) cannot fire on ignorance. Age/experiments use known or 0 age with low experiments.
    purchases: known(r.purchases) ? r.purchases : -1,
    revenueUsd: known(r.revenue) ? r.revenue : 0,
    landingViews: known(r.traffic) ? r.traffic : 0,
    checkoutStarts: known(r.checkout_starts) ? r.checkout_starts : 0,
    ageDays: known(r.age_days) ? r.age_days : 0,
    experimentCount:
      r.acquisition_experiments_attempted +
      r.code_evolution_attempts +
      r.commercial_lessons,
    ownerLocked: false,
    engineeringBlocked: r.fitness_state === "REPAIR_REQUIRED",
  };
}
