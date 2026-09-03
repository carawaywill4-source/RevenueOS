/**
 * Evidence-class proof grading.
 *
 * Success count alone MUST NOT determine C-level.
 *
 *   OWNED_SURFACE     → max C3 (implementation / test / production availability)
 *   THIRD_PARTY_ACTION→ C4 if RevenueOS actually mutated an external system
 *   EXTERNAL_EFFECT   → C5 (external response/effect independent of our write)
 *   COMMERCIAL        → C6 (payment / customer)
 */

import type pg from "pg";
import type { CapabilityProofLevel, Logger } from "../ultron-core/types.js";

export type EvidenceClass =
  | "OWNED_SURFACE"
  | "THIRD_PARTY_ACTION"
  | "EXTERNAL_EFFECT"
  | "COMMERCIAL"
  | "UNKNOWN";

const OWNED_ACTIONS = new Set([
  "publish_owned_intent_page",
  "publish_owned_page",
  "owned_publish",
  "portfolio_crosslink_publish",
  "publish_free_utility",
  "CONTENT_PUBLISH",
  "PORTFOLIO_CROSSLINK",
]);

const OWNED_PLATFORMS = new Set([
  "owned_domain",
  "owned",
  "portfolio",
  "owned_rss",
  "sslip.io",
]);

export function evidenceClassForAction(input: {
  externalAction?: string | null;
  executorType?: string | null;
  platform?: string | null;
  publicUrl?: string | null;
}): EvidenceClass {
  const action = String(input.externalAction ?? "").toLowerCase();
  const exec = String(input.executorType ?? "").toLowerCase();
  const plat = String(input.platform ?? "").toLowerCase();
  const url = String(input.publicUrl ?? "").toLowerCase();
  if (/indexnow|websub/.test(action) || /indexnow|websub/.test(exec)) {
    return "THIRD_PARTY_ACTION";
  }
  if (
    OWNED_ACTIONS.has(action) ||
    OWNED_ACTIONS.has(exec.toUpperCase()) ||
    OWNED_PLATFORMS.has(plat) ||
    /sslip\.io|130\.131\.15\.68/.test(url) ||
    /owned|portfolio_crosslink|publish_owned/.test(action)
  ) {
    return "OWNED_SURFACE";
  }
  if (/email|resend|directory|listing|producthunt|third_party/.test(action + exec + plat)) {
    return "THIRD_PARTY_ACTION";
  }
  return "UNKNOWN";
}

export function capProofForEvidence(cls: EvidenceClass, successes: number, rate: number): CapabilityProofLevel {
  if (successes <= 0) return "C1_IMPLEMENTED";
  if (cls === "COMMERCIAL") return "C6_COMMERCIAL_EFFECT_PROVEN";
  if (cls === "EXTERNAL_EFFECT") return successes >= 1 ? "C5_EXTERNAL_EFFECT_PROVEN" : "C4_EXTERNAL_ACTION_PROVEN";
  if (cls === "THIRD_PARTY_ACTION") {
    if (successes >= 1 && rate >= 0.2) return "C4_EXTERNAL_ACTION_PROVEN";
    if (successes >= 1) return "C3_PRODUCTION_AVAILABLE";
    return "C2_TESTED";
  }
  // OWNED_SURFACE / UNKNOWN: never C4+. Production availability starts at first live success.
  if (successes >= 1) return "C3_PRODUCTION_AVAILABLE";
  return "C1_IMPLEMENTED";
}

export function browserProofForSurface(opts: {
  successes: number;
  ownedSuccesses: number;
  thirdPartySuccesses: number;
  primitiveExecuted: boolean;
}): { runtime: CapabilityProofLevel; skill: CapabilityProofLevel; surface: "OWNED" | "THIRD_PARTY" | "NONE" } {
  if (opts.thirdPartySuccesses >= 1) {
    return {
      runtime: "C3_PRODUCTION_AVAILABLE",
      skill: "C4_EXTERNAL_ACTION_PROVEN",
      surface: "THIRD_PARTY",
    };
  }
  if (opts.ownedSuccesses >= 1 || opts.successes >= 1) {
    return {
      runtime: "C3_PRODUCTION_AVAILABLE",
      skill: "C3_PRODUCTION_AVAILABLE",
      surface: "OWNED",
    };
  }
  if (opts.primitiveExecuted) {
    return { runtime: "C2_TESTED", skill: "C2_TESTED", surface: "OWNED" };
  }
  return { runtime: "C1_IMPLEMENTED", skill: "C1_IMPLEMENTED", surface: "NONE" };
}

