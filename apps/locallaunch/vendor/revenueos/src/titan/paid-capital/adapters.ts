/**
 * Ad platform adapters — stubs only.
 * Live credentials must not be connected until governor proofs pass
 * and owner enables live_paid_execution_enabled.
 */

import type { OwnerPaidCapitalControls, PaidPlatform } from "./types";
import { liveExecutionAllowed } from "./policy";

export type AdSpendExecutionRequest = {
  platform: PaidPlatform;
  campaign_id: string;
  authorization_id: string;
  amount_usd: number;
};

export type AdSpendExecutionResult = {
  executed: boolean;
  detail: string;
  external_spend_reported_usd: number;
};

/**
 * Defense-in-depth: even if somehow called, refuse without live flag.
 * Never circumvent platform spending limits.
 */
export async function executeAuthorizedAdSpend(input: {
  controls: OwnerPaidCapitalControls;
  request: AdSpendExecutionRequest;
}): Promise<AdSpendExecutionResult> {
  if (!liveExecutionAllowed(input.controls)) {
    return {
      executed: false,
      detail:
        "LIVE_PAID_EXECUTION_DISABLED — authorization may exist but adapters refuse to move money",
      external_spend_reported_usd: 0,
    };
  }
  // Intentionally unimplemented — connecting credentials is a later, explicit step.
  return {
    executed: false,
    detail:
      "ADAPTER_NOT_CONNECTED — platform credentials not wired; build governor proofs first",
    external_spend_reported_usd: 0,
  };
}

/** Owner UI / external defense checklist (documentation-as-data). */
export const EXTERNAL_DEFENSE_CHECKLIST = [
  "Configure platform/account-level spending caps wherever supported",
  "Use a dedicated payment method with hard external limits — not the full treasury card",
  "Stripe is evidence/treasury source, not an unlimited ad wallet",
  "Never attempt to circumvent platform billing controls or advertising policies",
] as const;
