/**
 * ULTRON — first unknown task.
 *
 * Objective (fixed by owner, chosen strategy by RevenueOS):
 *   "Obtain the first legitimate third-party audience exposure for one
 *    existing frontier business. You may research, acquire permitted
 *    accounts, build capabilities, modify the business, use permitted
 *    browser/API/email operations, and modify RevenueOS itself. Do not
 *    ask the owner unless genuine owner authority is required."
 *
 * RevenueOS chooses: business, audience, strategy, capabilities,
 * engineering, execution. This loop is intentionally thin — its job is
 * to (1) generate competing candidate plans, (2) run the critic,
 * (3) commit to one path via the capability compiler, (4) invoke the
 * real executor from the skill library, and (5) reflect + write the
 * learning back into the world model + skills.
 */

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type {
  EconomicProofLevel,
  Logger,
} from "./types.js";
import { compileCapability } from "./capability-compiler.js";
import { queryFacts, markFactConsumed } from "./world-model.js";
import { routeReasoning } from "./cognitive-router.js";
import { recordSkillExecution } from "./skill-library.js";
import { markEventConsumed, unconsumedEvents } from "./event-bus.js";

const TASK_ID = "ULTRON_FIRST_EXTERNAL_EXPOSURE_001";
const OBJECTIVE =
  "Obtain the first legitimate third-party audience exposure for one existing frontier business.";

type Plan = {
  id: string;
  strategy: string;
  business: string;
  audience: string;
  requiredCapability: string;
  keywords: string[];
  expectedValue: number;
  expectedInformationValue: number;
  cost: number;
  risk: number;
  successProbability: number;
  rationale: string;
  /**
   * Highest economic proof milestone the plan can plausibly *advance* on
   * success. The scorer weights this against the earliest broken milestone
   * so activity that rearranges the portfolio without touching the current
   * bottleneck cannot outbid activity that could break it.
   */
  targetMilestone: EconomicProofLevel;
};

type CriticVerdict = {
  planId: string;
  passes: boolean;
  notes: string[];
};

