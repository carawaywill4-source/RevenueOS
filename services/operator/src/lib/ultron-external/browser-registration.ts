/**
 * Register browser primitives + skills into the ULTRON capability graph
 * and skill library. Proof level is derived from actual execution
 * evidence (ros_browser_actions), never from code presence.
 */

import type pg from "pg";
import type { CapabilityProofLevel, Logger } from "../ultron-core/types.js";
import { BROWSER_PRIMITIVES } from "./browser-operator.js";

// Maps a primitive capability to the ros_browser_actions.kind values that
// count as evidence for it. A single execution might exercise several
// primitives (verify_public_artifact opens a page, reads DOM, captures
// a screenshot — all three primitives get credit).
const PRIMITIVE_EVIDENCE: Record<string, string[]> = {
  browser_open_page: ["verify_public_artifact", "open_page"],
  browser_read_page: ["verify_public_artifact", "read_page"],
  browser_click: ["click"],
  browser_type: ["type"],
  browser_submit_form: ["submit_form"],
  browser_upload: ["upload"],
  browser_download: ["download"],
  browser_capture_artifact: ["verify_public_artifact", "capture_artifact"],
  browser_verify_external_artifact: ["verify_public_artifact", "verify_external_artifact"],
  browser_session_resume: ["session_resume"],
};

async function proofFromExecutions(pool: pg.Pool, primitive: string): Promise<CapabilityProofLevel> {
  const kinds = PRIMITIVE_EVIDENCE[primitive] ?? [primitive];
  const r = await pool.query(
    `select
       sum(case when result='SUCCESS' then 1 else 0 end)::int as ok,
       sum(case when result='SUCCESS' and coalesce(surface_class,'') = 'THIRD_PARTY_BROWSER_PROOF' then 1 else 0 end)::int as third,
       count(*)::int as total
       from ros_browser_actions
       where kind = ANY($1::text[])
         and created_at > now() - interval '30 days'`,
    [kinds],
  );
  const ok = Number(r.rows[0]?.ok ?? 0);
  const third = Number(r.rows[0]?.third ?? 0);
  const total = Number(r.rows[0]?.total ?? 0);
  // Owned-fixture / owned-site success is C2/C3 mechanics, never C4.
  if (third >= 1 && ok / Math.max(1, total) >= 0.5) return "C4_EXTERNAL_ACTION_PROVEN";
  if (ok >= 3) return "C3_PRODUCTION_AVAILABLE";
  if (ok >= 1) return "C2_TESTED";
  if (total > 0) return "C1_IMPLEMENTED";
  return "C1_IMPLEMENTED";
}

async function upsertBrowserCapability(
  pool: pg.Pool,
  input: {
    id: string;
    name: string;
    description: string;
    proofLevel: CapabilityProofLevel;
  },
): Promise<void> {
  await pool.query(
    `insert into ros_capability_graph
       (capability_id, name, domain, description, proof_level, success_rate,
        last_verified_at, owner_dependency, registry_ref, meta, updated_at)
     values ($1,$2,'browser',$3,$4, case
                                        when $4='C4_EXTERNAL_ACTION_PROVEN' then 0.5
                                        when $4='C3_PRODUCTION_AVAILABLE'   then 0.3
                                        when $4='C2_TESTED'                 then 0.15
                                        else 0.05
                                      end,
             now(), false, 'ultron-external/browser-operator',
             $5::jsonb, now())
     on conflict (capability_id) do update set
       description = excluded.description,
       proof_level = excluded.proof_level,
       success_rate = excluded.success_rate,
       last_verified_at = now(),
       meta = excluded.meta,
       updated_at = now()`,
    [
      input.id,
      input.name,
      input.description,
      input.proofLevel,
      JSON.stringify({ builtBy: "ultron-external", primitive: true }),
    ],
  );
}

