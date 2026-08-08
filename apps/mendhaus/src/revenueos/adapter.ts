import path from "node:path";
import {
  detectBottleneck,
  buildFunnel,
  largestDrop,
  moneyFromCounts,
  type ActionResult,
  type BusinessContext,
  type DiscoveryDoor,
  type DiscoveryDoorMetrics,
  type MarketSignals,
  type Observation,
  type PrecursorMetric,
  type SafeAction,
  type SeedLesson,
  type SiteAdapter,
} from "@tributeready/revenueos";
import { PERSONAS } from "@/catalog/personas";
import { PRODUCT_OPPORTUNITIES } from "@/catalog/opportunities";
import { PRODUCTS } from "@/catalog/products";
import { KITS } from "@/catalog/kits";
import { BRAND } from "@/lib/brand";
import { appendJournal } from "@/lib/events";
import {
  activateNamedKitDeal,
  clearActivePromo,
  runMerchOptimize,
  setFreeShippingThreshold,
  setHomepageFocus,
} from "@/lib/merch-optimize";
import type { MerchFocus } from "@/lib/merch";
import {
  listDiscoveryDoorsFromState,
  listPublishedTopics,
  loadDiscoveryState,
  publishIntentTopic,
  pingSitemap,
  retireTopic,
  runDiscoveryAttack,
  runInternetMarketResearch,
  syncDoorScoreToTopic,
  topicToDoor,
} from "@/lib/discovery";
import {
  getLastHourPulse,
  getWindowSnapshot,
  measureDiscoveryDoorMetrics,
} from "@/lib/metrics";
import { ownerGates } from "@/lib/readiness";
import { createDurableExperimentStore } from "@/revenueos/durable-store";
import { planOpportunityDecision } from "@/revenueos/ai-planner";
import { MENDHAUS_SEED_LESSONS } from "@/revenueos/seeds";

const FUNNEL_STEPS = [
  "landing_view",
  "product_view",
  "engagement",
  "add_to_cart",
  "checkout_started",
  "purchase",
];

const INDEXNOW_KEY = process.env.MENDHAUS_INDEXNOW_KEY ?? "";
const INDEXNOW_COOLDOWN_MS = 10 * 60 * 1000;
let lastIndexNowAt = 0;

function publicBase() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://mendhaus.shop").replace(/\/$/, "");
}

async function publicUrls() {
  const base = publicBase();
  const topics = await listPublishedTopics();
  return [
    `${base}/`,
    `${base}/shop`,
    `${base}/guides`,
    `${base}/guides/renter-friendly-upgrades`,
    `${base}/guides/under-sink-organizer`,
    `${base}/guides/pet-hair-hardwood`,
    `${base}/guides/small-desk-setup`,
    `${base}/category/kitchen`,
    `${base}/category/bathroom`,
    `${base}/category/renter`,
    `${base}/category/desk`,
    `${base}/category/cleaning`,
    `${base}/shipping`,
    `${base}/returns`,
    ...PRODUCTS.map((p) => `${base}/product/${p.slug}`),
    ...topics.map((topic) => `${base}/topics/${topic.slug}`),
  ];
}

function ledgerRoot() {
  if (process.env.REVENUEOS_LEDGER_DIR) return process.env.REVENUEOS_LEDGER_DIR;
  if (process.env.VERCEL) return path.join("/tmp", "revenueos-mendhaus");
  return path.join(process.cwd(), "data", "revenueos");
}

function count(events: Partial<Record<string, number>> | undefined, name: string) {
  return Number(events?.[name] ?? 0);
}

