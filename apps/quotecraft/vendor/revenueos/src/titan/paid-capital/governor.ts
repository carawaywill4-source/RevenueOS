/**
 * Deterministic Capital Governor — outside the LLM.
 * The LLM may propose spending. The LLM cannot authorize money.
 */

import { newId } from "../../ledger/store";
import { computeEligibleCapital, type EligibleCapitalInput } from "./eligible-capital";
import {
  evaluateCircuitBreakers,
  shouldFreezeNewSpend,
} from "./circuit-breakers";
import {
  createTreasuryLedger,
  reserveAuthorization,
  sumActiveReservations,
  type TreasuryLedger,
} from "./treasury-ledger";
import { clampOwnerControls, liveExecutionAllowed } from "./policy";
import { ladderMaxSpend } from "./experiment-ladder";
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  ApexPaidProposal,
  OwnerPaidCapitalControls,
  TreasurySnapshot,
} from "./types";

export type GovernorState = {
  controls: OwnerPaidCapitalControls;
  ledger: TreasuryLedger;
  capital_input: Omit<EligibleCapitalInput, "controls">;
};

export function createGovernorState(input: {
  controls?: Partial<OwnerPaidCapitalControls>;
  capital: Omit<EligibleCapitalInput, "controls">;
}): GovernorState {
  return {
    controls: clampOwnerControls(input.controls),
    ledger: createTreasuryLedger(),
    capital_input: input.capital,
  };
}

export function snapshotTreasury(state: GovernorState): TreasurySnapshot {
  const active = sumActiveReservations(state.ledger);
  return computeEligibleCapital({
    ...state.capital_input,
    controls: state.controls,
    ad_authorized_today_usd:
      (state.capital_input.ad_authorized_today_usd ?? 0) + active,
  });
}

/**
 * Authorize a paid spend request. Deterministic. Never moves unrestricted capital.
 * Returns authorized=false by default whenever uncertain.
 */
export function authorizePaidSpend(
  state: GovernorState,
  request: AuthorizationRequest,
  opts?: {
    proposal?: ApexPaidProposal;
    economics_deteriorated?: boolean;
    attribution_unreliable?: boolean;
    spend_acceleration_anomaly?: boolean;
    duplicate_campaign?: boolean;
    credentials_abnormal?: boolean;
    telemetry_stale?: boolean;
    abnormal_charge_refund_dispute?: boolean;
    now?: Date;
  },
): { decision: AuthorizationDecision; state: GovernorState } {
  const controls = clampOwnerControls(state.controls);
  const treasury = snapshotTreasury(state);
  const requested = Math.max(0, request.requested_spend_usd);

  // Ladder clamp — never jump to max daily from tiny win.
  const ladderCap = opts?.proposal
    ? ladderMaxSpend(opts.proposal.ladder_stage, treasury.remaining_ceiling_usd)
    : Math.min(requested, treasury.remaining_ceiling_usd);
  const cappedRequest = Math.min(requested, ladderCap);

  // Expected value gate: if EV <= 0 or confidence too low → $0
  const evPositive =
    request.expected_value_usd > 0 &&
    request.confidence >= 0.35 &&
    cappedRequest > 0;

  const breakers = evaluateCircuitBreakers({
    treasury,
    controls,
    requested_spend_usd: cappedRequest,
    platform: request.platform,
    business_id: request.business_id,
    campaign_id: request.campaign_id,
    economics_deteriorated: opts?.economics_deteriorated,
    attribution_unreliable: opts?.attribution_unreliable,
    spend_acceleration_anomaly: opts?.spend_acceleration_anomaly,
    duplicate_campaign: opts?.duplicate_campaign,
    credentials_abnormal: opts?.credentials_abnormal,
    telemetry_stale: opts?.telemetry_stale,
    abnormal_charge_refund_dispute: opts?.abnormal_charge_refund_dispute,
    would_exceed_ceiling: cappedRequest > treasury.remaining_ceiling_usd + 1e-9,
    would_exceed_owner_cap:
      controls.absolute_daily_cap_usd > 0 &&
      treasury.ad_authorized_today_usd +
        treasury.ad_committed_today_usd +
        treasury.ad_spent_today_usd +
        cappedRequest >
        controls.absolute_daily_cap_usd + 1e-9,
    provider_disagrees: !treasury.reconciliation.ok,
  });

  const reject = (reason: string): { decision: AuthorizationDecision; state: GovernorState } => ({
    decision: {
      authorized: false,
      authorization_id: null,
      authorized_spend_usd: 0,
      expires_at: null,
      reason,
      portfolio_exposure_usd:
        treasury.ad_authorized_today_usd +
        treasury.ad_committed_today_usd +
        treasury.ad_spent_today_usd,
      business_exposure_usd: 0,
      daily_ceiling_usd: treasury.daily_ceiling_usd,
      remaining_ceiling_usd: treasury.remaining_ceiling_usd,
      circuit_breakers_triggered: breakers.map((b) => b.code),
      authorized_by: "DETERMINISTIC_GOVERNOR",
    },
    state,
  });

  if (shouldFreezeNewSpend(breakers)) {
    return reject(`circuit_breaker:${breakers.map((b) => b.code).join(",")}`);
  }
  if (!evPositive) {
    return reject("non_positive_expected_incremental_value_or_low_confidence — spend $0");
  }
  if (opts?.proposal && opts.proposal.organic_prior_keys.length === 0) {
    return reject("organic_priors_required — paid must accelerate validated learning");
  }

  // Never force spend up to ceiling. Evidence-sized: request ∩ ladder ∩ remaining ∩ confidence.
  let spend = Math.min(cappedRequest, treasury.remaining_ceiling_usd);
  if (request.confidence < 0.55) {
    spend = Number((spend * 0.5).toFixed(2));
  } else {
    spend = Number(spend.toFixed(2));
  }

  if (spend <= 0) {
    return reject("justified_spend_zero");
  }

  const authId = newId("tauth");
  const ttl = request.authorization_ttl_ms ?? 15 * 60_000;
  const reserved = reserveAuthorization(state.ledger, {
    authorization_id: authId,
    business_id: request.business_id,
    campaign_id: request.campaign_id,
    platform: request.platform,
    amount_usd: spend,
    remaining_ceiling_usd: treasury.remaining_ceiling_usd,
    ttl_ms: ttl,
    now: opts?.now,
  });

  if (!reserved.ok || !reserved.reservation) {
    return reject(reserved.reason);
  }

  return {
    decision: {
      authorized: true,
      authorization_id: authId,
      authorized_spend_usd: spend,
      expires_at: reserved.reservation.expires_at,
      reason: `authorized ${spend} of requested ${requested} under portfolio ceiling ${treasury.daily_ceiling_usd}; live_execution=${liveExecutionAllowed(controls)}`,
      portfolio_exposure_usd:
        treasury.ad_authorized_today_usd +
        treasury.ad_committed_today_usd +
        treasury.ad_spent_today_usd +
        spend,
      business_exposure_usd: spend,
      daily_ceiling_usd: treasury.daily_ceiling_usd,
      remaining_ceiling_usd: Number(
        (treasury.remaining_ceiling_usd - spend).toFixed(2),
      ),
      circuit_breakers_triggered: [],
      authorized_by: "DETERMINISTIC_GOVERNOR",
    },
    state: { ...state, ledger: reserved.ledger, controls },
  };
}

/**
 * Emergency owner pause — immediate, overrides everything.
 */
export function applyOwnerPause(state: GovernorState): GovernorState {
  return {
    ...state,
    controls: clampOwnerControls({
      ...state.controls,
      pause_all_paid_acquisition: true,
    }),
  };
}
