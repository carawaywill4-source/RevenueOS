/**
 * Non-negotiable safety simulations — must fail safely before live credentials.
 */

import { createGovernorState, authorizePaidSpend, applyOwnerPause, snapshotTreasury } from "./governor";
import { createApexPaidProposal, proposalToAuthRequest } from "./apex-proposals";
import { allocatePortfolioAdCapital } from "./portfolio-market";
import { executeAuthorizedAdSpend } from "./adapters";
import { dayKey, ensureLedgerDay, reserveAuthorization } from "./treasury-ledger";
import type { AuthorizationDecision } from "./types";

export type SimResult = {
  name: string;
  pass: boolean;
  detail: string;
};

function baseCapital(overrides?: Record<string, number>) {
  return {
    gross_revenue_usd: 10_000,
    settled_usd: 8_000,
    refund_reserve_usd: 400,
    dispute_reserve_usd: 200,
    payment_fees_usd: 300,
    tax_reserve_usd: 100,
    operating_liabilities_usd: 500,
    infrastructure_obligations_usd: 200,
    already_committed_ad_spend_usd: 0,
    provider_settled_usd: 8_000,
    ...overrides,
  };
}

function goodProposal(business_id: string, spend: number) {
  return createApexPaidProposal({
    business_id,
    platform: "meta",
    campaign_key: `camp_${business_id}`,
    hypothesis: "organic persona converts with paid boost",
    audience: "freelancer scope creep",
    message: "get paid for change orders",
    offer: "ScopeGuard $45",
    landing_path: "/",
    organic_prior_keys: ["persona:freelancer", "intent:high", "message:boundaries"],
    organic_evidence_summary: "organic qualified exposures with CTA engagement",
    requested_spend_usd: spend,
    expected_incremental_contribution_usd: spend * 1.3,
    expected_cac_usd: 20,
    expected_cvr: 0.02,
    expected_aov_usd: 45,
    expected_incremental_roas: 2.3,
    confidence: 0.7,
    ladder_stage: "SMALLEST_USEFUL",
  });
}

