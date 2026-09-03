/**
 * Production-evidence → engineering backlog (profit-aware ranking).
 */

import type pg from "pg";
import { ensureAutonomousEngineeringTables } from "./schema.js";
import { AE_BACKLOG_KEY, type EngineeringLimitation } from "./types.js";

function rankScore(l: EngineeringLimitation): number {
  const cost = Math.max(0.15, l.complexity);
  const riskPenalty = l.risk === "HIGH" ? 2.2 : l.risk === "MEDIUM" ? 1.3 : 1;
  return (
    (l.expectedValueOfFix *
      l.rootCauseConfidence *
      (0.5 + l.commercialImpact * 0.5)) /
    (cost * riskPenalty)
  );
}

async function upsertLimitation(
  pool: pg.Pool,
  l: EngineeringLimitation,
  rca?: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `insert into ros_eng_limitations (
       limitation_id, title, commercial_impact, evidence, root_cause_confidence,
       affected_components, expected_value, risk, complexity, proposed_solutions,
       selected_solution_id, test_plan, status, technical_success, commercial_success,
       hypothesis_confidence, implementation_confidence, test_confidence,
       commercial_confidence, root_cause_report, updated_at
     ) values (
       $1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13,$14,$15,
       $16,$17,$18,$19,$20::jsonb,now()
     )
     on conflict (limitation_id) do update set
       commercial_impact=excluded.commercial_impact,
       evidence=excluded.evidence,
       root_cause_confidence=excluded.root_cause_confidence,
       expected_value=excluded.expected_value,
       proposed_solutions=excluded.proposed_solutions,
       status=case
         when ros_eng_limitations.status in ('RETAINED','ROLLED_BACK','DEPLOYING','OBSERVING','PATCHING','TESTING','CANARY')
           then ros_eng_limitations.status
         else excluded.status
       end,
       root_cause_report=excluded.root_cause_report,
       updated_at=now()`,
    [
      l.limitationId,
      l.title,
      l.commercialImpact,
      JSON.stringify(l.evidence),
      l.rootCauseConfidence,
      l.affectedComponents,
      l.expectedValueOfFix,
      l.risk,
      l.complexity,
      JSON.stringify(l.proposedSolutions),
      l.selectedSolutionId,
      JSON.stringify(l.testPlan),
      l.status,
      l.technicalSuccessCriteria,
      l.commercialSuccessCriteria,
      l.hypothesisConfidence,
      l.implementationConfidence,
      l.testConfidence,
      l.commercialConfidence,
      JSON.stringify(rca ?? {}),
    ],
  );
}

function lim(
  partial: Omit<EngineeringLimitation, "createdAt" | "updatedAt"> & {
    createdAt?: string;
    updatedAt?: string;
  },
): EngineeringLimitation {
  const now = new Date().toISOString();
  return { ...partial, createdAt: partial.createdAt ?? now, updatedAt: now };
}

