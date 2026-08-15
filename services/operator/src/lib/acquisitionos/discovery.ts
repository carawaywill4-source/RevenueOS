/**
 * Open-world channel discovery — zero paid AI.
 * Seeds + DuckDuckGo → channel graph. Dedupes via canonical keys.
 */

import type pg from "pg";
import { searchDuckDuckGo } from "../titan-research-engine.js";
import { buildBuyerHabitat, persistBuyerHabitat } from "./buyer-habitat.js";
import {
  linkBusinessSurface,
  upsertChannelSurface,
} from "./channel-graph.js";
import type {
  ChannelFamily,
  ChannelSurface,
  ExecutionClass,
  ExecutorType,
} from "./types.js";

type SeedSpec = {
  family: ChannelFamily;
  platform: string;
  name: string;
  url: string;
  audience: string;
  executionClass: ExecutionClass;
  executorType: ExecutorType;
  accountRequired?: boolean;
  automationAllowed?: boolean;
  postingAllowed?: boolean | null;
  promotionAllowed?: boolean | null;
  fit: number;
  intent: number;
};

/** Broad legitimate surface universe seeds (not claims of prior posting). */
const GLOBAL_DIRECTORY_SEEDS: SeedSpec[] = [
  {
    family: "directories",
    platform: "alternativeto",
    name: "AlternativeTo",
    url: "https://alternativeto.net/",
    audience: "software seekers comparing tools",
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "DIRECTORY_LISTING",
    accountRequired: true,
    fit: 0.7,
    intent: 0.75,
  },
  {
    family: "directories",
    platform: "saashub",
    name: "SaaSHub",
    url: "https://www.saashub.com/",
    audience: "SaaS buyers",
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "DIRECTORY_LISTING",
    accountRequired: true,
    fit: 0.65,
    intent: 0.7,
  },
  {
    family: "directories",
    platform: "siftery",
    name: "StackShare / tool stacks",
    url: "https://stackshare.io/",
    audience: "tech buyers reviewing stacks",
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "DIRECTORY_LISTING",
    accountRequired: true,
    fit: 0.55,
    intent: 0.6,
  },
  {
    family: "product_discovery",
    platform: "producthunt",
    name: "Product Hunt",
    url: "https://www.producthunt.com/",
    audience: "early adopters / makers",
    executionClass: "OWNER_ACCOUNT_REQUIRED",
    executorType: "MARKETPLACE_LISTING",
    accountRequired: true,
    fit: 0.6,
    intent: 0.65,
  },
  {
    family: "product_discovery",
    platform: "betalist",
    name: "BetaList",
    url: "https://betalist.com/",
    audience: "startup early adopters",
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "DIRECTORY_LISTING",
    accountRequired: true,
    fit: 0.55,
    intent: 0.6,
  },
  {
    family: "product_discovery",
    platform: "indiehackers",
    name: "Indie Hackers Products",
    url: "https://www.indiehackers.com/products",
    audience: "bootstrappers",
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "COMMUNITY_POST_PREP",
    accountRequired: true,
    fit: 0.6,
    intent: 0.6,
  },
  {
    family: "directories",
    platform: "toolify",
    name: "There's An AI For That / tool directories",
    url: "https://theresanaiforthat.com/",
    audience: "tool discoverers",
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "DIRECTORY_LISTING",
    accountRequired: true,
    fit: 0.4,
    intent: 0.45,
  },
  {
    family: "marketplaces",
    platform: "gumroad",
    name: "Gumroad",
    url: "https://gumroad.com/",
    audience: "digital product buyers",
    executionClass: "CREDENTIAL_REQUIRED",
    executorType: "MARKETPLACE_LISTING",
    accountRequired: true,
    fit: 0.75,
    intent: 0.85,
  },
  {
    family: "search_discovery",
    platform: "indexnow",
    name: "IndexNow API",
    url: "https://www.indexnow.org/",
    audience: "search engines",
    executionClass: "AUTO_EXECUTABLE",
    executorType: "SEARCH_SUBMISSION",
    automationAllowed: true,
    postingAllowed: true,
    fit: 0.5,
    intent: 0.3,
  },
  {
    family: "search_discovery",
    platform: "bing_webmaster",
    name: "Bing Webmaster Tools",
    url: "https://www.bing.com/webmasters",
    audience: "search indexing",
    executionClass: "CREDENTIAL_REQUIRED",
    executorType: "WEBMASTER_API",
    accountRequired: true,
    fit: 0.55,
    intent: 0.35,
  },
  {
    family: "search_discovery",
    platform: "google_search_console",
    name: "Google Search Console",
    url: "https://search.google.com/search-console",
    audience: "search indexing",
    executionClass: "CREDENTIAL_REQUIRED",
    executorType: "WEBMASTER_API",
    accountRequired: true,
    fit: 0.6,
    intent: 0.4,
  },
  {
    family: "owned_distribution",
    platform: "websub",
    name: "Google PubSubHubbub",
    url: "https://pubsubhubbub.appspot.com/",
    audience: "feed subscribers / aggregators",
    executionClass: "AUTO_EXECUTABLE",
    executorType: "WEBSUB_PING",
    automationAllowed: true,
    fit: 0.45,
    intent: 0.35,
  },
];

