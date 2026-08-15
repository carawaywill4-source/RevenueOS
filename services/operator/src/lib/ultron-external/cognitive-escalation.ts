/**
 * FIX 15 — COGNITIVE_ESCALATION_POLICY.
 *
 * Executable economic policy: which reasoning tier a task deserves.
 * Weak inference is never recorded as strong inference.
 */

import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Logger, ReasoningTier } from "../ultron-core/types.js";
import { routeReasoning } from "../ultron-core/cognitive-router.js";

export type EscalationInput = {
  taskKind: string;
  taskValueUsd: number;
  novelty: number; // 0-1
  failureCount: number;
  uncertainty: number; // 0-1
  architectureScope: boolean;
  risk: "LOW" | "MEDIUM" | "HIGH";
  economicMilestone: string;
  modelCostUsd: number;
  availableBudgetUsd: number;
};

export type EscalationDecision = {
  tier: ReasoningTier | "CAPABILITY_LIMIT";
  required: ReasoningTier;
  reason: string;
  limitationRecorded: boolean;
};

export function decideCognitiveEscalation(input: EscalationInput): EscalationDecision {
  let required: ReasoningTier = "DETERMINISTIC";
  const reasons: string[] = [];

  if (input.architectureScope) {
    required = "STRONG";
    reasons.push("architecture_scope");
  } else if (input.risk === "HIGH" || input.novelty >= 0.7) {
    required = "STRONG";
    reasons.push(input.risk === "HIGH" ? "high_risk" : "high_novelty");
  } else if (input.failureCount >= 3 || input.uncertainty >= 0.6 || input.taskValueUsd >= 50) {
    required = "CHEAP";
    reasons.push(
      input.failureCount >= 3 ? "repeated_failure"
        : input.uncertainty >= 0.6 ? "uncertainty"
        : "task_value",
    );
  } else {
    reasons.push("routine_deterministic");
  }

  if (input.economicMilestone.startsWith("E") && Number(input.economicMilestone.slice(1)) >= 8) {
    if (required === "DETERMINISTIC") required = "CHEAP";
    reasons.push("late_economic_milestone");
  }

  if (input.modelCostUsd > input.availableBudgetUsd && required !== "DETERMINISTIC") {
    return {
      tier: "CAPABILITY_LIMIT",
      required,
      reason: `budget_exhausted need=${required} cost=${input.modelCostUsd} budget=${input.availableBudgetUsd}; ${reasons.join(",")}`,
      limitationRecorded: true,
    };
  }

  return {
    tier: required,
    required,
    reason: reasons.join(","),
    limitationRecorded: false,
  };
}

export async function applyCognitiveEscalation(
  pool: pg.Pool,
  logger: Logger,
  input: EscalationInput,
): Promise<EscalationDecision> {
  const decision = decideCognitiveEscalation(input);
  if (decision.tier === "CAPABILITY_LIMIT") {
    await pool.query(
      `insert into ros_reasoning_events
         (event_id, tier, task, required_tier, authorized_tier,
          limitation_recorded, detail, duration_ms, created_at)
       values ($1,'CHEAP',$2,$3,'CHEAP', true, $4, 0, now())`,
      [
        `re_${randomUUID().slice(0, 12)}`,
        input.taskKind,
        decision.required,
        decision.reason,
      ],
    );
    logger("warn", "ultron.cognitive.escalation.limit", { task: input.taskKind, reason: decision.reason });
    return decision;
  }
  const routed = await routeReasoning(pool, logger, input.taskKind, decision.reason);
  if (decision.required === "STRONG" && routed.tier !== "STRONG") {
    return {
      tier: "CAPABILITY_LIMIT",
      required: "STRONG",
      reason: `required STRONG, runtime authorized ${routed.authorizedTier}`,
      limitationRecorded: true,
    };
  }
  return {
    tier: routed.tier,
    required: decision.required,
    reason: decision.reason,
    limitationRecorded: routed.limitationRecorded,
  };
}
