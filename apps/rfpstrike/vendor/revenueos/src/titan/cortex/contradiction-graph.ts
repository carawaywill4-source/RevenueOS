/**
 * ContradictionGraph — preserve disagreement; do not overwrite.
 */

import type { ContradictionEdge, KnowledgeClaim } from "./types";

export type ContradictionGraph = {
  edges: ContradictionEdge[];
};

export function createContradictionGraph(): ContradictionGraph {
  return { edges: [] };
}

export function linkClaims(
  graph: ContradictionGraph,
  from: KnowledgeClaim,
  to: KnowledgeClaim,
  relation: ContradictionEdge["relation"],
  note?: string,
): ContradictionGraph {
  return {
    edges: [
      ...graph.edges,
      {
        from_claim_id: from.claim_id,
        to_claim_id: to.claim_id,
        relation,
        note,
      },
    ],
  };
}

export function contradictionsFor(
  graph: ContradictionGraph,
  claimId: string,
): ContradictionEdge[] {
  return graph.edges.filter(
    (e) =>
      (e.from_claim_id === claimId || e.to_claim_id === claimId) &&
      e.relation === "CONTRADICTS",
  );
}

/**
 * Example preserved tension:
 * lower friction often helps conversion vs qualification can improve customer quality.
 */
export function seedAcquisitionPrincipleTension(
  frictionClaim: KnowledgeClaim,
  qualificationClaim: KnowledgeClaim,
): ContradictionGraph {
  let g = createContradictionGraph();
  g = linkClaims(
    g,
    frictionClaim,
    qualificationClaim,
    "QUALIFIES",
    "Both can be true under different contexts — neither erases the other",
  );
  return g;
}
