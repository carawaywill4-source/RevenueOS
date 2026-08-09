import type { ActionRisk, SafeAction } from "./types";
import {
  isOwnerRequired,
  isPermissionlessOrganic,
  OWNER_REQUIRED_TYPES,
  PERMISSIONLESS_ORGANIC_TYPES,
} from "./modules/permissionless";

const RISK_RANK: Record<ActionRisk, number> = {
  safe: 0,
  owner_gate: 1,
  forbidden: 2,
};

/**
 * Autonomous allowlist = permissionless organic doctrine.
 * Anything that creates leads/sales without accounts/logins/spend is safe.
 */
export const AUTONOMOUS_SAFE_TYPES = PERMISSIONLESS_ORGANIC_TYPES;

/** Only actions that need a human identity, wallet, or legal say-so. */
export const OWNER_GATE_TYPES = new Set([
  ...OWNER_REQUIRED_TYPES,
  "rewrite_page_copy", // brand voice — keep gated until copy limb is trusted
]);

/** Never autonomous — destructive or out of policy. */
export const FORBIDDEN_TYPES = new Set([
  "delete_production_data",
  "mass_delete",
  "price_sabotage",
  "fabricate_reviews",
  "scrape_pii",
]);

/**
 * Legacy always-run set. The executive now gates heartbeats through
 * `shouldHeartbeatAction` / profit mandate — discovery spam is not automatic.
 * Kept for adapters/tests that still reference the constant.
 */
export const ALWAYS_RUN_ACTION_TYPES = new Set([
  "scorecard_snapshot",
  "journal_decision",
]);

/** Actions that may run as heartbeats only when the profit maximizer funds them. */
export const PROFIT_HEARTBEAT_CANDIDATES = new Set([
  "scorecard_snapshot",
  "journal_decision",
  "indexnow_submit",
  "market_research",
  "discovery_attack",
  "sitemap_ping",
  "ping_search_engines",
  "publish_programmatic_door",
  "publish_free_resource",
  "distribute_owned_urls",
  "merch_optimize",
  "activate_kit_deal",
  "set_homepage_focus",
  "set_free_shipping_threshold",
  "feature_product",
]);

export function classifyActionType(type: string): ActionRisk {
  if (FORBIDDEN_TYPES.has(type)) return "forbidden";
  if (isOwnerRequired(type) || OWNER_GATE_TYPES.has(type)) return "owner_gate";
  if (isPermissionlessOrganic(type) || AUTONOMOUS_SAFE_TYPES.has(type)) {
    return "safe";
  }
  // Unknown types default to owner_gate so new limbs can be proposed as asks
  // without a core release — still never auto-run account/spend/destructive.
  return "owner_gate";
}

export function policyAllows(
  action: SafeAction,
  opts: { maxRisk?: ActionRisk; dailySpendUsd?: number; dailyCapUsd?: number } = {},
): { ok: boolean; reason?: string } {
  const maxRisk = opts.maxRisk ?? "safe";
  const risk = action.risk === "safe" ? classifyActionType(action.type) : action.risk;

  if (RISK_RANK[risk] > RISK_RANK[maxRisk]) {
    return {
      ok: false,
      reason: `Action ${action.type} is ${risk}; max allowed is ${maxRisk}`,
    };
  }

  if (risk === "forbidden") {
    return { ok: false, reason: `Action ${action.type} is forbidden` };
  }

  const cost = Number(action.payload?.costUsd ?? 0);
  if (
    cost > 0 &&
    opts.dailyCapUsd !== undefined &&
    (opts.dailySpendUsd ?? 0) + cost > opts.dailyCapUsd
  ) {
    return { ok: false, reason: "Would exceed autonomous daily spend cap" };
  }

  return { ok: true };
}

export function filterAutonomousActions(actions: SafeAction[]): SafeAction[] {
  return actions.filter((action) => policyAllows(action).ok);
}
