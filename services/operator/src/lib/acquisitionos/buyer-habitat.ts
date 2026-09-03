import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type pg from "pg";

export type BuyerHabitat = {
  businessId: string;
  buyerPersona: string;
  buyerRole: string;
  industry: string;
  problem: string;
  urgency: string;
  purchaseTrigger: string;
  searchQueries: string[];
  communities: string[];
  websites: string[];
  publications: string[];
  directories: string[];
  socialPlatforms: string[];
  creators: string[];
  newsletters: string[];
  podcasts: string[];
  associations: string[];
  marketplaces: string[];
  complementaryProducts: string[];
  contentConsumed: string[];
  toolsUsed: string[];
  decisionSources: string[];
  clarityScore: number;
};

const HABITAT_SEEDS: Record<string, Partial<BuyerHabitat>> = {
  storelift: {
    buyerPersona: "DTC ecommerce operator with traffic but weak PDP conversion",
    buyerRole: "ecommerce_merchandiser",
    industry: "ecommerce",
    problem: "Product pages lack merchandising structure and proof hierarchy",
    urgency: "high when conversion rate stalls despite paid traffic",
    purchaseTrigger: "Need PDP checklist / merchandising pack this week",
    searchQueries: [
      "product page optimization checklist",
      "ecommerce merchandising template",
      "pdp conversion framework",
      "Shopify product page CRO",
    ],
    communities: [
      "r/ecommerce",
      "r/shopify",
      "r/PPC",
      "Shopify Community",
      "eCommerceFuel",
    ],
    directories: [
      "AlternativeTo ecommerce tools",
      "G2 merchandising",
      "Capterra ecommerce",
      "SaaSHub",
    ],
    socialPlatforms: ["LinkedIn ecommerce ops", "X/Twitter Shopify"],
    newsletters: ["Practical Ecommerce", "eCom Insights"],
    podcasts: ["Shopify Masters", "eCommerce Fuel Podcast"],
    complementaryProducts: ["Shopify apps", "Klaviyo", "Hotjar"],
    contentConsumed: ["CRO blogs", "PDP teardown threads", "template packs"],
    decisionSources: ["peer operators", "agency recommendations", "tool lists"],
  },
  bidforge: {
    buyerPersona: "Contractor / bid estimator needing proposal templates",
    buyerRole: "contractor_estimator",
    industry: "construction",
    problem: "Slow, inconsistent bid/proposal packaging loses jobs",
    urgency: "high before bid deadlines",
    purchaseTrigger: "Upcoming bid package due",
    searchQueries: [
      "contractor estimate template",
      "construction proposal template",
      "bid proposal pack",
      "SOW for contractors",
    ],
    communities: [
      "r/Construction",
      "r/Contractor",
      "ContractorTalk",
      "HotRod forums trade sections",
    ],
    directories: ["Angi pro resources", "Buildertrend resource lists"],
    associations: ["NAHB", "local contractor associations"],
    complementaryProducts: ["QuickBooks", "Buildertrend", "Jobber"],
    contentConsumed: ["estimating guides", "proposal examples"],
    decisionSources: ["trade peers", "supplier reps", "YouTube estimators"],
  },
  invoicechaser: {
    buyerPersona: "SMB owner chasing overdue invoices",
    buyerRole: "smb_owner_finance",
    industry: "smb_finance",
    problem: "Overdue AR drains cash; awkward follow-ups",
    urgency: "high when cash flow tight",
    purchaseTrigger: "Multiple invoices 30+ days overdue",
    searchQueries: [
      "overdue invoice email template",
      "how to chase invoice politely",
      "accounts receivable follow up",
      "invoice reminder sequence",
    ],
    communities: ["r/smallbusiness", "r/Entrepreneur", "r/bookkeeping"],
    directories: ["Capterra invoicing", "G2 accounts receivable"],
    complementaryProducts: ["QuickBooks", "Xero", "FreshBooks", "Wave"],
    contentConsumed: ["AR playbooks", "email scripts"],
    decisionSources: ["accountant advice", "peer SMB owners"],
  },
  scopesmith: {
    buyerPersona: "Consultant / freelancer writing scopes of work",
    buyerRole: "consultant_freelancer",
    industry: "professional_services",
    problem: "Scope creep from weak SOWs",
    urgency: "medium-high at project kickoff",
    purchaseTrigger: "New client engagement starting",
    searchQueries: [
      "statement of work template",
      "consulting sow example",
      "scope of work for freelancers",
    ],
    communities: ["r/consulting", "r/freelance", "Indie Hackers"],
    directories: ["AlternativeTo project tools"],
    complementaryProducts: ["Notion", "HoneyBook", "Bonsai"],
    contentConsumed: ["SOW examples", "freelance contract guides"],
    decisionSources: ["freelance communities", "agency ops leads"],
  },
  deckready: {
    buyerPersona: "Founder needing investor pitch structure fast",
    buyerRole: "startup_founder",
    industry: "startups",
    problem: "Pitch narrative unstructured before investor meetings",
    urgency: "high before fundraising meetings",
    purchaseTrigger: "Investor meeting scheduled",
    searchQueries: [
      "pitch deck outline template",
      "investor narrative framework",
      "startup pitch structure",
    ],
    communities: ["r/startups", "r/Entrepreneur", "Indie Hackers", "Product Hunt"],
    directories: ["BetaList", "Startup directories", "AlternativeTo"],
    creators: ["Y Combinator", "a16z content"],
    podcasts: ["How I Built This", "Indie Hackers Podcast"],
    complementaryProducts: ["DocSend", "Pitch.com", "Gamma"],
    contentConsumed: ["deck teardowns", "fundraising guides"],
    decisionSources: ["accelerators", "founder peers", "investor blogs"],
  },
};