const SKILL_OVERRIDES: Record<string, EvidenceClass> = {
  AUTO_INDEXNOW_SUBMIT: "THIRD_PARTY_ACTION",
  AUTO_WEBSUB_PUBLISH: "THIRD_PARTY_ACTION",
  AUTO_PORTFOLIO_CROSSLINK_PUBLISH: "OWNED_SURFACE",
  AUTO_PUBLISH_OWNED_INTENT_PAGE: "OWNED_SURFACE",
  AUTO_PUBLISH_FREE_UTILITY: "OWNED_SURFACE",
  PUBLISH_OWNED_RESOURCE_PAGE: "OWNED_SURFACE",
  VERIFY_PUBLIC_ARTIFACT_EXISTS: "OWNED_SURFACE", // until third-party verify exists
  AUTO_BROWSER_VERIFY_PUBLIC_ARTIFACT: "OWNED_SURFACE",
  DISCOVER_BUSINESS_CONTACTS: "THIRD_PARTY_ACTION",
  SEND_ATTRIBUTED_EMAIL: "THIRD_PARTY_ACTION",
};

export async function regradeInflatedProof(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ regraded: number; details: Array<{ id: string; from: string; to: string; why: string }> }> {
  await pool.query(`
    create table if not exists ros_proof_regrades (
      regrade_id text primary key,
      subject_kind text not null,
      subject_id text not null,
      from_level text not null,
      to_level text not null,
      evidence_class text not null,
      why text not null,
      created_at timestamptz not null default now()
    )
  `);

  const details: Array<{ id: string; from: string; to: string; why: string }> = [];

  const skills = await pool.query(
    `select skill_id, proof_level, success_count, failure_count, platform, domain, meta
       from ros_skills`,
  );

  for (const s of skills.rows) {
    if (String(s.skill_id) === "ARCHITECTURE_CHANGE_SKILL") continue;
    const cls = SKILL_OVERRIDES[String(s.skill_id)]
      ?? evidenceClassForAction({
        externalAction: String(s.skill_id),
        platform: String(s.platform ?? ""),
      });
    const successes = Number(s.success_count ?? 0);
    const failures = Number(s.failure_count ?? 0);
    const rate = successes / Math.max(1, successes + failures);

    // Email: C4 only if SENT receipts exist; C5 only if trusted inbound reply exists.
    let next: CapabilityProofLevel = capProofForEvidence(cls, successes, rate);
    if (String(s.skill_id) === "SEND_ATTRIBUTED_EMAIL") {
      const sent = await pool.query(
        `select count(*)::int as n from aq_distribution_receipts
          where status='SENT' and request_result->>'marker' ilike '%V3_CAPABILITY%'`,
      );
      const replies = await pool.query(
        `select count(*)::int as n from ros_inbound_webhooks
          where trust_status = 'TRUSTED' and classification in ('REPLY','LEAD')`,
      );
      if (Number(replies.rows[0]?.n ?? 0) > 0) next = "C5_EXTERNAL_EFFECT_PROVEN";
      else if (Number(sent.rows[0]?.n ?? 0) > 0) next = "C4_EXTERNAL_ACTION_PROVEN";
      else next = capProofForEvidence("THIRD_PARTY_ACTION", successes, rate);
    }
    if (String(s.skill_id).includes("BROWSER") || String(s.skill_id) === "VERIFY_PUBLIC_ARTIFACT_EXISTS") {
      const third = await pool.query(
        `select count(*)::int as n from ros_browser_actions
          where result='SUCCESS'
            and coalesce(url,'') <> ''
            and url not ilike '%sslip.io%'
            and url not ilike '%130.131.15.68%'
            and url not ilike '%127.0.0.1%'
            and url not ilike '%localhost%'
            and url not ilike '%example.com%'`,
      );
      if (Number(third.rows[0]?.n ?? 0) > 0) {
        next = "C4_EXTERNAL_ACTION_PROVEN";
      } else {
        next = capProofForEvidence("OWNED_SURFACE", successes, rate);
      }
    }

    const from = String(s.proof_level);
    if (from === next) continue;
    const why = `evidence_class=${cls}; successes=${successes}; owned/internal cannot exceed C3 unless third-party/commercial evidence exists`;
    await pool.query(
      `update ros_skills
          set proof_level = $2,
              meta = coalesce(meta,'{}'::jsonb) || $3::jsonb,
              updated_at = now()
        where skill_id = $1`,
      [
        s.skill_id,
        next,
        JSON.stringify({
          regradedAt: new Date().toISOString(),
          evidenceClass: cls,
          previousProof: from,
          why,
        }),
      ],
    );
    await pool.query(
      `insert into ros_proof_regrades
         (regrade_id, subject_kind, subject_id, from_level, to_level, evidence_class, why)
       values ($1,'skill',$2,$3,$4,$5,$6)
       on conflict (regrade_id) do nothing`,
      [`rg_skill_${s.skill_id}_${Date.now().toString(36)}`, s.skill_id, from, next, cls, why],
    );
    details.push({ id: String(s.skill_id), from, to: next, why });
  }

  logger("info", "ultron.proof.regrade", { regraded: details.length, details });
  return { regraded: details.length, details };
}
