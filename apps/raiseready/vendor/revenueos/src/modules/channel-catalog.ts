/**
 * Channel capability catalog.
 *
 * This is NOT an action loop. It enumerates distribution surfaces RevenueOS
 * *can* operate when credentials and platform rules allow. The Channel
 * Discovery Engine decides *which* capabilities to try per business; the
 * Channel Registry allocates effort by revenue_per_action.
 *
 * Hard rules baked into every capability:
 *   - zero ad spend / no paid listings / no fake engagement
 *   - draft mode when write credentials are missing
 *   - never spam or impersonate humans
 */

import type { MechanismClass } from "./action-class";

export type ChannelCategory =
  | "search_engines"
  | "major_social"
  | "qa"
  | "publishing"
  | "startup_discovery"
  | "software_discovery"
  | "local_listings"
  | "visual_discovery"
  | "developer_products"
  | "communities"
  | "earned_distribution"
  | "partnerships"
  | "direct_outreach"
  | "seo_assets"
  | "digital_pr"
  | "owned_tools";

export type ChannelCapability = {
  /** Stable catalog id — not a business-specific channel instance. */
  id: string;
  platform: string;
  category: ChannelCategory;
  label: string;
  /** Buyer-intent prior before business-specific evidence. */
  defaultBuyerIntent: "high" | "medium" | "low";
  mechanism: MechanismClass;
  /** Action types this capability can drive when selected. */
  actionTypes: string[];
  /** Env vars that unlock WRITE mode (absence → draft / discover-only). */
  writeCredentialEnv?: string[];
  /** Env vars that unlock READ / discover mode. */
  readCredentialEnv?: string[];
  allowedActions: string[];
  postingRules: string[];
  contentFormats: string[];
  /** Minutes between autonomous attempts on this capability family. */
  defaultCooldownMinutes: number;
  /** Rough autonomous effort units (1 = cheap). */
  effortEstimate: number;
  /** Never purchase placement on this surface. */
  neverBuy: true;
};

/**
 * Canonical catalog of operable zero-cost channels. Discovery seeds and
 * expands from this list; it does not enqueue every entry every cycle.
 */
