/**
 * APEX proposes paid experiments; TITAN allocates capital.
 * Proposals are never authority.
 */

import { newId } from "../../ledger/store";
import type { ApexPaidProposal, ExperimentLadderStage, PaidPlatform } from "./types";

export function createApexPaidProposal(input: {
  business_id: string;
  platform: PaidPlatform;
  campaign_key: string;
  hypothesis: string;
  audience: string;
  message: string;
  offer: string;
  landing_path: string;
  organic_prior_keys: string[];
  organic_evidence_summary: string;
  requested_spend_usd: number;
  expected_incremental_contribution_usd: number;
  expected_cac_usd: number;
  expected_cvr: number;
  expected_aov_usd: number;
  expected_refund_rate?: number;
  expected_incremental_roas: number;
  confidence: number;
  evidence_ids?: string[];
  creative_lineage_id?: string;
  ladder_stage?: ExperimentLadderStage;
}): ApexPaidProposal {
  return {
    proposal_id: newId("aprop"),
    business_id: input.business_id,
    platform: input.platform,
    campaign_key: input.campaign_key,
    hypothesis: input.hypothesis,
    audience: input.audience,
    message: input.message,
    creative_lineage_id: input.creative_lineage_id,
    offer: input.offer,
    landing_path: input.landing_path,
    organic_prior_keys: input.organic_prior_keys,
    organic_evidence_summary: input.organic_evidence_summary,
    requested_spend_usd: Math.max(0, input.requested_spend_usd),
    expected_incremental_contribution_usd: input.expected_incremental_contribution_usd,
    expected_cac_usd: input.expected_cac_usd,
    expected_cvr: input.expected_cvr,
    expected_aov_usd: input.expected_aov_usd,
    expected_refund_rate: input.expected_refund_rate ?? 0.05,
    expected_incremental_roas: input.expected_incremental_roas,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    evidence_ids: input.evidence_ids ?? [],
    ladder_stage: input.ladder_stage ?? "SMALLEST_USEFUL",
  };
}

/** Convert APEX proposal into a governor authorization request (still not spent). */
export function proposalToAuthRequest(proposal: ApexPaidProposal) {
  return {
    business_id: proposal.business_id,
    platform: proposal.platform,
    campaign_id: proposal.campaign_key,
    proposal_id: proposal.proposal_id,
    requested_spend_usd: proposal.requested_spend_usd,
    expected_value_usd: proposal.expected_incremental_contribution_usd,
    confidence: proposal.confidence,
    evidence: [
      proposal.organic_evidence_summary,
      ...proposal.organic_prior_keys,
      ...proposal.evidence_ids,
    ],
  };
}
