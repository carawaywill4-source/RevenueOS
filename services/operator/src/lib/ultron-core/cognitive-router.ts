/**
 * Organ 3 — COGNITIVE RESOURCE ROUTER.
 *
 * Decides which reasoning tier a task deserves and records the outcome.
 *
 *   DETERMINISTIC — pure code (filters, arithmetic, health checks)
 *   CHEAP         — small/local model classification, summarization
 *   STRONG        — architecture, market selection, capability acquisition
 *
 * Honesty rule: if a task requires STRONG but no strong reasoning model
 * is authorized in the current runtime, log `COGNITIVE_CAPABILITY_LIMIT`
 * rather than pretending a deterministic script produced strong reasoning.
 * A defect is recorded so this is visible in the proof ledger.
 */

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Logger, ReasoningTier } from "./types.js";

function authorizedStrongModel(): string | null {
  // Real check: any of these env vars indicate an authorized strong model.
  const candidates = [
    process.env.ULTRON_STRONG_MODEL,
    process.env.OPENAI_STRONG_MODEL,
    process.env.ANTHROPIC_STRONG_MODEL,
    process.env.STRONG_REASONING_MODEL,
  ];
  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return found ?? null;
}

function classifyRequiredTier(taskKind: string): ReasoningTier {
  const t = taskKind.toLowerCase();
  if (/(architecture|market|strategy|acquire_capability|debug|novel|business_model)/.test(t))
    return "STRONG";
  if (/(classify|summarize|extract|dedupe|score|rank)/.test(t)) return "CHEAP";
  return "DETERMINISTIC";
}

export type RouteResult = {
  tier: ReasoningTier;
  requiredTier: ReasoningTier;
  authorizedTier: ReasoningTier;
  limitationRecorded: boolean;
  authorizedModel: string | null;
  detail: string;
};

export async function routeReasoning(
  pool: pg.Pool,
  logger: Logger,
  taskKind: string,
  detail: string,
  ranMs = 0,
): Promise<RouteResult> {
  const required = classifyRequiredTier(taskKind);
  const strong = authorizedStrongModel();
  const authorized: ReasoningTier = strong ? "STRONG" : "CHEAP";
  const tier: ReasoningTier =
    required === "STRONG" && authorized !== "STRONG" ? "CHEAP" : required;
  const limitation = required === "STRONG" && authorized !== "STRONG";

  await pool.query(
    `insert into ros_reasoning_events
       (event_id, tier, task, required_tier, authorized_tier,
        limitation_recorded, detail, duration_ms, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8, now())`,
    [
      `re_${randomUUID().slice(0, 12)}`,
      tier,
      taskKind,
      required,
      authorized,
      limitation,
      detail.slice(0, 800),
      Math.max(0, Math.floor(ranMs)),
    ],
  );

  if (limitation) {
    logger("warn", "ultron.cognitive.limitation", {
      required,
      authorized,
      task: taskKind,
    });
    await pool.query(
      `insert into ros_closed_loop_defects
         (defect_id, kind, subject, detail, severity, status,
          first_seen_at, last_seen_at)
       values ('def_cognitive_limit_' || $1, 'CAPABILITY_WITHOUT_EXECUTION',
               $2, $3, 'MEDIUM', 'OPEN', now(), now())
       on conflict (defect_id) do update set
         detail = excluded.detail, last_seen_at = now(), status = 'OPEN'`,
      [
        taskKind.replace(/[^a-z0-9]/gi, "_").slice(0, 40),
        `COGNITIVE_CAPABILITY_LIMIT:${taskKind}`,
        `Task requires STRONG reasoning; no strong model authorized in runtime env.`,
      ],
    );
  }

  return {
    tier,
    requiredTier: required,
    authorizedTier: authorized,
    limitationRecorded: limitation,
    authorizedModel: strong,
    detail: `Routed task=${taskKind} to ${tier} (required=${required}, authorized=${authorized}).`,
  };
}

export async function cognitiveLimitCount(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `select count(*)::int as n from ros_reasoning_events
       where limitation_recorded = true
         and created_at > now() - interval '24 hours'`,
  );
  return Number(r.rows[0]?.n ?? 0);
}
