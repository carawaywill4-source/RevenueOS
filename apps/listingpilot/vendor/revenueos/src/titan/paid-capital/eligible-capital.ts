/**
 * Conservative eligible capital.
 * Never use Stripe gross sales or pending balances as ad wallet.
 */

import type { OwnerPaidCapitalControls, TreasurySnapshot } from "./types";
import { computeDailyCeiling } from "./policy";

export type EligibleCapitalInput = {
  as_of?: string;
  gross_revenue_usd: number;
  settled_usd: number;
  refund_reserve_usd?: number;
  dispute_reserve_usd?: number;
  payment_fees_usd?: number;
  tax_reserve_usd?: number;
  operating_liabilities_usd?: number;
  infrastructure_obligations_usd?: number;
  already_committed_ad_spend_usd?: number;
  /** Optional Stripe/provider settled figure for reconciliation. */
  provider_settled_usd?: number | null;
  ad_authorized_today_usd?: number;
  ad_committed_today_usd?: number;
  ad_spent_today_usd?: number;
  controls: OwnerPaidCapitalControls;
};

/**
 * Money required to keep businesses alive is not advertising capital.
 */
export function computeEligibleCapital(input: EligibleCapitalInput): TreasurySnapshot {
  const settled = Math.max(0, input.settled_usd);
  const refund = Math.max(0, input.refund_reserve_usd ?? 0);
  const dispute = Math.max(0, input.dispute_reserve_usd ?? 0);
  const fees = Math.max(0, input.payment_fees_usd ?? 0);
  const tax = Math.max(0, input.tax_reserve_usd ?? 0);
  const operating = Math.max(0, input.operating_liabilities_usd ?? 0);
  const infra = Math.max(0, input.infrastructure_obligations_usd ?? 0);
  const protectedFloor = Math.max(0, input.controls.protected_cash_floor_usd);
  const committed = Math.max(0, input.already_committed_ad_spend_usd ?? 0);

  const deductions = refund + dispute + fees + tax + operating + infra + protectedFloor + committed;
  const eligible = Math.max(0, settled - deductions);
  // Available for new ad authorization = eligible minus already authorized/committed/spent today
  const authorized = Math.max(0, input.ad_authorized_today_usd ?? 0);
  const adCommitted = Math.max(0, input.ad_committed_today_usd ?? 0);
  const spent = Math.max(0, input.ad_spent_today_usd ?? 0);
  const dailyCeiling = computeDailyCeiling({
    eligible_capital_usd: eligible,
    controls: input.controls,
  });
  const remaining = Math.max(0, dailyCeiling - authorized - adCommitted - spent);
  const available = Math.min(eligible, remaining);

  const provider = input.provider_settled_usd ?? null;
  const drift = provider === null ? 0 : Number((provider - settled).toFixed(2));
  const reconcileOk = provider === null ? true : Math.abs(drift) <= Math.max(1, settled * 0.02);

  return {
    as_of: input.as_of ?? new Date().toISOString(),
    gross_revenue_usd: Math.max(0, input.gross_revenue_usd),
    settled_usd: settled,
    refund_reserve_usd: refund,
    dispute_reserve_usd: dispute,
    payment_fees_usd: fees,
    tax_reserve_usd: tax,
    operating_liabilities_usd: operating,
    infrastructure_obligations_usd: infra,
    protected_cash_floor_usd: protectedFloor,
    already_committed_ad_spend_usd: committed,
    eligible_capital_usd: Number(eligible.toFixed(2)),
    available_usd: Number(available.toFixed(2)),
    ad_authorized_today_usd: authorized,
    ad_committed_today_usd: adCommitted,
    ad_spent_today_usd: spent,
    daily_ceiling_usd: Number(dailyCeiling.toFixed(2)),
    remaining_ceiling_usd: Number(remaining.toFixed(2)),
    reconciliation: {
      provider_settled_usd: provider,
      internal_settled_usd: settled,
      drift_usd: drift,
      ok: reconcileOk,
      note:
        provider === null
          ? "No provider settled figure supplied — do not infer cash from gross"
          : reconcileOk
            ? "Internal settled reconciles with provider within tolerance"
            : "RECONCILIATION_DRIFT — default to NO NEW SPEND",
    },
  };
}
