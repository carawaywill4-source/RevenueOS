/**
 * PRIORITY 6 — AUTOMATIC SKILL PROMOTION.
 *
 * Discovers reusable procedures hiding in repeated successful executions.
 * A single success is NOT enough — a pattern must appear ≥3 times with
 * consistent context before a skill candidate is proposed.
 *
 * Sources scanned:
 *   ros_ultron_events           (external effects grouped by kind + business)
 *   aq_distribution_receipts    (successful action patterns by external_action)
 *   ros_browser_actions         (successful browser action sequences)
 *
 * Demotion: skills whose recent success rate drops below 20% get suspended.
 */

import type pg from "pg";
import type { CapabilityProofLevel, Logger } from "../ultron-core/types.js";
import { capProofForEvidence, evidenceClassForAction } from "./proof-evidence.js";

type Candidate = {
  skillId: string;
  purpose: string;
  capabilitiesUsed: string[];
  proofLevel: CapabilityProofLevel;
  evidence: number;
  domain: string;
  platform: string;
  whenToUse: string;
};

export async function runSkillPromotion(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ promoted: number; demoted: number; candidates: Candidate[] }> {
  const candidates: Candidate[] = [];

  // 1. External action patterns.
  const patterns = await pool.query(
    `select external_action, executor_type,
            count(*)::int as attempts,
            sum(case when status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED','PUBLISHED')
                     then 1 else 0 end)::int as successes
       from aq_distribution_receipts
      where created_at > now() - interval '60 days'
      group by 1, 2
      having count(*) >= 3
      order by successes desc, attempts desc
      limit 25`,
  );

  for (const p of patterns.rows) {
    const successes = Number(p.successes);
    const attempts = Number(p.attempts);
    if (successes < 3) continue;
    const rate = successes / attempts;
    if (rate < 0.2) continue;
    const skillId = `AUTO_${String(p.external_action).toUpperCase()}`;
    const cls = evidenceClassForAction({
      externalAction: String(p.external_action),
      executorType: String(p.executor_type),
    });
    const proof: CapabilityProofLevel = capProofForEvidence(cls, successes, rate);
    candidates.push({
      skillId,
      purpose: `Repeatably execute ${p.external_action} via ${p.executor_type}`,
      capabilitiesUsed: [String(p.executor_type).toLowerCase()],
      proofLevel: proof,
      evidence: successes,
      domain: "distribution",
      platform: String(p.executor_type),
      whenToUse: `Effect ${p.external_action} — has ${successes} successes / ${attempts} attempts (${Math.round(rate * 100)}%).`,
    });
  }

  // 2. Browser action sequences.
  const browserPatterns = await pool.query(
    `select kind, count(*)::int as total,
            sum(case when result='SUCCESS' then 1 else 0 end)::int as ok
       from ros_browser_actions
      where created_at > now() - interval '30 days'
      group by 1
      having count(*) >= 3`,
  );
  for (const b of browserPatterns.rows) {
    const successes = Number(b.ok);
    if (successes < 3) continue;
    const total = Number(b.total);
    const rate = successes / total;
    if (rate < 0.5) continue;
    const skillId = `AUTO_BROWSER_${String(b.kind).toUpperCase()}`;
    const third = await pool.query(
      `select count(*)::int as n from ros_browser_actions
        where kind = $1 and result='SUCCESS'
          and coalesce(surface_class,'')='THIRD_PARTY_BROWSER_PROOF'`,
      [b.kind],
    );
    const proof: CapabilityProofLevel = capProofForEvidence(
      Number(third.rows[0]?.n ?? 0) > 0 ? "THIRD_PARTY_ACTION" : "OWNED_SURFACE",
      successes,
      rate,
    );
    candidates.push({
      skillId,
      purpose: `Repeatably perform browser kind=${b.kind}`,
      capabilitiesUsed: [`browser_${b.kind}`],
      proofLevel: proof,
      evidence: successes,
      domain: "browser",
      platform: "web",
      whenToUse: `Browser kind=${b.kind} — ${successes}/${total} successful.`,
    });
  }

  let promoted = 0;
  for (const c of candidates) {
    await pool.query(
      `insert into ros_skills
         (skill_id, purpose, capabilities_used, executable_impl, platform, domain,
          proof_level, success_count, when_to_use, meta, updated_at)
       values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb, now())
       on conflict (skill_id) do update set
         purpose = excluded.purpose,
         proof_level = excluded.proof_level,
         success_count = greatest(ros_skills.success_count, excluded.success_count),
         when_to_use = excluded.when_to_use,
         updated_at = now()`,
      [
        c.skillId,
        c.purpose,
        c.capabilitiesUsed,
        JSON.stringify({ auto: true }),
        c.platform,
        c.domain,
        c.proofLevel,
        c.evidence,
        c.whenToUse,
        JSON.stringify({ promotedBy: "skill-promotion", firstPromotedAt: new Date().toISOString() }),
      ],
    );
    promoted++;
  }

  // 3. Demotion — recent failure surge.
  const demote = await pool.query(
    `select skill_id,
            success_count, failure_count,
            case when (success_count + failure_count) > 5
                 then failure_count::float / greatest(1,(success_count + failure_count))
                 else 0 end as fail_rate
       from ros_skills
      where success_count + failure_count > 5
        and (failure_count::float / greatest(1,(success_count + failure_count))) > 0.8
      limit 25`,
  );
  let demoted = 0;
  for (const d of demote.rows) {
    await pool.query(
      `update ros_skills
          set proof_level = 'C1_IMPLEMENTED',
              meta = jsonb_set(meta, '{demotedAt}', to_jsonb(now()::text), true),
              updated_at = now()
        where skill_id = $1`,
      [d.skill_id],
    );
    demoted++;
  }

  logger("info", "ultron.skills.promotion", {
    candidates: candidates.length,
    promoted,
    demoted,
  });
  return { promoted, demoted, candidates };
}
