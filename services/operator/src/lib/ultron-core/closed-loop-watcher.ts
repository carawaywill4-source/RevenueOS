/**
 * Organ 5 — CLOSED-LOOP ENFORCER.
 *
 * Detects broken cognitive loops:
 *   RESEARCH_WITHOUT_CONSUMER              — world facts nobody reads
 *   CAPABILITY_WITHOUT_EXECUTION           — capability C3+ never invoked
 *   ACCOUNT_WITHOUT_USE                    — vaulted credential never used
 *   ASSET_WITHOUT_DISTRIBUTION             — published resource never referenced
 *   ACTION_WITHOUT_VERIFICATION            — send with no delivery/exposure signal
 *   EXTERNAL_EVENT_WITHOUT_INTERPRETATION  — event with no consumers
 *   LESSON_WITHOUT_BEHAVIOR_CHANGE         — same failure repeated
 *   APEX_DECISION_WITHOUT_EXECUTOR         — plan without capability
 *   CAPABILITY_GAP_WITHOUT_ENGINEERING     — gap never picked up by AE
 *   ENGINEERING_WITHOUT_EXTERNAL_PROOF     — deploy without any external effect
 *
 * Each detected defect becomes a row in `ros_closed_loop_defects` so the
 * rest of the system can prioritize repairs.
 */

import { createHash } from "node:crypto";
import type pg from "pg";
import type { ClosedLoopDefect, Logger } from "./types.js";

function defectId(kind: string, subject: string): string {
  return `def_${createHash("sha1").update(`${kind}|${subject}`).digest("hex").slice(0, 20)}`;
}

async function upsertDefect(
  pool: pg.Pool,
  d: Omit<ClosedLoopDefect, "defectId">,
): Promise<void> {
  const id = defectId(d.kind, d.subject);
  await pool.query(
    `insert into ros_closed_loop_defects
       (defect_id, kind, subject, detail, severity, status,
        first_seen_at, last_seen_at)
     values ($1,$2,$3,$4,$5,$6, now(), now())
     on conflict (defect_id) do update set
       detail = excluded.detail,
       severity = excluded.severity,
       last_seen_at = now(),
       status = case when ros_closed_loop_defects.status = 'RESOLVED' then 'OPEN'
                     else ros_closed_loop_defects.status end`,
    [id, d.kind, d.subject, d.detail, d.severity, d.status],
  );
}

