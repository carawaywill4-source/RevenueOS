/**
 * Portfolio capital market — businesses compete for ad capital.
 * Entire portfolio shares the 5% daily ceiling. Uneven allocation is correct.
 */

import type {
  ApexPaidProposal,
  CapitalAllocationPlan,
  TreasurySnapshot,
} from "./types";

export function allocatePortfolioAdCapital(input: {
  treasury: TreasurySnapshot;
  proposals: ApexPaidProposal[];
  /** Optional diversification: max share any single business may take. */
  max_business_share?: number;
}): CapitalAllocationPlan {
  const ceiling = input.treasury.remaining_ceiling_usd;
  const maxShare = input.max_business_share ?? 0.7;
  const rationale: string[] = [
    "Optimize expected marginal incremental contribution — not equal splits",
    "Ceiling is portfolio-wide 5% max, never a spending target",
  ];

  if (ceiling <= 0 || input.proposals.length === 0) {
    return {
      as_of: new Date().toISOString(),
      daily_ceiling_usd: input.treasury.daily_ceiling_usd,
      total_authorized_usd: 0,
      allocations: [],
      zero_allocation_businesses: [...new Set(input.proposals.map((p) => p.business_id))],
      rationale: [...rationale, "No remaining ceiling or no proposals — spend $0"],
    };
  }

  // Score by expected incremental contribution * confidence / requested spend (marginal).
  const scored = input.proposals
    .map((p) => {
      const riskAdj =
        (p.expected_incremental_contribution_usd * p.confidence) /
        Math.max(p.requested_spend_usd, 0.01);
      return { proposal: p, marginal: riskAdj };
    })
    .filter((s) => s.marginal > 0 && s.proposal.expected_incremental_contribution_usd > 0)
    .sort((a, b) => b.marginal - a.marginal);

  if (!scored.length) {
    return {
      as_of: new Date().toISOString(),
      daily_ceiling_usd: input.treasury.daily_ceiling_usd,
      total_authorized_usd: 0,
      allocations: [],
      zero_allocation_businesses: [...new Set(input.proposals.map((p) => p.business_id))],
      rationale: [...rationale, "No proposal with positive expected incremental value"],
    };
  }

  let remaining = ceiling;
  const allocations: CapitalAllocationPlan["allocations"] = [];
  const businessSpent = new Map<string, number>();

  for (const s of scored) {
    if (remaining <= 0) break;
    const bid = s.proposal.business_id;
    const already = businessSpent.get(bid) ?? 0;
    const businessCap = ceiling * maxShare - already;
    if (businessCap <= 0) continue;

    // Evidence-sized: do not automatically fill remaining ceiling.
    const want = Math.min(
      s.proposal.requested_spend_usd,
      remaining,
      businessCap,
      // confidence shrinks capital hunger
      s.proposal.requested_spend_usd * Math.min(1, s.proposal.confidence + 0.15),
    );
    if (want < 0.5) continue;

    const usd = Number(want.toFixed(2));
    remaining = Number((remaining - usd).toFixed(2));
    businessSpent.set(bid, already + usd);
    allocations.push({
      business_id: bid,
      proposal_id: s.proposal.proposal_id,
      share: Number((usd / ceiling).toFixed(4)),
      authorized_usd: usd,
      marginal_return_estimate: Number(s.marginal.toFixed(4)),
      reason: `Higher risk-adjusted marginal return (${s.marginal.toFixed(3)}) vs alternatives`,
    });
  }

  const allocatedIds = new Set(allocations.map((a) => a.business_id));
  const zero = [
    ...new Set(
      input.proposals.map((p) => p.business_id).filter((id) => !allocatedIds.has(id)),
    ),
  ];

  rationale.push(
    `Allocated $${allocations.reduce((a, x) => a + x.authorized_usd, 0).toFixed(2)} of $${ceiling} remaining ceiling across ${allocations.length} proposals`,
  );

  return {
    as_of: new Date().toISOString(),
    daily_ceiling_usd: input.treasury.daily_ceiling_usd,
    total_authorized_usd: Number(
      allocations.reduce((a, x) => a + x.authorized_usd, 0).toFixed(2),
    ),
    allocations,
    zero_allocation_businesses: zero,
    rationale,
  };
}
