/**
 * Owner kill switches — production storefronts stay online when autonomy pauses.
 */

import type { KillSwitch, MutationDomain } from "./types";

export type KillSwitchState = {
  active: Set<KillSwitch>;
};

export function createKillSwitchState(
  initial: KillSwitch[] = [],
): KillSwitchState {
  return { active: new Set(initial) };
}

export function setKillSwitch(
  state: KillSwitchState,
  sw: KillSwitch,
  on: boolean,
): KillSwitchState {
  const next = new Set(state.active);
  if (on) next.add(sw);
  else next.delete(sw);
  return { active: next };
}

const DOMAIN_SWITCHES: Partial<Record<MutationDomain, KillSwitch[]>> = {
  ACQUISITION: ["PAUSE_ACQUISITION", "PAUSE_EXTERNAL_WRITES", "EMERGENCY_STOP_AUTONOMY"],
  PRODUCT: ["PAUSE_PRODUCT_CHANGES", "EMERGENCY_STOP_AUTONOMY"],
  LANDING: ["PAUSE_PRODUCT_CHANGES", "PAUSE_EXTERNAL_WRITES", "EMERGENCY_STOP_AUTONOMY"],
  PRICING: ["PAUSE_PRODUCT_CHANGES", "EMERGENCY_STOP_AUTONOMY"],
  CHECKOUT: ["PAUSE_PRODUCT_CHANGES", "EMERGENCY_STOP_AUTONOMY"],
  FULFILLMENT: ["PAUSE_EXTERNAL_WRITES", "EMERGENCY_STOP_AUTONOMY"],
  INFRASTRUCTURE: ["PAUSE_DEPLOYMENTS", "EMERGENCY_STOP_AUTONOMY"],
  BRAND: ["PAUSE_PRODUCT_CHANGES", "EMERGENCY_STOP_AUTONOMY"],
  CAPITAL: ["PAUSE_PAID_SPEND", "EMERGENCY_STOP_AUTONOMY"],
  BUSINESS_LIFECYCLE: [
    "PAUSE_BUSINESS_CREATION",
    "PAUSE_BUSINESS_RETIREMENT",
    "EMERGENCY_STOP_AUTONOMY",
  ],
};

export function killSwitchBlocks(
  state: KillSwitchState,
  domain: MutationDomain,
  action?: string,
): { blocked: boolean; switch?: KillSwitch; reason: string } {
  if (state.active.has("EMERGENCY_STOP_AUTONOMY")) {
    return {
      blocked: true,
      switch: "EMERGENCY_STOP_AUTONOMY",
      reason: "owner_emergency_stop",
    };
  }
  const relevant = DOMAIN_SWITCHES[domain] ?? ["EMERGENCY_STOP_AUTONOMY"];
  for (const sw of relevant) {
    if (state.active.has(sw)) {
      return { blocked: true, switch: sw, reason: `kill_switch:${sw}` };
    }
  }
  if (
    action?.includes("create_business") &&
    state.active.has("PAUSE_BUSINESS_CREATION")
  ) {
    return {
      blocked: true,
      switch: "PAUSE_BUSINESS_CREATION",
      reason: "pause_business_creation",
    };
  }
  if (
    action?.includes("retire") &&
    state.active.has("PAUSE_BUSINESS_RETIREMENT")
  ) {
    return {
      blocked: true,
      switch: "PAUSE_BUSINESS_RETIREMENT",
      reason: "pause_business_retirement",
    };
  }
  return { blocked: false, reason: "clear" };
}
