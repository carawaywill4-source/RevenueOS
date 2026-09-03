/**
 * APEX Governor — constitution + risk classes.
 * Strategies cannot override owner constitution.
 */

import type { ApexDecision, ApexRiskClass } from "./types";

export type ApexConstitution = {
  noPaidAds: boolean;
  noAutonomousSpend: boolean;
  maxActiveBusinesses: number;
  allowExternalPublish: boolean;
};

export const DEFAULT_APEX_CONSTITUTION: ApexConstitution = {
  noPaidAds: true,
  noAutonomousSpend: true,
  maxActiveBusinesses: 50,
  allowExternalPublish: true,
};

const PAID_MARKERS = [
  "paid_ads",
  "google_ads",
  "meta_ads",
  "facebook_ads",
  "boost_post",
  "sponsored",
  "ppc",
  "buy_traffic",
  "adwords",
];

const SPEND_MARKERS = [
  "autonomous_spend",
  "purchase_credits",
  "top_up",
  "pay_for_",
  "buy_followers",
];

export function inferRiskClass(action: string): ApexRiskClass {
  const a = action.toLowerCase();
  if (a.includes("owner_") || a.includes("legal_") || a.includes("contract")) {
    return "R4";
  }
  if (
    PAID_MARKERS.some((m) => a.includes(m)) ||
    SPEND_MARKERS.some((m) => a.includes(m))
  ) {
    return "R3";
  }
  // Owned-property actions are R1 even when named publish_*_door / landing.
  if (
    a.includes("owned") ||
    a.includes("discovery_door") ||
    a.includes("door") ||
    a.includes("sitemap") ||
    a.includes("indexnow") ||
    a.includes("landing") ||
    a.includes("trust_signal") ||
    a.includes("checkout_friction") ||
    a.includes("conversion_lab") ||
    a.includes("offer_clarity") ||
    a.includes("message_genome")
  ) {
    return "R1";
  }
  if (
    a.includes("reddit") ||
    a.includes("email") ||
    a.includes("outreach") ||
    a.includes("publish") ||
    a.includes("hn_") ||
    a.includes("producthunt") ||
    a.includes("indiehackers") ||
    a.includes("gumroad") ||
    a.includes("list_")
  ) {
    return "R2";
  }
  return "R0";
}

export function governAction(input: {
  action: string;
  riskClass?: ApexRiskClass;
  constitution?: ApexConstitution;
}): { authorized: boolean; detail: string; riskClass: ApexRiskClass } {
  const constitution = input.constitution ?? DEFAULT_APEX_CONSTITUTION;
  const riskClass = input.riskClass ?? inferRiskClass(input.action);
  const action = input.action.toLowerCase();

  if (constitution.noPaidAds && PAID_MARKERS.some((m) => action.includes(m))) {
    return {
      authorized: false,
      detail: "constitution:NO_PAID_ADS",
      riskClass,
    };
  }
  if (
    constitution.noAutonomousSpend &&
    SPEND_MARKERS.some((m) => action.includes(m))
  ) {
    return {
      authorized: false,
      detail: "constitution:NO_AUTONOMOUS_SPEND",
      riskClass,
    };
  }
  if (riskClass === "R4") {
    return {
      authorized: false,
      detail: "needs_you:R4_owner_only",
      riskClass,
    };
  }
  if (riskClass === "R3") {
    return {
      authorized: false,
      detail: "blocked:R3_reputation_or_financial",
      riskClass,
    };
  }
  if (riskClass === "R2" && !constitution.allowExternalPublish) {
    return {
      authorized: false,
      detail: "constitution:external_publish_disabled",
      riskClass,
    };
  }
  return {
    authorized: true,
    detail: `authorized:${riskClass}`,
    riskClass,
  };
}

export function authorizeDecision(
  decision: ApexDecision,
  constitution?: ApexConstitution,
): ApexDecision {
  const g = governAction({
    action: decision.selected_action,
    riskClass: decision.risk_class,
    constitution,
  });
  return {
    ...decision,
    risk_class: g.riskClass,
    authorized: g.authorized,
    authorization_detail: g.detail,
  };
}
