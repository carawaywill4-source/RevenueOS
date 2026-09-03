/**
 * Economic remodel + selective soft-retire for replacement-grade businesses.
 * Does NOT mass-kill. Challenges seriously; pivots when EV high; retires when not.
 */

import type pg from "pg";
import { modelTenKPath } from "./mission.js";
import {
  planBusinessPivot,
  executeBusinessPivot,
  type PivotPlan,
} from "../business-pivot.js";
import {
  softRetireManagedBusinessPg,
  recordReplacementLineage,
} from "../portfolio-soft-retire-pg.js";
import { saveCommercialLesson } from "../titan-world-store.js";
import {
  evaluateBusinessFitness,
  FITNESS_CHALLENGE_KEY,
} from "../accepted-business-fitness.js";
import {
  loadAdmitCheckpoint,
  saveAdmitCheckpoint,
  TARGET_PORTFOLIO_DEFAULT,
} from "../portfolio-admit-controller.js";
import { selectReplacementOpportunity } from "../titan-admission-gate.js";

export type RemodelDecision =
  | "KEEP"
  | "UPGRADE_ECONOMICS"
  | "PIVOT"
  | "CHALLENGE"
  | "SOFT_RETIRE";

export type RemodelPlan = {
  businessId: string;
  currentPrice: number | null;
  purchasesPerDayNeeded: number;
  pathPlausible: boolean;
  whyFail: string;
  remodelOptions: Array<{
    model: string;
    priceUsd: number;
    purchasesPerDay: number;
    plausible: boolean;
    note: string;
  }>;
  decision: RemodelDecision;
  expectedValueRepair: number;
  expectedValueReplace: number;
  reason: string;
};

function remodelOptionsFor(price: number | null): RemodelPlan["remodelOptions"] {
  const candidates = [
    { model: "higher_one_shot", priceUsd: Math.max(149, (price ?? 49) * 3) },
    { model: "b2b_monthly", priceUsd: 299 },
    { model: "team_plan_monthly", priceUsd: 199 },
    { model: "implementation_service", priceUsd: 1500 },
    { model: "usage_tier_monthly", priceUsd: 99 },
  ];
  return candidates.map((c) => {
    const path = modelTenKPath(c.priceUsd);
    // Recurring: treat monthly as ~1/20 of daily need conceptually for plausibility
    const recurringBoost = /monthly|service/i.test(c.model);
    const purchasesPerDay = recurringBoost
      ? Math.ceil(path.purchasesPerDay / 20)
      : path.purchasesPerDay;
    const plausible = recurringBoost
      ? purchasesPerDay <= 40
      : path.plausible;
    return {
      model: c.model,
      priceUsd: c.priceUsd,
      purchasesPerDay,
      plausible,
      note: recurringBoost
        ? `${c.model}: ~${purchasesPerDay} new subs/day equivalent for $10k/day`
        : path.note,
    };
  });
}

export async function planEconomicRemodel(
  pool: pg.Pool,
  businessId: string,
): Promise<RemodelPlan> {
  const res = await pool.query(
    `select price_usd, document, commercial_pressure, acquisition_state,
            primary_bottleneck
     from titan_business_commercial_missions where business_id=$1`,
    [businessId],
  );
  const price =
    res.rows[0]?.price_usd != null ? Number(res.rows[0].price_usd) : null;
  const path = modelTenKPath(price);
  const options = remodelOptionsFor(price);
  const best = options.find((o) => o.plausible) ?? options[0]!;

  const na = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true`,
    [businessId],
  );
  const exposed = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where business_id=$1 and status in ('EXPOSED','PUBLISHED')`,
    [businessId],
  );
  const naN = Number(na.rows[0]?.n ?? 0);
  const expN = Number(exposed.rows[0]?.n ?? 0);

  let decision: RemodelDecision = "KEEP";
  let reason = "path still being tested";
  let evRepair = 0.4;
  let evReplace = 0.5;

  if (!path.plausible) {
    if (best.plausible) {
      decision = "UPGRADE_ECONOMICS";
      reason = `one-shot $${price} needs ${path.purchasesPerDay}/day; ${best.model} @ $${best.priceUsd} is more credible`;
      evRepair = 0.7;
      evReplace = 0.55;
    } else if (naN >= 2 && expN === 0) {
      decision = "SOFT_RETIRE";
      reason =
        "implausible economics + multiple new-audience attempts + zero exposure; remodel options still extreme";
      evRepair = 0.25;
      evReplace = 0.75;
    } else {
      decision = "PIVOT";
      reason = "try B2B/recurring thesis before retirement";
      evRepair = 0.55;
      evReplace = 0.6;
    }
  } else if (naN >= 3 && expN === 0) {
    decision = "CHALLENGE";
    reason = "credible math but zero exposure after varied attempts";
    evRepair = 0.5;
    evReplace = 0.55;
  }

  return {
    businessId,
    currentPrice: price,
    purchasesPerDayNeeded: path.purchasesPerDay,
    pathPlausible: path.plausible,
    whyFail: path.plausible
      ? "economics ok; acquisition unproven"
      : `At $${price}, need ${path.purchasesPerDay} sales/day for $10k`,
    remodelOptions: options,
    decision,
    expectedValueRepair: evRepair,
    expectedValueReplace: evReplace,
    reason,
  };
}