export async function rebuildEngineeringBacklog(
  pool: pg.Pool,
): Promise<EngineeringLimitation[]> {
  await ensureAutonomousEngineeringTables(pool);

  const zt = await pool.query(
    `select value from ros_config_meta where key='zero_traffic_war_room' limit 1`,
  );
  const ztDoc = (zt.rows[0]?.value ?? {}) as {
    status?: string;
    meaningfulAttemptsPerHour?: number;
    channelReality?: Record<string, number>;
  };
  const humans = await pool.query(
    `select count(*)::int as n from ros_traffic_events
     where created_at > now() - interval '48 hours'
       and class in ('LIKELY_HUMAN','QUALIFIED')
       and coalesce(referer,'') <> ''
       and referer not ilike '%sslip.io%'`,
  );
  const verifiedHumans = Number(humans.rows[0]?.n ?? 0);
  const emailOk = await pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where external_action='resource_email_pitch'
       and status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED')
       and created_at > now() - interval '24 hours'`,
  );
  const lessons = await pool.query(
    `select value from ros_config_meta where key='commercial_comms_lessons' limit 1`,
  );
  const lessonDoc = (lessons.rows[0]?.value ?? {}) as { lessons?: unknown[] };
  const lessonCount = Array.isArray(lessonDoc.lessons)
    ? lessonDoc.lessons.length
    : 0;
  const newAudienceSrc = await pool.query(
    // presence of steering marker checked later by playbook; evidence from config
    `select 1`,
  );
  void newAudienceSrc;

  const items: EngineeringLimitation[] = [
    lim({
      limitationId: "eng_commercial_memory_steering",
      title: "Commercial memory weakly steers outbound execution",
      commercialImpact: 0.85,
      evidence: [
        `commercial_comms_lessons_count=${lessonCount}`,
        "capability_reality: lessons persist but rarely change family/executor",
        "ONE LICENSE regression lesson persisted",
      ],
      rootCauseConfidence: 0.9,
      affectedComponents: [
        "capability-reality/commercial-comms.ts",
        "titan-commercial-executive/new-audience.ts",
      ],
      expectedValueOfFix: 0.88,
      risk: "LOW",
      complexity: 0.25,
      proposedSolutions: [
        {
          id: "A_load_lessons_into_gate",
          summary: "Load commercial_comms_lessons into quality gate + preferFamily bias",
          pros: ["low risk", "uses existing memory", "immediate"],
          cons: ["does not create new channels"],
          score: 0.92,
        },
        {
          id: "B_rewrite_prompt_only",
          summary: "Change email templates only",
          pros: ["simple"],
          cons: ["no learning loop"],
          score: 0.45,
        },
      ],
      selectedSolutionId: "A_load_lessons_into_gate",
      testPlan: [
        "commercial-regression.email_quality",
        "unit: lessons increase reject on vague copy",
        "deploy + confirm marker COMMERCIAL_MEMORY_STEERING_V1",
      ],
      status: "DETECTED",
      technicalSuccessCriteria:
        "COMMERCIAL_MEMORY_STEERING_V1 marker present; lessons loaded before send",
      commercialSuccessCriteria:
        "Fewer vague owner/email pitches; more quality-gated structured asks",
      hypothesisConfidence: 0.9,
      implementationConfidence: 0.85,
      testConfidence: 0.8,
      commercialConfidence: 0.35,
    }),
    lim({
      limitationId: "eng_inbound_email",
      title: "Inbound email intelligence incomplete",
      commercialImpact: 0.9,
      evidence: [
        "Resend receiving=disabled on tributeready.org",
        "Outbound proven; replies cannot enter Titan loop",
      ],
      rootCauseConfidence: 0.85,
      affectedComponents: ["capability-reality/inbound-intel.ts", "resend"],
      expectedValueOfFix: 0.9,
      risk: "MEDIUM",
      complexity: 0.55,
      proposedSolutions: [
        {
          id: "A_enable_receiving_webhook",
          summary: "Enable Resend receiving + webhook ingest",
          pros: ["real-time", "provider-native"],
          cons: ["needs MX/DNS — may be owner"],
          score: 0.7,
        },
        {
          id: "B_api_poll",
          summary: "Poll Resend received emails API",
          pros: ["no MX if available"],
          cons: ["provider coupling", "latency"],
          score: 0.55,
        },
      ],
      selectedSolutionId: "A_enable_receiving_webhook",
      testPlan: ["classifyInboundReply unit", "ingest → lesson"],
      status: "DETECTED",
      technicalSuccessCriteria: "Inbound message stored + classified",
      commercialSuccessCriteria: "Reply changes future outreach behavior",
      hypothesisConfidence: 0.8,
      implementationConfidence: 0.4,
      testConfidence: 0.5,
      commercialConfidence: 0.5,
    }),
    lim({
      limitationId: "eng_third_party_distribution",
      title: "Only ~2 partial third-party executable capabilities",
      commercialImpact: 0.95,
      evidence: [
        `zero_traffic=${ztDoc.status}`,
        `thirdPartyAuto=${ztDoc.channelReality?.thirdPartyAutoExecutable ?? "?"}`,
        `verifiedHumans48h=${verifiedHumans}`,
      ],
      rootCauseConfidence: 0.95,
      affectedComponents: ["capability-reality", "acquisitionos", "adapters"],
      expectedValueOfFix: 0.95,
      risk: "MEDIUM",
      complexity: 0.7,
      proposedSolutions: [
        {
          id: "A_expand_authenticated_adapters",
          summary: "Prove PH publish + add directory adapters with verification",
          pros: ["direct exposure path"],
          cons: ["platform rules", "partial auth"],
          score: 0.75,
        },
      ],
      selectedSolutionId: "A_expand_authenticated_adapters",
      testPlan: ["distribution capability registry counts", "receipt verification"],
      status: "DETECTED",
      technicalSuccessCriteria: "≥1 new verified 3P publication path",
      commercialSuccessCriteria: "Exposure > 0 or verified referral human",
      hypothesisConfidence: 0.85,
      implementationConfidence: 0.45,
      testConfidence: 0.4,
      commercialConfidence: 0.55,
    }),
    lim({
      limitationId: "eng_apex_execution_steering",
      title: "Apex/bottleneck signals do not steer Titan executors",
      commercialImpact: 0.7,
      evidence: [
        "Apex=governAction only",
        "mission.primary_bottleneck logged but family rotation dominates",
      ],
      rootCauseConfidence: 0.8,
      affectedComponents: ["executive-cycle.ts", "mission.ts"],
      expectedValueOfFix: 0.7,
      risk: "LOW",
      complexity: 0.4,
      proposedSolutions: [
        {
          id: "A_bottleneck_to_preferFamily",
          summary: "Map primary_bottleneck → preferFamily / executor choice",
          pros: ["closes dead intelligence"],
          cons: ["needs careful mapping"],
          score: 0.8,
        },
      ],
      selectedSolutionId: "A_bottleneck_to_preferFamily",
      testPlan: ["unit map bottleneck→family"],
      status: "DETECTED",
      technicalSuccessCriteria: "Executor selection reads mission bottleneck",
      commercialSuccessCriteria: "Higher meaningful attempts/hour diversity",
      hypothesisConfidence: 0.75,
      implementationConfidence: 0.7,
      testConfidence: 0.7,
      commercialConfidence: 0.4,
    }),
    lim({
      limitationId: "eng_account_autonomy",
      title: "Account autonomy framework unproven E2E",
      commercialImpact: 0.8,
      evidence: ["LaunchFree OWNER_ACTION", "vault sync without account create proof"],
      rootCauseConfidence: 0.7,
      affectedComponents: ["capability-reality/credential-vault.ts"],
      expectedValueOfFix: 0.75,
      risk: "HIGH",
      complexity: 0.8,
      proposedSolutions: [
        {
          id: "A_permitted_test_registration",
          summary: "Prove one permitted registration + verify email path",
          pros: ["unlocks class of channels"],
          cons: ["platform rules", "HIGH risk"],
          score: 0.5,
        },
      ],
      selectedSolutionId: "A_permitted_test_registration",
      testPlan: ["account lifecycle receipt"],
      status: "DETECTED",
      technicalSuccessCriteria: "One autonomous account create+verify proof",
      commercialSuccessCriteria: "New EXECUTABLE_AUTHENTICATED surfaces > 0",
      hypothesisConfidence: 0.6,
      implementationConfidence: 0.3,
      testConfidence: 0.3,
      commercialConfidence: 0.5,
    }),
    lim({
      limitationId: "eng_producthunt_partial",
      title: "Product Hunt authenticated but partial",
      commercialImpact: 0.55,
      evidence: ["token live", "frontier often no_match keywords"],
      rootCauseConfidence: 0.75,
      affectedComponents: ["producthunt-adapter.ts"],
      expectedValueOfFix: 0.55,
      risk: "MEDIUM",
      complexity: 0.35,
      proposedSolutions: [
        {
          id: "A_broader_keywords",
          summary: "Widen keyword matching + topic overlap",
          pros: ["quick"],
          cons: ["spam risk if too broad"],
          score: 0.7,
        },
      ],
      selectedSolutionId: "A_broader_keywords",
      testPlan: ["PH discover returns ≥1 thread for frontier habitats"],
      status: "DETECTED",
      technicalSuccessCriteria: "PH comment or honest quality skip with threads found",
      commercialSuccessCriteria: "producthunt_helpful_comment PUBLISHED > 0",
      hypothesisConfidence: 0.7,
      implementationConfidence: 0.65,
      testConfidence: 0.6,
      commercialConfidence: 0.35,
    }),
  ];

  // Rank-adjust email sent signal
  if (Number(emailOk.rows[0]?.n ?? 0) === 0 && ztDoc.status === "CRITICAL") {
    const mem = items.find((i) => i.limitationId === "eng_commercial_memory_steering");
    if (mem) mem.expectedValueOfFix = Math.min(1, mem.expectedValueOfFix + 0.05);
  }

  items.sort((a, b) => rankScore(b) - rankScore(a));

  for (const item of items) {
    await upsertLimitation(pool, item, {
      symptom: item.title,
      expected: item.commercialSuccessCriteria,
      bestOption: item.selectedSolutionId,
    });
  }

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='AUTONOMOUS_ENGINEERING'`,
    [
      AE_BACKLOG_KEY,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        ranked: items.map((i) => ({
          id: i.limitationId,
          score: rankScore(i),
          status: i.status,
          risk: i.risk,
        })),
      }),
    ],
  );

  return items;
}

