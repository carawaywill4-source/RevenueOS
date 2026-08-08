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
]);

export const OWNER_GATE_TYPES = new Set([
  "rewrite_page_copy",
  "change_price",
  "send_commercial_outreach",
  "create_account",
  "spend_ads",
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
