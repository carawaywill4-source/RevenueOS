/**
 * Executive Situation Room — drives decisions, not vanity dashboards.
 */

import type {
  ConstraintDiagnosis,
  DecisionJournalEntry,
  ExecutiveWorldModel,
  SituationRoom,
} from "./types";

export function buildSituationRoom(input: {
  world: ExecutiveWorldModel;
  constraints: ConstraintDiagnosis;
  decision: DecisionJournalEntry;
}): SituationRoom {
  const b = input.world.businesses[0];
  return {
    portfolio_state: `${input.world.portfolio.active_count} businesses; stranger_revenue=$${input.world.portfolio.stranger_revenue_usd}; north_star=$${input.world.north_star_daily_usd}/day/business (ambition, not fabricated progress)`,
    top_opportunities: [input.world.portfolio.top_opportunity],
    top_constraints: [
      input.constraints.statement,
      `secondary=${input.constraints.secondary}; emerging=${input.constraints.emerging}`,
    ],
    top_risks: [
      input.world.portfolio.top_risk,
      "LLM degradation must not kill commerce",
      "metric gaming / Goodhart",
    ],
    active_bets: [
      `${input.decision.resource_allocation} allocation: ${input.decision.decision}`,
    ],
    capital_allocation: `favor ${input.decision.resource_allocation}; paid_spend=$0; Phase 1 execution_authority=NONE`,
    business_health: b
      ? [
          `${b.business_id}: stage=${b.stage}; evidence=${b.evidence_level}; product=${b.product_status}; checkout=${b.checkout_status}; forge_conf=${b.forge_confidence}`,
        ]
      : [],
    system_health: [
      "APEX truth plane active",
      "FORGE capability manifest authoritative for product readiness",
      "TITAN Phase 1 observe/recommend only",
    ],
    evidence_changes: [
      `evidence_level=${input.constraints.evidence_level}`,
      `clock=${input.decision.learning_clock}`,
    ],
    owner_attention_required: input.decision.escalation
      ? [input.decision.escalation]
      : [],
  };
}
