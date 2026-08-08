import type { SeedLesson } from "@revenueos/core";

/**
 * Mendhaus local + transferable priors. Injected via SiteAdapter so the
 * portable RevenueOS brain never hard-codes home-goods facts.
 */
export const MENDHAUS_SEED_LESSONS: SeedLesson[] = [
  {
    id: "mh_10k_day_attack",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "objective:10k-day",
    summary:
      "Primary attack target: $10,000/day gross revenue. Prefer kit merchandising (Kitchen Reset, Renter Bath, Desk Day, Entry Clear) that lands AOV in the $100–$165 band. Organic SEO, Pinterest, and problem-page content are the acquisition engines. Never buy ads without owner approval.",
    evidenceCount: 1,
    transferable: false,
    sentiment: "positive",
    rankingWeight: 1.4,
  },
  {
    id: "mh_kit_aov",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "conversion:kit-aov",
    summary:
      "Single $20 SKUs cannot carry a $10k/day store without impossible traffic. Push kits and free-shipping threshold ($79) so each converted visitor is worth the acquisition effort.",
    evidenceCount: 1,
    transferable: false,
    sentiment: "positive",
    rankingWeight: 1.25,
  },
  {
    id: "mh_profit_not_popularity",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "objective:realized-profit",
    summary:
      "Mendhaus optimizes long-term realized gross profit after COGS, shipping, fulfillment, Stripe fees, and refunds — not pageviews, impressions, or fake conversions.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
    rankingWeight: 1.3,
  },
  {
    id: "mh_organic_default",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "acq:organic_search",
    summary:
      "Organic/free acquisition is the default. Never spend on ads, subscriptions, or paid tools without explicit owner authorization.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
    rankingWeight: 1.25,
  },
  {
    id: "mh_empty_hour_internet",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "discovery-attack",
    summary:
      "A near-zero view hour is discovery failure. Do not rotate promos into silence. Research the live internet, publish a new intent topic, IndexNow it, and ping sitemaps before any merchandising experiment.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "negative",
    rankingWeight: 1.45,
  },

  {
    id: "mh_us_warehouse_first",
    scope: "industry",
    industry: "home-goods",
    patternKey: "ops:us-warehouse-eta",
    summary:
      "US-warehouse SKUs with 3–7 day delivery convert better and refund less than China 9–14 day lookalikes for problem-solving home products. Demote China SKUs unless margin and honesty about ETA still clear the floor.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
    rankingWeight: 1.1,
  },
  {
    id: "mh_no_fake_reviews",
    scope: "global",
    patternKey: "content:truthful-only",
    summary:
      "Never invent reviews, testimonials, scarcity, or landlord/damage-free guarantees. Honest install constraints convert better long-term than deceptive copy, and they avoid refunds and platform bans.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "negative",
    rankingWeight: 1.2,
  },
  {
    id: "mh_renter_no_drill",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "acq:organic_search:renter:a0",
    summary:
      "Renter persona: lead with no-drill / over-the-door / tension / comes-with-you. Never claim deposit protection. Prior as a starting angle until purchase evidence updates it.",
    evidenceCount: 1,
    transferable: false,
    sentiment: "positive",
    rankingWeight: 1.05,
  },
  {
    id: "mh_tiny_n_uncertainty",
    scope: "global",
    patternKey: "learn:small-n",
    summary:
      "4 visitors vs 3 is not evidence a strategy failed. Keep exploration early; require credible bounds before killing a channel/persona/angle. One lucky purchase must not permanently dominate.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "neutral",
    rankingWeight: 1.15,
  },
  {
    id: "mh_min_margin",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "pricing:min-margin",
    summary:
      "RevenueOS may recommend price changes only above each SKU minMarginUsd and confirmed supplier COGS. Never discount below contribution floor to win vanity conversion.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "negative",
    rankingWeight: 1.1,
  },
  {
    id: "mh_supplier_owner_gate",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "ops:supplier-account",
    summary:
      "No paid order ships until the owner creates CJ/Spocket accounts, maps live SKUs, and sets MENDHAUS_SUPPLIER_READY=1. Do not fake fulfillment or invent supplier APIs.",
    evidenceCount: 1,
    transferable: false,
    sentiment: "neutral",
    rankingWeight: 1.0,
  },
  {
    id: "mh_merch_margin_safe",
    scope: "site",
    siteId: "mendhaus",
    patternKey: "merch:optimize-heartbeat",
    summary:
      "Autonomous merchandising may run kit/site deals, rotate homepage focus, and tune free-shipping ($49–$99). Never fake scarcity. Never discount below minMarginUsd / confirmed COGS. Prefer kit AOV $100–$165.",
    evidenceCount: 1,
    transferable: true,
    sentiment: "positive",
    rankingWeight: 1.2,
  },
];
