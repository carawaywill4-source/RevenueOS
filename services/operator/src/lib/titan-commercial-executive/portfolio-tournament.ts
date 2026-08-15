/**
 * Portfolio tournament — no permanent protection for accepted businesses.
 */

import type pg from "pg";
import { modelTenKPath } from "./mission.js";

export type Tier =
  | "TOP_TIER"
  | "PROMISING"
  | "UNPROVEN"
  | "WEAK"
  | "CHALLENGED"
  | "REPLACEMENT_CANDIDATE";

export type TournamentRow = {
  businessId: string;
  tier: Tier;
  score: number;
  reasons: string[];
  pathPlausible: boolean;
  purchasesPerDayNeeded: number;
  acquisitionState: string;
  pressure: number;
};

export async function runPortfolioTournament(
  pool: pg.Pool,
  managed: string[],
): Promise<{
  rows: TournamentRow[];
  top10: string[];
  weakest10: string[];
  challenged: string[];
  replacementCandidates: string[];
}> {
  const res = await pool.query(
    `select business_id, price_usd, commercial_pressure, acquisition_state,
            qualified_visits, real_purchases, funnel_rung, primary_bottleneck,
            document, last_new_audience_at, confidence
     from titan_business_commercial_missions
     where business_id = any($1::text[])`,
    [managed],
  );

  const rows: TournamentRow[] = [];
  for (const r of res.rows) {
    const price = r.price_usd != null ? Number(r.price_usd) : null;
    const path = modelTenKPath(price);
    const pressure = Number(r.commercial_pressure ?? 0);
    const qualified = Number(r.qualified_visits ?? 0);
    const purchases = Number(r.real_purchases ?? 0);
    const confidence = Number(r.confidence ?? 0.4);
    const hasNewAud = Boolean(r.last_new_audience_at);
    const reasons: string[] = [];

    let score = 40;
    if (purchases > 0) {
      score += 40;
      reasons.push("has_real_purchases");
    }
    if (qualified > 0) {
      score += 20;
      reasons.push("qualified_visits");
    }
    if (hasNewAud) {
      score += 12;
      reasons.push("new_audience_attempted");
    }
    if (path.plausible) {
      score += 8;
      reasons.push("path_plausible");
    } else {
      score -= 15;
      reasons.push("implausible_10k_path_at_price");
    }
    if (r.acquisition_state === "STALLED") {
      score -= 10;
      reasons.push("acquisition_stalled");
    }
    if (pressure >= 0.9 && !hasNewAud) {
      score -= 8;
      reasons.push("high_pressure_no_new_audience");
    }
    score += Math.round(confidence * 10);

    let tier: Tier = "UNPROVEN";
    if (purchases > 0 || qualified > 5) tier = "TOP_TIER";
    else if (hasNewAud && path.plausible) tier = "PROMISING";
    else if (!path.plausible && pressure >= 0.7) {
      tier = "CHALLENGED";
      reasons.push("economics_or_stall_challenge");
    } else if (score < 30) tier = "WEAK";
    else if (score < 45) tier = "UNPROVEN";
    else if (hasNewAud) tier = "PROMISING";
    else tier = "UNPROVEN";

    // Implausible $10k path, or stalled with no new-audience evidence → replace
    if (
      (!path.plausible && Number(path.purchasesPerDay) > 200) ||
      (r.acquisition_state === "STALLED" &&
        !hasNewAud &&
        pressure >= 0.8 &&
        score < 50)
    ) {
      tier = "REPLACEMENT_CANDIDATE";
      reasons.push("replacement_consideration");
    }

    rows.push({
      businessId: String(r.business_id),
      tier,
      score,
      reasons,
      pathPlausible: path.plausible,
      purchasesPerDayNeeded: path.purchasesPerDay,
      acquisitionState: String(r.acquisition_state ?? ""),
      pressure,
    });
  }

  rows.sort((a, b) => b.score - a.score);

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('portfolio_tournament', $1::jsonb, now(), 'NATIVE_POSTGRES')
     on conflict (key) do update set value=excluded.value, updated_at=now()`,
    [
      JSON.stringify({
        version: "portfolio-tournament-v1",
        updatedAt: new Date().toISOString(),
        rows: rows.slice(0, 50),
      }),
    ],
  );

  // Feed challenge state for replacement candidates (evidence for existing challenge lane)
  const replacements = rows.filter((r) => r.tier === "REPLACEMENT_CANDIDATE");
  if (replacements.length) {
    const ch = await pool.query(
      `select value from ros_config_meta where key='accepted_business_challenge_state'`,
    );
    const doc = (ch.rows[0]?.value ?? { bySite: {} }) as {
      bySite?: Record<string, Record<string, unknown>>;
    };
    const bySite = { ...(doc.bySite ?? {}) };
    for (const r of replacements.slice(0, 5)) {
      bySite[r.businessId] = {
        ...(bySite[r.businessId] ?? {}),
        tournamentTier: r.tier,
        tournamentScore: r.score,
        tournamentReasons: r.reasons,
        flaggedAt: new Date().toISOString(),
        flaggedBy: "commercial_executive_tournament",
      };
    }
    await pool.query(
      `insert into ros_config_meta (key, value, updated_at, provenance)
       values ('accepted_business_challenge_state', $1::jsonb, now(), 'COMMERCIAL_EXECUTIVE')
       on conflict (key) do update set value=excluded.value, updated_at=now()`,
      [JSON.stringify({ ...doc, bySite, updatedAt: new Date().toISOString() })],
    );
  }

  return {
    rows,
    top10: rows.slice(0, 10).map((r) => r.businessId),
    weakest10: [...rows].reverse().slice(0, 10).map((r) => r.businessId),
    challenged: rows
      .filter((r) => r.tier === "CHALLENGED" || r.tier === "WEAK")
      .map((r) => r.businessId),
    replacementCandidates: replacements.map((r) => r.businessId),
  };
}
