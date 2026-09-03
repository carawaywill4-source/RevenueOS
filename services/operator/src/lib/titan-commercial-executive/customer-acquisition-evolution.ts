/**
 * CUSTOMER ACQUISITION EVOLUTION MODE
 *
 * Overriding objective: acquire real customers for the EXISTING portfolio.
 * Freeze net-new business creation. Evolve RevenueOS + existing sites.
 * Funnel causality: distribution before polish.
 */

import type pg from "pg";
import {
  ADMIT_CHECKPOINT_KEY,
  loadAdmitCheckpoint,
  saveAdmitCheckpoint,
  TARGET_PORTFOLIO_DEFAULT,
} from "../portfolio-admit-controller.js";
import { saveCommercialLesson } from "../titan-world-store.js";
import { recordCommercialProgress } from "./progress.js";
import { recordCommercialFailure } from "./failure-intelligence.js";
import { buildBuyerHabitat } from "../acquisitionos/buyer-habitat.js";

export const CAE_MODE_KEY = "customer_acquisition_evolution_mode";
export const CAE_MEMORY_KEY = "customer_acquisition_commercial_memory";
export const CAE_VERSION = "customer-acquisition-evolution-v1";

export type FunnelStage =
  | "STAGE_0_NO_VERIFIED_EXPOSURE"
  | "STAGE_1_EXPOSURE_NO_VISITORS"
  | "STAGE_2_VISITORS_NO_ENGAGEMENT"
  | "STAGE_3_ENGAGEMENT_NO_INTENT"
  | "STAGE_4_INTENT_NO_CHECKOUT"
  | "STAGE_5_CHECKOUT_NO_PURCHASE"
  | "STAGE_6_CUSTOMER";

export type CaeModeDoc = {
  enabled: boolean;
  version: string;
  objective: string;
  freezeNetNewBusinesses: boolean;
  freezePortfolioExpansion: boolean;
  freezeSoftRetireReplace: boolean;
  allowSiteEvolution: boolean;
  allowRevenueOsSelfEvolution: boolean;
  allowAcquisitionAssets: boolean;
  prioritizeDistribution: boolean;
  economyMode: boolean;
  allowPaidAds: boolean;
  allowPaidAi: boolean;
  activatedAt: string;
  updatedAt: string;
  scoreboard: string[];
};

export type ScientistExperiment = {
  id: string;
  businessId: string;
  stage: FunnelStage;
  hypothesis: string;
  actionKind:
    | "research_buyer_channels"
    | "distribution_bet"
    | "message_rotate"
    | "acquisition_asset"
    | "site_relevance_evolve"
    | "offer_evolve"
    | "conversion_path_repair"
    | "checkout_friction_inspect"
    | "replicate_customer";
  primaryFix: string;
  allowSiteChange: boolean;
  createdAt: string;
};

const DEFAULT_MODE: CaeModeDoc = {
  enabled: true,
  version: CAE_VERSION,
  objective: "ACQUIRE_REAL_CUSTOMERS",
  freezeNetNewBusinesses: true,
  freezePortfolioExpansion: true,
  freezeSoftRetireReplace: true,
  allowSiteEvolution: true,
  allowRevenueOsSelfEvolution: true,
  allowAcquisitionAssets: true,
  prioritizeDistribution: true,
  economyMode: true,
  allowPaidAds: false,
  allowPaidAi: false,
  activatedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  scoreboard: [
    "verified_third_party_exposure",
    "verified_external_human",
    "engagement",
    "commercial_intent",
    "checkout",
    "first_customer",
    "second_customer",
    "repeatable_acquisition",
  ],
};

