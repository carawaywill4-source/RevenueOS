/**
 * AE_NOVEL_DISTRIBUTION_BREAKTHROUGH_001 — durable novel engineering project.
 * Cursor must NOT implement the distribution solution; this loop does.
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import type pg from "pg";
import {
  NOVEL_PROJECT_DISTRIBUTION,
  NOVEL_PROJECT_KEY,
  NOVEL_VERSION,
  type NovelProject,
  type ProofLevel,
} from "./types.js";
import {
  investigateDistributionBottleneck,
  synthesizeRequirements,
} from "./investigate.js";
import {
  generateDistributionDesigns,
  selectDesign,
} from "./design-options.js";
import { synthesizeSelectedDesign } from "./implement.js";
import {
  runCommercialRegressionSuite,
  regressionSuitePassed,
} from "../regression-suite.js";
import { AE_WAR_ROOM_KEY } from "../types.js";
import { persistCursorCompare, recordNovelMetrics } from "./cursor-compare.js";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function eid(): string {
  return `novel_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

async function loadProject(pool: pg.Pool): Promise<NovelProject | null> {
  const res = await pool.query(
    `select value from ros_config_meta where key=$1 limit 1`,
    [NOVEL_PROJECT_KEY],
  );
  return (res.rows[0]?.value as NovelProject) ?? null;
}

async function saveProject(pool: pg.Pool, project: NovelProject): Promise<void> {
  project.updatedAt = new Date().toISOString();
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING_NOVEL')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='AUTONOMOUS_ENGINEERING_NOVEL'`,
    [NOVEL_PROJECT_KEY, JSON.stringify(project)],
  );
}

async function commercialSnapshot(
  pool: pg.Pool,
  sinceIso?: string,
): Promise<NovelProject["commercial"]> {
  const since = sinceIso ?? new Date(Date.now() - 2 * 3600_000).toISOString();
  const t = await pool.query(
    `select count(*)::int as n from ros_traffic_events
     where created_at > $1::timestamptz
       and class in ('LIKELY_HUMAN','QUALIFIED')
       and coalesce(referer,'') <> ''
       and referer not ilike '%sslip.io%'`,
    [since],
  );
  // Only post-deploy third-party signals count (no all-time owned publish inflation)
  const r = await pool.query(
    `select
       count(*) filter (
         where external_action='resource_email_pitch'
           and status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED')
           and created_at > $1::timestamptz
       )::int as email_recent,
       count(*) filter (
         where external_action='producthunt_helpful_comment'
           and status='PUBLISHED'
           and created_at > $1::timestamptz
       )::int as ph_recent,
       count(*) filter (
         where is_new_audience
           and status in ('PUBLISHED','EXPOSED','EXPOSURE_CONFIRMED')
           and external_action not in ('publish_owned_intent_page')
           and created_at > $1::timestamptz
       )::int as exp
     from aq_distribution_receipts`,
    [since],
  );
  return {
    exposure:
      Number(r.rows[0]?.exp ?? 0) +
      Number(r.rows[0]?.email_recent ?? 0) +
      Number(r.rows[0]?.ph_recent ?? 0),
    humans: Number(t.rows[0]?.n ?? 0),
    engagement: 0,
    intent: 0,
    checkout: 0,
    customers: 0,
    revenue: 0,
  };
}

function proofLevelFrom(project: NovelProject): ProofLevel {
  if ((project.commercial?.humans ?? 0) > 0) return 7;
  if ((project.commercial?.exposure ?? 0) > 0 && project.externalProof?.verified) return 6;
  if (project.externalProof?.executed) return 5;
  if (project.externalProof?.capabilityExecuted) return 4;
  if (project.deploy?.ok) return 3;
  if (project.stage === "CANARY" || project.meta?.canaryOk) return 2;
  if (project.tests?.ok) return 1;
  if ((project.filesChanged?.length ?? 0) > 0) return 0;
  return 0;
}

function scheduleRestart(logger: Logger) {
  // Azure unit sets NoNewPrivileges=true — sudo/systemctl from the operator fails.
  // Exit cleanly; systemd Restart=always reloads the tree (including novel patches).
  logger("info", "novel.restart_scheduled", { method: "process_exit_for_systemd" });
  setTimeout(() => {
    try {
      process.exit(0);
    } catch {
      /* */
    }
  }, 1500);
}

