/**
 * ExecutiveContextCompiler — smallest high-value context for a decision.
 * Intelligence ≠ context window size.
 */

import type {
  ContradictionEdge,
  ExecutiveContextPacket,
  KnowledgeClaim,
  KnowledgeGap,
} from "./types";
import { separateByClass } from "./knowledge-claim";
import { detectKnowledgeGaps } from "./knowledge-gap";
import { evidenceWeight } from "./evidence-vector";

export function compileExecutiveContext(input: {
  decision: string;
  business_id: string;
  claims: KnowledgeClaim[];
  contradictions?: ContradictionEdge[];
  apex_summary?: string[];
  forge_summary?: string[];
  commercial_summary?: string[];
  required_questions?: string[];
  max_claims_per_class?: number;
}): ExecutiveContextPacket {
  const max = input.max_claims_per_class ?? 5;
  const ranked = [...input.claims].sort((a, b) => {
    const wa = a.evidence_vector ? evidenceWeight(a.evidence_vector) : a.confidence;
    const wb = b.evidence_vector ? evidenceWeight(b.evidence_vector) : b.confidence;
    return wb - wa;
  });

  // Attention economy: drop low-value noise
  const attentive = ranked.filter((c) => c.confidence >= 0.2 || c.classification === "FACT");
  const by = separateByClass(attentive);

  const take = (cls: keyof typeof by) => (by[cls] ?? []).slice(0, max);

  const gaps =
    input.required_questions && input.required_questions.length
      ? detectKnowledgeGaps({
          decision: input.decision,
          required_questions: input.required_questions,
          available: attentive,
        })
      : ([] as KnowledgeGap[]);

  return {
    decision: input.decision,
    business_id: input.business_id,
    compiled_at: new Date().toISOString(),
    facts: take("FACT"),
    observations: take("OBSERVATION"),
    beliefs: take("BELIEF"),
    hypotheses: take("HYPOTHESIS"),
    forecasts: take("FORECAST"),
    contradictions: input.contradictions ?? [],
    gaps,
    principles: take("ESTABLISHED_PRINCIPLE"),
    apex_summary: input.apex_summary ?? [],
    forge_summary: input.forge_summary ?? [],
    commercial_summary: input.commercial_summary ?? [],
    attention_notes: [
      "Compiled smallest high-value context — not full CORTEX dump",
      `claims_in=${input.claims.length}; claims_kept=${attentive.length}`,
      ...gaps.map((g) => `gap:${g.question}`),
    ],
  };
}