export async function loadCaeMode(pool: pg.Pool): Promise<CaeModeDoc | null> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1`,
    [CAE_MODE_KEY],
  );
  const v = res.rows[0]?.value;
  if (!v || typeof v !== "object") return null;
  return v as CaeModeDoc;
}

export async function isCaeModeEnabled(pool: pg.Pool): Promise<boolean> {
  const m = await loadCaeMode(pool);
  return Boolean(m?.enabled);
}

/** Persist mode + freeze admit checkpoint. Idempotent. */
export async function ensureCustomerAcquisitionEvolutionMode(
  pool: pg.Pool,
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void,
): Promise<CaeModeDoc> {
  const now = new Date().toISOString();
  const prior = await loadCaeMode(pool);
  const doc: CaeModeDoc = {
    ...DEFAULT_MODE,
    ...(prior ?? {}),
    enabled: true,
    version: CAE_VERSION,
    freezeNetNewBusinesses: true,
    freezePortfolioExpansion: true,
    freezeSoftRetireReplace: false,
    allowPaidAds: false,
    allowPaidAi: false,
    activatedAt: prior?.activatedAt ?? now,
    updatedAt: now,
  };

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'CAE_MODE')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CAE_MODE'`,
    [CAE_MODE_KEY, JSON.stringify(doc)],
  );

  // Hard freeze admissions / replacement chase
  const cp = await loadAdmitCheckpoint(pool, TARGET_PORTFOLIO_DEFAULT, 15);
  const managed = cp.titanManaged?.length ?? 0;
  const target = cp.targetPortfolio ?? TARGET_PORTFOLIO_DEFAULT;
  cp.pauseNewAdmissions = managed >= target;
  cp.pauseNewAdmissionsReason = cp.pauseNewAdmissions
    ? "CUSTOMER_ACQUISITION_EVOLUTION_MODE:portfolio_full"
    : "vacancy_open_replacement_allowed";
  cp.phase = "PORTFOLIO_BUILD_COMPLETE";
  cp.notes = [
    ...(cp.notes ?? []).slice(-30),
    `cae_mode_freeze:${now}`,
  ];
  await saveAdmitCheckpoint(pool, cp);

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('forge_admission_priors', $1::jsonb, now(), 'CAE_MODE')
     on conflict (key) do update set
       value = coalesce(ros_config_meta.value, '{}'::jsonb) || excluded.value,
       updated_at=now()`,
    [
      JSON.stringify({
        stopCreatingNewBusinesses: true,
        freezePortfolioExpansion: true,
        customerAcquisitionEvolution: true,
        vacancyPreferredOverWeakAdmit: true,
        updatedAt: now,
        source: CAE_VERSION,
      }),
    ],
  );

  // Commercial memory bootstrap lesson
  const recent = await pool.query(
    `select 1 from titan_commercial_lessons
     where scope='customer_acquisition_evolution'
       and created_at > now() - interval '12 hours' limit 1`,
  );
  if (!recent.rows[0]) {
    await saveCommercialLesson(pool, {
      scope: "customer_acquisition_evolution",
      lesson:
        "MODE: Freeze net-new businesses. Optimize for verified third-party exposure → external humans → engagement → intent → checkout → first customer. Do not polish sites with zero verified exposure. Failure must change hypothesis/channel/message/offer/site/capability — never infinite identical repeats.",
      businessIds: cp.titanManaged.slice(0, 20),
      confidence: 0.95,
      evidence: [
        {
          mode: CAE_VERSION,
          managed: cp.titanManaged.length,
          at: now,
        },
      ],
    });
  }

  logger?.("info", "cae.mode.ensured", {
    version: CAE_VERSION,
    managed: cp.titanManaged.length,
    freeze: true,
  });
  return doc;
}

export async function computeFunnelStage(
  pool: pg.Pool,
  businessId: string,
): Promise<{
  stage: FunnelStage;
  primaryProblem: string;
  nextAction: string;
  allowSiteChange: boolean;
  metrics: Record<string, number>;
}> {
  const exposure = await pool.query(
    `select
       count(*) filter (where status in ('PUBLISHED','EXPOSURE_CONFIRMED','EXPOSED') and is_new_audience=true)::int as pub,
       count(*) filter (where status='DESTINATION_REACHABLE' and is_new_audience=true)::int as reachable,
       count(*) filter (where is_new_audience=true)::int as attempts
     from aq_distribution_receipts
     where business_id=$1 and created_at > now() - interval '30 days'`,
    [businessId],
  );
  const pub = Number(exposure.rows[0]?.pub ?? 0);
  const attempts = Number(exposure.rows[0]?.attempts ?? 0);

  const traffic = await pool.query(
    `select
       count(*) filter (
         where class in ('LIKELY_HUMAN','QUALIFIED')
           and coalesce(referer,'') <> ''
           and referer not ilike '%sslip.io%'
           and referer not ilike '%130.131.15.68%'
       )::int as external_human,
       count(*) filter (where class='QUALIFIED' or qualified=true)::int as engaged,
       count(*) filter (
         where (meta->>'intent') is not null
            or path ilike '%checkout%'
            or path ilike '%pricing%'
       )::int as intentish
     from ros_traffic_events
     where business_id=$1 and created_at > now() - interval '30 days'`,
    [businessId],
  );
  const externalHuman = Number(traffic.rows[0]?.external_human ?? 0);
  const engaged = Number(traffic.rows[0]?.engaged ?? 0);
  const intentish = Number(traffic.rows[0]?.intentish ?? 0);

  const checkout = await pool.query(
    `select count(*)::int as n from ros_events
     where site_id=$1 and created_at > now() - interval '30 days'
       and (event_type ilike '%checkout%' or detail::text ilike '%checkout.session%')`,
    [businessId],
  ).catch(() => ({ rows: [{ n: 0 }] }));
  const checkouts = Number(checkout.rows[0]?.n ?? 0);

  const purchases = await pool.query(
    `select count(*)::int as n from ros_purchases
     where business_id=$1
       and stripe_session_id not like 'cs_test_%'
       and coalesce(meta->>'payment_status','paid') <> 'unpaid'`,
    [businessId],
  ).catch(() => ({ rows: [{ n: 0 }] }));
  const customers = Number(purchases.rows[0]?.n ?? 0);

  const metrics = {
    verifiedExposure: pub,
    attempts,
    externalHuman,
    engaged,
    intentish,
    checkouts,
    customers,
  };

  if (customers > 0) {
    return {
      stage: "STAGE_6_CUSTOMER",
      primaryProblem: "replicate_acquisition",
      nextAction: "trace_and_replicate_winning_path",
      allowSiteChange: true,
      metrics,
    };
  }
  if (checkouts > 0) {
    return {
      stage: "STAGE_5_CHECKOUT_NO_PURCHASE",
      primaryProblem: "purchase_decision",
      nextAction: "inspect_price_trust_payment_friction",
      allowSiteChange: true,
      metrics,
    };
  }
  if (intentish > 0 && externalHuman > 0) {
    return {
      stage: "STAGE_4_INTENT_NO_CHECKOUT",
      primaryProblem: "conversion_path",
      nextAction: "repair_cta_pricing_clarity_checkout_path",
      allowSiteChange: true,
      metrics,
    };
  }
  if (engaged > 0 || (externalHuman > 0 && intentish === 0 && engaged === 0)) {
    // visitors with weak engagement → stage 2; engaged without intent → stage 3
    if (engaged > 0 && intentish === 0) {
      return {
        stage: "STAGE_3_ENGAGEMENT_NO_INTENT",
        primaryProblem: "offer",
        nextAction: "evolve_value_prop_demo_pricing",
        allowSiteChange: true,
        metrics,
      };
    }
    if (externalHuman > 0) {
      return {
        stage: "STAGE_2_VISITORS_NO_ENGAGEMENT",
        primaryProblem: "site_relevance_trust_experience",
        nextAction: "evolve_landing_relevance",
        allowSiteChange: true,
        metrics,
      };
    }
  }
  if (pub > 0 && externalHuman === 0) {
    return {
      stage: "STAGE_1_EXPOSURE_NO_VISITORS",
      primaryProblem: "message_targeting_placement",
      nextAction: "rotate_pitch_audience_channel",
      allowSiteChange: false,
      metrics,
    };
  }
  return {
    stage: "STAGE_0_NO_VERIFIED_EXPOSURE",
    primaryProblem: "distribution",
    nextAction: "research_audiences_and_execute_verified_distribution",
    // Acquisition assets OK at stage 0 when research demands; homepage polish is not.
    allowSiteChange: false,
    metrics,
  };
}

export async function designScientistExperiment(
  pool: pg.Pool,
  businessId: string,
): Promise<ScientistExperiment> {
  const stageInfo = await computeFunnelStage(pool, businessId);
  const habitat = buildBuyerHabitat(businessId);
  const id = `cae_exp_${Date.now().toString(36)}_${businessId.slice(0, 8)}`;

  let actionKind: ScientistExperiment["actionKind"] = "distribution_bet";
  let hypothesis = "";
  let primaryFix = stageInfo.primaryProblem;

  switch (stageInfo.stage) {
    case "STAGE_0_NO_VERIFIED_EXPOSURE":
      actionKind =
        stageInfo.metrics.attempts > 20
          ? "research_buyer_channels"
          : "distribution_bet";
      hypothesis = `Buyers for "${habitat.problem}" congregate on undiscovered free surfaces; verified third-party publish is the bottleneck (not site polish).`;
      if (habitat.searchQueries[0] && stageInfo.metrics.attempts > 40) {
        actionKind = "acquisition_asset";
        hypothesis = `A free ${habitat.searchQueries[0]} utility may earn legitimate links/shares where cold form pitches failed.`;
      }
      break;
    case "STAGE_1_EXPOSURE_NO_VISITORS":
      actionKind = "message_rotate";
      hypothesis =
        "Placement exists but hook/audience mismatch — rotate message and channel family before touching the site.";
      break;
    case "STAGE_2_VISITORS_NO_ENGAGEMENT":
      actionKind = "site_relevance_evolve";
      hypothesis =
        "External humans arrive but bounce — landing relevance/trust is the bottleneck.";
      break;
    case "STAGE_3_ENGAGEMENT_NO_INTENT":
      actionKind = "offer_evolve";
      hypothesis =
        "Engagement without commercial intent — offer/value demonstration is weak.";
      break;
    case "STAGE_4_INTENT_NO_CHECKOUT":
      actionKind = "conversion_path_repair";
      hypothesis =
        "Intent without checkout — CTA/pricing clarity/funnel friction.";
      break;
    case "STAGE_5_CHECKOUT_NO_PURCHASE":
      actionKind = "checkout_friction_inspect";
      hypothesis =
        "Checkout starts without purchase — price/trust/payment friction.";
      break;
    case "STAGE_6_CUSTOMER":
      actionKind = "replicate_customer";
      hypothesis =
        "A real customer exists — reverse the winning path and replicate.";
      break;
  }

  const exp: ScientistExperiment = {
    id,
    businessId,
    stage: stageInfo.stage,
    hypothesis,
    actionKind,
    primaryFix,
    allowSiteChange:
      stageInfo.allowSiteChange || actionKind === "acquisition_asset",
    createdAt: new Date().toISOString(),
  };

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'CAE_SCIENTIST')
     on conflict (key) do update set
       value = jsonb_build_object(
         'updatedAt', now(),
         'active', $2::jsonb,
         'history', coalesce(ros_config_meta.value->'history','[]'::jsonb) || jsonb_build_array($2::jsonb)
       ),
       updated_at=now()`,
    [`cae_active_experiment:${businessId}`, JSON.stringify(exp)],
  );

  return exp;
}

