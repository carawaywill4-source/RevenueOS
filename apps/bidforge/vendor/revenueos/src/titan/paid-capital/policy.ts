/**
 * Paid capital policy — Prime Capital Law.
 * 5% is portfolio-wide ceiling, never a target, never overridable by LLM.
 */

import {
  DEFAULT_OWNER_PAID_CONTROLS,
  PAID_CAPITAL_LAW,
  type OwnerPaidCapitalControls,
} from "./types";

export function clampOwnerControls(
  input?: Partial<OwnerPaidCapitalControls>,
): OwnerPaidCapitalControls {
  const base = { ...DEFAULT_OWNER_PAID_CONTROLS, ...input };
  const pct = Math.min(
    PAID_CAPITAL_LAW.max_daily_pct_of_eligible,
    Math.max(0, base.max_daily_pct),
  );
  return {
    ...base,
    max_daily_pct: pct,
    absolute_daily_cap_usd: Math.max(0, base.absolute_daily_cap_usd),
    protected_cash_floor_usd: Math.max(0, base.protected_cash_floor_usd),
    // Live execution cannot silently turn on with only paid_capital_enabled.
    live_paid_execution_enabled:
      base.paid_capital_enabled === true && base.live_paid_execution_enabled === true
        ? true
        : false,
  };
}

/**
 * daily_paid_capital_ceiling = min(eligible * pct, owner absolute daily cap)
 * If absolute cap is 0 while paid enabled → treat as "pct only" but still require enable.
 * If paid disabled → ceiling 0.
 */
export function computeDailyCeiling(input: {
  eligible_capital_usd: number;
  controls: OwnerPaidCapitalControls;
}): number {
  const controls = clampOwnerControls(input.controls);
  if (!controls.paid_capital_enabled || controls.pause_all_paid_acquisition) {
    return 0;
  }
  const eligible = Math.max(0, input.eligible_capital_usd);
  const pctCap = eligible * controls.max_daily_pct;
  // absolute_daily_cap_usd === 0 means owner has not set a positive absolute cap;
  // still bound by pct, but live systems should set an absolute cap for defense-in-depth.
  if (controls.absolute_daily_cap_usd > 0) {
    return Math.min(pctCap, controls.absolute_daily_cap_usd);
  }
  return pctCap;
}

export function platformAllowed(
  controls: OwnerPaidCapitalControls,
  platform: string,
): boolean {
  const c = clampOwnerControls(controls);
  if (!c.paid_capital_enabled || c.pause_all_paid_acquisition) return false;
  const key = platform as keyof typeof c.platforms_enabled;
  // Explicit enable required per platform — empty map means none enabled.
  return c.platforms_enabled[key] === true;
}

export function liveExecutionAllowed(controls: OwnerPaidCapitalControls): boolean {
  const c = clampOwnerControls(controls);
  return (
    c.paid_capital_enabled &&
    !c.pause_all_paid_acquisition &&
    c.live_paid_execution_enabled === true
  );
}
