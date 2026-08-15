/**
 * FORGE Universal Enterprise Engine — evaluate opportunities before building.
 * Discovers economic opportunities; derives models; can conclude DO NOT BUILD.
 */

import { buildMarketGraph } from "./market-graph";
import { deriveEconomicShape } from "./derive-economics";
import { assessOperationalFit } from "./operational-capabilities";
import {
  buildCompetitorProfiles,
  strongestCompetitors,
} from "./competitive-intelligence";
import { evaluateDeserveToExist } from "./deserve-to-exist";
import { inferCategoryDesign } from "./corporate-reality";
import { decideLifecycle } from "./lifecycle";
import { createLesson } from "./market-memory";
import { DEFAULT_FORGE_CONSTITUTION } from "./constitution";
import {
  admissionToLifecycleHint,
  evaluateAdmission,
  type PortfolioContext,
} from "./admission";
import type {
  CompetitorProfile,
  EconomicOpportunity,
  LifecycleDecision,
  OpportunityEvaluation,
} from "./enterprise-types";

export function evaluateEconomicOpportunity(input: {
  opportunity: EconomicOpportunity;
  competitors?: Array<Partial<CompetitorProfile> & { name: string }>;
  stop_new_builds?: boolean;
  launched?: boolean;
  corporate_reality_passed?: boolean;
  portfolio?: PortfolioContext;
}): OpportunityEvaluation {
  const economics = deriveEconomicShape(input.opportunity);
  const operational_fit = assessOperationalFit(economics);
  const competitors = strongestCompetitors(
    buildCompetitorProfiles(input.opportunity, input.competitors),
  );
  const market_graph = buildMarketGraph({
    opportunity: input.opportunity,
    economics,
    competitorNames: competitors.map((c) => c.name),
  });
  const deserve = evaluateDeserveToExist({
    opportunity: input.opportunity,
    competitors,
    operational_fit,
  });
  const category_design = inferCategoryDesign({
    opportunity: input.opportunity,
    economics,
  });

  const stop =
    input.stop_new_builds ??
    DEFAULT_FORGE_CONSTITUTION.stopNewBusinessesUntilReferenceProof;

  const admission = evaluateAdmission({
    opportunity: input.opportunity,
    economics,
    operational_fit,
    deserve,
    competitors,
    portfolio: {
      ...input.portfolio,
      stop_new_businesses:
        input.portfolio?.stop_new_businesses ??
        (stop && input.opportunity.reference_label !== "scopeguard_digital_pack"),
      already_launched: input.launched ?? input.portfolio?.already_launched,
    },
  });

  const life = decideLifecycle({
    stage: "DISCOVER",
    deserve,
    operational_fit,
    evidence_confidence: input.opportunity.confidence,
    corporate_reality_passed: input.corporate_reality_passed,
    launched: input.launched,
    stop_new_builds: stop && input.opportunity.reference_label !== "scopeguard_digital_pack",
  });

  // Admission can harden DO_NOT_BUILD / INVESTIGATE; cannot override UNFIT ops.
  let decision: LifecycleDecision = life.decision;
  const admitHint = admissionToLifecycleHint(admission.decision);
  if (operational_fit.fit === "UNFIT" || admission.decision === "REJECT") {
    decision = "DO_NOT_BUILD";
  } else if (input.launched && admission.decision === "ADMIT_OPERATE") {
    decision = "OPERATE";
  } else if (admitHint === "INVESTIGATE_MORE" && decision === "BUILD") {
    decision = "INVESTIGATE_MORE";
  } else if (admitHint === "DO_NOT_BUILD") {
    decision = "DO_NOT_BUILD";
  }

  const lessons = [
    createLesson({
      kind: deserve.deserves ? "observation" : "failure",
      statement: deserve.answer,
      context: `${input.opportunity.buyer} / ${input.opportunity.problem}`,
      transferable: true,
      confidence: input.opportunity.confidence,
      source_business_id: input.opportunity.reference_label,
      evidence: deserve.evidence,
    }),
    createLesson({
      kind: "economic",
      statement: `Derived ${economics.recurrence}: ${economics.revenue_mechanism}`,
      context: economics.why_this_shape.join("; "),
      transferable: true,
      confidence: 0.6,
      evidence: economics.why_this_shape,
    }),
    createLesson({
      kind: "observation",
      statement: `Admission ${admission.decision} score=${admission.aggregate_score}`,
      context: admission.blocking_gates.join(",") || admission.weak_gates.join(","),
      transferable: true,
      confidence: admission.aggregate_score,
      evidence: admission.rationale,
    }),
  ];

  const rationale = [
    ...life.rationale,
    `admission=${admission.decision}`,
    ...admission.rationale.slice(0, 4),
    operational_fit.statement,
    `category_design=${category_design.category}`,
    `differentiation=${deserve.differentiation_quality}`,
    ...economics.why_this_shape,
  ];

  return {
    opportunity: input.opportunity,
    market_graph,
    competitors,
    deserve,
    derived_economics: economics,
    operational_fit,
    category_design,
    lifecycle_stage: life.stage,
    decision,
    rationale,
    lessons_to_preserve: lessons,
    admission,
  };
}
