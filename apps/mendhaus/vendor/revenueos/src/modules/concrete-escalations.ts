/**
 * Concrete owner-actionable escalations.
 *
 * When all permissionless mechanisms have exhausted their attempt budget with
 * zero signal, RevenueOS must not say "grant more permissions" — it must
 * propose a SPECIFIC unlock the owner can take today with an estimated cost,
 * an estimated revenue impact, and the mechanism it unlocks.
 *
 * These proposals are stored as capability_gaps with a `providers[]` field so
 * downstream tooling (or the owner directly) can act on them.
 */

import type { MechanismClass } from "./action-class";

export type ProviderProposal = {
  name: string;
  costPerMonthUsd: number;
  setupTime: string;
  actionOnceEnabled: string;
};

export type MechanismUnlock = {
  mechanism: MechanismClass;
  desiredAction: string;
  reason: string;
  expectedValueUsd: number;
  providers: ProviderProposal[];
};

export const MECHANISM_UNLOCKS: Record<Exclude<MechanismClass, "unknown">, MechanismUnlock> = {
  owned_content: {
    mechanism: "owned_content",
    desiredAction: "Generate demonstrably higher-quality content with real research + Product schema",
    reason: "Content-only strategy has produced zero verified visitors — upgrade the content quality, not the volume.",
    expectedValueUsd: 200,
    providers: [
      {
        name: "OpenAI GPT-4o",
        costPerMonthUsd: 20,
        setupTime: "5 minutes",
        actionOnceEnabled: "Generate expert-level long-form content with actual research and code examples",
      },
    ],
  },
  owned_distribution: {
    mechanism: "owned_distribution",
    desiredAction: "Enable programmatic sitemap and structured data for search engines",
    reason: "IndexNow submission alone has produced zero verified visitors.",
    expectedValueUsd: 150,
    providers: [
      {
        name: "Google Search Console (verify + service account)",
        costPerMonthUsd: 0,
        setupTime: "20 minutes (verify domain + create GCP service account with Owner access to the property)",
        actionOnceEnabled:
          "Set GOOGLE_SERVICE_ACCOUNT_JSON so RevenueOS can pull top queries (gsc_query_import) and run indexation audits (gsc_indexation_check) — high-commercial-intent queries become new opportunities automatically",
      },
      {
        name: "Google Search Console (manual)",
        costPerMonthUsd: 0,
        setupTime: "10 minutes (verify domain)",
        actionOnceEnabled:
          "Direct submission of sitemaps and monitoring of index/impression counts",
      },
    ],
  },
  external_placement: {
    mechanism: "external_placement",
    desiredAction: "Submit product to directories, comparison sites, and marketplaces where buyers search",
    reason: "Buyers do not appear on our own domain out of nowhere — they come from places that already have them.",
    expectedValueUsd: 600,
    providers: [
      {
        name: "AppSumo Submit",
        costPerMonthUsd: 0,
        setupTime: "30 minutes",
        actionOnceEnabled: "List digital product on marketplace with existing buyer audience",
      },
      {
        name: "Product Hunt account",
        costPerMonthUsd: 0,
        setupTime: "1 hour (create + verify)",
        actionOnceEnabled: "Coordinated launch to Product Hunt audience",
      },
      {
        name: "Gumroad access token (GUMROAD_ACCESS_TOKEN)",
        costPerMonthUsd: 0,
        setupTime: "5 minutes (Settings → Advanced → Application → create token)",
        actionOnceEnabled:
          "RevenueOS runs gumroad_product_sync + gumroad_sales_import so each portfolio product is listed and sales feed attribution",
      },
    ],
  },
  community_participation: {
    mechanism: "community_participation",
    desiredAction:
      "Install the RevenueOS Devvit app in communities (or get it approved for public install)",
    reason:
      "Reddit's current path is Devvit — apps only write inside subreddits that install them. Self-service OAuth bots are dead.",
    expectedValueUsd: 800,
    providers: [
      {
        name: "RevenueOS Devvit app (playtest r/revenueos_dev)",
        costPerMonthUsd: 0,
        setupTime: "already scaffolded — npm run launch for review",
        actionOnceEnabled:
          "Hourly helpful replies in installed communities; mods install from Reddit app directory after publish",
      },
      {
        name: "Indie Hackers session cookie (INDIEHACKERS_SESSION_COOKIE)",
        costPerMonthUsd: 0,
        setupTime: "5 minutes (log in, copy session cookie into env)",
        actionOnceEnabled:
          "RevenueOS auto-posts drafted product listings + community replies. Without the cookie the same actions still run in DRAFT mode into .data/indiehackers/",
      },
      {
        name: "HackerNews Show HN",
        costPerMonthUsd: 0,
        setupTime: "1 hour (paste drafted Show HN from .data/hackernews/show-hn-drafts.json)",
        actionOnceEnabled:
          "Show HN drafts are already being generated per 30d cooldown; owner submits at https://news.ycombinator.com/submit",
      },
      {
        name: "YouTube Data API key (YOUTUBE_API_KEY)",
        costPerMonthUsd: 0,
        setupTime: "15 minutes (Google Cloud Console → APIs → YouTube Data API v3 → create API key)",
        actionOnceEnabled:
          "Enables youtube_intent_discovery to surface buying-intent comments as leads; optional YOUTUBE_OAUTH_TOKEN lets RevenueOS post replies directly, otherwise it drafts them",
      },
    ],
  },
  direct_outreach: {
    mechanism: "direct_outreach",
    desiredAction: "Provision transactional email so RevenueOS can send personalized outreach",
    reason: "The most direct path to a first customer is contacting one — this requires an email sender.",
    expectedValueUsd: 1200,
    providers: [
      {
        name: "Resend",
        costPerMonthUsd: 20,
        setupTime: "15 minutes (add RESEND_API_KEY + verify domain)",
        actionOnceEnabled: "Send 1-to-1 personalized outreach to publicly-listed decision makers",
      },
      {
        name: "Postmark",
        costPerMonthUsd: 15,
        setupTime: "20 minutes",
        actionOnceEnabled: "Transactional email with deliverability tracking",
      },
    ],
  },
  product_iteration: {
    mechanism: "product_iteration",
    desiredAction: "Give RevenueOS ability to A/B test the offer itself, not just landing pages",
    reason: "If nobody buys at $X, the offer may be wrong — price, scope, guarantee should be tested.",
    expectedValueUsd: 400,
    providers: [
      {
        name: "Stripe Coupons API (already integrated)",
        costPerMonthUsd: 0,
        setupTime: "0 (already available)",
        actionOnceEnabled: "Auto-generate promo codes for time-limited discounts and test price elasticity",
      },
    ],
  },
  conversion_optimization: {
    mechanism: "conversion_optimization",
    desiredAction: "Enable page-variant serving so RevenueOS can A/B test CTA, price, and urgency",
    reason: "Traffic without conversion is wasted attention — must test the funnel, not just fill it.",
    expectedValueUsd: 300,
    providers: [
      {
        name: "Vercel Edge Config",
        costPerMonthUsd: 0,
        setupTime: "20 minutes",
        actionOnceEnabled: "Serve different landing-page variants with sticky assignment per visitor",
      },
    ],
  },
};

export function proposeUnlocksForBannedMechanisms(input: {
  bannedMechanisms: Set<MechanismClass>;
  siteId: string;
  observation?: { landingViews?: number; purchases?: number };
}): MechanismUnlock[] {
  const priority: MechanismClass[] = [
    "external_placement",
    "direct_outreach",
    "community_participation",
    "conversion_optimization",
    "product_iteration",
    "owned_distribution",
    "owned_content",
  ];
  // Prioritize mechanisms that are NOT already exhausted. If everything is
  // banned, prioritize external_placement / direct_outreach — the two most
  // direct paths to a first customer.
  const unlocks: MechanismUnlock[] = [];
  for (const m of priority) {
    if (input.bannedMechanisms.has(m)) continue;
    const template = MECHANISM_UNLOCKS[m as Exclude<MechanismClass, "unknown">];
    if (!template) continue;
    unlocks.push(template);
    if (unlocks.length >= 3) break;
  }
  if (unlocks.length === 0) {
    // Even our unbanned list is empty — return the top-EV templates anyway.
    unlocks.push(
      MECHANISM_UNLOCKS.direct_outreach,
      MECHANISM_UNLOCKS.external_placement,
      MECHANISM_UNLOCKS.community_participation,
    );
  }
  return unlocks;
}