async function generateCandidatePlans(pool: pg.Pool): Promise<Plan[]> {
  // Pull commercial state facts from world model.
  const bizFacts = await queryFacts(pool, {
    entityKind: "business",
    predicate: "commercial_state",
    freshOnly: true,
    limit: 20,
  });
  bizFacts.forEach((f) => void markFactConsumed(pool, f.factId, "ultron.first_task"));

  const frontier = await pool.query(
    `select business_id, traffic_ready, quality, demand, band
       from ros_business_scores
      order by traffic_ready desc, quality desc, demand desc
      limit 2`,
  );
  const primary = String(frontier.rows[0]?.business_id ?? bizFacts[0]?.entityId ?? "invoicechaser");
  const secondary = String(frontier.rows[1]?.business_id ?? bizFacts[1]?.entityId ?? primary);
  const trafficReady = Boolean(frontier.rows[0]?.traffic_ready);

  const plans: Plan[] = [
    {
      id: "PLAN_A_EMAIL_ATTRIBUTED",
      strategy: "attributed_email_to_public_contact",
      business: primary,
      audience: "founders/operators discoverable via public contact pages",
      requiredCapability: "email_attributed_send",
      keywords: ["email", "attributed", "send", "contact"],
      expectedValue: 0.25,
      expectedInformationValue: 0.4,
      cost: 0.05,
      risk: 0.2,
      successProbability: 0.05,
      targetMilestone: "E4_EXTERNAL_EFFECT",
      rationale:
        "Skill SEND_ATTRIBUTED_EMAIL is already at C4. Cheapest path to a real external effect; low probability of audience exposure but non-zero information value on reply rate.",
    },
    {
      id: "PLAN_B_OWNED_UTILITY_PUBLISH",
      strategy: "owned_utility_page_seed_directory",
      business: primary,
      audience: "search/directory visitors landing on utility page",
      requiredCapability: "publish_owned_resource",
      keywords: ["publish", "resource", "directory", "utility"],
      expectedValue: 0.15,
      expectedInformationValue: 0.35,
      cost: 0.08,
      risk: 0.25,
      successProbability: 0.03,
      targetMilestone: "E5_AUDIENCE_EXPOSURE",
      rationale:
        "Publishes a genuinely-useful artifact on an owned domain, then submits to a real free directory. Slower feedback loop, cleaner attribution.",
    },
    {
      id: "PLAN_C_PLATFORM_LISTING",
      strategy: "third_party_directory_listing",
      business: secondary,
      audience: "buyer-side procurement/founder audiences on a free directory",
      requiredCapability: "directory_listing_permitted",
      keywords: ["directory", "listing", "submit", "publish"],
      expectedValue: 0.35,
      expectedInformationValue: 0.5,
      cost: 0.15,
      risk: 0.4,
      successProbability: 0.02,
      targetMilestone: "E5_AUDIENCE_EXPOSURE",
      rationale:
        "Directly targets audience-exposure milestone via a legitimate third-party publish. Higher information value; higher failure probability due to gatekeeping.",
    },
    {
      id: "PLAN_D_INBOUND_INTAKE_CAPABILITY",
      strategy: "unlock_inbound_email_capability",
      business: primary,
      audience: "converts existing SENT emails into a reply-driven loop",
      requiredCapability: "inbox_inbound_ingest",
      keywords: ["inbound", "inbox", "reply", "receive"],
      expectedValue: 0.5,
      expectedInformationValue: 0.7,
      cost: 0.3,
      risk: 0.35,
      successProbability: 0.15,
      targetMilestone: "E6_HUMAN",
      rationale:
        "Unlocks two-way email. High information value because it converts every prior SENT into a candidate exposure/human path.",
    },
    {
      id: "PLAN_E_PIVOT_FRONTIER_BUSINESS",
      strategy: "swap_frontier_business",
      business: secondary,
      audience: "reconsider which business is likely to attract first exposure",
      requiredCapability: "world_model_query",
      keywords: ["choose", "business", "swap", "world_model"],
      expectedValue: 0.4,
      expectedInformationValue: 0.6,
      cost: 0.02,
      risk: 0.15,
      successProbability: 0.1,
      targetMilestone: "E1_PLAN",
      rationale:
        "Question the assumption that current frontier business is right. Cheap; information value is high; requires the world model to actually inform selection.",
    },
  ];

  // Extra plan the compiler+skill library actually earned: browser-verified
  // third-party publish. Only added if the browser primitive has proof ≥ C3.
  const bp = await pool.query(
    `select proof_level from ros_capability_graph where capability_id = 'browser_verify_external_artifact' limit 1`,
  );
  const browserProof = String(bp.rows[0]?.proof_level ?? "");
  if (["C3_PRODUCTION_AVAILABLE", "C4_EXTERNAL_ACTION_PROVEN", "C5_EXTERNAL_EFFECT_PROVEN", "C6_COMMERCIAL_EFFECT_PROVEN"].includes(browserProof)) {
    plans.push({
      id: "PLAN_F_BROWSER_VERIFIED_THIRD_PARTY",
      strategy: "browser_verified_third_party_publish",
      business: primary,
      audience: "buyer-side visitors on a permitted third-party surface",
      requiredCapability: "browser_verify_external_artifact",
      keywords: ["browser", "third-party", "publish", "verify"],
      expectedValue: 0.4,
      expectedInformationValue: 0.4,
      cost: 0.1,
      risk: 0.3,
      successProbability: 0.12,
      targetMilestone: "E5_AUDIENCE_EXPOSURE",
      rationale:
        "Uses the newly-proven browser skill VERIFY_PUBLIC_ARTIFACT_EXISTS to close the exposure loop by verifying the artifact via a real browser render.",
    });
  }

  if (!trafficReady) {
    plans.unshift({
      id: "PLAN_G_FORGE_COMMERCIAL_REPAIR",
      strategy: "repair_offer_site_trust_before_traffic",
      business: primary,
      audience: "the named buyer on the frontier business",
      requiredCapability: "world_model_query",
      keywords: ["forge", "trust", "premium", "offer", "traffic_ready"],
      expectedValue: 0.55,
      expectedInformationValue: 0.5,
      cost: 0.12,
      risk: 0.15,
      successProbability: 0.4,
      targetMilestone: "E5_AUDIENCE_EXPOSURE",
      rationale:
        "BUSINESS_READY_FOR_TRAFFIC is false. Pushing acquisition at a weak destination wastes E5 effort. Forge repairs offer/site/trust first; hunter still researches surfaces.",
    });
    for (const p of plans) {
      if (p.id !== "PLAN_G_FORGE_COMMERCIAL_REPAIR" && p.targetMilestone === "E5_AUDIENCE_EXPOSURE") {
        p.successProbability *= 0.4;
        p.rationale += " Downweighted: destination not TRAFFIC_READY.";
      }
    }
  }

  return plans;
}

