/**
 * KnowledgeGapDetector — excellence at "I DON'T KNOW ENOUGH YET."
 */

import { newId } from "../../ledger/store";
import type { EpistemicClass, KnowledgeClaim, KnowledgeGap, SourceClass } from "./types";

export function detectKnowledgeGaps(input: {
  decision: string;
  required_questions: string[];
  available: KnowledgeClaim[];
  decision_impact?: KnowledgeGap["decision_impact"];
}): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  for (const q of input.required_questions) {
    const hit = input.available.find((c) =>
      statementCoversQuestion(c.statement, q),
    );
    if (!hit || hit.classification === "UNKNOWN" || hit.confidence < 0.35) {
      gaps.push({
        gap_id: newId("cgap"),
        question: q,
        why_needed: `Required for decision: ${input.decision}`,
        decision_impact: input.decision_impact ?? "high",
        current_uncertainty: hit ? 1 - hit.confidence : 0.9,
        expected_value_of_information: estimateEvoi(input.decision_impact ?? "high"),
        preferred_source_classes: preferredSourcesFor(q),
        status: "OPEN",
      });
    }
  }
  return gaps;
}

function statementCoversQuestion(statement: string, question: string): boolean {
  const s = statement.toLowerCase();
  const tokens = question
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 4);
  const hits = tokens.filter((t) => s.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

function estimateEvoi(impact: KnowledgeGap["decision_impact"]): number {
  switch (impact) {
    case "critical":
      return 0.9;
    case "high":
      return 0.7;
    case "medium":
      return 0.4;
    default:
      return 0.2;
  }
}

function preferredSourcesFor(question: string): SourceClass[] {
  const q = question.toLowerCase();
  if (/stripe|revenue|purchase|payment/.test(q)) return ["INTERNAL_COMMERCIAL"];
  if (/traffic|channel|persona|acquisition/.test(q)) return ["INTERNAL_TELEMETRY", "PUBLIC_COMMUNITY"];
  if (/regulat|legal|privacy/.test(q)) return ["REGULATOR", "GOVERNMENT"];
  if (/competitor|pricing/.test(q)) return ["COMPETITOR_FIRST_PARTY", "INDUSTRY_PRIMARY"];
  return ["INTERNAL_TELEMETRY", "REPUTABLE_SECONDARY"];
}

/** Hallucination refusal shape when domain competence is missing. */
export function refuseHallucinatedExpertise(input: {
  domain: string;
  available_claims: KnowledgeClaim[];
  min_claims?: number;
}): { competent: boolean; response: string; gaps: KnowledgeGap[] } {
  const domainClaims = input.available_claims.filter(
    (c) => c.domain.toLowerCase().includes(input.domain.toLowerCase()),
  );
  const facts = domainClaims.filter((c) =>
    (["FACT", "MEASUREMENT", "OBSERVATION"] as EpistemicClass[]).includes(c.classification),
  );
  if (facts.length >= (input.min_claims ?? 2)) {
    return { competent: true, response: "domain_evidence_present", gaps: [] };
  }
  const gaps = detectKnowledgeGaps({
    decision: `enter_or_reason_about_${input.domain}`,
    required_questions: [
      `What is the industry structure of ${input.domain}?`,
      `Who is the buyer and what is the buying process in ${input.domain}?`,
      `What are unit economics and pricing norms in ${input.domain}?`,
    ],
    decision_impact: "critical",
    available: domainClaims,
  });
  return {
    competent: false,
    response: `KNOWLEDGE_GAP_DETECTED:${input.domain} — research required; do not hallucinate expertise`,
    gaps,
  };
}
