import type { ActionRegistryEntry, SafeAction } from "../types";

/** Canonical registry of autonomous actions the brain may execute. */
export const ACTION_REGISTRY: Record<string, ActionRegistryEntry> = {
  scorecard_snapshot: { type: "scorecard_snapshot", exposureKey: "scorecard" },
  indexnow_submit: { type: "indexnow_submit", exposureKey: "indexnow", cooldownMinutes: 10 },
  email_daily_review: { type: "email_daily_review", exposureKey: "email-digest" },
  merch_optimize: {
    type: "merch_optimize",
    exposureKey: "merch-state",
    rollbackActionType: "clear_promo",
  },
  activate_kit_deal: {
    type: "activate_kit_deal",
    exposureKey: "kit-promo",
    rollbackActionType: "clear_promo",
  },
  clear_promo: { type: "clear_promo", exposureKey: "merch-state" },
  set_homepage_focus: { type: "set_homepage_focus", exposureKey: "homepage-focus" },
  set_free_shipping_threshold: {
    type: "set_free_shipping_threshold",
    exposureKey: "free-shipping-threshold",
  },
  market_research: {
    type: "market_research",
    exposureKey: "internet-research",
    cooldownMinutes: 20,
  },
  publish_intent_page: {
    type: "publish_intent_page",
    exposureKey: "intent-topic",
    cooldownMinutes: 15,
  },
  sitemap_ping: {
    type: "sitemap_ping",
    exposureKey: "sitemap-ping",
    cooldownMinutes: 30,
  },
  discovery_attack: {
    type: "discovery_attack",
    exposureKey: "discovery-attack",
    cooldownMinutes: 15,
  },
  retire_discovery_door: {
    type: "retire_discovery_door",
    exposureKey: "discovery-retire",
  },
};

export function getRegistryEntry(type: string): ActionRegistryEntry | undefined {
  return ACTION_REGISTRY[type];
}

export function exposureKeyForAction(action: SafeAction): string {
  if (action.exposureKey) return action.exposureKey;
  const entry = getRegistryEntry(action.type);
  if (entry) return entry.exposureKey;
  const experimentId = action.payload?.experimentId;
  if (typeof experimentId === "string" && experimentId) {
    return `${action.type}:${experimentId}`;
  }
  return action.type;
}

export function exposureVersion(now = new Date()): string {
  return now.toISOString();
}