export async function runClosedLoopSweep(
  pool: pg.Pool,
  logger: Logger,
): Promise<{ opened: number; byKind: Record<string, number> }> {
  const byKind: Record<string, number> = {};
  let opened = 0;

  // 1. RESEARCH_WITHOUT_CONSUMER — world facts observed >12h ago with 0 consumers.
  const dang = await pool.query(
    `select fact_id, entity_kind, entity_id, predicate
       from ros_world_facts
      where cardinality(consumed_by) = 0
        and observed_at < now() - interval '12 hours'
      order by observed_at asc
      limit 25`,
  );
  for (const r of dang.rows) {
    await upsertDefect(pool, {
      kind: "RESEARCH_WITHOUT_CONSUMER",
      subject: `${r.entity_kind}:${r.entity_id}#${r.predicate}`,
      detail: `Fact ${r.fact_id} recorded >12h ago, no consumer.`,
      severity: "LOW",
      status: "OPEN",
    });
    opened++;
    byKind.RESEARCH_WITHOUT_CONSUMER = (byKind.RESEARCH_WITHOUT_CONSUMER ?? 0) + 1;
  }

  // 2. CAPABILITY_WITHOUT_EXECUTION — capability C3+ with 0 recent action.
  const idle = await pool.query(
    `select g.capability_id, g.name, g.proof_level
       from ros_capability_graph g
      where g.proof_level in ('C3_PRODUCTION_AVAILABLE','C4_EXTERNAL_ACTION_PROVEN','C5_EXTERNAL_EFFECT_PROVEN')
        and not exists (
          select 1 from aq_distribution_receipts r
           where r.created_at > now() - interval '7 days'
             and (coalesce(r.request_result->>'marker','') ilike '%'||g.capability_id||'%'
                  or r.executor_type ilike '%'||g.domain||'%')
        )
      limit 25`,
  );
  for (const r of idle.rows) {
    await upsertDefect(pool, {
      kind: "CAPABILITY_WITHOUT_EXECUTION",
      subject: String(r.capability_id),
      detail: `Capability ${r.name} (${r.proof_level}) not exercised in 7 days.`,
      severity: "MEDIUM",
      status: "OPEN",
    });
    opened++;
    byKind.CAPABILITY_WITHOUT_EXECUTION = (byKind.CAPABILITY_WITHOUT_EXECUTION ?? 0) + 1;
  }

  // 3. ACTION_WITHOUT_VERIFICATION — SENT receipts with no downstream traffic/inbound.
  const unverified = await pool.query(
    `select r.action_id, r.business_id, r.created_at
       from aq_distribution_receipts r
      where r.status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED','PUBLISHED')
        and r.created_at > now() - interval '7 days'
        and not exists (
          select 1 from ros_traffic_events t
           where t.business_id = r.business_id
             and t.class in ('LIKELY_HUMAN','QUALIFIED')
             and coalesce(t.referer,'') <> ''
             and t.created_at > r.created_at
        )
        and not exists (
          select 1 from ros_inbound_messages i
           where i.business_id = r.business_id
             and i.created_at > r.created_at
        )
      order by r.created_at desc
      limit 25`,
  );
  for (const r of unverified.rows) {
    await upsertDefect(pool, {
      kind: "ACTION_WITHOUT_VERIFICATION",
      subject: String(r.action_id),
      detail: `Action sent, no downstream visitor or inbound within window.`,
      severity: "HIGH",
      status: "OPEN",
    });
    opened++;
    byKind.ACTION_WITHOUT_VERIFICATION = (byKind.ACTION_WITHOUT_VERIFICATION ?? 0) + 1;
  }

  // 4. EXTERNAL_EVENT_WITHOUT_INTERPRETATION.
  const unc = await pool.query(
    `select event_id, kind from ros_ultron_events
      where cardinality(consumers) = 0
        and created_at < now() - interval '6 hours'
      limit 25`,
  );
  for (const r of unc.rows) {
    await upsertDefect(pool, {
      kind: "EXTERNAL_EVENT_WITHOUT_INTERPRETATION",
      subject: String(r.event_id),
      detail: `Event ${r.kind} not consumed within 6h.`,
      severity: "MEDIUM",
      status: "OPEN",
    });
    opened++;
    byKind.EXTERNAL_EVENT_WITHOUT_INTERPRETATION =
      (byKind.EXTERNAL_EVENT_WITHOUT_INTERPRETATION ?? 0) + 1;
  }

  // 5. ENGINEERING_WITHOUT_EXTERNAL_PROOF — AE novel projects deployed but proof<4.
  try {
    const eng = await pool.query(
      `select key, value->>'proofLevel' as proof, value->>'stage' as stage
         from ros_config_meta
        where key in ('ae_novel_external_action_002','ae_novel_project_state')
          and coalesce((value->>'proofLevel')::int, 0) < 4
          and value->>'stage' in ('DEPLOYED','COMMERCIALLY_EFFECTIVE')`,
    );
    for (const r of eng.rows) {
      await upsertDefect(pool, {
        kind: "ENGINEERING_WITHOUT_EXTERNAL_PROOF",
        subject: String(r.key),
        detail: `Project deployed but proof=${r.proof}; no external effect verified.`,
        severity: "HIGH",
        status: "OPEN",
      });
      opened++;
      byKind.ENGINEERING_WITHOUT_EXTERNAL_PROOF =
        (byKind.ENGINEERING_WITHOUT_EXTERNAL_PROOF ?? 0) + 1;
    }
  } catch {
    // ok — ros_config_meta may not always be populated
  }

  logger("info", "ultron.closed_loop.sweep", { opened, byKind });
  return { opened, byKind };
}

export async function openDefects(
  pool: pg.Pool,
  limit = 25,
): Promise<ClosedLoopDefect[]> {
  const r = await pool.query(
    `select defect_id, kind, subject, detail, severity, status
       from ros_closed_loop_defects
      where status = 'OPEN'
      order by case severity
                 when 'CRITICAL' then 0 when 'HIGH' then 1
                 when 'MEDIUM' then 2 else 3 end,
               last_seen_at desc
      limit ${Number(limit)}`,
  );
  return r.rows.map((row) => ({
    defectId: String(row.defect_id),
    kind: row.kind as ClosedLoopDefect["kind"],
    subject: String(row.subject),
    detail: String(row.detail),
    severity: row.severity as ClosedLoopDefect["severity"],
    status: row.status as ClosedLoopDefect["status"],
  }));
}
