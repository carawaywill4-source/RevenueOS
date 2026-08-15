/**
 * APEX / FORGE command contracts.
 * TITAN sets objectives and constraints; subsystems choose tactics.
 */

import type {
  ApexCommandContract,
  ConstraintDiagnosis,
  ForgeCommandContract,
  BusinessSnapshot,
} from "./types";

export function buildApexCommand(input: {
  snapshot: BusinessSnapshot;
  constraints: ConstraintDiagnosis;
}): ApexCommandContract {
  const c = input.constraints.primary;
  if (c === "qualified_exposure" || c === "acquisition" || c === "awareness") {
    return {
      objective:
        "prove or disprove qualified freelancer demand; generate qualified exposure and channel evidence",
      constraints: [
        "zero paid spend",
        "no platform abuse",
        "no deceptive urgency",
        `test only: ${input.snapshot.apex_allowed_to_test.join(", ") || "channel/persona/intent/message"}`,
      ],
      budget: { paid_spend_usd: 0, notes: "organic / permissionless only" },
      priority: "critical",
      evidence_requirements:
        "increase qualified exposures; record channel/persona/intent/message evidence; do not treat tiny samples as offer failure",
      time_horizon: "48 hours",
      success:
        "meaningful high-intent behavior and clearer channel evidence toward first attributed stranger purchase",
      do_not_micromanage: true,
    };
  }
  return {
    objective:
      "maintain qualified demand while FORGE investigates conversion constraint; keep attribution clean",
    constraints: ["zero paid spend", "preserve traffic quality labels"],
    budget: { paid_spend_usd: 0, notes: "organic only" },
    priority: "normal",
    evidence_requirements: "stable qualified flow for conversion experiments",
    time_horizon: "7 days",
    success: "sustained qualified traffic without spam or dark patterns",
    do_not_micromanage: true,
  };
}

export function buildForgeCommand(input: {
  snapshot: BusinessSnapshot;
  constraints: ConstraintDiagnosis;
}): ForgeCommandContract {
  const favorProductWork =
    input.constraints.primary === "conversion" ||
    input.constraints.primary === "offer" ||
    input.constraints.primary === "pricing" ||
    input.constraints.primary === "trust" ||
    input.constraints.primary === "checkout";

  if (!favorProductWork) {
    return {
      business_objective: input.snapshot.primary_objective,
      observed_constraint: input.constraints.primary,
      evidence: `${input.constraints.evidence_level}; q=${input.snapshot.qualified_visits}; forge_confidence=${input.snapshot.forge_confidence} (NOT WTP)`,
      risk_level: "R0",
      desired_customer_outcome:
        "keep product/reliability healthy while APEX gathers demand evidence",
      speculative_redesign_allowed: false,
      do_not_micromanage: true,
    };
  }

  return {
    business_objective:
      "diagnose why qualified traffic is not purchasing; improve customer value without dark patterns",
    observed_constraint: input.constraints.primary,
    evidence: input.constraints.statement,
    risk_level: "R2",
    desired_customer_outcome:
      "clearer offer/trust/payment path that matches freelancer JTBD",
    speculative_redesign_allowed: false,
    do_not_micromanage: true,
  };
}