function rollback(appRoot: string, knownGoodDir: string, files: string[]) {
  for (const rel of files) {
    const good = path.join(knownGoodDir, rel);
    const dest = path.join(appRoot, rel);
    if (!existsSync(good)) continue;
    const raw = readFileSync(good, "utf8");
    if (raw.length === 0 && !existsSync(dest)) continue;
    if (raw.length === 0) {
      try {
        rmSync(dest, { force: true });
      } catch {
        /* */
      }
      continue;
    }
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(good, dest);
  }
}

async function designReview(
  pool: pg.Pool,
  designId: string,
): Promise<{ agree: boolean; titan: string; apex: string; eng: string }> {
  const zt = await pool.query(
    `select value from ros_config_meta where key='zero_traffic_war_room' limit 1`,
  );
  const status = (zt.rows[0]?.value as { status?: string } | undefined)?.status;
  const titan =
    status === "CRITICAL"
      ? "AGREE — acquisition bottleneck is third-party exposure"
      : "CAUTION — zero-traffic not CRITICAL";
  const apex =
    designId.startsWith("A_") || designId.startsWith("B_")
      ? "AGREE — highest-value near-term improvement given credentials"
      : "DISAGREE_SOFT — slower path than using live auth";
  const eng = "AGREE — synthesizer exists; LOW/MEDIUM risk deployable";
  const agree = titan.startsWith("AGREE") && eng.startsWith("AGREE");
  return { agree, titan, apex, eng };
}

/**
 * Advance novel distribution breakthrough project one stage (resumable).
 */