const COMMUNITY_SEEDS: Record<string, SeedSpec[]> = {
  storelift: [
    sub("r/ecommerce", "https://www.reddit.com/r/ecommerce/", "ecommerce operators", 0.85),
    sub("r/shopify", "https://www.reddit.com/r/shopify/", "Shopify merchants", 0.9),
    sub("r/PPC", "https://www.reddit.com/r/PPC/", "paid traffic operators needing CRO", 0.7),
    sub("r/Fulfillment", "https://www.reddit.com/r/FulfillmentByAmazon/", "marketplace sellers", 0.5),
    forum("Shopify Community", "https://community.shopify.com/", "Shopify merchants", 0.8),
  ],
  bidforge: [
    sub("r/Construction", "https://www.reddit.com/r/Construction/", "construction pros", 0.85),
    sub("r/Contractor", "https://www.reddit.com/r/Contractor/", "contractors", 0.9),
    sub("r/smallbusiness", "https://www.reddit.com/r/smallbusiness/", "SMB owners", 0.55),
    forum("ContractorTalk", "https://www.contractortalk.com/", "trade contractors", 0.8),
  ],
  invoicechaser: [
    sub("r/smallbusiness", "https://www.reddit.com/r/smallbusiness/", "SMB cashflow", 0.9),
    sub("r/Entrepreneur", "https://www.reddit.com/r/Entrepreneur/", "founders AR pain", 0.7),
    sub("r/bookkeeping", "https://www.reddit.com/r/bookkeeping/", "bookkeepers", 0.75),
    sub("r/Accounting", "https://www.reddit.com/r/Accounting/", "accounting pros", 0.6),
  ],
  scopesmith: [
    sub("r/consulting", "https://www.reddit.com/r/consulting/", "consultants", 0.9),
    sub("r/freelance", "https://www.reddit.com/r/freelance/", "freelancers", 0.85),
    sub("r/agencies", "https://www.reddit.com/r/agencies/", "agency ops", 0.7),
    forum("Indie Hackers", "https://www.indiehackers.com/", "bootstrappers", 0.6),
  ],
  deckready: [
    sub("r/startups", "https://www.reddit.com/r/startups/", "founders", 0.9),
    sub("r/Entrepreneur", "https://www.reddit.com/r/Entrepreneur/", "founders", 0.75),
    forum("Indie Hackers", "https://www.indiehackers.com/", "bootstrappers", 0.7),
    forum("Hacker News", "https://news.ycombinator.com/", "tech founders", 0.65),
  ],
};