export const CHANNEL_CAPABILITY_CATALOG: ChannelCapability[] = [
  // —— Search engines / SEO assets ——
  {
    id: "google_organic",
    platform: "google",
    category: "search_engines",
    label: "Google organic (owned intent pages)",
    defaultBuyerIntent: "high",
    mechanism: "owned_content",
    actionTypes: [
      "publish_intent_page",
      "publish_programmatic_door",
      "gsc_query_import",
      "gsc_indexation_check",
      "indexnow_submit",
      "ping_search_engines",
    ],
    readCredentialEnv: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
    allowedActions: ["publish", "index", "measure_queries"],
    postingRules: ["Own domain only", "No doorway spam", "Respect quality guidelines"],
    contentFormats: ["intent_page", "howto", "comparison"],
    defaultCooldownMinutes: 15,
    effortEstimate: 1,
    neverBuy: true,
  },
  {
    id: "owned_seo_cluster",
    platform: "owned_domain",
    category: "seo_assets",
    label: "Owned SEO clusters (howto / comparison / template)",
    defaultBuyerIntent: "high",
    mechanism: "owned_content",
    actionTypes: [
      "publish_howto_cluster",
      "publish_comparison_page",
      "publish_template_landing",
      "publish_free_resource",
      "publish_lead_magnet",
    ],
    allowedActions: ["publish", "refresh", "internal_link"],
    postingRules: ["Long-tail commercial intent", "One job per page"],
    contentFormats: ["howto", "comparison", "template", "checklist"],
    defaultCooldownMinutes: 15,
    effortEstimate: 1,
    neverBuy: true,
  },
  {
    id: "owned_intent_tools",
    platform: "owned_domain",
    category: "owned_tools",
    label: "Owned acquisition tools (calculators, generators, quizzes)",
    defaultBuyerIntent: "high",
    mechanism: "owned_content",
    actionTypes: [
      "publish_intent_tool",
      "publish_calculator",
      "publish_free_resource",
    ],
    allowedActions: ["publish_tool", "publish_calculator", "embed_widget"],
    postingRules: [
      "Reusable traffic machine on owned domain",
      "Must funnel to checkout or email capture",
      "Driven by discovered long-tail intent",
    ],
    contentFormats: [
      "calculator",
      "generator",
      "template",
      "quiz",
      "comparison_tool",
      "mini_database",
      "embeddable_widget",
    ],
    defaultCooldownMinutes: 20,
    effortEstimate: 2,
    neverBuy: true,
  },

  // —— Communities / Q&A ——
  {
    id: "reddit",
    platform: "reddit",
    category: "communities",
    label: "Reddit helpful replies (buying-intent threads)",
    defaultBuyerIntent: "high",
    mechanism: "community_participation",
    actionTypes: ["reddit_discover_intent", "reddit_helpful_reply"],
    writeCredentialEnv: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USERNAME", "REDDIT_PASSWORD"],
    allowedActions: ["discover_intent", "helpful_reply", "draft"],
    postingRules: [
      "Only answer real buying-intent questions",
      "No spam, no identical crossposts",
      "Disclose affiliation when linking",
      "Draft when write creds missing",
    ],
    contentFormats: ["helpful_reply", "intent_discovery"],
    defaultCooldownMinutes: 25,
    effortEstimate: 2,
    neverBuy: true,
  },
  {
    id: "hackernews",
    platform: "hackernews",
    category: "communities",
    label: "Hacker News (Show HN draft + intent discovery)",
    defaultBuyerIntent: "medium",
    mechanism: "community_participation",
    actionTypes: ["hackernews_intent_discovery", "hackernews_show_hn_draft"],
    allowedActions: ["discover_intent", "draft_show_hn"],
    postingRules: [
      "Draft-first Show HN",
      "No voting rings",
      "Product must be genuinely interesting to HN",
    ],
    contentFormats: ["show_hn_draft", "intent_lead"],
    defaultCooldownMinutes: 60,
    effortEstimate: 2,
    neverBuy: true,
  },
  {
    id: "indiehackers",
    platform: "indiehackers",
    category: "communities",
    label: "Indie Hackers product + community",
    defaultBuyerIntent: "medium",
    mechanism: "community_participation",
    actionTypes: [
      "indiehackers_product_listing_draft",
      "indiehackers_community_post_draft",
    ],
    writeCredentialEnv: ["INDIEHACKERS_SESSION_COOKIE"],
    allowedActions: ["draft_listing", "draft_community_post", "optional_post"],
    postingRules: ["Draft by default", "Helpful community posts only", "No growth-hack spam"],
    contentFormats: ["product_listing", "community_reply"],
    defaultCooldownMinutes: 240,
    effortEstimate: 2,
    neverBuy: true,
  },

  // —— Startup / software discovery ——
  {
    id: "producthunt",
    platform: "producthunt",
    category: "startup_discovery",
    label: "Product Hunt helpful comments",
    defaultBuyerIntent: "medium",
    mechanism: "community_participation",
    actionTypes: ["producthunt_helpful_reply"],
    writeCredentialEnv: ["PRODUCTHUNT_DEVELOPER_TOKEN"],
    allowedActions: ["helpful_comment"],
    postingRules: ["Developer token only", "Genuinely helpful", "No fake upvotes"],
    contentFormats: ["helpful_comment"],
    defaultCooldownMinutes: 30,
    effortEstimate: 2,
    neverBuy: true,
  },
  {
    id: "gumroad",
    platform: "gumroad",
    category: "software_discovery",
    label: "Gumroad marketplace listing",
    defaultBuyerIntent: "high",
    mechanism: "external_placement",
    actionTypes: ["gumroad_product_sync", "gumroad_sales_import"],
    writeCredentialEnv: ["GUMROAD_ACCESS_TOKEN"],
    allowedActions: ["sync_product", "import_sales"],
    postingRules: ["List own product only", "No paid boosts"],
    contentFormats: ["product_listing"],
    defaultCooldownMinutes: 10_080,
    effortEstimate: 1,
    neverBuy: true,
  },

  // —— Visual / video ——
  {
    id: "youtube",
    platform: "youtube",
    category: "visual_discovery",
    label: "YouTube buying-intent comments",
    defaultBuyerIntent: "medium",
    mechanism: "community_participation",
    actionTypes: ["youtube_intent_discovery", "youtube_community_reply_draft"],
    readCredentialEnv: ["YOUTUBE_API_KEY"],
    writeCredentialEnv: ["YOUTUBE_OAUTH_TOKEN"],
    allowedActions: ["discover_intent", "draft_reply", "optional_post"],
    postingRules: ["Draft without OAuth", "Helpful replies only", "No fake engagement"],
    contentFormats: ["intent_comment", "helpful_reply"],
    defaultCooldownMinutes: 90,
    effortEstimate: 2,
    neverBuy: true,
  },

  // —— Direct outreach / partnerships ——
  {
    id: "email_outreach",
    platform: "email",
    category: "direct_outreach",
    label: "1:1 cold email to publicly-listed contacts",
    defaultBuyerIntent: "high",
    mechanism: "direct_outreach",
    actionTypes: ["email_cold_outreach", "buyer_discovery"],
    writeCredentialEnv: ["RESEND_API_KEY"],
    allowedActions: ["discover_contacts", "send_1to1"],
    postingRules: [
      "Publicly listed emails only",
      "Personalized 1:1 — never blast lists",
      "Respect rate limits",
    ],
    contentFormats: ["personalized_email"],
    defaultCooldownMinutes: 30,
    effortEstimate: 2,
    neverBuy: true,
  },
  {
    id: "public_form_outreach",
    platform: "public_web",
    category: "partnerships",
    label: "Public contact-form outreach",
    defaultBuyerIntent: "medium",
    mechanism: "direct_outreach",
    actionTypes: ["public_form_outreach", "buyer_discovery", "send_commercial_outreach"],
    allowedActions: ["submit_public_form"],
    postingRules: ["Public forms only", "No captcha bypass", "Truthful messages"],
    contentFormats: ["personalized_pitch"],
    defaultCooldownMinutes: 45,
    effortEstimate: 2,
    neverBuy: true,
  },
  {
    id: "directory_submit",
    platform: "directories",
    category: "software_discovery",
    label: "Free public directory listings",
    defaultBuyerIntent: "medium",
    mechanism: "external_placement",
    actionTypes: ["directory_submit", "buyer_discovery"],
    allowedActions: ["submit_listing"],
    postingRules: ["Free listings only", "Never pay for placement", "Accurate product facts"],
    contentFormats: ["directory_listing"],
    defaultCooldownMinutes: 120,
    effortEstimate: 1,
    neverBuy: true,
  },

  // —— Publishing / earned / PR ——
  {
    id: "content_syndication",
    platform: "syndication",
    category: "publishing",
    label: "Public content syndication hubs",
    defaultBuyerIntent: "low",
    mechanism: "external_placement",
    actionTypes: ["syndicate_content", "distribute_owned_urls"],
    allowedActions: ["syndicate", "distribute"],
    postingRules: ["Public hubs only", "No paid boosts", "Canonical link to owned domain"],
    contentFormats: ["article", "guide"],
    defaultCooldownMinutes: 60,
    effortEstimate: 2,
    neverBuy: true,
  },
  {
    id: "digital_pr_earned",
    platform: "earned_media",
    category: "digital_pr",
    label: "Earned digital PR (helpful public commentary)",
    defaultBuyerIntent: "medium",
    mechanism: "external_placement",
    actionTypes: ["public_form_outreach", "buyer_discovery", "web_research"],
    allowedActions: ["pitch_public", "comment_public"],
    postingRules: ["No fake reviews", "No purchased backlinks", "Value-first pitches"],
    contentFormats: ["expert_comment", "resource_pitch"],
    defaultCooldownMinutes: 180,
    effortEstimate: 3,
    neverBuy: true,
  },
  {
    id: "qa_surfaces",
    platform: "qa",
    category: "qa",
    label: "Q&A surfaces (public threads — draft/helpful answer)",
    defaultBuyerIntent: "high",
    mechanism: "community_participation",
    actionTypes: ["buyer_discovery", "public_form_outreach", "web_research"],
    allowedActions: ["discover_questions", "draft_answer"],
    postingRules: [
      "Answer only when product genuinely helps",
      "No account spam-creation",
      "Draft when write login unavailable",
    ],
    contentFormats: ["helpful_answer"],
    defaultCooldownMinutes: 90,
    effortEstimate: 2,
    neverBuy: true,
  },

  // —— Major social (discover/draft only unless owner provides write creds) ——
  {
    id: "major_social_organic",
    platform: "social",
    category: "major_social",
    label: "Major social organic (discover + draft; no spam accounts)",
    defaultBuyerIntent: "medium",
    mechanism: "community_participation",
    actionTypes: ["buyer_discovery", "web_research"],
    allowedActions: ["discover_surfaces", "draft_post"],
    postingRules: [
      "Google login ≠ permission to spam-create accounts",
      "Owner must connect write credentials",
      "Never buy followers or engagement",
    ],
    contentFormats: ["draft_post", "intent_surface"],
    defaultCooldownMinutes: 240,
    effortEstimate: 3,
    neverBuy: true,
  },

  // —— Local listings (free only) ——
  {
    id: "local_free_listings",
    platform: "local",
    category: "local_listings",
    label: "Free local / niche listings",
    defaultBuyerIntent: "medium",
    mechanism: "external_placement",
    actionTypes: ["directory_submit", "buyer_discovery"],
    allowedActions: ["submit_free_listing"],
    postingRules: ["Free tier only", "Accurate NAP/product facts", "No paid upgrades"],
    contentFormats: ["listing"],
    defaultCooldownMinutes: 1_440,
    effortEstimate: 2,
    neverBuy: true,
  },

  // —— Developer products ——
  {
    id: "developer_products",
    platform: "dev_platforms",
    category: "developer_products",
    label: "Developer product surfaces (free catalogs / showcases)",
    defaultBuyerIntent: "medium",
    mechanism: "external_placement",
    actionTypes: ["directory_submit", "syndicate_content", "buyer_discovery"],
    allowedActions: ["submit_free", "showcase"],
    postingRules: ["Free catalogs only", "No purchased featured slots"],
    contentFormats: ["showcase", "listing"],
    defaultCooldownMinutes: 720,
    effortEstimate: 2,
    neverBuy: true,
  },

  // —— Owned conversion ——
  {
    id: "owned_conversion",
    platform: "owned_domain",
    category: "seo_assets",
    label: "Owned conversion optimization (exit-intent, bumps)",
    defaultBuyerIntent: "high",
    mechanism: "conversion_optimization",
    actionTypes: ["exit_intent_deploy", "order_bump_deploy", "change_default_cta", "rewrite_page_copy"],
    allowedActions: ["deploy_snippet", "test_offer"],
    postingRules: ["Owned property only", "Truthful offers"],
    contentFormats: ["exit_intent", "order_bump", "cta_test"],
    defaultCooldownMinutes: 1_440,
    effortEstimate: 1,
    neverBuy: true,
  },
];

