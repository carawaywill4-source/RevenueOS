import type { SafeAction } from "@revenueos/core";

/**
 * Safe-action manifest the operator service exposes to the planner.
 *
 * Note this is intentionally NARROWER than the per-app storefront-kit
 * catalog: the operator does not have filesystem access to any Next.js
 * app, so it cannot execute `publish_*` actions. Instead the operator
 * relies on the sidecar for external-distribution actions (Reddit, HN,
 * IH, Substack, Quora). Owner-controlled apps continue to handle the
 * heavy on-site publish surface via their own cron.
 */
export function listOperatorSafeActions(): SafeAction[] {
  return [
    {
      type: "scorecard_snapshot",
      risk: "safe",
      description: "Persist scorecard snapshot",
    },
    {
      type: "market_research",
      risk: "safe",
      description: "Public web research summary",
    },
    {
      type: "web_research",
      risk: "safe",
      description: "LLM+web scan for buyer signals",
    },
    {
      type: "buyer_discovery",
      risk: "safe",
      description: "Find external surfaces where buyers gather",
    },
    {
      type: "channel_discover",
      risk: "safe",
      description: "Discover new zero-cost acquisition channels",
    },
    {
      type: "llm_hypothesize",
      risk: "safe",
      description: "LLM strategist proposes acquisition hypotheses",
    },
    {
      type: "reddit_helpful_reply",
      risk: "safe",
      description:
        "Post a helpful Reddit reply on a buying-intent thread (via sidecar)",
    },
    {
      type: "reddit_discover_intent",
      risk: "safe",
      description: "Submit a Reddit post via the browser sidecar",
    },
    {
      type: "hackernews_show_hn_draft",
      risk: "safe",
      description: "Submit a Show HN via the browser sidecar",
    },
    {
      type: "indiehackers_product_listing_draft",
      risk: "safe",
      description: "Publish an Indie Hackers product post via the sidecar",
    },
    {
      type: "indiehackers_community_post_draft",
      risk: "safe",
      description: "Publish an Indie Hackers community post via the sidecar",
    },
    {
      type: "substack_publish",
      risk: "safe",
      description: "Publish a Substack post via the sidecar",
    },
    {
      type: "quora_answer_public",
      risk: "safe",
      description: "Answer a Quora question via the sidecar",
    },
  ];
}
