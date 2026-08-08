import type {
  DiscoveryDoor,
  Lesson,
  Observation,
  Opportunity,
  WorldModel,
} from "../types";
import { NORTH_STAR_DAILY_PROFIT_USD } from "./northstar";
import { toPortableLesson } from "../memory/portable";

/**
 * Organic mastery era.
 *
 * RevenueOS is the business manager — solely responsible for making the site
 * profitable. Ads come later. Right now the only acceptable standard is
 * mastering organic qualified leads → sales. "Okay" or "decent" is failure.
 * When paid access lands, this organic machine must already be lethal.
 */

export const ORGANIC_ERA_MISSION =
  "ERA: ORGANIC MASTERY. RevenueOS is the sole business manager for this site. " +
  "Master organic qualified leads and sales — not okay, not decent, mastery. " +
  "Ads are deferred until organic conversion is a weapon. Money made for the " +
  "customer is the only success; organic is the current path to that money.";

export type OrganicMasteryLevel =
  | "novice"
  | "apprentice"
  | "journeyman"
  | "master"
  | "lethal";

export type OrganicMasteryReport = {
  level: OrganicMasteryLevel;
  score: number;
  mission: string;
  /**
   * Strategic judgment only: would paid amplify a working organic close?
   * Never permission to spend — `spend_ads` stays owner-gated until the owner
   * grants a budget (see policy.ts OWNER_GATE_TYPES).
   */
  adsReadiness: "locked" | "almost" | "ready";
  drills: string[];
  gaps: string[];
  verdict: string;
  /** Boost multipliers applied to opportunity ranking. */
  organicAcquisitionBoost: number;
  organicConversionBoost: number;
  paidSuppression: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function scoreOrganicMastery(input: {
  observation: Observation;
  world: WorldModel;
  doors?: DiscoveryDoor[];
  northStarUsd?: number;
}): OrganicMasteryReport {
  const northStar = input.northStarUsd ?? NORTH_STAR_DAILY_PROFIT_USD;
  const landing = input.observation.funnel.landingViews;
  const purchases = input.observation.money.purchases;
  const profit = input.observation.money.estimatedProfitUsd;
  const checkouts = input.observation.funnel.checkouts;
  const cvr = landing > 0 ? purchases / landing : 0;
  const doors = input.doors ?? [];
  const activeDoors = doors.filter(
    (d) => d.status === "active" || d.status === "holding" || d.status === "expanding",
  );
  const scoredDoors = doors.filter((d) => d.lastScore);
  const expanding = doors.filter((d) => d.status === "expanding" || d.lastScore?.verdict === "expand");
  const killed = doors.filter((d) => d.status === "killed");
  const revenueDoors = doors.filter(
    (d) =>
      d.lastScore?.stage === "purchase" ||
      d.lastScore?.stage === "revenue" ||
      (d.lastScore?.metrics.purchases ?? 0) > 0,
  );

  let score = 0;
  const gaps: string[] = [];
  const drills: string[] = [];

  // 1) Organic demand engine (doors + research discipline)
  if (doors.length === 0) {
    gaps.push("No organic intent doors published yet.");
    drills.push("Run discovery attack: buyable query → publish → IndexNow → measure.");
  } else {
    score += 12;
    if (scoredDoors.length > 0) score += 8;
    else {
      gaps.push("Doors exist but none scored — organic learning loop incomplete.");
      drills.push("Wait out 3d/7d windows; kill dead doors; expand only winners.");
    }
    if (killed.length > 0) score += 8; // proof we refuse losers
    if (expanding.length > 0 || revenueDoors.length > 0) score += 12;
    else if (activeDoors.length >= 3) {
      gaps.push("Multiple doors live without an expand/revenue winner.");
      drills.push("Rewrite or kill flat clusters; only clone what converts to product views.");
    }
  }

  // 2) Lead quality → sales (not vanity traffic)
  if (landing < 25) {
    gaps.push("Almost no organic strangers arriving.");
    drills.push("Master buyable-demand research and indexable money pages.");
  } else {
    score += 10;
    if (cvr >= 0.02) score += 15;
    else if (cvr >= 0.01) score += 8;
    else {
      gaps.push(`Organic CVR ${(cvr * 100).toFixed(2)}% — traffic without mastery closes.`);
      drills.push("Conversion drill: homepage/kit/clarity until visitors buy.");
    }
  }

  if (checkouts > 0 && purchases === 0) {
    gaps.push("Organic demand dies at checkout.");
    drills.push("Close payment drop — leads that don't pay are not mastery.");
  }

  // 3) Sales printed (the only success)
  if (purchases <= 0) {
    gaps.push("Zero purchases — organic path has not made money.");
    drills.push("Force one organic sale path: intent door → product → checkout → paid order.");
  } else {
    score += 18;
    if (purchases >= 5) score += 8;
    if (purchases >= 20) score += 8;
  }

  if (profit > 0) score += 10;
  if (profit >= 500) score += 8;
  if (profit >= northStar * 0.1) score += 10;

  // 4) Discovery coverage / friction awareness
  if (input.world.market.discoveryCoverage === "broad") score += 5;
  else if (input.world.market.discoveryCoverage === "thin") {
    drills.push("Widen organic coverage: more buyable clusters that survive the governor.");
  }
  if (input.world.shopper.primaryFriction === "discovery" && landing < 40) {
    drills.push("Primary friction is discovery — organic acquisition is the mastery drill.");
  }

  score = clamp(score, 0, 100);

  let level: OrganicMasteryLevel = "novice";
  if (score >= 85 && purchases >= 10 && cvr >= 0.015 && revenueDoors.length > 0) {
    level = "lethal";
  } else if (score >= 70 && purchases >= 5 && cvr >= 0.01) {
    level = "master";
  } else if (score >= 50 && purchases >= 1) {
    level = "journeyman";
  } else if (score >= 25) {
    level = "apprentice";
  }

  const adsReadiness: OrganicMasteryReport["adsReadiness"] =
    level === "lethal" || level === "master"
      ? "ready"
      : level === "journeyman"
        ? "almost"
        : "locked";

  // While mastering organic, crush paid curiosity and overweight organic levers.
  const organicAcquisitionBoost =
    level === "novice" || level === "apprentice"
      ? 1.55
      : level === "journeyman"
        ? 1.35
        : 1.2;
  const organicConversionBoost =
    landing >= 20 && (purchases === 0 || cvr < 0.02) ? 1.65 : 1.35;
  const paidSuppression = adsReadiness === "ready" ? 0.85 : 0.25;

  if (adsReadiness !== "ready") {
    drills.push(
      "Paid is strategically locked. Master organic lead→sale until ads would multiply a working close, not subsidize a broken one. (Spend stays owner-gated either way.)",
    );
  } else {
    drills.push(
      "Paid is strategically justified — still not authorized. Owner must grant a spend_ads budget before any paid test runs.",
    );
  }

  const verdict =
    level === "lethal"
      ? `ORGANIC LETHAL (${score}/100): repeatable organic leads→sales proven. Paid is strategically justified; spend still needs owner budget.`
      : level === "master"
        ? `ORGANIC MASTER (${score}/100): selling from organic. Keep compounding doors that print; paid nearly strategically justified (spend still owner-gated).`
        : level === "journeyman"
          ? `ORGANIC JOURNEYMAN (${score}/100): first sales exist — not mastery yet. Tighten CVR and expand only winning clusters.`
          : level === "apprentice"
            ? `ORGANIC APPRENTICE (${score}/100): tools moving, money not mastered. Refuse vanity. Close or kill.`
            : `ORGANIC NOVICE (${score}/100): failing at organic leads→sales. This is the whole job until mastery. Paid strategically locked.`;

  return {
    level,
    score,
    mission: ORGANIC_ERA_MISSION,
    adsReadiness,
    drills: drills.slice(0, 6),
    gaps: gaps.slice(0, 6),
    verdict,
    organicAcquisitionBoost,
    organicConversionBoost,
    paidSuppression,
  };
}

const ORGANIC_ACTION_TYPES = new Set([
  "indexnow_submit",
  "market_research",
  "publish_intent_page",
  "sitemap_ping",
  "discovery_attack",
  "retire_discovery_door",
  "merch_optimize",
  "activate_kit_deal",
  "set_homepage_focus",
  "set_free_shipping_threshold",
  "clear_promo",
]);

const PAID_OR_OWNER_SPEND = new Set(["spend_ads", "paid_ads"]);

/** Re-rank opportunities for organic mastery era. */
export function applyOrganicMasteryPressure(input: {
  opportunities: Opportunity[];
  mastery: OrganicMasteryReport;
}): Opportunity[] {
  const { mastery } = input;
  return input.opportunities
    .map((opp) => {
      let mult = 1;
      const action = opp.safeActionType ?? "";
      const isOrganicAction = ORGANIC_ACTION_TYPES.has(action);
      const isPaid =
        PAID_OR_OWNER_SPEND.has(action) ||
        opp.patternKey?.includes("paid") ||
        opp.patternKey?.includes("ads") ||
        opp.title.toLowerCase().includes("paid ad");

      if (isPaid) {
        mult *= mastery.paidSuppression;
      } else if (opp.category === "acquisition" && isOrganicAction) {
        mult *= mastery.organicAcquisitionBoost;
      } else if (opp.category === "conversion") {
        mult *= mastery.organicConversionBoost;
      } else if (opp.category === "acquisition") {
        // Advisory organic channels (directories, etc.) — keep alive but below executables.
        mult *= mastery.level === "novice" ? 1.15 : 1.05;
      }

      // Explicit mastery drills: buyable research + close path.
      if (
        action === "market_research" ||
        action === "discovery_attack" ||
        action === "publish_intent_page"
      ) {
        if (mastery.level === "novice" || mastery.level === "apprentice") {
          mult *= 1.15;
        }
      }
      if (
        (action === "merch_optimize" || action === "activate_kit_deal") &&
        mastery.organicConversionBoost > 1.4
      ) {
        mult *= 1.1;
      }

      return {
        ...opp,
        score: Number((opp.score * mult).toFixed(2)),
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function lessonFromOrganicMastery(input: {
  siteId: string;
  industry?: string;
  mastery: OrganicMasteryReport;
  now?: Date;
}): Lesson {
  return toPortableLesson({
    siteId: input.siteId,
    industry: input.industry,
    now: input.now,
    lesson: {
      patternKey: `organic-mastery:${input.mastery.level}`,
      summary: `${input.mastery.verdict} Ads=${input.mastery.adsReadiness}. Drills: ${input.mastery.drills.slice(0, 2).join(" | ")}`,
      evidenceCount: 1,
      transferable: true,
      sentiment:
        input.mastery.level === "master" || input.mastery.level === "lethal"
          ? "positive"
          : "negative",
      rankingWeight:
        input.mastery.level === "novice"
          ? 1.45
          : input.mastery.level === "apprentice"
            ? 1.3
            : 1.15,
    },
  });
}

/** Curriculum text override while ads are locked. */
export function organicMasteryCurriculumNote(mastery: OrganicMasteryReport): string {
  if (mastery.adsReadiness === "ready") {
    return "Organic mastery cleared ads lock — paid can amplify a working close.";
  }
  return `Organic era (ads ${mastery.adsReadiness}): ${mastery.drills[0] ?? "Master organic leads→sales before paid."}`;
}