async function persistRemodelDecision(
  pool: pg.Pool,
  plan: RemodelPlan,
): Promise<void> {
  const res = await pool.query(
    `select value from ros_config_meta where key='economic_remodel_decisions'`,
  );
  const doc = (res.rows[0]?.value ?? { bySite: {} }) as {
    bySite?: Record<string, RemodelPlan & { updatedAt?: string }>;
  };
  const bySite = { ...(doc.bySite ?? {}) };
  bySite[plan.businessId] = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('economic_remodel_decisions', $1::jsonb, now(), 'COMMERCIAL_EXECUTIVE')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [JSON.stringify({ updatedAt: new Date().toISOString(), bySite })],
  );

  // Feed challenge state
  const ch = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [FITNESS_CHALLENGE_KEY],
  );
  const cdoc = (ch.rows[0]?.value ?? { bySite: {} }) as {
    bySite?: Record<string, Record<string, unknown>>;
  };
  const by = { ...(cdoc.bySite ?? {}) };
  by[plan.businessId] = {
    ...(by[plan.businessId] ?? {}),
    remodelDecision: plan.decision,
    remodelReason: plan.reason,
    remodelEvRepair: plan.expectedValueRepair,
    remodelEvReplace: plan.expectedValueReplace,
    flaggedAt: new Date().toISOString(),
    flaggedBy: "economic_remodel_v1",
  };
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'COMMERCIAL_EXECUTIVE')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [FITNESS_CHALLENGE_KEY, JSON.stringify({ ...cdoc, bySite: by })],
  );
}

function economicPivotPlan(siteId: string, option: RemodelPlan["remodelOptions"][0]): PivotPlan {
  const base = planBusinessPivot(siteId);
  const recurring = /monthly|service/i.test(option.model);
  return {
    ...base,
    dimensions: ["price", "business_model", "buyer", "offer"],
    toThesis: {
      ...base.toThesis,
      priceUsd: option.priceUsd,
      businessModel: option.model,
      offer: recurring
        ? `B2B ${option.model.replace(/_/g, " ")} — recurring value, not a $29 dump`
        : `Higher-ticket outcome kit @ $${option.priceUsd}`,
      buyer: "budget-holding operator / team lead with recurring workflow pain",
    },
    hypothesis: `Remodel to ${option.model} @ $${option.priceUsd} restores credible $10k/day path (${option.note})`,
    expectedBenefit: "Portfolio economics no longer depend on absurd daily one-shot volume",
    invalidatedAssumptions: [
      "Low-ticket one-shot can reach $10k/day organically at current volume capacity",
      ...base.invalidatedAssumptions,
    ],
  };
}

/**
 * Persist systemic lesson: Forge/admission over-produced low-ticket one-shots.
 */
