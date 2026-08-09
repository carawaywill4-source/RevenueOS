/**
 * Action class taxonomy: production ≠ pursuit.
 *
 * RevenueOS is forbidden from confusing content creation with customer pursuit.
 * A page we publish is `production`. Pinging IndexNow is `distribution`. A real
 * stranger loading the page is `verified_exposure`. Only intent and commercial
 * outcomes count as commercial signal.
 *
 * Success hierarchy (highest → lowest):
 *   commercial > intent > verified_exposure > distribution > production
 */

export type ActionClass =
  | "production"
  | "distribution"
  | "verified_exposure"
  | "intent"
  | "commercial";

/**
 * Weight applied to executed actions when computing a pattern's commercial
 * score. Production actions have zero intrinsic value; only downstream signal
 * matters. Distribution is a weak positive because it at least proves the URL
 * reached an external surface, even without a visitor.
 */
export const ACTION_CLASS_WEIGHT: Record<ActionClass, number> = {
  production: 0,
  distribution: 0.05,
  verified_exposure: 1,
  intent: 4,
  commercial: 16,
};

const PRODUCTION_ACTIONS = new Set([
  "publish_intent_page",
  "publish_programmatic_door",
  "publish_free_resource",
  "publish_lead_magnet",
  "publish_howto_cluster",
  "publish_comparison_page",
  "publish_template_landing",
  "publish_bundle",
  "publish_llms_txt",
  "refresh_discovery_door",
  "feature_product",
  "market_research",
  "scorecard_snapshot",
  "rewrite_page_copy",
  "change_default_cta",
  "discovery_attack",
  "web_research",
  "buyer_discovery",
  "schema_enrichment",
  "llm_hypothesize",
  "exit_intent_deploy",
  "order_bump_deploy",
  "indiehackers_product_listing_draft",
  "hackernews_show_hn_draft",
]);

const DISTRIBUTION_ACTIONS = new Set([
  "indexnow_submit",
  "sitemap_ping",
  "ping_search_engines",
  "distribute_owned_urls",
  "public_form_outreach",
  "directory_submit",
  "syndicate_content",
  "gsc_indexation_check",
]);

const INTENT_ACTIONS = new Set([
  "hackernews_intent_discovery",
  "youtube_intent_discovery",
  "gsc_query_import",
]);

/**
 * A syntactic classification of a safeActionType. Real class is decided at
 * measure time — production remains production even if the page happens to
 * attract a viewer; the viewer becomes a separate verified_exposure event.
 *
 * Renamed to avoid a name clash with `policy.classifyActionType` (which
 * returns a risk classification, not a commercial-signal class).
 */
export function classifyExecutionActionClass(
  actionType: string | undefined,
): ActionClass {
  if (!actionType) return "production";
  if (INTENT_ACTIONS.has(actionType)) return "intent";
  if (DISTRIBUTION_ACTIONS.has(actionType)) return "distribution";
  if (PRODUCTION_ACTIONS.has(actionType)) return "production";
  // Unknown types default to production so unclaimed executors never inflate
  // commercial signal by accident.
  return "production";
}

export type MechanismClass =
  | "owned_content"
  | "owned_distribution"
  | "external_placement"
  | "community_participation"
  | "direct_outreach"
  | "product_iteration"
  | "conversion_optimization"
  | "unknown";

/**
 * A mechanism is the abstract acquisition mechanic. Two different action types
 * can share the same mechanism (publish_free_resource and publish_howto_cluster
 * are both `owned_content`) — banning a pattern must fall back to a DIFFERENT
 * mechanism, not another owned_content variant.
 */
export function classifyMechanism(input: {
  actionType?: string;
  patternKey?: string;
  category?: string;
}): MechanismClass {
  const key = (input.patternKey ?? "").toLowerCase();
  const type = (input.actionType ?? "").toLowerCase();

  if (type.startsWith("reddit_") || key.includes("reddit")) {
    return "community_participation";
  }
  if (type.startsWith("producthunt_") || key.includes("producthunt")) {
    return "community_participation";
  }
  if (type === "indiehackers_community_post_draft" || key.includes("indiehackers-community")) {
    return "community_participation";
  }
  if (type === "hackernews_intent_discovery" || type === "youtube_intent_discovery") {
    return "community_participation";
  }
  if (type === "youtube_community_reply_draft") {
    return "community_participation";
  }
  if (type === "indiehackers_product_listing_draft" || type === "hackernews_show_hn_draft") {
    return "external_placement";
  }
  if (type === "gsc_query_import") {
    return "owned_content";
  }
  if (type === "gsc_indexation_check") {
    return "owned_distribution";
  }
  if (type === "exit_intent_deploy") {
    return "conversion_optimization";
  }
  if (type === "order_bump_deploy") {
    return "conversion_optimization";
  }
  if (type === "email_cold_outreach" || type === "public_form_outreach") {
    return "direct_outreach";
  }
  if (DISTRIBUTION_ACTIONS.has(input.actionType ?? "")) {
    return "owned_distribution";
  }
  if (type.startsWith("publish_") || type === "discovery_attack" ||
      type === "market_research" || type === "refresh_discovery_door") {
    return "owned_content";
  }
  if (type === "feature_product" || type === "publish_bundle" ||
      type === "change_default_cta" || type === "rewrite_page_copy") {
    return "conversion_optimization";
  }
  if (key.includes("outreach") || key.includes("email") ||
      key.includes("cold")) {
    return "direct_outreach";
  }
  if (key.includes("community") || key.includes("forum") ||
      key.includes("reddit") || key.includes("discord")) {
    return "community_participation";
  }
  if (key.includes("directory") || key.includes("marketplace") ||
      key.includes("partner") || key.includes("syndication")) {
    return "external_placement";
  }
  if (input.category === "conversion" || input.category === "pricing") {
    return "conversion_optimization";
  }
  return "unknown";
}