function sub(
  name: string,
  url: string,
  audience: string,
  fit: number,
): SeedSpec {
  return {
    family: "communities",
    platform: "reddit",
    name,
    url,
    audience,
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "COMMUNITY_POST_PREP",
    accountRequired: true,
    postingAllowed: null,
    promotionAllowed: false,
    fit,
    intent: 0.8,
  };
}

function forum(
  name: string,
  url: string,
  audience: string,
  fit: number,
): SeedSpec {
  return {
    family: "communities",
    platform: "forum",
    name,
    url,
    audience,
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "COMMUNITY_POST_PREP",
    accountRequired: true,
    fit,
    intent: 0.7,
  };
}

/** Expand query clusters into many unique search-intent surfaces per business. */
function intentSurfaceSeeds(
  businessId: string,
  queries: string[],
): SeedSpec[] {
  const out: SeedSpec[] = [];
  for (const q of queries.slice(0, 12)) {
    const slug = q.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
    out.push({
      family: "search_seo",
      platform: "google",
      name: `Google intent cluster: ${q}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      audience: `searchers for "${q}"`,
      executionClass: "UNAVAILABLE",
      executorType: "CONTENT_PUBLISH",
      automationAllowed: false,
      fit: 0.8,
      intent: 0.9,
    });
    out.push({
      family: "programmatic_organic",
      platform: "owned_domain",
      name: `Owned intent page: ${q}`,
      url: `https://${businessId}.130.131.15.68.sslip.io/${slug}/`,
      audience: `buyers searching ${q}`,
      executionClass: "AUTO_EXECUTABLE",
      executorType: "CONTENT_PUBLISH",
      automationAllowed: true,
      fit: 0.85,
      intent: 0.9,
    });
    out.push({
      family: "search_seo",
      platform: "bing",
      name: `Bing intent cluster: ${q}`,
      url: `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
      audience: `Bing searchers for "${q}"`,
      executionClass: "UNAVAILABLE",
      executorType: "CONTENT_PUBLISH",
      automationAllowed: false,
      fit: 0.7,
      intent: 0.85,
    });
  }
  return out;
}

function partnerSeeds(businessId: string, complements: string[]): SeedSpec[] {
  return complements.slice(0, 10).map((name) => ({
    family: "partnerships" as const,
    platform: "partner",
    name: `Partner type: ${name}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(`${name} partners OR affiliates OR "resource page"`)}`,
    audience: `${name} users overlapping buyer`,
    executionClass: "HUMAN_ACTION_REQUIRED" as const,
    executorType: "PARTNER_OUTREACH" as const,
    accountRequired: false,
    fit: 0.7,
    intent: 0.65,
  }));
}

function newsletterCreatorSeeds(
  newsletters: string[],
  podcasts: string[],
  creators: string[],
): SeedSpec[] {
  const out: SeedSpec[] = [];
  for (const n of newsletters) {
    out.push({
      family: "creators",
      platform: "newsletter",
      name: `Newsletter: ${n}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${n}" newsletter`)}`,
      audience: n,
      executionClass: "HUMAN_ACTION_REQUIRED",
      executorType: "RESOURCE_PITCH",
      fit: 0.65,
      intent: 0.6,
    });
  }
  for (const p of podcasts) {
    out.push({
      family: "creators",
      platform: "podcast",
      name: `Podcast: ${p}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${p}" podcast`)}`,
      audience: p,
      executionClass: "HUMAN_ACTION_REQUIRED",
      executorType: "RESOURCE_PITCH",
      fit: 0.6,
      intent: 0.55,
    });
  }
  for (const c of creators) {
    out.push({
      family: "creators",
      platform: "creator",
      name: `Creator: ${c}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(c)}`,
      audience: c,
      executionClass: "HUMAN_ACTION_REQUIRED",
      executorType: "RESOURCE_PITCH",
      fit: 0.55,
      intent: 0.5,
    });
  }
  return out;
}

function classifyHitFamily(url: string): ChannelFamily {
  const u = url.toLowerCase();
  if (/reddit\.com|forum|community|discourse|indiehackers|news\.ycombinator/.test(u))
    return "communities";
  if (/alternativeto|capterra|g2\.com|saashub|getapp|directory|betalist/.test(u))
    return "directories";
  if (/producthunt|gumroad|appsumo|marketplace/.test(u)) return "marketplaces";
  if (/youtube\.com|podcast|substack|medium\.com|newsletter/.test(u))
    return "creators";
  if (/linkedin\.com|twitter\.com|x\.com/.test(u)) return "social_organic";
  return "earned";
}

function classifyHitExecution(url: string): {
  executionClass: ExecutionClass;
  executorType: ExecutorType;
} {
  const u = url.toLowerCase();
  if (/reddit\.com|linkedin\.com|facebook\.com/.test(u)) {
    return {
      executionClass: "HUMAN_ACTION_REQUIRED",
      executorType: "COMMUNITY_POST_PREP",
    };
  }
  if (/alternativeto|capterra|g2\.com|saashub|betalist|producthunt/.test(u)) {
    return {
      executionClass: "HUMAN_ACTION_REQUIRED",
      executorType: "DIRECTORY_LISTING",
    };
  }
  if (/gumroad\.com/.test(u)) {
    return {
      executionClass: "CREDENTIAL_REQUIRED",
      executorType: "MARKETPLACE_LISTING",
    };
  }
  return {
    executionClass: "HUMAN_ACTION_REQUIRED",
    executorType: "RESOURCE_PITCH",
  };
}

async function upsertSeed(
  pool: pg.Pool,
  businessId: string,
  seed: SeedSpec,
  topic: string,
  buyerRole: string,
  market: string,
): Promise<boolean> {
  const surface: Omit<ChannelSurface, "channelSurfaceId"> = {
    channelFamily: seed.family,
    platform: seed.platform,
    surfaceName: seed.name,
    surfaceUrl: seed.url,
    audience: seed.audience,
    buyerRole,
    market,
    topic,
    businessFit: seed.fit,
    commercialIntent: seed.intent,
    estimatedReach: seed.fit * 1000,
    estimatedRelevance: seed.fit,
    cost: "free",
    accountRequired: seed.accountRequired ?? false,
    credentialRequired: seed.executionClass === "CREDENTIAL_REQUIRED",
    apiAvailable: seed.executorType === "SEARCH_SUBMISSION" || seed.executorType === "WEBSUB_PING",
    automationAllowed: seed.automationAllowed ?? false,
    manualActionRequired: seed.executionClass !== "AUTO_EXECUTABLE",
    postingAllowed: seed.postingAllowed ?? null,
    promotionAllowed: seed.promotionAllowed ?? null,
    linkAllowed: true,
    rateLimits: "respect platform",
    platformRules: "no spam; value-first; follow ToS",
    risk: seed.family === "communities" ? "medium" : "low",
    executionClass: seed.executionClass,
    executorType: seed.executorType,
    status: seed.executionClass === "AUTO_EXECUTABLE" ? "READY" : "DISCOVERED",
    confidence: 0.55,
    businessIds: [businessId],
    meta: { source: "acquisitionos_seed_v1" },
  };
  const { id, created } = await upsertChannelSurface(pool, surface);
  await linkBusinessSurface(pool, businessId, id, seed.fit, Math.round((1 - seed.fit) * 100));
  return created;
}

export async function discoverChannelsForBusiness(input: {
  pool: pg.Pool;
  businessId: string;
  openWorldSearches?: number;
}): Promise<{
  habitatClarity: number;
  created: number;
  linked: number;
  openWorldHits: number;
}> {
  const habitat = buildBuyerHabitat(input.businessId);
  await persistBuyerHabitat(input.pool, habitat);

  let created = 0;
  let linked = 0;

  const seeds: SeedSpec[] = [
    ...GLOBAL_DIRECTORY_SEEDS,
    ...(COMMUNITY_SEEDS[input.businessId] ?? []),
    ...intentSurfaceSeeds(input.businessId, habitat.searchQueries),
    ...partnerSeeds(input.businessId, habitat.complementaryProducts),
    ...newsletterCreatorSeeds(
      habitat.newsletters,
      habitat.podcasts,
      habitat.creators,
    ),
    // Owned RSS surface
    {
      family: "owned_distribution",
      platform: "owned_rss",
      name: `${input.businessId} RSS feed`,
      url: `https://${input.businessId}.130.131.15.68.sslip.io/rss.xml`,
      audience: "feed readers / aggregators",
      executionClass: "AUTO_EXECUTABLE",
      executorType: "FEED_PUBLISH",
      automationAllowed: true,
      fit: 0.5,
      intent: 0.4,
    },
    // Portfolio cross-discovery placeholder
    {
      family: "owned_distribution",
      platform: "portfolio",
      name: "Portfolio complementary cross-link hub",
      url: `https://${input.businessId}.130.131.15.68.sslip.io/resources/`,
      audience: "overlapping portfolio buyers",
      executionClass: "AUTO_EXECUTABLE",
      executorType: "PORTFOLIO_CROSSLINK",
      automationAllowed: true,
      fit: 0.55,
      intent: 0.5,
    },
  ];

  for (const seed of seeds) {
    const wasNew = await upsertSeed(
      input.pool,
      input.businessId,
      seed,
      habitat.problem,
      habitat.buyerRole,
      habitat.industry,
    );
    linked++;
    if (wasNew) created++;
  }

  // Open-world DDG expansion (no paid AI)
  let openWorldHits = 0;
  const searches = input.openWorldSearches ?? 2;
  const queries = [
    `${habitat.searchQueries[0] ?? habitat.problem} tools directory OR community OR forum`,
    `best ${habitat.industry} resources for ${habitat.buyerRole.replace(/_/g, " ")}`,
  ].slice(0, searches);

  for (const q of queries) {
    const hits = await searchDuckDuckGo(q, 8);
    openWorldHits += hits.length;
    for (const hit of hits) {
      if (!hit.url || hit.url.includes("duckduckgo.com")) continue;
      const family = classifyHitFamily(hit.url);
      const exec = classifyHitExecution(hit.url);
      const wasNew = await upsertSeed(
        input.pool,
        input.businessId,
        {
          family,
          platform: new URL(hit.url).hostname.replace(/^www\./, ""),
          name: hit.title.slice(0, 120) || hit.url,
          url: hit.url,
          audience: hit.snippet.slice(0, 160) || habitat.buyerPersona,
          executionClass: exec.executionClass,
          executorType: exec.executorType,
          accountRequired: exec.executionClass !== "AUTO_EXECUTABLE",
          fit: 0.55,
          intent: 0.55,
        },
        habitat.problem,
        habitat.buyerRole,
        habitat.industry,
      );
      linked++;
      if (wasNew) created++;
    }
  }

  return {
    habitatClarity: habitat.clarityScore,
    created,
    linked,
    openWorldHits,
  };
}

export async function expandPortfolioChannelUniverse(input: {
  pool: pg.Pool;
  businessIds: string[];
  openWorldPerBusiness?: number;
}): Promise<{
  businesses: number;
  created: number;
  linked: number;
  openWorldHits: number;
}> {
  let created = 0;
  let linked = 0;
  let openWorldHits = 0;
  for (const businessId of input.businessIds) {
    const r = await discoverChannelsForBusiness({
      pool: input.pool,
      businessId,
      openWorldSearches: input.openWorldPerBusiness ?? 2,
    });
    created += r.created;
    linked += r.linked;
    openWorldHits += r.openWorldHits;
  }
  return {
    businesses: input.businessIds.length,
    created,
    linked,
    openWorldHits,
  };
}
