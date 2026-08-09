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
  publish_programmatic_door: {
    type: "publish_programmatic_door",
    exposureKey: "programmatic-door",
    cooldownMinutes: 12,
  },
  publish_free_resource: {
    type: "publish_free_resource",
    exposureKey: "free-resource",
    cooldownMinutes: 20,
  },
  publish_lead_magnet: {
    type: "publish_lead_magnet",
    exposureKey: "lead-magnet",
    cooldownMinutes: 20,
  },
  publish_howto_cluster: {
    type: "publish_howto_cluster",
    exposureKey: "howto-cluster",
    cooldownMinutes: 15,
  },
  publish_comparison_page: {
    type: "publish_comparison_page",
    exposureKey: "comparison-page",
    cooldownMinutes: 15,
  },
  publish_template_landing: {
    type: "publish_template_landing",
    exposureKey: "template-landing",
    cooldownMinutes: 15,
  },
  publish_intent_tool: {
    type: "publish_intent_tool",
    exposureKey: "intent-tool",
    cooldownMinutes: 20,
  },
  publish_calculator: {
    type: "publish_calculator",
    exposureKey: "calculator",
    cooldownMinutes: 20,
  },
  channel_discover: {
    type: "channel_discover",
    exposureKey: "channel-discover",
    cooldownMinutes: 360,
  },
  distribute_owned_urls: {
    type: "distribute_owned_urls",
    exposureKey: "distribute-owned",
    cooldownMinutes: 25,
  },
  ping_search_engines: {
    type: "ping_search_engines",
    exposureKey: "sitemap-ping",
    cooldownMinutes: 30,
  },
  publish_llms_txt: {
    type: "publish_llms_txt",
    exposureKey: "llms-txt",
    cooldownMinutes: 60,
  },
  refresh_discovery_door: {
    type: "refresh_discovery_door",
    exposureKey: "discovery-refresh",
    cooldownMinutes: 15,
  },
  feature_product: {
    type: "feature_product",
    exposureKey: "homepage-focus",
  },
  reddit_helpful_reply: {
    type: "reddit_helpful_reply",
    exposureKey: "reddit-reply",
    cooldownMinutes: 25,
  },
  reddit_discover_intent: {
    type: "reddit_discover_intent",
    exposureKey: "reddit-discover",
    cooldownMinutes: 60,
  },
  email_cold_outreach: {
    type: "email_cold_outreach",
    exposureKey: "email-outreach",
    cooldownMinutes: 30,
  },
  producthunt_helpful_reply: {
    type: "producthunt_helpful_reply",
    exposureKey: "producthunt-reply",
    cooldownMinutes: 30,
  },
  indiehackers_product_listing_draft: {
    type: "indiehackers_product_listing_draft",
    exposureKey: "indiehackers-product-listing",
    cooldownMinutes: 43_200,
  },
  indiehackers_community_post_draft: {
    type: "indiehackers_community_post_draft",
    exposureKey: "indiehackers-community-post",
    cooldownMinutes: 240,
  },
  hackernews_show_hn_draft: {
    type: "hackernews_show_hn_draft",
    exposureKey: "hackernews-show-hn",
    cooldownMinutes: 43_200,
  },
  hackernews_intent_discovery: {
    type: "hackernews_intent_discovery",
    exposureKey: "hackernews-intent",
    cooldownMinutes: 60,
  },
  gsc_query_import: {
    type: "gsc_query_import",
    exposureKey: "gsc-queries",
    cooldownMinutes: 360,
  },
  gsc_indexation_check: {
    type: "gsc_indexation_check",
    exposureKey: "gsc-indexation",
    cooldownMinutes: 720,
  },
  youtube_intent_discovery: {
    type: "youtube_intent_discovery",
    exposureKey: "youtube-intent",
    cooldownMinutes: 90,
  },
  youtube_community_reply_draft: {
    type: "youtube_community_reply_draft",
    exposureKey: "youtube-reply",
    cooldownMinutes: 180,
  },
  exit_intent_deploy: {
    type: "exit_intent_deploy",
    exposureKey: "exit-intent",
    cooldownMinutes: 43_200,
  },
  order_bump_deploy: {
    type: "order_bump_deploy",
    exposureKey: "order-bump",
    cooldownMinutes: 10_080,
  },
  gumroad_product_sync: {
    type: "gumroad_product_sync",
    exposureKey: "gumroad-product",
    cooldownMinutes: 10_080,
  },
  gumroad_sales_import: {
    type: "gumroad_sales_import",
    exposureKey: "gumroad-sales",
    cooldownMinutes: 360,
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
