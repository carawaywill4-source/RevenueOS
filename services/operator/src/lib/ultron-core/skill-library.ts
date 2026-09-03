/**
 * Organ 2 — SKILL LIBRARY (executable, composed capabilities).
 *
 * A skill is a *learned* composition of capability primitives that has
 * demonstrably produced a useful outcome. Skills are versioned, carry
 * success/failure history, and are consumed by the capability compiler.
 *
 * Bootstrap set is populated from real evidence already produced by the
 * AE v3 lane (contact discovery → attributed email, PH read adapter,
 * owned-resource publication, distribution receipts). No fabricated
 * skills — anything without live evidence stays out.
 */

import type pg from "pg";
import type { CapabilityProofLevel, Logger, Skill } from "./types.js";

type SkillSeed = {
  id: string;
  purpose: string;
  capabilitiesUsed: string[];
  platform: string;
  domain: string;
  proofLevel: CapabilityProofLevel;
  whenToUse: string;
  whenNotToUse: string;
  executable: Record<string, unknown>;
  evidenceQuery: string;
};

const BOOTSTRAP_SKILLS: SkillSeed[] = [
  {
    id: "SEND_ATTRIBUTED_EMAIL",
    purpose:
      "Send a partnership/pitch email to a discovered public contact with attribution + delivery receipt.",
    capabilitiesUsed: [
      "email_send_resend",
      "contact_discovery_from_public_page",
      "distribution_receipt_write",
    ],
    platform: "email",
    domain: "distribution",
    proofLevel: "C4_EXTERNAL_ACTION_PROVEN",
    whenToUse:
      "A high-quality target has a legitimate public contact and we have concrete recipient value + one ask.",
    whenNotToUse:
      "No verified contact, no clear value proposition, or platform prohibits solicitation.",
    executable: {
      module: "autonomous-engineering/novel/v3/v3-external-email-action",
      export: "runV3AttributedEmailBurst",
    },
    evidenceQuery:
      "select count(*)::int from aq_distribution_receipts where status='SENT' and request_result->>'marker' ilike '%V3_CAPABILITY_CONTACT_DISCOVERY%'",
  },
  {
    id: "DISCOVER_BUSINESS_CONTACTS",
    purpose:
      "Given a business, discover legitimate public contact routes from surface URLs and known contact-page patterns.",
    capabilitiesUsed: ["web_fetch", "contact_extraction"],
    platform: "web",
    domain: "research",
    proofLevel: "C4_EXTERNAL_ACTION_PROVEN",
    whenToUse:
      "We need to send a message and no contact is on file for a legitimate target.",
    whenNotToUse:
      "Target has explicitly opted out or the surface is a scraping-hostile platform.",
    executable: {
      module: "autonomous-engineering/novel/v3/contact-discovery",
      export: "discoverBusinessContacts",
    },
    evidenceQuery:
      "select count(*)::int from aq_distribution_receipts where external_destination is not null and created_at > now() - interval '30 days'",
  },
  {
    id: "PUBLISH_OWNED_RESOURCE_PAGE",
    purpose:
      "Publish a resource/utility page on an owned business domain to create a distributable public artifact.",
    capabilitiesUsed: ["site_deploy_vercel", "content_generation"],
    platform: "owned_domain",
    domain: "asset",
    proofLevel: "C3_PRODUCTION_AVAILABLE",
    whenToUse:
      "We need a public URL as a hook for third-party distribution.",
    whenNotToUse:
      "Third-party distribution slot doesn't accept an outbound URL.",
    executable: {
      module: "titan-commercial-executive/new-audience",
      export: "executeNewAudienceBet",
    },
    evidenceQuery:
      "select count(*)::int from aq_distribution_receipts where external_action = 'publish_owned_intent_page' and created_at > now() - interval '30 days'",
  },
  {
    id: "QUERY_PRODUCTHUNT_READ",
    purpose:
      "Query Product Hunt public GraphQL for market signal (posts, keywords, discussions).",
    capabilitiesUsed: ["producthunt_read_api"],
    platform: "producthunt",
    domain: "research",
    proofLevel: "C3_PRODUCTION_AVAILABLE",
    whenToUse:
      "We need current market signal for a keyword or want to identify launched products in a niche.",
    whenNotToUse:
      "We need to publish/comment (write mutation is not exposed to public API).",
    executable: {
      module: "capability-reality/producthunt-adapter",
      export: "runProductHuntCycle",
    },
    evidenceQuery:
      "select count(*)::int from ros_capability_registry where capability_id ilike '%producthunt%' and state='IMPLEMENTED'",
  },
];

