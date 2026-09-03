/**
 * Phase-1 CORTEX advisor — answers executive questions with epistemic hygiene.
 * First test: ScopeGuard "best use of effort right now?"
 */

import { newId, type ExperimentStore } from "../../ledger/store";
import type { EvidenceLevel } from "../../apex/types";
import { classifyExternalContent } from "../injection-defense";
import { assertKnowledgeClaim } from "./knowledge-claim";
import { scoreEvidenceVector } from "./evidence-vector";
import {
  INTERNAL_APEX_SOURCE,
  INTERNAL_FORGE_SOURCE,
  INTERNAL_STRIPE_SOURCE,
  registerSource,
} from "./source-registry";
import { compileExecutiveContext } from "./context-compiler";
import { createContradictionGraph, linkClaims } from "./contradiction-graph";
import { refuseHallucinatedExpertise } from "./knowledge-gap";
import type { CortexAdvice, KnowledgeClaim } from "./types";

export type CortexCommercialSnapshot = {
  business_id: string;
  evidence_level: EvidenceLevel;
  qualified_visits: number;
  checkouts: number;
  purchases: number;
  revenue_usd: number;
  product_ready: boolean;
  forge_confidence: number;
  product_mutation_blocked: boolean;
  learning_clock?: string;
  primary_objective?: string;
  checkout_healthy?: boolean;
};

export function buildScopeGuardClaims(
  snap: CortexCommercialSnapshot,
): KnowledgeClaim[] {
  const stripe = INTERNAL_STRIPE_SOURCE();
  const apex = INTERNAL_APEX_SOURCE();
  const forge = INTERNAL_FORGE_SOURCE();

  const claims: KnowledgeClaim[] = [
    assertKnowledgeClaim({
      statement: `Stripe/observation: purchases=${snap.purchases}; revenue_usd=${snap.revenue_usd}`,
      classification: "FACT",
      domain: "commerce",
      business_id: snap.business_id,
      source_ids: [stripe.source_id],
      sample_size: snap.purchases,
      causal_status: "OBSERVATION_ONLY",
      freshness: "VERY_FAST",
      evidence_vector: scoreEvidenceVector({
        source: stripe,
        classification: "FACT",
        sample_size: snap.purchases,
        applicability: 1,
        scope: snap.business_id,
      }),
      supporting_evidence: ["adapter.observe.money / Stripe"],
    }),
    assertKnowledgeClaim({
      statement: `APEX evidence_level=${snap.evidence_level}; qualified_visits=${snap.qualified_visits}; checkouts=${snap.checkouts}; clock=${snap.learning_clock ?? "unknown"}`,
      classification: "OBSERVATION",
      domain: "acquisition",
      business_id: snap.business_id,
      source_ids: [apex.source_id],
      sample_size: snap.qualified_visits,
      freshness: "VERY_FAST",
      evidence_vector: scoreEvidenceVector({
        source: apex,
        classification: "OBSERVATION",
        sample_size: snap.qualified_visits,
        applicability: 1,
      }),
    }),
    assertKnowledgeClaim({
      statement: `FORGE product_ready=${snap.product_ready}; forge_confidence=${snap.forge_confidence} (NOT willingness-to-pay)`,
      classification: "FACT",
      domain: "product",
      business_id: snap.business_id,
      source_ids: [forge.source_id],
      freshness: "MODERATE",
      evidence_vector: scoreEvidenceVector({
        source: forge,
        classification: "FACT",
        sample_size: 1,
        applicability: 0.9,
      }),
      known_exceptions: ["forge_confidence_is_not_market_validation"],
    }),
    assertKnowledgeClaim({
      statement:
        "Tiny traffic without conversion is insufficient evidence of offer failure — acquire more qualified exposure first",
      classification: "ESTABLISHED_PRINCIPLE",
      domain: "acquisition",
      business_id: snap.business_id,
      freshness: "STABLE",
      causal_status: "PLAUSIBLE_CAUSATION",
      applicability_conditions: ["evidence_level in NO_EVIDENCE|WEAK_SIGNAL|EMERGING_SIGNAL"],
    }),
    assertKnowledgeClaim({
      statement:
        snap.primary_objective ??
        "FIRST ATTRIBUTED STRANGER PURCHASE remains the operating objective in FIRST_CUSTOMER stage",
      classification: "BELIEF",
      domain: "strategy",
      business_id: snap.business_id,
      freshness: "MODERATE",
      sample_size: 1,
    }),
  ];

  // Strong demand + no purchase → offer/price/trust hypotheses
  if (
    snap.purchases === 0 &&
    snap.qualified_visits >= 50 &&
    snap.checkouts >= 20 &&
    snap.checkout_healthy !== false
  ) {
    claims.push(
      assertKnowledgeClaim({
        statement:
          "Given substantial qualified demand and checkout starts with zero purchases and healthy checkout, investigate offer/trust/price/product mismatch — not acquisition absence",
        classification: "HYPOTHESIS",
        domain: "conversion",
        business_id: snap.business_id,
        sample_size: snap.qualified_visits,
        freshness: "FAST",
        supporting_evidence: [
          `q=${snap.qualified_visits}`,
          `checkouts=${snap.checkouts}`,
          "checkout_healthy",
        ],
      }),
    );
  } else if (snap.purchases === 0 && snap.qualified_visits < 50) {
    claims.push(
      assertKnowledgeClaim({
        statement:
          "Primary missing evidence is qualified demand; speculative FORGE redesign is not justified",
        classification: "HYPOTHESIS",
        domain: "acquisition",
        business_id: snap.business_id,
        sample_size: snap.qualified_visits,
        freshness: "FAST",
      }),
    );
  }

  return claims;
}

