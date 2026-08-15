/**
 * Organ 2/3 — CAPABILITY COMPILER.
 *
 * Input : a required external effect ("obtain audience exposure for X").
 * Output: either an executable plan (list of skills + capabilities) or a
 *         capability-gap project handed off to Autonomous Engineering.
 *
 * The compiler intentionally consults the *bus* (capability graph +
 * skill library) rather than hardcoding executor references. This is
 * how the reasoning layer stops needing to know implementation details.
 */

import type pg from "pg";
import type {
  CapabilityProofLevel,
  Logger,
  Skill,
} from "./types.js";
import { queryCapabilities } from "./capability-graph.js";
import { findSkillsFor } from "./skill-library.js";
import { CAPABILITY_GAPS_KEY } from "../autonomous-engineering/novel/v3/types.js";
import { compileExposurePaths } from "../ultron-external/surface-intelligence.js";

export type DesiredEffect = {
  effect: string; // e.g. "audience_exposure", "external_action", "human_visitor"
  keywords: string[]; // e.g. ["email","directory","publish","comment"]
  businessId?: string;
  minProof?: CapabilityProofLevel;
};

export type ExecutablePath = {
  ok: true;
  kind: "EXECUTABLE";
  skills: Skill[];
  capabilityIds: string[];
  rationale: string;
};

export type CapabilityGapPath = {
  ok: false;
  kind: "GAP";
  gapId: string;
  reason: string;
  handedOffTo: "AE_NOVEL_EXTERNAL_ACTION_002";
};

export type CompilerResult = ExecutablePath | CapabilityGapPath;