export async function persistPortfolioEconomicsLesson(
  pool: pg.Pool,
  stats: {
    replacementCandidates: number;
    managed: number;
  },
): Promise<string | null> {
  if (stats.replacementCandidates < 10) return null;
  const recent = await pool.query(
    `select 1 from titan_commercial_lessons
     where scope='portfolio_economics'
       and created_at > now() - interval '24 hours' limit 1`,
  );
  if (recent.rows[0]) return null;

  const lesson = await saveCommercialLesson(pool, {
    scope: "portfolio_economics",
    lesson:
      "SYSTEMIC: Large share of admitted businesses are low-ticket one-shot digital products whose $10k/day path requires extreme daily transaction volume. Prefer B2B recurring, higher ticket, team/agency plans, or clear high-LTV buyers unless extraordinary organic capacity is evidenced. Vacancy < bad admit.",
    businessIds: [],
    confidence: 0.88,
    evidence: [
      {
        replacementCandidates: stats.replacementCandidates,
        managed: stats.managed,
        ratio: stats.replacementCandidates / Math.max(1, stats.managed),
        at: new Date().toISOString(),
      },
    ],
  });

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('forge_admission_priors', $1::jsonb, now(), 'COMMERCIAL_EXECUTIVE')
     on conflict (key) do update set
       value = coalesce(ros_config_meta.value, '{}'::jsonb) || excluded.value,
       updated_at=now()`,
    [
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        penalizeLowTicketOneShot: true,
        minCrediblePriceUsd: 49,
        maxPurchasesPerDayForPlausible: 150,
        preferRecurringB2B: true,
        preferProductLedDistribution: true,
        vacancyPreferredOverWeakAdmit: true,
        lessonId: lesson,
        source: "portfolio_tournament_30_plus_weak",
      }),
    ],
  );
  return lesson;
}

export async function runEconomicRemodelPass(input: {
  pool: pg.Pool;
  appRoot: string;
  replacementCandidates: string[];
  logger: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
  /** CAE mode: remodel/upgrade OK, soft-retire/replace frozen */
  freezeSoftRetire?: boolean;
}): Promise<{
  planned: number;
  upgraded: number;
  pivoted: number;
  softRetired: number;
  lessonId: string | null;
}> {
  let planned = 0;
  let upgraded = 0;
  let pivoted = 0;
  let softRetired = 0;

  const lessonId = await persistPortfolioEconomicsLesson(input.pool, {
    replacementCandidates: input.replacementCandidates.length,
    managed: input.replacementCandidates.length, // approximate; caller may pass more context
  });

  // Cap actions per cycle — no mass kill
  const toPlan = input.replacementCandidates.slice(0, 12);
  const plans: RemodelPlan[] = [];
  for (const id of toPlan) {
    const plan = await planEconomicRemodel(input.pool, id);
    await persistRemodelDecision(input.pool, plan);
    plans.push(plan);
    planned++;
  }

  // Execute at most 2 economic pivots / upgrades per cycle
  const upgradeTargets = plans
    .filter((p) => p.decision === "UPGRADE_ECONOMICS" || p.decision === "PIVOT")
    .slice(0, 2);
  const rolledBack: string[] = [];
  for (const plan of upgradeTargets) {
    const opt =
      plan.remodelOptions.find((o) => o.plausible) ?? plan.remodelOptions[0]!;
    try {
      const pivotPlan = economicPivotPlan(plan.businessId, opt);
      const receipt = await executeBusinessPivot({
        pool: input.pool,
        appRoot: input.appRoot,
        siteId: plan.businessId,
        logger: input.logger,
        plan: pivotPlan,
      });
      if (receipt.result === "RETAINED" || receipt.result === "IN_PROGRESS") {
        if (plan.decision === "UPGRADE_ECONOMICS") upgraded++;
        else pivoted++;
      } else if (receipt.result === "ROLLED_BACK" || receipt.result === "FAILED") {
        rolledBack.push(plan.businessId);
      }
      input.logger("info", "economic.remodel.pivot", {
        businessId: plan.businessId,
        model: opt.model,
        price: opt.priceUsd,
        result: receipt.result,
      });
    } catch (e) {
      rolledBack.push(plan.businessId);
      input.logger("warn", "economic.remodel.pivot_failed", {
        businessId: plan.businessId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Soft-retire at most ONE: explicit SOFT_RETIRE OR remodel pivot rolled back with zero exposure
  let retireTarget =
    plans.find((p) => p.decision === "SOFT_RETIRE") ??
    (rolledBack.length
      ? {
          ...plans.find((p) => rolledBack.includes(p.businessId))!,
          decision: "SOFT_RETIRE" as RemodelDecision,
          reason: `economic_pivot_rolled_back_after_implausible_one_shot; ${
            plans.find((p) => rolledBack.includes(p.businessId))?.reason ?? ""
          }`,
          expectedValueRepair: 0.2,
          expectedValueReplace: 0.8,
        }
      : undefined);

  if (
    input.freezeSoftRetire &&
    retireTarget
  ) {
    input.logger("info", "economic.remodel.soft_retire_frozen", {
      businessId: retireTarget.businessId,
      reason: "CUSTOMER_ACQUISITION_EVOLUTION_MODE",
      note: "prove existing portfolio — no escape via replace",
    });
  } else if (
    !input.freezeSoftRetire &&
    retireTarget &&
    retireTarget.expectedValueReplace > retireTarget.expectedValueRepair + 0.15
  ) {
    const cp = await loadAdmitCheckpoint(
      input.pool,
      TARGET_PORTFOLIO_DEFAULT,
      15,
    );
    const managed = cp.titanManaged;
    const replacementOpp = selectReplacementOpportunity({
      rejectedSiteId: retireTarget.businessId,
      criteria: "economic_remodel_soft_retire",
      activeSiteIds: managed,
      activeIndustries: [],
      rejectedSiteIds: cp.rejected,
    });

    try {
      const fitness = await evaluateBusinessFitness(
        input.pool,
        retireTarget.businessId,
        {
          strongerOpportunityScore: replacementOpp?.score ?? 80,
          ownOpportunityScore: 35,
        },
      );
      // Evidence-backed override for remodel soft-retire path
      fitness.fitness_state = "ECONOMICALLY_FAILED";
      fitness.path_to_10k_day = "implausible";
      fitness.bottleneck = "unit_economics_implausible";
      fitness.evidence = [
        ...fitness.evidence,
        retireTarget.reason,
        "economic_remodel_v1_soft_retire",
      ];

      const retire = await softRetireManagedBusinessPg({
        pool: input.pool,
        siteId: retireTarget.businessId,
        fitness,
        reason: `economic_remodel:${retireTarget.reason}`.slice(0, 240),
        replacementOpportunityId: replacementOpp?.id ?? null,
        expectedValueKeep: retireTarget.expectedValueRepair * 100,
        expectedValueReplace:
          replacementOpp?.score ?? retireTarget.expectedValueReplace * 100,
        logger: input.logger,
      });
      if (retire.status === "SOFT_RETIRED") {
        softRetired++;
        // Stick the retirement against concurrent admit-lane checkpoint overwrites
        const cpSticky = await loadAdmitCheckpoint(
          input.pool,
          TARGET_PORTFOLIO_DEFAULT,
          15,
        );
        cpSticky.titanManaged = cpSticky.titanManaged.filter(
          (s) => s !== retireTarget.businessId,
        );
        cpSticky.accepted = cpSticky.accepted.filter(
          (s) => s !== retireTarget.businessId,
        );
        const soft = Array.isArray(cpSticky.softRetired)
          ? [...cpSticky.softRetired]
          : [];
        if (!soft.includes(retireTarget.businessId)) soft.push(retireTarget.businessId);
        cpSticky.softRetired = soft;
        if (replacementOpp) {
          if (!cpSticky.replacementQueue) cpSticky.replacementQueue = [];
          if (!cpSticky.replacementQueue.includes(replacementOpp.siteId)) {
            cpSticky.replacementQueue.push(replacementOpp.siteId);
          }
          await recordReplacementLineage(input.pool, {
            retiredBusiness: retireTarget.businessId,
            vacancyReason: retire.reason,
            opportunityId: replacementOpp.id,
            replacementSiteId: replacementOpp.siteId,
            origin: "ECONOMIC_REMODEL",
            status: "REPLACEMENT_QUEUED",
            detail: retireTarget.reason,
          });
        }
        cpSticky.vacantSlots = Math.max(
          0,
          cpSticky.targetPortfolio - cpSticky.titanManaged.length,
        );
        await saveAdmitCheckpoint(input.pool, cpSticky);
        input.logger("warn", "economic.remodel.soft_retired", {
          businessId: retireTarget.businessId,
          replacement: replacementOpp?.siteId ?? null,
          managedNow: cpSticky.titanManaged.length,
        });
      }
    } catch (e) {
      input.logger("warn", "economic.remodel.retire_failed", {
        businessId: retireTarget.businessId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { planned, upgraded, pivoted, softRetired, lessonId };
}
