/**
 * Permissionless organic doctrine.
 *
 * RevenueOS may autonomously do anything legal/truthful that generates organic
 * leads WITHOUT owner intervention — as long as it does not require creating
 * or logging into third-party accounts, spending money, or deception.
 *
 * Allowed by default: publish on owned properties, expand long-tail pages,
 * free resources/tools that funnel to checkout, IndexNow/sitemap pings,
 * public HTTP indexes, RSS/llms.txt, internal linking, offer/message tests
 * on owned surfaces.
 *
 * Owner-gated: account signup/login, paid ads, cold spam, price changes.
 */

export const PERMISSIONLESS_DOCTRINE =
  "Permissionless organic by default: execute any legal, truthful, " +
  "account-free action that can create buyer exposure or a sale on owned " +
  "or public surfaces. Never wait for the owner to log into Reddit, " +
  "directories, social networks, or marketplaces. Ask the owner only when " +
  "an action requires a new account, an existing login, money spend, or " +
  "legal approval.";

/**
 * Actions that always need a human — narrow set per operator mandate:
 * "no paid ads, no owner login required". Everything else is delegable.
 */
export const OWNER_REQUIRED_TYPES = new Set([
  "create_account",
  "login_account",
  "oauth_connect",
  "spend_ads",
  "change_price",
]);

/**
 * Permissionless organic acquisition + conversion actions the brain may run
 * without the owner. Expand freely; keep out of OWNER_REQUIRED_TYPES.
 */
export const PERMISSIONLESS_ORGANIC_TYPES = new Set([
  "scorecard_snapshot",
  "email_daily_review",
  "indexnow_submit",
  "sitemap_ping",
  "ping_search_engines",
  "record_experiment",
  "record_lesson",
  "journal_decision",
  "merch_optimize",
  "activate_kit_deal",
  "clear_promo",
  "set_homepage_focus",
  "set_free_shipping_threshold",
  "feature_product",
  "change_default_cta",
  "publish_bundle",
  "market_research",
  "publish_intent_page",
  "discovery_attack",
  "retire_discovery_door",
  "publish_free_resource",
  "publish_programmatic_door",
  "publish_lead_magnet",
  "publish_howto_cluster",
  "publish_comparison_page",
  "publish_template_landing",
  "publish_llms_txt",
  "publish_rss_feed",
  "distribute_owned_urls",
  "internal_link_boost",
  "refresh_discovery_door",
  "rewrite_page_copy",
  // Agent-tier permissionless actions (LLM + internet powered):
  "web_research",
  "buyer_discovery",
  "public_form_outreach",
  "directory_submit",
  "syndicate_content",
  "schema_enrichment",
  "llm_hypothesize",
  "deep_content_generate",
  "cross_portfolio_link",
  // Outreach to publicly-listed contact surfaces (public forms only, not PII):
  "send_commercial_outreach",
]);

export function isPermissionlessOrganic(type: string): boolean {
  if (OWNER_REQUIRED_TYPES.has(type)) return false;
  return PERMISSIONLESS_ORGANIC_TYPES.has(type);
}

export function isOwnerRequired(type: string): boolean {
  return OWNER_REQUIRED_TYPES.has(type);
}