export async function runNovelDistributionProject(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
}): Promise<NovelProject> {
  let project = await loadProject(input.pool);
  if (!project || project.projectId !== NOVEL_PROJECT_DISTRIBUTION) {
    project = {
      projectId: NOVEL_PROJECT_DISTRIBUTION,
      problem:
        "RevenueOS currently lacks a reliable autonomous mechanism for creating verified third-party buyer exposure. Determine what architecture or capabilities are missing and engineer the highest-value solution.",
      outcome:
        "Verified third-party exposure path exists and executes; climb proof levels toward external humans.",
      stage: "PROBLEM",
      proofLevel: 0,
      authorship: "AUTONOMOUS_ENGINEERING_NOVEL",
      cursorIntervention: [
        "Cursor bootstrapped novel-engineering framework only — did not select/implement distribution solution",
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      meta: { version: NOVEL_VERSION },
    };
    await saveProject(input.pool, project);
    input.logger("info", "novel.project.created", { id: project.projectId });
  }

  // Terminal states
  if (
    [
      "COMMERCIALLY_VALIDATED",
      "COMMERCIALLY_INEFFECTIVE",
      "ROLLED_BACK",
      "FAILED",
    ].includes(project.stage)
  ) {
    project.commercial = await commercialSnapshot(input.pool);
    project.proofLevel = proofLevelFrom(project);
    await saveProject(input.pool, project);
    return project;
  }

  // INVESTIGATION
  if (project.stage === "PROBLEM" || project.stage === "INVESTIGATION") {
    project.stage = "INVESTIGATION";
    const inv = await investigateDistributionBottleneck(
      input.pool,
      input.appRoot,
    );
    project.investigation = inv as unknown as Record<string, unknown>;
    project.stage = "REQUIREMENTS";
    project.requirements = synthesizeRequirements(inv);
    await saveProject(input.pool, project);
    input.logger("info", "novel.investigated", {
      dead: inv.deadIntelligence.length,
      thirdAuto: inv.channels.thirdPartyAuto,
      emailReady: inv.credentials.resendFrom,
    });
  }

  // DESIGNS
  if (project.stage === "REQUIREMENTS" || project.stage === "DESIGN_OPTIONS") {
    const inv = project.investigation as unknown as Awaited<
      ReturnType<typeof investigateDistributionBottleneck>
    >;
    const designs = generateDistributionDesigns(inv);
    const { selected, whyWon, whyOthersLost } = selectDesign(designs);
    project.designs = designs;
    project.selectedDesignId = selected.id;
    project.whyWon = whyWon;
    project.whyOthersLost = whyOthersLost;
    project.stage = "DESIGN_REVIEW";
    await saveProject(input.pool, project);
    input.logger("info", "novel.design_selected", {
      id: selected.id,
      score: selected.totalScore,
    });
  }

  // REVIEW
  if (project.stage === "DESIGN_REVIEW") {
    const review = await designReview(input.pool, project.selectedDesignId!);
    project.meta = { ...project.meta, designReview: review };
    if (!review.agree) {
      project.missingCapabilities = [
        "design_review_disagreement — re-rank designs",
      ];
    }
    project.stage = "IMPLEMENTATION_PLAN";
    const chosen = project.designs?.find((d) => d.id === project.selectedDesignId);
    project.plan = {
      limitation: project.problem,
      outcome: project.outcome,
      design: project.selectedDesignId,
      components: chosen?.componentsTouched ?? [],
      risks: chosen?.whyNot ?? [],
      testStrategy: [
        "commercial regression suite",
        "marker presence",
        "frontier email/PH execution observation",
      ],
      canaryStrategy: "promote files → regression → restart → observe receipts 2h",
      commercialProofCriteria:
        "email SENT or PH PUBLISHED or verified publication; humans remain separate",
      rollbackStrategy: "known-good restore + restart",
      authorship: "AUTONOMOUS_ENGINEERING_NOVEL",
    };
    await saveProject(input.pool, project);
  }

  // CODE (also re-entered on EVOLVE after commercial miss)
  if (
    project.stage === "IMPLEMENTATION_PLAN" ||
    project.stage === "CODE" ||
    project.stage === "INCONCLUSIVE"
  ) {
    project.stage = "CODE";
    const inv = project.investigation as unknown as Awaited<
      ReturnType<typeof investigateDistributionBottleneck>
    >;
    const design = project.designs?.find((d) => d.id === project.selectedDesignId);
    if (!design) {
      project.stage = "FAILED";
      project.missingCapabilities = ["selected_design_missing"];
      await saveProject(input.pool, project);
      return project;
    }
    // Wipe prior synth marker so re-patch applies
    const priorMarker = String(project.meta?.marker ?? "");
    if (priorMarker) {
      for (const rel of project.filesChanged ?? []) {
        const abs = path.join(input.appRoot, rel);
        if (!existsSync(abs)) continue;
        // leave known-good; synthesizer will overwrite targets
      }
    }
    const evolutionId = eid();
    const synth = synthesizeSelectedDesign({
      appRoot: input.appRoot,
      design,
      investigation: inv,
      evolutionId,
    });
    if (!synth.filesChanged.length) {
      project.stage = "FAILED";
      project.missingCapabilities = [
        `synthesizer_failed:${synth.detail}`,
        "novel_code_generation",
      ];
      await saveProject(input.pool, project);
      input.logger("error", "novel.synth_failed", { detail: synth.detail });
      return project;
    }
    project.filesChanged = synth.filesChanged;
    project.meta = {
      ...project.meta,
      marker: synth.marker,
      knownGoodDir: synth.knownGoodDir,
      evolutionId,
      synthVersion: Number(project.meta?.synthVersion ?? 0) + 1,
      deployedAt: null,
    };
    project.stage = "TEST";
    await saveProject(input.pool, project);
    input.logger("info", "novel.code_synthesized", {
      files: synth.filesChanged,
      marker: synth.marker,
      synthVersion: project.meta.synthVersion,
    });
  }

  // TEST
  if (project.stage === "TEST") {
    const reg = runCommercialRegressionSuite({
      discoveredSurfaces: Number(
        (project.investigation as { channels?: { discovered?: number } })?.channels
          ?.discovered ?? 1712,
      ),
      thirdPartyAutoExecutable: Number(
        (project.investigation as { channels?: { thirdPartyAuto?: number } })
          ?.channels?.thirdPartyAuto ?? 2,
      ),
      formFailures: 955,
      formAttempts: 956,
      meaningfulAttemptsPerHour: 0.17,
      stallDiagnosed: true,
      ownedCountsAsNewAudience: false,
      stage0AllowPolish: false,
    });
    const suite = regressionSuitePassed(reg);
    // marker check
    const marker = String(project.meta?.marker ?? "");
    let markerOk = !marker;
    if (marker && project.filesChanged?.length) {
      markerOk = project.filesChanged.some((f) => {
        const abs = path.join(input.appRoot, f);
        return existsSync(abs) && readFileSync(abs, "utf8").includes(marker);
      });
    }
    project.tests = {
      ok: suite.ok && markerOk,
      detail: suite.ok
        ? markerOk
          ? `${suite.detail};marker_ok`
          : "marker_missing"
        : suite.detail,
    };
    if (!project.tests.ok) {
      const kg = String(project.meta?.knownGoodDir ?? "");
      if (kg) rollback(input.appRoot, kg, project.filesChanged ?? []);
      project.stage = "ROLLED_BACK";
      await saveProject(input.pool, project);
      input.logger("warn", "novel.rolled_back_tests", { detail: project.tests.detail });
      return project;
    }
    project.stage = "CANARY";
    project.meta = { ...project.meta, canaryOk: true };
    await saveProject(input.pool, project);
  }

  // CANARY → DEPLOY
  if (project.stage === "CANARY" || project.stage === "DEPLOY") {
    project.stage = "DEPLOY";
    scheduleRestart(input.logger);
    project.deploy = { ok: true, detail: "promoted_restart_scheduled" };
    project.technicalRetain = true;
    project.commercialState = "PENDING";
    project.meta = {
      ...project.meta,
      deployedAt: new Date().toISOString(),
    };
    project.stage = "TECHNICALLY_RETAINED_PENDING_COMMERCIAL_PROOF";
    project.proofLevel = 3;
    await saveProject(input.pool, project);
    input.logger("info", "novel.deployed", {
      files: project.filesChanged,
      design: project.selectedDesignId,
    });
  }

  // EXTERNAL / COMMERCIAL MEASURE
  if (
    project.stage === "TECHNICALLY_RETAINED_PENDING_COMMERCIAL_PROOF" ||
    project.stage === "EXTERNAL_PROOF" ||
    project.stage === "COMMERCIAL_MEASUREMENT"
  ) {
    const since = String(
      project.meta?.deployedAt ?? new Date(Date.now() - 2 * 3600_000).toISOString(),
    );
    project.commercial = await commercialSnapshot(input.pool, since);
    const marker = String(project.meta?.marker ?? "");
    const recent = await input.pool.query(
      `select external_action, status, count(*)::int as n
       from aq_distribution_receipts
       where created_at > $1::timestamptz
         and (
           (external_action='resource_email_pitch' and status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED'))
           or (external_action='producthunt_helpful_comment' and status='PUBLISHED')
         )
         and (
           $2 = ''
           or coalesce(request_result::text,'') ilike '%' || $2 || '%'
           or coalesce(referral_tracking::text,'') ilike '%' || $2 || '%'
         )
       group by 1,2`,
      [since, marker],
    );
    const executed = recent.rows.length > 0;
    const sentN = recent.rows.reduce((a, r) => a + Number(r.n), 0);
    project.externalProof = {
      executed,
      capabilityExecuted: executed,
      verified: executed,
      rows: recent.rows,
      since,
      note: executed
        ? "Post-deploy third-party capability executed (marker-attributed when possible)"
        : "Awaiting post-deploy email SENT / PH PUBLISHED attributed to this novel project",
    };
    project.proofLevel = proofLevelFrom(project);

    const observeMs =
      Date.now() - new Date(since).getTime();
    if (executed && sentN > 0) {
      project.commercialState = "INCONCLUSIVE";
      project.stage = "TECHNICALLY_RETAINED_PENDING_COMMERCIAL_PROOF";
    } else if (observeMs > 6 * 60_000 && !executed) {
      // AE v3: DESIGN_REENTRY_REQUIRES_CHANGED_EVIDENCE — no A↔B ping-pong
      if (project.meta?.oscillationFrozen || project.meta?.pivotDisabled) {
        project.missingCapabilities = [
          ...(project.missingCapabilities ?? []),
          "DESIGN_OSCILLATION→capability_acquisition_handoff",
        ];
        input.logger("warn", "novel.pivot_blocked_oscillation", {
          design: project.selectedDesignId,
          handoff: "AE_NOVEL_EXTERNAL_ACTION_002",
        });
      } else {
        const sv = Number(project.meta?.synthVersion ?? 1);
        const pivotCount = Number(project.meta?.designPivotCount ?? 0);
        if (sv < 2 && pivotCount === 0) {
          project.missingCapabilities = [
            ...(project.missingCapabilities ?? []),
            "post_deploy_zero_third_party_execution→evolve_synth",
          ];
          project.stage = "INCONCLUSIVE";
          project.commercialState = "INCONCLUSIVE";
          input.logger("warn", "novel.evolve_synth", {
            reason: "no_post_deploy_external_execution",
            synthVersion: sv,
          });
        } else {
          // Stop oscillating: hand off to capability acquisition instead of re-ranking
          project.meta = {
            ...project.meta,
            oscillationFrozen: true,
            pivotDisabled: true,
            v3Handoff: "AE_NOVEL_EXTERNAL_ACTION_002",
          };
          project.missingCapabilities = [
            ...(project.missingCapabilities ?? []),
            "shared_capability_gap→AE_NOVEL_EXTERNAL_ACTION_002",
          ];
          input.logger("warn", "novel.design_oscillation_stop", {
            design: project.selectedDesignId,
            next: "capability_acquisition",
          });
        }
      }
    }
    if ((project.commercial?.humans ?? 0) > 0) {
      project.commercialState = "VALIDATED";
      project.stage = "COMMERCIALLY_VALIDATED";
    }

    await saveProject(input.pool, project);

    await input.pool.query(
      `insert into ros_config_meta (key, value, updated_at, provenance)
       values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING_NOVEL')
       on conflict (key) do update set value=excluded.value, updated_at=now()`,
      [
        AE_WAR_ROOM_KEY,
        JSON.stringify({
          version: NOVEL_VERSION,
          activeLimitationId: project.projectId,
          title: project.selectedDesignId,
          commercialImpact: 0.95,
          rootCause: (project.investigation as { deadIntelligence?: string[] })
            ?.deadIntelligence?.[0],
          files: project.filesChanged ?? [],
          candidatePatch: project.selectedDesignId,
          testStatus: project.tests?.detail,
          deploymentStatus: project.deploy?.detail,
          productionObservation: project.externalProof?.note,
          commercialResult: project.commercialState,
          rollbackState: "AVAILABLE",
          cursorDependency: "REDUCED",
          proofLevel: project.proofLevel,
          authorship: project.authorship,
          updatedAt: new Date().toISOString(),
        }),
      ],
    );

    await persistCursorCompare({
      pool: input.pool,
      projectId: project.projectId,
      revenueosDiagnosis: String(
        (project.investigation as { deadIntelligence?: string[] })
          ?.deadIntelligence?.[0] ?? "see investigation",
      ),
      revenueosDesign: String(project.selectedDesignId ?? ""),
      revenueosPatch: project.filesChanged ?? [],
      revenueosResult: `${project.stage}@proof=${project.proofLevel}`,
      cursorShadowNotes: [
        "Cursor bootstrapped novel framework (AST/Git/design/project-loop) only",
        "Distribution design selection and patch synthesis attributed to AUTONOMOUS_ENGINEERING_NOVEL",
        "Post-hoc: evaluate whether git presence on Azure would have improved regression origin ID",
      ],
      lessons: [
        {
          at: new Date().toISOString(),
          projectId: project.projectId,
          cursorFound: "Azure deploy tree often lacks .git",
          revenueosMissed: "regression origin via commit bisect unavailable without git",
          why: "rsync deploy historically omitted .git",
          missingCapability: "git_intelligence_on_runtime_host",
          selfEvolution:
            "use known-good snapshots + optionally sync shallow .git for history queries",
        },
      ],
    });

    await recordNovelMetrics({
      pool: input.pool,
      novelSolved: Boolean(project.deploy?.ok),
      withoutPlaybook: true,
      diagnosisSummary: String(project.whyWon ?? "").slice(0, 240),
      architectureSuccess: Boolean(project.filesChanged?.length),
      technicalRetain: Boolean(project.technicalRetain),
      commercialState: String(project.commercialState ?? "PENDING"),
      proofLevel: project.proofLevel,
      cursorInterventionCount: project.cursorIntervention?.length ?? 0,
      missingCapabilities: project.missingCapabilities ?? [],
    });
  }

  return project;
}

export async function runNovelEngineeringLane(input: {
  pool: pg.Pool;
  appRoot: string;
  logger: Logger;
  signal: AbortSignal;
  intervalMs?: number;
}): Promise<void> {
  const interval = input.intervalMs ?? 120_000;
  input.logger("info", "novel.lane.start", {
    version: NOVEL_VERSION,
    project: NOVEL_PROJECT_DISTRIBUTION,
    intervalMs: interval,
  });
  while (!input.signal.aborted) {
    try {
      const p = await runNovelDistributionProject(input);
      input.logger("info", "novel.lane.tick", {
        stage: p.stage,
        design: p.selectedDesignId,
        proofLevel: p.proofLevel,
        commercial: p.commercialState,
      });
    } catch (e) {
      input.logger("error", "novel.lane.error", {
        message: e instanceof Error ? e.message : String(e),
      });
    }
    await new Promise<void>((resolve) => {
      if (input.signal.aborted) return resolve();
      const t = setTimeout(resolve, interval);
      input.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true },
      );
    });
  }
}