/**
 * Answer: "What is the best use of RevenueOS effort right now?"
 */
export function adviseExecutiveQuestion(input: {
  question: string;
  snapshot: CortexCommercialSnapshot;
  prior_belief?: string;
}): CortexAdvice {
  const snap = input.snapshot;
  const claims = buildScopeGuardClaims(snap);
  let graph = createContradictionGraph();

  const weakDemand = claims.find((c) =>
    /Primary missing evidence is qualified demand/i.test(c.statement),
  );
  const conversionHyp = claims.find((c) =>
    /investigate offer\/trust\/price/i.test(c.statement),
  );
  if (weakDemand && conversionHyp) {
    graph = linkClaims(
      graph,
      weakDemand,
      conversionHyp,
      "CONTRADICTS",
      "Demand-bottleneck belief vs conversion-bottleneck belief — evidence decides",
    );
  }

  const principle = claims.find((c) => c.classification === "ESTABLISHED_PRINCIPLE");
  const redesignTemptation = assertKnowledgeClaim({
    statement: "Redesign product because there are few visits and no sales yet",
    classification: "HEURISTIC",
    domain: "product",
    business_id: snap.business_id,
  });
  if (principle) {
    graph = linkClaims(
      graph,
      principle,
      redesignTemptation,
      "CONTRADICTS",
      "Small-sample redesign heuristic contradicted by acquisition principle",
    );
  }

  const conversionMode =
    snap.purchases === 0 &&
    snap.qualified_visits >= 50 &&
    snap.checkouts >= 20 &&
    snap.checkout_healthy !== false;

  const favor = conversionMode
    ? "FORGE"
    : snap.purchases === 0
      ? "APEX"
      : "BALANCED";

  const primary = conversionMode
    ? "Shift investigation to offer/trust/price/product mismatch under demonstrated demand; keep checkout reliability; do not conclude acquisition failure"
    : snap.product_ready
      ? "Prioritize APEX qualified acquisition toward first attributed stranger purchase; constrain speculative FORGE redesign; no new business; no major pricing conclusion"
      : "FORGE must finish Corporate Reality / product readiness before aggressive acquisition spend conclusions";

  const changed =
    Boolean(input.prior_belief) &&
    conversionMode &&
    /qualified demand|acquisition|APEX/i.test(input.prior_belief ?? "");

  const context = compileExecutiveContext({
    decision: input.question,
    business_id: snap.business_id,
    claims: [...claims, redesignTemptation],
    contradictions: graph.edges,
    apex_summary: [
      `evidence_level=${snap.evidence_level}`,
      `qualified_visits=${snap.qualified_visits}`,
      `product_mutation_blocked=${snap.product_mutation_blocked}`,
    ],
    forge_summary: [
      `product_ready=${snap.product_ready}`,
      `forge_confidence=${snap.forge_confidence}≠WTP`,
    ],
    commercial_summary: [
      `purchases=${snap.purchases}`,
      `revenue_usd=${snap.revenue_usd}`,
      `checkouts=${snap.checkouts}`,
    ],
    required_questions: conversionMode
      ? [
          "What price/trust objections appear at checkout?",
          "Is the offer mismatched to the arriving persona?",
        ]
      : [
          "Which channels produce qualified freelancer intent?",
          "What organic priors transfer to paid later?",
        ],
  });

  return {
    question: input.question,
    business_id: snap.business_id,
    at: new Date().toISOString(),
    primary_recommendation: primary,
    resource_favor: favor,
    rationale: [
      primary,
      ...context.apex_summary,
      ...context.forge_summary,
      ...context.commercial_summary,
      favor === "APEX"
        ? "No new business needed; no owner escalation required for routine acquisition"
        : "Belief updated from acquisition-primary to conversion-investigation",
    ],
    epistemic_separations: [
      "FACT: Stripe purchase/revenue counts",
      "OBSERVATION: APEX evidence_level and qualified visits",
      "FACT: FORGE readiness (not WTP)",
      "HYPOTHESIS: bottleneck diagnosis (demand vs conversion)",
      "ESTABLISHED_PRINCIPLE: do not infer offer failure from tiny samples",
    ],
    forbidden_conclusions: [
      "major pricing change from weak samples",
      "speculative product redesign under WEAK_SIGNAL",
      "spawn new businesses to escape first-customer work",
      "treat forge_confidence as market validation",
      "claim success without attributed stranger purchase",
    ],
    gaps: context.gaps,
    context,
    changed_mind: changed,
    prior_belief: input.prior_belief,
  };
}