export async function topActionableLimitation(
  pool: pg.Pool,
): Promise<EngineeringLimitation | null> {
  const res = await pool.query(
    `select * from ros_eng_limitations
     where status in ('DETECTED','DIAGNOSING','DESIGNING')
       and risk in ('LOW','MEDIUM')
     order by
       (expected_value * root_cause_confidence) /
       (greatest(complexity,0.15) * case risk when 'HIGH' then 2.2 when 'MEDIUM' then 1.3 else 1 end) desc
     limit 1`,
  );
  const r = res.rows[0];
  if (!r) return null;
  return {
    limitationId: r.limitation_id,
    title: r.title,
    commercialImpact: Number(r.commercial_impact),
    evidence: r.evidence ?? [],
    rootCauseConfidence: Number(r.root_cause_confidence),
    affectedComponents: r.affected_components ?? [],
    expectedValueOfFix: Number(r.expected_value),
    risk: r.risk,
    complexity: Number(r.complexity),
    proposedSolutions: r.proposed_solutions ?? [],
    selectedSolutionId: r.selected_solution_id,
    testPlan: r.test_plan ?? [],
    status: r.status,
    technicalSuccessCriteria: r.technical_success,
    commercialSuccessCriteria: r.commercial_success,
    hypothesisConfidence: Number(r.hypothesis_confidence),
    implementationConfidence: Number(r.implementation_confidence),
    testConfidence: Number(r.test_confidence),
    commercialConfidence: Number(r.commercial_confidence),
    createdAt: r.created_at?.toISOString?.() ?? String(r.created_at),
    updatedAt: r.updated_at?.toISOString?.() ?? String(r.updated_at),
  };
}