function critic(plans: Plan[]): CriticVerdict[] {
  return plans.map((p) => {
    const notes: string[] = [];
    if (p.successProbability < 0.02) notes.push("Success probability floor too low.");
    if (p.expectedInformationValue < 0.2) notes.push("Low information value.");
    if (p.cost > p.expectedValue + p.expectedInformationValue) notes.push("Cost exceeds expected combined value.");
    return { planId: p.id, passes: notes.length === 0, notes };
  });
}

const LADDER_ORDER: readonly EconomicProofLevel[] = [
  "E0_KNOWLEDGE","E1_PLAN","E2_CAPABILITY","E3_EXECUTION","E4_EXTERNAL_EFFECT",
  "E5_AUDIENCE_EXPOSURE","E6_HUMAN","E7_ENGAGEMENT","E8_INTENT","E9_CUSTOMER",
  "E10_PROFIT","E11_REPEATABLE_PROFIT","E12_SCALABLE_PROFIT",
];

function selectPlan(
  plans: Plan[],
  verdicts: CriticVerdict[],
  earliestBrokenMilestone: EconomicProofLevel,
): {
  chosen: Plan;
  whyChosen: string;
  whyOthersLost: string[];
} {
  const earliestIdx = LADDER_ORDER.indexOf(earliestBrokenMilestone);

  const scored = plans.map((p) => {
    const v = verdicts.find((x) => x.planId === p.id);
    const passPenalty = v?.passes ? 0 : 0.15;
    const base = p.expectedValue * p.successProbability
      + 0.5 * p.expectedInformationValue
      - p.cost
      - 0.3 * p.risk
      - passPenalty;

    // Milestone bonus. Plans that directly advance the current bottleneck
    // get a large bonus; plans that advance a later milestone we can't
    // reach yet are penalized (because they don't move the earliest zero);
    // plans that only advance earlier already-proven levels get a smaller
    // bonus proportional to their probability.
    let bonus = 0;
    const planIdx = LADDER_ORDER.indexOf(p.targetMilestone);
    if (planIdx === earliestIdx) {
      // Direct advance of the current bottleneck.
      bonus = 0.9 * p.successProbability + 0.3;
    } else if (planIdx === earliestIdx + 1) {
      // Adjacent — useful if the plan opens the door once E_earliest passes.
      bonus = 0.2 * p.successProbability;
    } else if (planIdx < earliestIdx) {
      // Rearranging earlier proven levels — near zero value.
      bonus = 0.02 * p.successProbability;
    } else {
      // Skipping ahead — small credit for future value, but discounted.
      bonus = 0.05 * p.successProbability;
    }

    const total = base + bonus;
    return { plan: p, score: total, base, bonus, verdict: v };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0].plan;
  const others = scored.slice(1).map((s) => {
    const failed = s.verdict && !s.verdict.passes;
    return `${s.plan.id} lost (score ${s.score.toFixed(3)}, milestone=${s.plan.targetMilestone})${failed ? ` — critic: ${s.verdict?.notes.join("; ")}` : ""}`;
  });
  return {
    chosen: winner,
    whyChosen:
      `Won by score ${scored[0].score.toFixed(3)} (bonus ${scored[0].bonus.toFixed(3)} for advancing ${winner.targetMilestone} = current earliest zero ${earliestBrokenMilestone}). ${winner.rationale}`,
    whyOthersLost: others,
  };
}

async function earliestBrokenMilestone(pool: pg.Pool): Promise<EconomicProofLevel> {
  // Derive the earliest broken milestone from the curriculum + proof ledger.
  // If the DB doesn't have anything yet, default to E5 (matches current reality).
  try {
    const r = await pool.query(
      `select milestone
         from ros_curriculum_state
        where status <> 'ACHIEVED'
        order by milestone asc
        limit 1`,
    );
    const raw = String(r.rows[0]?.milestone ?? "");
    // Curriculum M1..M9 -> economic ladder mapping:
    // M1: E4, M2: E4, M3: E5, M4: E6, M5: E7, M6: E8, M7: E9, M8: E9, M9: E10
    const map: Record<string, EconomicProofLevel> = {
      M1: "E4_EXTERNAL_EFFECT",
      M2: "E4_EXTERNAL_EFFECT",
      M3: "E5_AUDIENCE_EXPOSURE",
      M4: "E6_HUMAN",
      M5: "E7_ENGAGEMENT",
      M6: "E8_INTENT",
      M7: "E9_CUSTOMER",
      M8: "E9_CUSTOMER",
      M9: "E10_PROFIT",
    };
    return map[raw] ?? "E5_AUDIENCE_EXPOSURE";
  } catch {
    return "E5_AUDIENCE_EXPOSURE";
  }
}

async function loadState(pool: pg.Pool): Promise<Record<string, unknown> | null> {
  const r = await pool.query(
    `select task_id, status, selected_business, selected_strategy,
            chosen_plan_id, execution_trace, external_effect, proof_level,
            economic_proof_level, updated_at
       from ros_first_task_state where task_id = $1`,
    [TASK_ID],
  );
  return r.rows[0] ?? null;
}

async function saveState(pool: pg.Pool, patch: Record<string, unknown>): Promise<void> {
  const cols = Object.keys(patch);
  const vals = cols.map((c) => (patch as Record<string, unknown>)[c]);
  const setSql = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
  await pool.query(
    `insert into ros_first_task_state (task_id, objective, ${cols.join(",")}, updated_at)
     values ($1, $${cols.length + 2}, ${cols.map((_, i) => `$${i + 2}`).join(",")}, now())
     on conflict (task_id) do update set ${setSql}, updated_at = now()`,
    [TASK_ID, ...vals, OBJECTIVE],
  );
}

function economicProofFromEvidence(external: Record<string, unknown>): EconomicProofLevel {
  if ((external as { humans?: number })?.humans && Number(external.humans) > 0) return "E6_HUMAN";
  if ((external as { published?: boolean })?.published) return "E5_AUDIENCE_EXPOSURE";
  if ((external as { sent?: boolean })?.sent) return "E4_EXTERNAL_EFFECT";
  if ((external as { executed?: boolean })?.executed) return "E3_EXECUTION";
  return "E2_CAPABILITY";
}

export async function runFirstTaskTick(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ status: string; chosen: string | null }> {
  const t0 = Date.now();

  // Route this deliberation through the cognitive router.
  await routeReasoning(
    pool,
    logger,
    "acquire_capability_first_external_exposure",
    "First-task tick: choose business + plan + execute",
  );

  // 1. Generate candidate plans (via proposer).
  const plans = await generateCandidatePlans(pool);

  // 2. Critic evaluates.
  const verdicts = critic(plans);

  // 3. Select — scorer prioritizes plans that advance the earliest broken
  //    proof milestone over plans that merely rearrange the portfolio.
  const earliest = await earliestBrokenMilestone(pool);
  const { chosen, whyChosen, whyOthersLost } = selectPlan(plans, verdicts, earliest);

  // 4. Compile executable path for the chosen plan.
  const compiled = await compileCapability(pool, logger, {
    effect: chosen.strategy,
    keywords: chosen.keywords,
    businessId: chosen.business,
    minProof: "C3_PRODUCTION_AVAILABLE",
  });

  await saveState(pool, {
    status: compiled.ok ? "EXECUTING" : "AWAITING_CAPABILITY",
    selected_business: chosen.business,
    selected_strategy: chosen.strategy,
    selected_capability: chosen.requiredCapability,
    candidate_plans: JSON.stringify(plans),
    critic_notes: JSON.stringify(verdicts),
    chosen_plan_id: chosen.id,
    why_chosen: whyChosen,
    why_others_lost: whyOthersLost,
    predictions: JSON.stringify({
      expectedValue: chosen.expectedValue,
      successProbability: chosen.successProbability,
      expectedInformationValue: chosen.expectedInformationValue,
    }),
  });

  // 5. If compilable, execute the top skill directly.
  let external: Record<string, unknown> = { executed: false };
  if (compiled.ok) {
    const skill = compiled.skills[0];
    const impl = skill && (skill as unknown as { executable_impl?: Record<string, unknown> }).executable_impl;
    // Best-effort: only dispatch known-safe skill for this tick.
    if (skill?.id === "SEND_ATTRIBUTED_EMAIL") {
      try {
        // Synthesized at runtime by AE v3; resolve dynamically to avoid
        // static type resolution against a not-yet-existing module.
        const modPath = "../autonomous-engineering/novel/v3/v3-external-email-action.js";
        const mod: Record<string, unknown> = await import(/* @vite-ignore */ modPath as string);
        const runFn = mod.runV3AttributedEmailBurst as
          | ((input: { pool: pg.Pool; logger: Logger }) => Promise<{ sent: number; attempts: number; details: unknown[] }>)
          | undefined;
        if (typeof runFn === "function") {
          const r = await runFn({ pool, logger });
          external = { executed: true, sent: r.sent > 0, attempts: r.attempts, sentCount: r.sent };
          await recordSkillExecution(pool, skill.id, r.sent > 0 ? "success" : "failure", `attempts=${r.attempts} sent=${r.sent}`);
        } else {
          external = { executed: false, reason: "skill_impl_missing" };
        }
      } catch (e) {
        external = { executed: false, reason: e instanceof Error ? e.message : String(e) };
        await recordSkillExecution(pool, skill.id, "failure", String(external.reason));
      }
    } else if (skill?.id === "COMPILE_EXTERNAL_EXPOSURE") {
      try {
        const { huntE5 } = await import("../ultron-external/e5-hunter.js");
        const hunt = await huntE5(pool, logger);
        external = {
          executed: hunt.attempted,
          sent: false,
          published: hunt.e5,
          reason: hunt.reason,
          surface: hunt.surface ?? null,
        };
      } catch (e) {
        external = { executed: false, reason: e instanceof Error ? e.message : String(e) };
      }
    } else {
      try {
        const { huntE5 } = await import("../ultron-external/e5-hunter.js");
        const hunt = await huntE5(pool, logger);
        external = {
          executed: hunt.attempted,
          sent: false,
          published: hunt.e5,
          reason: `skill_not_dispatchable:${skill?.id ?? "unknown"}; hunter:${hunt.reason}`,
          surface: hunt.surface ?? null,
        };
      } catch (e) {
        external = { executed: false, reason: `skill_not_dispatchable:${skill?.id ?? "unknown"}` };
      }
    }
  } else {
    // Try the E5 hunter when the compiler cannot assemble a publish path.
    try {
      const { huntE5 } = await import("../ultron-external/e5-hunter.js");
      const hunt = await huntE5(pool, logger);
      external = {
        executed: hunt.attempted,
        sent: false,
        published: hunt.e5,
        reason: hunt.reason,
        surface: hunt.surface ?? null,
      };
    } catch (e) {
      external = { executed: false, reason: `capability_gap:${compiled.gapId}; hunter:${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // 6. Reflection — check for human traffic, mark events consumed, promote lessons.
  const humansRow = await pool.query(
    `select count(*)::int as n from ros_traffic_events
      where class = 'VERIFIED_HUMAN_SIGNAL'
        and created_at > now() - interval '48 hours'
        and (business_id = $1 or $1 is null)`,
    [chosen.business ?? null],
  );
  external.humans = Number(humansRow.rows[0]?.n ?? 0);

  const events = await unconsumedEvents(pool, 30);
  for (const e of events.slice(0, 10)) {
    await markEventConsumed(pool, e.eventId, "ultron.first_task");
  }

  const economicProof = economicProofFromEvidence(external);

  await saveState(pool, {
    status: external.executed ? "EXECUTED" : "AWAITING_CAPABILITY",
    external_effect: JSON.stringify(external),
    execution_trace: JSON.stringify([
      { step: "propose", plans: plans.map((p) => p.id) },
      { step: "critique", verdicts: verdicts.map((v) => ({ id: v.planId, passes: v.passes })) },
      { step: "compile", ok: compiled.ok, kind: compiled.kind },
      { step: "execute", external },
      { step: "reflect", tookMs: Date.now() - t0 },
    ]),
    proof_level: economicProof,
    economic_proof_level: economicProof,
    reflection: JSON.stringify({
      whyChosen,
      whyOthersLost,
      external,
      compiled: compiled.ok ? { kind: compiled.kind, skills: compiled.skills.map((s) => s.id) } : { kind: "GAP", gapId: compiled.gapId },
    }),
  });

  logger("info", "ultron.first_task.tick", {
    chosen: chosen.id,
    business: chosen.business,
    executed: external.executed,
    humans: external.humans,
    proof: economicProof,
  });

  return { status: external.executed ? "EXECUTED" : "AWAITING_CAPABILITY", chosen: chosen.id };
}

export async function readFirstTaskState(pool: pg.Pool): Promise<Record<string, unknown> | null> {
  return loadState(pool);
}
