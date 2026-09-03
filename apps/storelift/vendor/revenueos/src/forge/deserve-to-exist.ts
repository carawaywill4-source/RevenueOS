/**
 * WHY DOES THIS BUSINESS DESERVE TO EXIST?
 * Branding-only, AI copy, lower price, or superficial feature diffs → fail.
 */

import type {
  CompetitorProfile,
  DeserveToExistVerdict,
  EconomicOpportunity,
  OperationalFitResult,
} from "./enterprise-types";

const SUPERFICIAL_MARKERS = [
  /better\s+branding/i,
  /ai[- ]generated/i,
  /prettier\s+ui/i,
  /lower\s+price\s+only/i,
  /same\s+as\s+.+\s+but\s+cheaper/i,
  /generic\s+templates?/i,
  /me.?too/i,
];

export function evaluateDeserveToExist(input: {
  opportunity: EconomicOpportunity;
  competitors: CompetitorProfile[];
  operational_fit: OperationalFitResult;
}): DeserveToExistVerdict {
  const opp = input.opportunity;
  const disqualifiers: string[] = [];
  const evidence: string[] = [];

  if (input.operational_fit.fit === "UNFIT") {
    disqualifiers.push("cannot_operate_end_to_end");
  }

  const complaintDepth = opp.signals.complaints.length + opp.signals.pain.length;
  const spendEvidence = opp.signals.existing_spending.length + opp.signals.willingness_to_pay.length;
  const weaknessDepth = input.competitors.reduce(
    (n, c) => n + c.weaknesses.length + c.complaints.length + c.missing_capabilities.length,
    0,
  );

  if (complaintDepth === 0) disqualifiers.push("no_customer_pain_evidence");
  else evidence.push(...opp.signals.pain.slice(0, 3), ...opp.signals.complaints.slice(0, 3));

  if (spendEvidence === 0) disqualifiers.push("no_existing_spending_or_wtp_signal");
  else evidence.push(...opp.signals.existing_spending, ...opp.signals.willingness_to_pay);

  if (input.competitors.length === 0) {
    disqualifiers.push("no_competitor_intelligence");
  }

  // Look for structural opening: competitor weakness ∩ our operational strength
  const structuralHooks: string[] = [];
  for (const c of input.competitors) {
    for (const w of [...c.weaknesses, ...c.missing_capabilities, ...c.complaints]) {
      if (/ux|onboarding|generic|scope|freelancer|workflow|support|price.?opaque|trust/i.test(w)) {
        structuralHooks.push(`${c.name}: ${w}`);
      }
    }
  }

  const blob = [
    opp.title,
    opp.job_to_be_done,
    ...opp.signals.ros_operational_fit,
    ...structuralHooks,
  ].join(" ");

  let differentiation: DeserveToExistVerdict["differentiation_quality"] = "none";
  if (SUPERFICIAL_MARKERS.some((re) => re.test(blob)) && structuralHooks.length === 0) {
    differentiation = "superficial";
    disqualifiers.push("differentiation_appears_superficial");
  } else if (structuralHooks.length >= 2 && spendEvidence > 0 && complaintDepth > 0) {
    differentiation = "structural";
    evidence.push(...structuralHooks.slice(0, 4));
  } else if (structuralHooks.length >= 1 && complaintDepth > 0) {
    differentiation = "meaningful";
    evidence.push(...structuralHooks.slice(0, 3));
  } else if (weaknessDepth > 0) {
    differentiation = "superficial";
    disqualifiers.push("weaknesses_noted_but_not_a_clear_superior_opening");
  }

  if (/only\s+branding|just\s+rebrand|ai\s+rewrite/i.test(blob)) {
    differentiation = "superficial";
    disqualifiers.push("branding_or_ai_copy_is_not_a_reason_to_exist");
  }

  const deserves =
    disqualifiers.length === 0 &&
    (differentiation === "meaningful" || differentiation === "structural") &&
    input.operational_fit.fit !== "UNFIT";

  const answer = deserves
    ? `Exists because buyers already spend on inferior alternatives while specific pains (${structuralHooks[0] ?? opp.signals.pain[0]}) remain unmet — and RevenueOS can fulfill the job with ${input.operational_fit.autonomous_fulfillment_pct}% automation.`
    : `Does not yet deserve to exist: ${disqualifiers.join("; ") || "no compelling evidence-backed opening versus competitors"}.`;

  return {
    deserves,
    answer,
    evidence: [...new Set(evidence)].slice(0, 12),
    disqualifiers,
    differentiation_quality: differentiation,
  };
}