/** Persist stage snapshot + active hypothesis for war-room businesses. */
export async function runCaeScientistPass(input: {
  pool: pg.Pool;
  businessIds: string[];
  logger: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<{
  experiments: ScientistExperiment[];
  stageCounts: Record<string, number>;
  siteEvolutionsAllowed: number;
  distributionPriority: number;
}> {
  const experiments: ScientistExperiment[] = [];
  const stageCounts: Record<string, number> = {};
  let siteEvolutionsAllowed = 0;
  let distributionPriority = 0;

  for (const businessId of input.businessIds) {
    const stage = await computeFunnelStage(input.pool, businessId);
    stageCounts[stage.stage] = (stageCounts[stage.stage] ?? 0) + 1;
    if (
      stage.stage === "STAGE_0_NO_VERIFIED_EXPOSURE" ||
      stage.stage === "STAGE_1_EXPOSURE_NO_VISITORS"
    ) {
      distributionPriority++;
    }
    if (stage.allowSiteChange) siteEvolutionsAllowed++;

    const exp = await designScientistExperiment(input.pool, businessId);

    // If acquisition_asset selected, BUILD it — hypothesis without Forge is theater
    if (exp.actionKind === "acquisition_asset") {
      try {
        const { executeAcquisitionAsset } = await import(
          "./acquisition-asset-executor.js"
        );
        const built = await executeAcquisitionAsset({
          pool: input.pool,
          businessId,
          hypothesis: exp.hypothesis,
          logger: input.logger,
        });
        if (built.alreadyPresent) {
          // Suppress endless re-hypothesis; pivot scientist to distribution of the utility
          exp.actionKind = "distribution_bet";
          exp.hypothesis = `Free utility live at ${built.publicUrl} — place on third-party surfaces and verify publication (owned utility alone is STAGE_0).`;
          exp.allowSiteChange = false;
          await input.pool.query(
            `insert into ros_config_meta (key, value, updated_at, provenance)
             values ($1,$2::jsonb,now(),'CAE_SCIENTIST')
             on conflict (key) do update set
               value = jsonb_set(coalesce(ros_config_meta.value,'{}'::jsonb), '{active}', $2::jsonb),
               updated_at=now()`,
            [`cae_active_experiment:${businessId}`, JSON.stringify(exp)],
          );
        }
      } catch (e) {
        input.logger("warn", "cae.acquisition_asset.exec_failed", {
          businessId,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    experiments.push(exp);

    await input.pool.query(
      `update titan_business_commercial_missions set
         funnel_rung=$2,
         primary_bottleneck=$3,
         next_action=$4,
         document = coalesce(document,'{}'::jsonb) || $5::jsonb,
         updated_at=now()
       where business_id=$1`,
      [
        businessId,
        stage.stage,
        stage.primaryProblem,
        stage.nextAction,
        JSON.stringify({
          cae: {
            version: CAE_VERSION,
            stage: stage.stage,
            metrics: stage.metrics,
            experiment: exp,
            at: new Date().toISOString(),
          },
        }),
      ],
    );

    await recordCommercialProgress(input.pool, {
      businessId,
      eventKind: "validated_channel_learning",
      isNewAudience: false,
      detail: `${exp.stage}:${exp.actionKind}`,
      meta: exp as unknown as Record<string, unknown>,
    }).catch(() => undefined);

    input.logger("info", "cae.scientist.experiment", {
      businessId,
      stage: exp.stage,
      actionKind: exp.actionKind,
      allowSiteChange: exp.allowSiteChange,
      hypothesis: exp.hypothesis.slice(0, 160),
    });
  }

  // Durable memory rollup
  await input.pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'CAE_MEMORY')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [
      CAE_MEMORY_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        version: CAE_VERSION,
        stageCounts,
        activeExperiments: experiments.map((e) => ({
          businessId: e.businessId,
          stage: e.stage,
          actionKind: e.actionKind,
          hypothesis: e.hypothesis,
        })),
        principle:
          "No verified exposure → distribution first. Do not rewrite homepages to invent traffic.",
      }),
    ],
  );

  return {
    experiments,
    stageCounts,
    siteEvolutionsAllowed,
    distributionPriority,
  };
}

export async function shouldAllowSiteEvolution(
  pool: pg.Pool,
  businessId: string,
): Promise<{ allow: boolean; reason: string; stage: FunnelStage }> {
  const mode = await loadCaeMode(pool);
  if (!mode?.enabled) {
    return {
      allow: true,
      reason: "cae_mode_off",
      stage: "STAGE_0_NO_VERIFIED_EXPOSURE",
    };
  }
  const stage = await computeFunnelStage(pool, businessId);
  if (stage.allowSiteChange) {
    return { allow: true, reason: `funnel_${stage.stage}`, stage: stage.stage };
  }
  // Stage 0/1: only acquisition assets with research demand, not random homepage rewrites
  const exp = await pool.query(
    `select value->'active' as active from ros_config_meta where key=$1`,
    [`cae_active_experiment:${businessId}`],
  );
  const active = exp.rows[0]?.active as ScientistExperiment | undefined;
  // Stage 0/1 acquisition_asset must NOT unlock generic homepage polish.
  // Free utilities are built by acquisition-asset-executor, not code-evolution CTA/FAQ mutations.
  if (active?.actionKind === "acquisition_asset") {
    return {
      allow: false,
      reason: "acquisition_asset_uses_utility_executor_not_polish",
      stage: stage.stage,
    };
  }
  await recordCommercialFailure(pool, {
    businessId,
    strategyKey: "site_polish_without_exposure",
    rootCauseHypothesis: "WRONG_FUNNEL_STAGE_INTERVENTION",
    evidence: { stage },
    lesson:
      "Homepage/site polish with STAGE_0/1 teaches almost nothing — solve verified distribution first",
    nextDifferentAction: "research_and_verified_third_party_distribution",
  }).catch(() => undefined);
  return {
    allow: false,
    reason: "blocked_polish_without_exposure",
    stage: stage.stage,
  };
}

export { ADMIT_CHECKPOINT_KEY };