/** External research poison → DATA only, zero control. */
export function ingestExternalResearchBlob(text: string, uri: string): {
  control_plane_effect: "NONE";
  contains_injection: boolean;
  claim: KnowledgeClaim | null;
} {
  const poison = classifyExternalContent(text);
  const source = registerSource({
    source_type: "UNKNOWN_WEB",
    uri_reference: uri,
    authority_level: 0.15,
    primary_or_secondary: "secondary",
    commercial_incentive: 0.5,
  });
  if (poison.contains_injection_attempt) {
    return {
      control_plane_effect: "NONE",
      contains_injection: true,
      claim: assertKnowledgeClaim({
        statement: "EXTERNAL_UNTRUSTED_INSTRUCTION detected — zero control authority",
        classification: "OBSERVATION",
        domain: "security",
        source_ids: [source.source_id],
        supporting_evidence: poison.signals,
        freshness: "VERY_FAST",
      }),
    };
  }
  return {
    control_plane_effect: "NONE",
    contains_injection: false,
    claim: assertKnowledgeClaim({
      statement: text.slice(0, 280),
      classification: "EXPERT_OPINION",
      domain: "external",
      source_ids: [source.source_id],
      freshness: "FAST",
    }),
  };
}

/** Guru article vs primary commercial evidence. */
export function resolveAuthorityConflict(input: {
  guru_claim: string;
  stripe_purchases: number;
  beacon_claimed_sales: number;
}): {
  favored: "PRIMARY_COMMERCIAL" | "GURU";
  detail: string;
  reject_success_belief: boolean;
} {
  if (input.beacon_claimed_sales > 0 && input.stripe_purchases === 0) {
    return {
      favored: "PRIMARY_COMMERCIAL",
      detail:
        "Corrupted tracking vs Stripe zero — do NOT update business-success belief",
      reject_success_belief: true,
    };
  }
  return {
    favored: "PRIMARY_COMMERCIAL",
    detail: `Prefer Stripe/internal commercial truth over guru rhetoric: "${input.guru_claim.slice(0, 80)}"`,
    reject_success_belief: false,
  };
}

export function detectDomainGapOrAnswer(domain: string, claims: KnowledgeClaim[]) {
  return refuseHallucinatedExpertise({ domain, available_claims: claims });
}

export async function persistCortexAdvice(
  store: ExperimentStore,
  advice: CortexAdvice,
): Promise<void> {
  if (!store.appendPursuitEvent) return;
  await store.appendPursuitEvent({
    id: newId("tevt"),
    pursuitId: "titan_cortex_advise",
    siteId: advice.business_id,
    eventType: "learned",
    detail: { titan: true, cortex: true, kind: "advice", advice },
    createdAt: advice.at,
  });
}
