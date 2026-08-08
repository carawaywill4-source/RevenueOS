import type { ActionRisk, SafeAction } from "./types";

const RISK_RANK: Record<ActionRisk, number> = {
  safe: 0,
  owner_gate: 1,
  forbidden: 2,
};

/** MVP allowlist of action types the executive may run without an owner. */
export const AUTONOMOUS_SAFE_TYPES = new Set([
  "scorecard_snapshot",
  "email_daily_review",
  "indexnow_submit",
  "record_experiment",
  "record_lesson",
  "journal_decision",
  "merch_optimize",
  "activate_kit_deal",
  "clear_promo",
  "set_homepage_focus",
  "set_free_shipping_threshold",
  "market_research",
  "publish_intent_page",
  "sitemap_ping",
  "discovery_attack",
  "retire_discovery_door",
]);

export const OWNER_GATE_TYPES = new Set([
  "rewrite_page_copy",
  "change_price",
  "send_commercial_outreach",
  "create_account",
  "spend_ads",
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
  "merch_optimize",
  "activate_kit_deal",
  "set_homepage_focus",
  "set_free_shipping_threshold",
]);

export function classifyActionType(type: string): ActionRisk {
  if (AUTONOMOUS_SAFE_TYPES.has(type)) return "safe";
  if (OWNER_GATE_TYPES.has(type)) return "owner_gate";
  return "forbidden";
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