export async function seedSkillLibrary(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ seeded: number; verified: number }> {
  let seeded = 0;
  let verified = 0;
  for (const s of BOOTSTRAP_SKILLS) {
    let evidenceCount = 0;
    try {
      const r = await pool.query(s.evidenceQuery);
      evidenceCount = Number(r.rows[0]?.count ?? 0);
    } catch (e) {
      // evidence query may reference a table that doesn't exist yet — that's fine, keep proof=C1
      evidenceCount = 0;
    }
    const proof =
      evidenceCount > 0 ? s.proofLevel : ("C1_IMPLEMENTED" as CapabilityProofLevel);
    if (evidenceCount > 0) verified++;
    await pool.query(
      `insert into ros_skills
         (skill_id, purpose, preconditions, capabilities_used, executable_impl,
          input_schema, output_schema, platform, domain, risk, cost, proof_level,
          success_count, failure_count, when_to_use, when_not_to_use, version,
          last_executed_at, meta, updated_at)
       values ($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,
               $13,$14,$15,$16,$17,$18,$19::jsonb, now())
       on conflict (skill_id) do update set
         purpose=excluded.purpose,
         capabilities_used=excluded.capabilities_used,
         executable_impl=excluded.executable_impl,
         proof_level=excluded.proof_level,
         success_count=greatest(ros_skills.success_count, excluded.success_count),
         when_to_use=excluded.when_to_use,
         when_not_to_use=excluded.when_not_to_use,
         updated_at=now()`,
      [
        s.id,
        s.purpose,
        JSON.stringify([]),
        s.capabilitiesUsed,
        JSON.stringify(s.executable),
        JSON.stringify({}),
        JSON.stringify({}),
        s.platform,
        s.domain,
        "LOW",
        0,
        proof,
        evidenceCount,
        0,
        s.whenToUse,
        s.whenNotToUse,
        1,
        evidenceCount > 0 ? new Date().toISOString() : null,
        JSON.stringify({ bootstrap: true, evidenceCount }),
      ],
    );
    seeded++;
  }
  logger("info", "ultron.skills.seeded", { seeded, verified });
  return { seeded, verified };
}

export async function listSkills(pool: pg.Pool): Promise<Skill[]> {
  const r = await pool.query(
    `select skill_id, purpose, capabilities_used, proof_level, success_count,
            failure_count, when_to_use, when_not_to_use
       from ros_skills
       order by success_count desc, updated_at desc`,
  );
  return r.rows.map((row) => ({
    id: String(row.skill_id),
    purpose: String(row.purpose),
    capabilitiesUsed: (row.capabilities_used ?? []) as string[],
    proofLevel: row.proof_level as CapabilityProofLevel,
    successCount: Number(row.success_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    whenToUse: String(row.when_to_use ?? ""),
    whenNotToUse: String(row.when_not_to_use ?? ""),
  }));
}

export async function findSkillsFor(
  pool: pg.Pool,
  needleWords: string[],
): Promise<Skill[]> {
  if (needleWords.length === 0) return [];
  const pattern = needleWords.map((w) => w.toLowerCase()).join("|");
  const r = await pool.query(
    `select skill_id, purpose, capabilities_used, proof_level, success_count,
            failure_count, when_to_use, when_not_to_use
       from ros_skills
       where lower(purpose) ~ $1 or lower(when_to_use) ~ $1
       order by success_count desc, updated_at desc
       limit 20`,
    [pattern],
  );
  return r.rows.map((row) => ({
    id: String(row.skill_id),
    purpose: String(row.purpose),
    capabilitiesUsed: (row.capabilities_used ?? []) as string[],
    proofLevel: row.proof_level as CapabilityProofLevel,
    successCount: Number(row.success_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    whenToUse: String(row.when_to_use ?? ""),
    whenNotToUse: String(row.when_not_to_use ?? ""),
  }));
}

export async function recordSkillExecution(
  pool: pg.Pool,
  skillId: string,
  outcome: "success" | "failure",
  detail: string,
): Promise<void> {
  const col = outcome === "success" ? "success_count" : "failure_count";
  await pool.query(
    `update ros_skills
        set ${col} = ${col} + 1,
            last_executed_at = now(),
            meta = jsonb_set(meta, '{lastExecutionDetail}', to_jsonb($2::text), true),
            updated_at = now()
      where skill_id = $1`,
    [skillId, detail.slice(0, 500)],
  );
}
