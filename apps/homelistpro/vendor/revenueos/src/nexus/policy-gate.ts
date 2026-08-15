/**
 * Deterministic pre-action policy gate — separate from model reasoning.
 */

import { killSwitchBlocks, type KillSwitchState } from "./kill-switches";
import type {
  AutonomyRank,
  MutationDomain,
  NexusSubsystem,
  PolicyVerdict,
  RevenueCommand,
} from "./types";

export type PolicyDecision = {
  verdict: PolicyVerdict;
  reason: string;
  risk_class: AutonomyRank;
  stored_at: string;
};

export type PolicyContext = {
  actor: string;
  subsystem: NexusSubsystem;
  action: string;
  domain: MutationDomain;
  business_id: string | null;
  risk_class: AutonomyRank;
  kills: KillSwitchState;
  /** Owner constitution flags. */
  no_paid_ads?: boolean;
  max_autonomy?: AutonomyRank;
  world_version?: string | null;
  command_authorized_version?: string | null;
};

const RANK_ORDER: AutonomyRank[] = ["R0", "R1", "R2", "R3", "R4", "R5"];

function rankAtMost(have: AutonomyRank, max: AutonomyRank): boolean {
  return RANK_ORDER.indexOf(have) <= RANK_ORDER.indexOf(max);
}

export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  const now = new Date().toISOString();
  const kill = killSwitchBlocks(ctx.kills, ctx.domain, ctx.action);
  if (kill.blocked) {
    return {
      verdict: "DENY",
      reason: kill.reason,
      risk_class: ctx.risk_class,
      stored_at: now,
    };
  }

  if (
    ctx.no_paid_ads !== false &&
    (ctx.domain === "CAPITAL" ||
      ctx.action.includes("paid_ad") ||
      ctx.action.includes("ad_spend"))
  ) {
    return {
      verdict: "DENY",
      reason: "constitution_no_paid_ads",
      risk_class: ctx.risk_class,
      stored_at: now,
    };
  }

  const max = ctx.max_autonomy ?? "R3";
  if (!rankAtMost(ctx.risk_class, max)) {
    if (ctx.risk_class === "R5") {
      return {
        verdict: "REQUIRE_APPROVAL",
        reason: "owner_only_R5",
        risk_class: ctx.risk_class,
        stored_at: now,
      };
    }
    return {
      verdict: "REQUIRE_APPROVAL",
      reason: `autonomy_exceeds_max:${ctx.risk_class}>${max}`,
      risk_class: ctx.risk_class,
      stored_at: now,
    };
  }

  // Stale decision protection
  if (
    ctx.command_authorized_version &&
    ctx.world_version &&
    ctx.command_authorized_version !== ctx.world_version
  ) {
    return {
      verdict: "DENY",
      reason: "STATE_CHANGED_REPLAN",
      risk_class: ctx.risk_class,
      stored_at: now,
    };
  }

  // CORTEX has no commercial execution authority
  if (
    ctx.subsystem === "CORTEX" &&
    ["ACQUISITION", "PRODUCT", "PRICING", "LANDING", "CHECKOUT", "CAPITAL"].includes(
      ctx.domain,
    )
  ) {
    return {
      verdict: "DENY",
      reason: "cortex_no_commercial_execution",
      risk_class: ctx.risk_class,
      stored_at: now,
    };
  }

  // TITAN commands — does not post/checkout/edit pages directly
  if (
    ctx.subsystem === "TITAN" &&
    ["publish", "post_reddit", "checkout", "deploy", "edit_page"].some((a) =>
      ctx.action.includes(a),
    )
  ) {
    return {
      verdict: "DENY",
      reason: "titan_commands_not_executes",
      risk_class: ctx.risk_class,
      stored_at: now,
    };
  }

  return {
    verdict: "ALLOW",
    reason: "policy_clear",
    risk_class: ctx.risk_class,
    stored_at: now,
  };
}

export function policyForCommand(
  command: RevenueCommand,
  kills: KillSwitchState,
  opts?: {
    no_paid_ads?: boolean;
    max_autonomy?: AutonomyRank;
    world_version?: string | null;
  },
): PolicyDecision {
  return evaluatePolicy({
    actor: command.issuer,
    subsystem: command.issuer,
    action: command.requested_action,
    domain: command.domain,
    business_id: command.business_id,
    risk_class: command.risk_class,
    kills,
    no_paid_ads: opts?.no_paid_ads,
    max_autonomy: opts?.max_autonomy,
    world_version: opts?.world_version ?? null,
    command_authorized_version: command.authorized_against_version,
  });
}