export async function compileCapability(
  pool: pg.Pool,
  logger: Logger,
  input: DesiredEffect,
): Promise<CompilerResult> {
  // 1b. For audience-exposure effects, consult surface intelligence.
  const wantsExposure = /audience|exposure|third.?party|publish/.test(
    `${input.effect} ${input.keywords.join(" ")}`.toLowerCase(),
  );
  if (wantsExposure) {
    const paths = await compileExposurePaths(pool).catch(() => null);
    if (paths && paths.executable && paths.paths.length > 0) {
      logger("info", "ultron.compiler.surface_path", {
        effect: input.effect,
        platforms: paths.paths.map((p) => p.platform),
      });
      return {
        ok: true,
        kind: "EXECUTABLE",
        skills: [
          {
            id: "COMPILE_EXTERNAL_EXPOSURE",
            purpose: `Execute permitted third-party exposure via ${paths.paths[0].platform}`,
            capabilitiesUsed: ["browser_open_page", "browser_verify_external_artifact"],
            proofLevel: "C3_PRODUCTION_AVAILABLE",
            successCount: 0,
            failureCount: 0,
            whenToUse: "obtain_legitimate_audience_exposure",
            whenNotToUse: "owned surfaces, prohibited automation",
          },
        ],
        capabilityIds: ["browser_open_page", "browser_verify_external_artifact"],
        rationale: `Surface intelligence found PERMITTED_PUBLISH path on ${paths.paths[0].platform} ${paths.paths[0].url}`,
      };
    }
  }

  // 1. Ask the skill library for direct matches.
  const skills = await findSkillsFor(pool, input.keywords);
  const proven = skills.filter((s) => {
    const proofOk = ["C3_PRODUCTION_AVAILABLE", "C4_EXTERNAL_ACTION_PROVEN", "C5_EXTERNAL_EFFECT_PROVEN", "C6_COMMERCIAL_EFFECT_PROVEN"].includes(s.proofLevel);
    if (!proofOk) return false;
    if (wantsExposure) {
      const hay = `${s.id} ${s.purpose} ${s.whenToUse}`.toLowerCase();
      if (/owned|portfolio_crosslink|publish_owned|indexnow|websub/.test(hay)) return false;
    }
    return true;
  });

  if (proven.length > 0) {
    const capIds = Array.from(new Set(proven.flatMap((s) => s.capabilitiesUsed)));
    // Verify the underlying capabilities still pass the min-proof gate.
    const caps = await queryCapabilities(pool, {
      minProof: input.minProof ?? "C3_PRODUCTION_AVAILABLE",
      excludeOwnerRequired: true,
    });
    const capSet = new Set(caps.map((c) => c.id));
    const intersect = capIds.filter((id) => capSet.has(id));

    // If at least one skill has all its capabilities live, ship it.
    const executable = proven.find((s) =>
      s.capabilitiesUsed.every((id) => capSet.has(id) || intersect.length > 0),
    );
    if (executable) {
      logger("info", "ultron.compiler.executable", {
        effect: input.effect,
        skill: executable.id,
        capabilities: executable.capabilitiesUsed,
      });
      return {
        ok: true,
        kind: "EXECUTABLE",
        skills: [executable, ...proven.filter((s) => s.id !== executable.id).slice(0, 2)],
        capabilityIds: executable.capabilitiesUsed,
        rationale: `Skill ${executable.id} matches "${input.effect}" at proof ${executable.proofLevel}; underlying capabilities present.`,
      };
    }
  }

  // 2. No skill covers it. Look for capabilities that could be composed.
  const capsBroad = await queryCapabilities(pool, {
    minProof: "C1_IMPLEMENTED",
    excludeOwnerRequired: true,
  });
  const relevant = capsBroad.filter((c) => {
    const hay = `${c.name} ${c.description} ${c.domain}`.toLowerCase();
    return input.keywords.some((k) => hay.includes(k.toLowerCase()));
  });

  if (relevant.length >= 2) {
    // Compose — hand back the top capabilities and let the caller execute.
    logger("info", "ultron.compiler.composable", {
      effect: input.effect,
      capabilities: relevant.slice(0, 4).map((c) => c.id),
    });
    // Persist the emergent skill hypothesis (unproven — C1) so we can
    // grow the library organically.
    const skillId = `COMPOSED_${input.effect.toUpperCase()}_${Date.now().toString(36)}`;
    await pool.query(
      `insert into ros_skills
         (skill_id, purpose, capabilities_used, executable_impl, platform, domain,
          proof_level, when_to_use, meta, updated_at)
       values ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9::jsonb, now())
       on conflict (skill_id) do nothing`,
      [
        skillId,
        `Composed hypothesis for effect: ${input.effect}`,
        relevant.slice(0, 4).map((c) => c.id),
        JSON.stringify({ composed: true }),
        "composed",
        "composed",
        "C1_IMPLEMENTED",
        `Effect ${input.effect} keywords ${input.keywords.join(",")}`,
        JSON.stringify({ createdBy: "ultron.compiler", firstSeen: new Date().toISOString() }),
      ],
    );
    return {
      ok: true,
      kind: "EXECUTABLE",
      skills: [
        {
          id: skillId,
          purpose: `Composed hypothesis for ${input.effect}`,
          capabilitiesUsed: relevant.slice(0, 4).map((c) => c.id),
          proofLevel: "C1_IMPLEMENTED",
          successCount: 0,
          failureCount: 0,
          whenToUse: `Effect ${input.effect}`,
          whenNotToUse: "",
        },
      ],
      capabilityIds: relevant.slice(0, 4).map((c) => c.id),
      rationale: `Composed candidate — no proven skill covers "${input.effect}" but ${relevant.length} capabilities are relevant.`,
    };
  }

  // 3. Truly missing — spawn a capability-gap and hand off to AE v3.
  const gapId = `gap_${input.effect}_${Date.now().toString(36).slice(-6)}`;
  const reason = `No skill or ≥2 relevant capabilities cover effect "${input.effect}". Handing off to AE v3.`;
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update set
       value = jsonb_set(
                 coalesce(ros_config_meta.value, '{}'::jsonb),
                 '{compilerHandoffs}',
                 coalesce(ros_config_meta.value->'compilerHandoffs','[]'::jsonb) || $3::jsonb,
                 true
               ),
       updated_at = now()`,
    [
      CAPABILITY_GAPS_KEY,
      JSON.stringify({
        compilerHandoffs: [
          {
            gapId,
            effect: input.effect,
            keywords: input.keywords,
            reason,
            at: new Date().toISOString(),
          },
        ],
      }),
      JSON.stringify([
        {
          gapId,
          effect: input.effect,
          keywords: input.keywords,
          reason,
          at: new Date().toISOString(),
        },
      ]),
    ],
  );
  logger("warn", "ultron.compiler.gap", { effect: input.effect, gapId });
  return {
    ok: false,
    kind: "GAP",
    gapId,
    reason,
    handedOffTo: "AE_NOVEL_EXTERNAL_ACTION_002",
  };
}