function repoRoot(): string {
  return (
    process.env.REVENUEOS_REPO_ROOT ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  );
}

function loadBrandLite(siteId: string): {
  audience?: string;
  industry?: string;
  tagline?: string;
  keywords?: string[];
  name?: string;
} {
  const p = path.join(repoRoot(), "apps", siteId, "src/lib/brand.ts");
  if (!existsSync(p)) return {};
  const src = readFileSync(p, "utf8");
  const audience = src.match(/"audience"\s*:\s*"([^"]+)"/)?.[1];
  const industry = src.match(/"industry"\s*:\s*"([^"]+)"/)?.[1];
  const tagline = src.match(/"tagline"\s*:\s*"([^"]+)"/)?.[1];
  const name = src.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
  const intentBlock = src.match(/"intentKeywords"\s*:\s*\[([\s\S]*?)\]/);
  const keywords = intentBlock
    ? [...intentBlock[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!).slice(0, 8)
    : [];
  return { audience, industry, tagline, keywords, name };
}

export function buildBuyerHabitat(businessId: string): BuyerHabitat {
  const seed = HABITAT_SEEDS[businessId] ?? {};
  const brand = loadBrandLite(businessId);
  const searchQueries = [
    ...(seed.searchQueries ?? []),
    ...(brand.keywords ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const clarity =
    (seed.buyerPersona ? 0.25 : 0) +
    (searchQueries.length >= 2 ? 0.25 : 0.1) +
    ((seed.communities?.length ?? 0) >= 2 ? 0.2 : 0) +
    ((seed.directories?.length ?? 0) >= 1 ? 0.15 : 0) +
    (seed.problem ? 0.15 : 0);

  return {
    businessId,
    buyerPersona: seed.buyerPersona ?? brand.audience ?? "unknown buyer",
    buyerRole: seed.buyerRole ?? "unknown",
    industry: seed.industry ?? brand.industry ?? "unknown",
    problem: seed.problem ?? brand.tagline ?? "unknown problem",
    urgency: seed.urgency ?? "unknown",
    purchaseTrigger: seed.purchaseTrigger ?? "unknown",
    searchQueries,
    communities: seed.communities ?? [],
    websites: seed.websites ?? [],
    publications: seed.publications ?? [],
    directories: seed.directories ?? [],
    socialPlatforms: seed.socialPlatforms ?? ["LinkedIn", "X"],
    creators: seed.creators ?? [],
    newsletters: seed.newsletters ?? [],
    podcasts: seed.podcasts ?? [],
    associations: seed.associations ?? [],
    marketplaces: seed.marketplaces ?? [],
    complementaryProducts: seed.complementaryProducts ?? [],
    contentConsumed: seed.contentConsumed ?? [],
    toolsUsed: seed.toolsUsed ?? [],
    decisionSources: seed.decisionSources ?? [],
    clarityScore: Math.min(1, clarity),
  };
}

export async function persistBuyerHabitat(
  pool: pg.Pool,
  habitat: BuyerHabitat,
): Promise<void> {
  await pool.query(
    `insert into aq_buyer_habitats (business_id, document, clarity_score, updated_at)
     values ($1,$2::jsonb,$3,now())
     on conflict (business_id) do update set
       document=excluded.document, clarity_score=excluded.clarity_score, updated_at=now()`,
    [habitat.businessId, JSON.stringify(habitat), habitat.clarityScore],
  );
}