const BROWSER_SKILLS = [
  {
    id: "VERIFY_PUBLIC_ARTIFACT_EXISTS",
    purpose: "Fetch a public URL via a real browser, verify HTTP + title/text, capture screenshot as evidence.",
    capabilitiesUsed: [
      "browser_open_page",
      "browser_read_page",
      "browser_capture_artifact",
      "browser_verify_external_artifact",
    ],
    platform: "web",
    whenToUse: "Any time RevenueOS claims a public artifact exists (E5 gate).",
    whenNotToUse: "URL contains prohibited/captcha-solver phrases.",
    evidenceQuery:
      "select count(*)::int from ros_browser_actions where kind='verify_public_artifact' and result='SUCCESS' and created_at > now() - interval '30 days'",
  },
];

export async function registerBrowserCapabilities(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ capabilities: number; skills: number }> {
  const descByPrim: Record<string, string> = {
    browser_open_page: "Open a URL in a persistent browser context.",
    browser_read_page: "Read DOM/rendered text of the current page.",
    browser_click: "Click a selector.",
    browser_type: "Type a value into a selector.",
    browser_submit_form: "Submit a form and observe response.",
    browser_upload: "Upload a supported file into a file input.",
    browser_download: "Download a supported file into the artifact store.",
    browser_capture_artifact: "Capture a screenshot / DOM hash / text snippet as durable evidence.",
    browser_verify_external_artifact: "Verify an external artifact exists via real browser render + evidence.",
    browser_session_resume: "Resume a prior persistent browser session by session_id.",
  };

  for (const p of BROWSER_PRIMITIVES) {
    const proof = await proofFromExecutions(pool, p);
    await upsertBrowserCapability(pool, {
      id: p,
      name: p,
      description: descByPrim[p] ?? p,
      proofLevel: proof,
    });
  }

  let skills = 0;
  for (const s of BROWSER_SKILLS) {
    let evidence = 0;
    try {
      const r = await pool.query(s.evidenceQuery);
      evidence = Number(r.rows[0]?.count ?? 0);
    } catch {
      evidence = 0;
    }
    const third = await pool.query(
      `select count(*)::int as n from ros_browser_actions
        where kind='verify_public_artifact' and result='SUCCESS'
          and coalesce(surface_class,'') = 'THIRD_PARTY_BROWSER_PROOF'
          and created_at > now() - interval '30 days'`,
    );
    const owned = await pool.query(
      `select count(*)::int as n from ros_browser_actions
        where kind='verify_public_artifact' and result='SUCCESS'
          and created_at > now() - interval '30 days'`,
    );
    const thirdN = Number(third.rows[0]?.n ?? 0);
    const ownedN = Number(owned.rows[0]?.n ?? 0);
    const proof: CapabilityProofLevel =
      thirdN >= 1 ? "C4_EXTERNAL_ACTION_PROVEN"
      : ownedN >= 1 ? "C3_PRODUCTION_AVAILABLE"
      : "C1_IMPLEMENTED";
    await pool.query(
      `insert into ros_skills
         (skill_id, purpose, capabilities_used, executable_impl, platform, domain,
          proof_level, success_count, when_to_use, when_not_to_use, updated_at)
       values ($1,$2,$3,$4::jsonb,$5,'browser',$6,$7,$8,$9, now())
       on conflict (skill_id) do update set
         purpose = excluded.purpose,
         capabilities_used = excluded.capabilities_used,
         proof_level = excluded.proof_level,
         success_count = greatest(ros_skills.success_count, excluded.success_count),
         updated_at = now()`,
      [
        s.id,
        s.purpose,
        s.capabilitiesUsed,
        JSON.stringify({
          module: "ultron-external/browser-operator",
          export: "verifyPublicArtifactExists",
          ownedSurfaceProof: ownedN,
          thirdPartyProof: thirdN,
        }),
        s.platform,
        proof,
        evidence,
        s.whenToUse,
        s.whenNotToUse,
      ],
    );
    skills++;
  }

  logger("info", "ultron.browser.registered", {
    capabilities: BROWSER_PRIMITIVES.length,
    skills,
  });
  return { capabilities: BROWSER_PRIMITIVES.length, skills };
}