export function createMendhausAdapter(): SiteAdapter {
  const store = createDurableExperimentStore(ledgerRoot());

  return {
    id: BRAND.siteId,
    planDecision: planOpportunityDecision,

    async getContext(): Promise<BusinessContext> {
      return {
        siteId: BRAND.siteId,
        displayName: BRAND.name,
        industry: BRAND.industry,
        products: PRODUCTS.map((p) => ({
          id: p.id,
          name: p.name,
          priceUsd: p.priceUsd,
          marginEstimate: p.marginRatio,
        })),
        funnelSteps: FUNNEL_STEPS,
        brandVoice: BRAND.voice,
        allowedChannels: [
          "organic_search",
          "content_seo",
          "directories",
          "communities",
          "social_organic",
          "pinterest",
        ],
        autonomousDailyCapUsd: Number(process.env.MAX_AUTONOMOUS_DAILY_COST_USD ?? "0"),
        timezone: BRAND.timezone,
        constraints: [
          "PRIMARY ATTACK SITE — daily revenue target $10,000 gross",
          "Prefer kit AOV ($100–$165): Kitchen Reset, Renter Bath, Desk Day, Entry Clear",
          "RevenueOS may run margin-safe kit/site promos, rotate homepage focus, and tune free-shipping threshold",
          "Organic/free acquisition only unless the owner explicitly authorizes spend",
          "Never invent reviews, scarcity, or landlord/damage-free guarantees",
          "Pricing must stay above each SKU minMarginUsd and confirmed supplier COGS",
          "Do not open supplier, Stripe, tax, or domain accounts — owner only",
          "US shipping only until supplier coverage is confirmed",
        ],
        audienceSegments: PERSONAS.map((persona) => ({
          id: persona.id,
          label: persona.label,
          traits: persona.traits,
          habits: persona.habits,
          channels: persona.channels,
          triggers: persona.triggers,
          objections: persona.objections,
          messagingAngles: persona.angles,
          intentTemperature: "warm" as const,
        })),
      };
    },

    async observe(): Promise<Observation> {
      const [d7, hourPulse] = await Promise.all([
        getWindowSnapshot(7),
        getLastHourPulse(),
      ]);
      const events = d7.events;
      const purchases =
        count(d7.orders.byStatus, "paid") +
        count(d7.orders.byStatus, "fulfilling") +
        count(d7.orders.byStatus, "shipped") +
        count(d7.orders.byStatus, "delivered");
      const revenueUsd = d7.orders.grossRevenueUsd;
      const variableCostUsd = Number(
        (
          d7.orders.cogsUsd +
          d7.orders.shippingCostUsd +
          d7.orders.feesUsd
        ).toFixed(2),
      );
      const steps = buildFunnel(FUNNEL_STEPS, events);
      const open = await store.listExperiments(BRAND.siteId);

      return {
        observedAt: new Date().toISOString(),
        money: moneyFromCounts({
          purchases,
          awaitingPayment: count(d7.orders.byStatus, "awaiting_payment"),
          refunded: count(d7.orders.byStatus, "refunded"),
          revenueUsd,
          variableCostUsd,
        }),
        funnel: {
          steps,
          largestDrop: largestDrop(steps),
          landingViews: count(events, "landing_view"),
          checkouts: count(events, "checkout_started"),
          fulfillmentFailed: 0,
        },
        bottleneck: detectBottleneck({
          purchases,
          fulfillmentFailed: 0,
          landingViews: count(events, "landing_view"),
          checkouts: count(events, "checkout_started"),
        }),
        rawWindows: { d7, hour: hourPulse },
        hourPulse,
        openExperimentIds: open
          .filter((item) => item.status === "running" || item.status === "proposed")
          .map((item) => item.id),
        errors: ownerGates()
          .filter((g) => !g.done)
          .map((g) => `Owner gate: ${g.title}`),
      };
    },

    async listSiteOpportunities() {
      const hour = await getLastHourPulse();
      const discoveryUrgent = (hour.landingViews ?? 0) < 15;
      return [
        {
          id: "mh-discovery-attack",
          title: "Compound discovery attack (research → publish → index)",
          metric: "landing views",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: discoveryUrgent ? 10 : 7,
          confidence: 0.65,
          effort: 2,
          action:
            "Search the live internet for demand, publish an intent topic for strangers, IndexNow + sitemap ping. Do this before merchandising an empty funnel.",
          safeActionType: "discovery_attack",
          patternKey: "discovery-attack",
        },
        {
          id: "mh-internet-research",
          title: "Learn from the live internet who is buying now",
          metric: "qualified visits",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: discoveryUrgent ? 9.5 : 6,
          confidence: 0.6,
          effort: 1,
          action:
            "Web-search current renter/kitchen/desk/pet-hair demand and competitor gaps. Persist attacks as durable lessons.",
          safeActionType: "market_research",
          patternKey: "internet-market-research",
        },
        {
          id: "mh-publish-intent",
          title: "Publish searchable intent topic from research",
          metric: "organic visits",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: discoveryUrgent ? 9 : 6,
          confidence: 0.55,
          effort: 2,
          action:
            "Turn the top researched query into a public /topics page linked to real SKUs.",
          safeActionType: "publish_intent_page",
          patternKey: "publish-intent-page",
        },
        {
          id: "mh-sitemap-ping",
          title: "Ping Google/Bing with live sitemap",
          metric: "indexed URLs",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 6,
          confidence: 0.5,
          effort: 1,
          action: "Notify search engines that sitemap.xml (including new topics) changed.",
          safeActionType: "sitemap_ping",
          patternKey: "sitemap-ping",
        },
        {
          id: "mh-indexnow",
          title: "Keep public Mendhaus URLs discoverable (IndexNow)",
          metric: "indexed URLs / landing views",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 7,
          confidence: 0.5,
          effort: 1,
          action:
            "Submit shop, category, product, guide, and topic URLs via IndexNow every hunt cycle. Free discovery — no ads.",
          safeActionType: "indexnow_submit",
          patternKey: "indexnow-discovery",
        },
        {
          id: "mh-merch-optimize",
          title: "Autonomous merchandising: deals, focus, free shipping",
          metric: "purchases / AOV / contribution",
          category: "conversion" as const,
          precursorMetric: "purchases" as const,
          expectedImpact: discoveryUrgent ? 4 : 9,
          confidence: 0.65,
          effort: 1,
          action:
            "Each cycle: clear expired promos, activate margin-safe kit or site deals when conversion stalls, rotate homepage kit focus, and tune free-shipping threshold. Never fake scarcity; never break minMarginUsd. Skip when the hour is empty — acquisition first.",
          safeActionType: "merch_optimize",
          patternKey: "merch:optimize-heartbeat",
        },
        {
          id: "mh-kit-kitchen-deal",
          title: "Push Kitchen Reset kit deal",
          metric: "kit AOV + purchases",
          category: "conversion" as const,
          precursorMetric: "purchases" as const,
          expectedImpact: 8,
          confidence: 0.55,
          effort: 1,
          action:
            "Activate a margin-safe % off across Kitchen Reset SKUs and feature that kit on the homepage banner.",
          safeActionType: "activate_kit_deal",
          patternKey: "merch:kit-deal:kitchen-reset",
        },
        {
          id: "mh-kit-bath-deal",
          title: "Push Renter Bathroom kit deal",
          metric: "kit AOV + purchases",
          category: "conversion" as const,
          precursorMetric: "purchases" as const,
          expectedImpact: 8,
          confidence: 0.55,
          effort: 1,
          action:
            "Activate a margin-safe % off across Renter Bathroom Kit SKUs and feature that kit on the homepage.",
          safeActionType: "activate_kit_deal",
          patternKey: "merch:kit-deal:renter-bath",
        },
        {
          id: "mh-kit-desk-deal",
          title: "Push Desk Day kit deal",
          metric: "kit AOV + purchases",
          category: "conversion" as const,
          precursorMetric: "average_order_value" as const,
          expectedImpact: 7,
          confidence: 0.5,
          effort: 1,
          action: "Activate a margin-safe Desk Day kit promo and feature it sitewide.",
          safeActionType: "activate_kit_deal",
          patternKey: "merch:kit-deal:desk-day",
        },
        {
          id: "mh-kit-entry-deal",
          title: "Push Entry Clear kit deal",
          metric: "kit AOV + purchases",
          category: "conversion" as const,
          precursorMetric: "purchases" as const,
          expectedImpact: 7,
          confidence: 0.5,
          effort: 1,
          action: "Activate a margin-safe Entry Clear kit promo and feature it sitewide.",
          safeActionType: "activate_kit_deal",
          patternKey: "merch:kit-deal:entry-clear",
        },
        {
          id: "mh-homepage-focus",
          title: "Rotate homepage kit focus",
          metric: "product views → add to cart",
          category: "conversion" as const,
          precursorMetric: "product_started" as const,
          expectedImpact: 6,
          confidence: 0.45,
          effort: 1,
          action:
            "Change featured kits (kitchen / bath / desk / entry) so the first viewport story matches the active attack lane.",
          safeActionType: "set_homepage_focus",
          patternKey: "merch:homepage-focus",
        },
        {
          id: "mh-free-shipping-lever",
          title: "Tune free-shipping threshold",
          metric: "AOV / checkout completion",
          category: "conversion" as const,
          precursorMetric: "average_order_value" as const,
          expectedImpact: 6,
          confidence: 0.45,
          effort: 1,
          action:
            "Lower free shipping toward $69 when carts stall; restore $79 when purchases are healthy. Never invent tax or fake thresholds.",
          safeActionType: "set_free_shipping_threshold",
          patternKey: "merch:free-shipping",
        },
        {
          id: "mh-clear-promo",
          title: "End promo to protect contribution",
          metric: "contribution margin",
          category: "conversion" as const,
          precursorMetric: "contribution_profit" as const,
          expectedImpact: 5,
          confidence: 0.5,
          effort: 1,
          action: "Clear the active site/kit promo when sales are strong or margin needs protecting.",
          safeActionType: "clear_promo",
          patternKey: "merch:clear-promo",
        },
        {
          id: "mh-renter-seo",
          title: "Rank renter-friendly upgrade intent",
          metric: "organic visits → product views",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 8,
          confidence: 0.55,
          effort: 2,
          action:
            "Publish / deepen renter intent topics with honest no-drill install notes. Link to over-door and tension SKUs.",
          safeActionType: "publish_intent_page",
          patternKey: "acq:organic_search:renter:a0",
        },
        {
          id: "mh-kitchen-problem-pages",
          title: "Problem pages for under-sink / dish / fridge mess",
          metric: "guide → add to cart",
          category: "acquisition" as const,
          precursorMetric: "product_started" as const,
          expectedImpact: 8,
          confidence: 0.55,
          effort: 2,
          action:
            "Publish kitchen problem intent topics (dimensions, P-trap, drip tray). Link to caddy + sponge holder.",
          safeActionType: "publish_intent_page",
          patternKey: "acq:content_seo:kitchen-reset:a0",
        },
        {
          id: "mh-pet-hair-guide",
          title: "Pet-hair hardwood buying guide",
          metric: "guide → purchases",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 7,
          confidence: 0.5,
          effort: 2,
          action:
            "Publish floor-type specific intent topics. No miracle shed claims. Cross-sell rubber broom + lint roller.",
          safeActionType: "publish_intent_page",
          patternKey: "acq:content_seo:pet-home:a1",
        },
        {
          id: "mh-desk-setup",
          title: "Small-desk setup guide (riser + cables)",
          metric: "bundle AOV",
          category: "conversion" as const,
          precursorMetric: "average_order_value" as const,
          expectedImpact: 6,
          confidence: 0.45,
          effort: 2,
          action:
            "Publish small-desk intent topics with weight ratings and cable raceways.",
          safeActionType: "publish_intent_page",
          patternKey: "acq:content_seo:desk-worker:a0",
        },
        {
          id: "mh-gsc-bing",
          title: "Search Console + Bing sitemap coverage",
          metric: "indexed URLs",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 6,
          confidence: 0.5,
          effort: 1,
          action:
            "Autonomously ping Google/Bing with sitemap.xml. Owner still verifies GSC property once.",
          safeActionType: "sitemap_ping",
          patternKey: "search-console-coverage",
        },
        {
          id: "mh-supplier-map",
          title: "Map live supplier SKUs (owner)",
          metric: "fulfillment reliability",
          category: "operations" as const,
          precursorMetric: "fulfillment_reliability" as const,
          expectedImpact: 9,
          confidence: 0.7,
          effort: 4,
          action:
            "Owner: create CJ US warehouse and/or Spocket accounts, confirm unit cost + stock for all 32 SKUs, set MENDHAUS_SUPPLIER_READY=1. No paid order until this is done.",
          patternKey: "ops:supplier-account",
        },
        ...PRODUCT_OPPORTUNITIES.filter((o) => o.recommendedAction !== "IGNORE").map(
          (o) => ({
            id: o.id,
            title: `Product opportunity: ${o.name}`,
            metric: "new SKU contribution",
            category: "acquisition" as const,
            precursorMetric: "purchases" as const,
            expectedImpact: Math.round(o.confidence * 8),
            confidence: o.confidence,
            effort: 4,
            action: `${o.recommendedAction}: ${o.hypothesis} Do not open a new supplier relationship automatically.`,
            patternKey: `product-opp:${o.id}`,
          }),
        ),
      ];
    },

    async getMarketSignals(): Promise<MarketSignals> {
      const gates = ownerGates();
      const [urls, discovery] = await Promise.all([publicUrls(), loadDiscoveryState()]);
      return {
        indexCoverage: {
          knownUrls: urls.length,
          indexedUrls: discovery.publishedTopics.length,
        },
        channels: [
          { channel: "organic_search", status: "open" },
          { channel: "content_seo", status: "open" },
          { channel: "directories", status: "open" },
          { channel: "social_organic", status: "open" },
          {
            channel: "paid_ads",
            status: "owner_gate",
            note: "Forbidden without explicit owner spend authorization.",
          },
          {
            channel: "supplier",
            status: gates.find((g) => g.id === "supplier")?.done ? "open" : "owner_gate",
            note: "CJ/Spocket account + live SKU map required before fulfillment.",
          },
        ],
        competitors: discovery.attacks.slice(0, 3).map((attack) => ({
          name: attack.query,
          strength: "moderate" as const,
          note: attack.competitorGap,
        })),
        demandNotes: [
          ...(discovery.demandNotes.length
            ? discovery.demandNotes
            : [
                "Problem-solving home products: search intent is specific. Rank honest problem pages before brand terms.",
                "US 3–7 day ETA is a conversion lever vs generic dropship 2-week China shipping.",
              ]),
          discovery.researchSummary
            ? `Latest internet research: ${discovery.researchSummary}`
            : "Internet research has not run yet this cycle.",
        ].slice(0, 8),
      };
    },

    async getMeasurement(metric: PrecursorMetric): Promise<number | null> {
      const d7 = await getWindowSnapshot(7);
      const purchases =
        count(d7.orders.byStatus, "paid") +
        count(d7.orders.byStatus, "fulfilling") +
        count(d7.orders.byStatus, "shipped") +
        count(d7.orders.byStatus, "delivered");
      switch (metric) {
        case "purchases":
          return purchases;
        case "revenue":
          return d7.orders.grossRevenueUsd;
        case "contribution_profit":
          return d7.orders.realizedProfitUsd || d7.orders.estimatedProfitUsd;
        case "checkout_started":
          return count(d7.events, "checkout_started");
        case "product_started":
          return count(d7.events, "product_view");
        case "landing_views":
          return count(d7.events, "landing_view");
        case "average_order_value":
          return purchases > 0 ? d7.orders.grossRevenueUsd / purchases : 0;
        case "margin":
          return d7.orders.grossRevenueUsd > 0
            ? (d7.orders.realizedProfitUsd || d7.orders.estimatedProfitUsd) /
                d7.orders.grossRevenueUsd
            : 0;
        case "fulfillment_reliability":
          return 1;
        default:
          return null;
      }
    },

    getSeedLessons(): SeedLesson[] {
      return MENDHAUS_SEED_LESSONS;
    },

    async listSafeActions(): Promise<SafeAction[]> {
      const urls = await publicUrls();
      return [
        {
          type: "scorecard_snapshot",
          risk: "safe",
          description: "Persist RevenueOS scorecard snapshot to the ledger",
        },
        {
          type: "market_research",
          risk: "safe",
          description: "Search the live internet for demand and competitor gaps",
          exposureKey: "internet-research",
        },
        {
          type: "discovery_attack",
          risk: "safe",
          description: "Research → publish intent topic → sitemap ping",
          exposureKey: "discovery-attack",
        },
        {
          type: "publish_intent_page",
          risk: "safe",
          description: "Publish a searchable /topics page from research",
          exposureKey: "intent-topic",
        },
        {
          type: "retire_discovery_door",
          risk: "safe",
          description: "Retire a killed discovery door / topic cluster",
          exposureKey: "discovery-retire",
        },
        {
          type: "sitemap_ping",
          risk: "safe",
          description: "Ping Google/Bing with sitemap.xml",
          exposureKey: "sitemap-ping",
        },
        {
          type: "indexnow_submit",
          risk: "safe",
          description: "Submit public Mendhaus URLs to IndexNow",
          payload: { urls },
          exposureKey: "indexnow",
        },
        {
          type: "journal_decision",
          risk: "safe",
          description: "Append a human-readable decision to the owner journal",
        },
        {
          type: "merch_optimize",
          risk: "safe",
          description: "Run autonomous merchandising (deals, focus, free shipping)",
        },
        {
          type: "activate_kit_deal",
          risk: "safe",
          description: "Activate a margin-safe kit promo + homepage banner",
        },
        {
          type: "clear_promo",
          risk: "safe",
          description: "Clear the active site/kit promo",
        },
        {
          type: "set_homepage_focus",
          risk: "safe",
          description: "Rotate featured kits on the homepage",
        },
        {
          type: "set_free_shipping_threshold",
          risk: "safe",
          description: "Tune free-shipping threshold within $49–$99",
        },
      ];
    },

    async execute(action: SafeAction): Promise<ActionResult> {
      if (action.type === "scorecard_snapshot") {
        return { ok: true, detail: "Scorecard will be saved by runCycle" };
      }

      if (action.type === "journal_decision") {
        const summary = String(action.payload?.summary ?? "RevenueOS cycle recorded.");
        await appendJournal(summary, (action.payload as Record<string, unknown>) ?? {});
        return { ok: true, detail: "Journal updated" };
      }

      if (action.type === "market_research") {
        const hour = await getLastHourPulse();
        const result = await runInternetMarketResearch({
          viewsLastHour: hour.landingViews ?? 0,
        });
        return {
          ok: result.ok,
          detail: result.detail,
          exposureKey: "internet-research",
          exposureVersion: result.state.lastResearchAt,
        };
      }

      if (action.type === "publish_intent_page") {
        const result = await publishIntentTopic();
        if (result.ok && result.topic && store.saveDiscoveryDoor) {
          await store.saveDiscoveryDoor(topicToDoor(result.topic));
        }
        return {
          ok: result.ok,
          detail: result.detail,
          exposureKey: "intent-topic",
          exposureVersion: result.topic?.publishedAt,
        };
      }

      if (action.type === "sitemap_ping") {
        return pingSitemap();
      }

      if (action.type === "discovery_attack") {
        const hour = await getLastHourPulse();
        const result = await runDiscoveryAttack({
          viewsLastHour: hour.landingViews ?? 0,
        });
        // Persist new doors into the durable ledger for the governor.
        if (result.ok && store.saveDiscoveryDoor) {
          for (const door of await listDiscoveryDoorsFromState()) {
            await store.saveDiscoveryDoor(door);
          }
        }
        return {
          ok: result.ok,
          detail: result.detail,
          exposureKey: "discovery-attack",
          exposureVersion: new Date().toISOString(),
        };
      }

      if (action.type === "retire_discovery_door") {
        const doorId = String(action.payload?.doorId ?? "");
        const reason = String(action.payload?.reason ?? "governor_kill");
        return retireTopic(doorId, reason);
      }

      if (action.type === "merch_optimize") {
        return runMerchOptimize();
      }

      if (action.type === "activate_kit_deal") {
        const open = await store.listExperiments(BRAND.siteId);
        const running = open.find(
          (exp) =>
            exp.status === "running" && exp.hypothesis.safeActionType === "activate_kit_deal",
        );
        const pattern = String(
          action.payload?.patternKey ?? running?.hypothesis.patternKey ?? "",
        );
        const fromPattern =
          KITS.find((k) => pattern.includes(k.slug) || pattern.includes(k.id))?.id ??
          KITS[Math.floor(Date.now() / 3_600_000) % KITS.length].id;
        const kitId = String(action.payload?.kitId ?? fromPattern);
        const percentOff = Number(action.payload?.percentOff ?? 12);
        return activateNamedKitDeal(kitId, percentOff);
      }

      if (action.type === "clear_promo") {
        return clearActivePromo(String(action.payload?.reason ?? "bet_clear"));
      }

      if (action.type === "set_homepage_focus") {
        const open = await store.listExperiments(BRAND.siteId);
        const running = open.find(
          (exp) =>
            exp.status === "running" && exp.hypothesis.safeActionType === "set_homepage_focus",
        );
        const focuses: MerchFocus[] = ["kitchen", "bath", "desk", "entry", "kits"];
        const hinted = String(action.payload?.focus ?? running?.hypothesis.patternKey ?? "");
        const focus = focuses.includes(action.payload?.focus as MerchFocus)
          ? (action.payload?.focus as MerchFocus)
          : (focuses.find((f) => hinted.includes(f)) ??
            focuses[Math.floor(Date.now() / 3_600_000) % focuses.length]);
        return setHomepageFocus(focus);
      }

      if (action.type === "set_free_shipping_threshold") {
        const usd = Number(action.payload?.usd ?? 69);
        return setFreeShippingThreshold(usd);
      }

      if (action.type === "indexnow_submit") {
        const host = new URL(publicBase()).host;
        const urls = await publicUrls();
        if (!INDEXNOW_KEY || host.includes("localhost")) {
          return {
            ok: false,
            detail: "IndexNow skipped — owner must set MENDHAUS_INDEXNOW_KEY and a public domain",
          };
        }
        const since = Date.now() - lastIndexNowAt;
        if (lastIndexNowAt > 0 && since < INDEXNOW_COOLDOWN_MS) {
          return {
            ok: true,
            detail: `IndexNow on cooldown (${Math.ceil((INDEXNOW_COOLDOWN_MS - since) / 1000)}s left)`,
          };
        }
        try {
          // IndexNow accepts up to 10k URLs; chunk to stay polite.
          const chunk = urls.slice(0, 200);
          const response = await fetch("https://api.indexnow.org/indexnow", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
              host,
              key: INDEXNOW_KEY,
              keyLocation: `${publicBase()}/${INDEXNOW_KEY}.txt`,
              urlList: chunk,
            }),
          });
          lastIndexNowAt = Date.now();
          await appendJournal(`IndexNow submitted (${response.status})`, {
            host,
            urls: chunk.length,
          });
          return {
            ok: response.ok || response.status === 202,
            detail: `IndexNow HTTP ${response.status} (${chunk.length} URLs)`,
            exposureKey: "indexnow",
            exposureVersion: new Date().toISOString(),
          };
        } catch (error) {
          return { ok: false, detail: `IndexNow failed: ${(error as Error).message}` };
        }
      }

      return { ok: false, detail: `Unsupported action ${action.type}` };
    },

    getExperimentStore() {
      return store;
    },

    async listDiscoveryDoors(): Promise<DiscoveryDoor[]> {
      if (store.listDiscoveryDoors) {
        const fromLedger = await store.listDiscoveryDoors(BRAND.siteId);
        if (fromLedger.length) return fromLedger;
      }
      return listDiscoveryDoorsFromState();
    },

    async measureDiscoveryDoor(door: DiscoveryDoor): Promise<DiscoveryDoorMetrics> {
      const state = await loadDiscoveryState();
      const topic = state.publishedTopics.find(
        (t) => t.doorId === door.id || t.slug === door.slug,
      );
      const metrics = await measureDiscoveryDoorMetrics({
        slug: door.slug,
        productIds: topic?.productIds ?? [],
        publishedAt: door.publishedAt,
      });
      return metrics;
    },

    async listUnavailableCapabilities() {
      return [
        {
          capability: "search_console_analytics",
          reason:
            "No GSC/Bing Search Analytics API. Governor uses on-site topic/product/cart proxies; Indexed/Impressions/Clicks remain null.",
        },
        {
          capability: "outreach_executor",
          reason: "No autonomous outreach/directory submission limb yet.",
        },
      ];
    },

    async retireDiscoveryDoor(doorId: string, reason: string): Promise<ActionResult> {
      const result = await retireTopic(doorId, reason);
      if (result.ok && store.saveDiscoveryDoor) {
        const doors = await listDiscoveryDoorsFromState();
        const door = doors.find((d) => d.id === doorId);
        if (door) {
          await store.saveDiscoveryDoor(door);
          await syncDoorScoreToTopic(door);
        }
      }
      return result;
    },
  };
}