export function capabilityById(id: string): ChannelCapability | undefined {
  return CHANNEL_CAPABILITY_CATALOG.find((c) => c.id === id);
}

export function capabilityByPlatform(platform: string): ChannelCapability[] {
  const p = platform.toLowerCase();
  return CHANNEL_CAPABILITY_CATALOG.filter(
    (c) => c.platform === p || c.id === p || c.category === p,
  );
}

export function capabilitiesForActionType(actionType: string): ChannelCapability[] {
  return CHANNEL_CAPABILITY_CATALOG.filter((c) =>
    c.actionTypes.includes(actionType),
  );
}

/** Credential readiness for a capability — write > read > none. */
export function capabilityCredentialMode(
  cap: ChannelCapability,
  env: NodeJS.ProcessEnv = process.env,
): "write" | "read" | "draft" {
  if (cap.writeCredentialEnv?.length) {
    const allWrite = cap.writeCredentialEnv.every((k) => Boolean(env[k]?.trim()));
    if (allWrite) return "write";
  }
  if (cap.readCredentialEnv?.length) {
    const anyRead = cap.readCredentialEnv.some((k) => Boolean(env[k]?.trim()));
    if (anyRead) return "read";
  }
  if (!cap.writeCredentialEnv?.length && !cap.readCredentialEnv?.length) {
    return "write"; // fully permissionless
  }
  return "draft";
}