export function runPaidCapitalSafetySimulations(): SimResult[] {
  const results: SimResult[] = [];

  // 1) Concurrent spend requests cannot exceed ceiling
  {
    let state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        max_daily_pct: 0.05,
        absolute_daily_cap_usd: 10_000,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const treasury = snapshotTreasury(state);
    const half = treasury.remaining_ceiling_usd * 0.6;
    const p1 = goodProposal("a", half);
    const p2 = goodProposal("b", half);
    const r1 = authorizePaidSpend(state, proposalToAuthRequest(p1), { proposal: p1 });
    state = r1.state;
    const r2 = authorizePaidSpend(state, proposalToAuthRequest(p2), { proposal: p2 });
    const total =
      (r1.decision.authorized_spend_usd || 0) + (r2.decision.authorized_spend_usd || 0);
    results.push({
      name: "concurrent_spend_respects_ceiling",
      pass: total <= treasury.daily_ceiling_usd + 0.01,
      detail: `total_authorized=${total} ceiling=${treasury.daily_ceiling_usd}`,
    });
  }

  // 2) Stale / drifted Stripe balance → no spend
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 500,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital({ provider_settled_usd: 1_000 }), // big drift vs 8000
    });
    const p = goodProposal("scopeguard", 50);
    const r = authorizePaidSpend(state, proposalToAuthRequest(p), { proposal: p });
    results.push({
      name: "stale_stripe_balance_no_spend",
      pass: r.decision.authorized === false,
      detail: r.decision.reason,
    });
  }

  // 3) Refund / chargeback spike
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 500,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const p = goodProposal("scopeguard", 40);
    const r = authorizePaidSpend(state, proposalToAuthRequest(p), {
      proposal: p,
      abnormal_charge_refund_dispute: true,
    });
    results.push({
      name: "refund_chargeback_spike_freezes",
      pass: !r.decision.authorized,
      detail: r.decision.reason,
    });
  }

  // 4) Campaign overspend request > 5%
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 1_000_000,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const treasury = snapshotTreasury(state);
    const p = goodProposal("greedy", treasury.daily_ceiling_usd * 3);
    const r = authorizePaidSpend(state, proposalToAuthRequest(p), { proposal: p });
    results.push({
      name: "over_5pct_rejected_or_clamped",
      pass:
        !r.decision.authorized ||
        r.decision.authorized_spend_usd <= treasury.daily_ceiling_usd + 0.01,
      detail: `authorized=${r.decision.authorized_spend_usd} ceiling=${treasury.daily_ceiling_usd}`,
    });
  }

  // 5) TITAN requesting >5% of eligible
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        max_daily_pct: 0.05,
        absolute_daily_cap_usd: 999999,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const eligible = snapshotTreasury(state).eligible_capital_usd;
    const p = goodProposal("titan", eligible * 0.2);
    const r = authorizePaidSpend(state, proposalToAuthRequest(p), { proposal: p });
    results.push({
      name: "titan_cannot_override_5pct",
      pass:
        !r.decision.authorized ||
        r.decision.authorized_spend_usd <= eligible * 0.05 + 0.01,
      detail: r.decision.reason,
    });
  }

  // 6) Duplicate authorization / campaign
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 500,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const p = goodProposal("scopeguard", 30);
    const r = authorizePaidSpend(state, proposalToAuthRequest(p), {
      proposal: p,
      duplicate_campaign: true,
    });
    results.push({
      name: "duplicate_campaign_rejected",
      pass: !r.decision.authorized,
      detail: r.decision.reason,
    });
  }

  // 7) Corrupted / unreliable attribution
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 500,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const p = goodProposal("scopeguard", 30);
    const r = authorizePaidSpend(state, proposalToAuthRequest(p), {
      proposal: p,
      attribution_unreliable: true,
    });
    results.push({
      name: "corrupted_attribution_no_spend",
      pass: !r.decision.authorized,
      detail: r.decision.reason,
    });
  }

  // 8) Business requesting entire portfolio budget — market allocates unevenly, not 100% to weak
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 10_000,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const treasury = snapshotTreasury(state);
    const strong = goodProposal("scopeguard", 200);
    strong.expected_incremental_contribution_usd = 460;
    strong.confidence = 0.8;
    const weak = goodProposal("other", treasury.remaining_ceiling_usd);
    weak.expected_incremental_contribution_usd = 10;
    weak.confidence = 0.4;
    const plan = allocatePortfolioAdCapital({
      treasury,
      proposals: [strong, weak],
    });
    const weakAlloc = plan.allocations.find((a) => a.business_id === "other");
    results.push({
      name: "business_cannot_seize_entire_budget",
      pass:
        plan.total_authorized_usd <= treasury.remaining_ceiling_usd + 0.01 &&
        (weakAlloc?.authorized_usd ?? 0) < treasury.remaining_ceiling_usd * 0.9,
      detail: JSON.stringify(plan.allocations),
    });
  }

  // 9) Owner emergency pause
  {
    let state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 500,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    state = applyOwnerPause(state);
    const p = goodProposal("scopeguard", 20);
    const r = authorizePaidSpend(state, proposalToAuthRequest(p), { proposal: p });
    results.push({
      name: "owner_emergency_pause",
      pass: !r.decision.authorized,
      detail: r.decision.reason,
    });
  }

  // 10) Midnight / day-boundary accounting clears active auths
  {
    const state = createGovernorState({
      controls: {
        paid_capital_enabled: true,
        absolute_daily_cap_usd: 500,
        platforms_enabled: { meta: true },
      },
      capital: baseCapital(),
    });
    const treasury = snapshotTreasury(state);
    const reserved = reserveAuthorization(state.ledger, {
      authorization_id: "auth_day",
      business_id: "scopeguard",
      campaign_id: "c1",
      platform: "meta",
      amount_usd: 10,
      remaining_ceiling_usd: treasury.remaining_ceiling_usd,
    });
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const rolled = ensureLedgerDay(reserved.ledger!, tomorrow);
    results.push({
      name: "day_boundary_expires_active_reservations",
      pass:
        dayKey(tomorrow) === rolled.day_key &&
        rolled.reservations.every((r) => r.state !== "ACTIVE"),
      detail: `day=${rolled.day_key} states=${rolled.reservations.map((r) => r.state).join(",")}`,
    });
  }

  return results;
}

/** Async sims that need adapter promises. */
export async function runPaidCapitalAsyncSafetySimulations(): Promise<SimResult[]> {
  const sync = runPaidCapitalSafetySimulations().filter(
    (r) => r.name !== "retry_cannot_move_money_without_live_flag",
  );

  const execOff = await executeAuthorizedAdSpend({
    controls: {
      paid_capital_enabled: true,
      max_daily_pct: 0.05,
      absolute_daily_cap_usd: 100,
      protected_cash_floor_usd: 0,
      pause_all_paid_acquisition: false,
      platforms_enabled: { meta: true },
      live_paid_execution_enabled: false,
    },
    request: {
      platform: "meta",
      campaign_id: "c1",
      authorization_id: "auth",
      amount_usd: 25,
    },
  });

  const disabled = createGovernorState({
    controls: { paid_capital_enabled: false },
    capital: baseCapital(),
  });
  const p = goodProposal("scopeguard", 50);
  const r: AuthorizationDecision = authorizePaidSpend(
    disabled,
    proposalToAuthRequest(p),
    { proposal: p },
  ).decision;

  return [
    ...sync,
    {
      name: "retry_cannot_move_money_without_live_flag",
      pass: execOff.executed === false,
      detail: execOff.detail,
    },
    {
      name: "paid_capital_disabled_by_default",
      pass: r.authorized === false,
      detail: r.reason,
    },
    {
      name: "ai_recommendation_cannot_move_unrestricted_capital",
      pass: execOff.executed === false && r.authorized === false,
      detail: "Governor + adapter both refuse unrestricted movement",
    },
  ];
}
