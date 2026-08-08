import path from "node:path";
import {
  detectBottleneck,
  buildFunnel,
  largestDrop,
  moneyFromCounts,
  type ActionResult,
  type BusinessContext,
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
import { BRAND } from "@/lib/brand";
import { appendJournal } from "@/lib/events";
import { getLastHourPulse, getWindowSnapshot } from "@/lib/metrics";
import { ownerGates } from "@/lib/readiness";
import { createDurableExperimentStore } from "@/revenueos/durable-store";
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

function publicUrls() {
  const base = publicBase();
  return [
    `${base}/`,
    `${base}/shop`,
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
    ...PRODUCTS.slice(0, 12).map((p) => `${base}/product/${p.slug}`),
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
      return [
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
            "Submit shop, category, product, and guide URLs via IndexNow every hunt cycle. Free discovery — no ads.",
          safeActionType: "indexnow_submit",
          patternKey: "indexnow-discovery",
        },
        {
          id: "mh-renter-seo",
          title: "Rank renter-friendly upgrade intent",
          metric: "organic visits → product views",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 8,
          confidence: 0.55,
          effort: 3,
          action:
            "Deepen /guides/renter-friendly-upgrades and category/renter with honest no-drill install notes. Internal-link to over-door, tension, and film SKUs.",
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
          effort: 3,
          action:
            "Keep /guides/under-sink-organizer the best honest answer (dimensions, P-trap, drip tray). Link to caddy + sponge holder.",
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
            "Publish floor-type specific copy. No miracle shed claims. Cross-sell rubber broom + lint roller.",
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
            "Bundle laptop riser + cable raceway on /guides/small-desk-setup. Publish weight ratings honestly.",
          patternKey: "acq:content_seo:desk-worker:a0",
        },
        {
          id: "mh-gsc-bing",
          title: "Search Console + Bing Webmaster for Mendhaus domain",
          metric: "indexed URLs",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 6,
          confidence: 0.5,
          effort: 2,
          action:
            "Owner: verify the live domain in GSC and Bing, submit sitemap.xml. Parallel to supplier setup.",
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
      return {
        indexCoverage: { knownUrls: publicUrls().length },
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
        demandNotes: [
          "Problem-solving home products: search intent is specific ('under sink organizer leaking bottles'). Rank honest problem pages before brand terms.",
          "US 3–7 day ETA is a conversion lever vs generic dropship 2-week China shipping.",
        ],
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

    listSafeActions(): SafeAction[] {
      return [
        {
          type: "scorecard_snapshot",
          risk: "safe",
          description: "Persist RevenueOS scorecard snapshot to the ledger",
        },
        {
          type: "indexnow_submit",
          risk: "safe",
          description: "Submit public Mendhaus URLs to IndexNow",
          payload: { urls: publicUrls() },
        },
        {
          type: "journal_decision",
          risk: "safe",
          description: "Append a human-readable decision to the owner journal",
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

      if (action.type === "indexnow_submit") {
        const host = new URL(publicBase()).host;
        if (!INDEXNOW_KEY || host.includes("localhost")) {
          return {
            ok: true,
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
          const response = await fetch("https://api.indexnow.org/indexnow", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({
              host,
              key: INDEXNOW_KEY,
              keyLocation: `${publicBase()}/${INDEXNOW_KEY}.txt`,
              urlList: publicUrls(),
            }),
          });
          lastIndexNowAt = Date.now();
          await appendJournal(`IndexNow submitted (${response.status})`, {
            host,
            urls: publicUrls().length,
          });
          return {
            ok: response.ok || response.status === 202,
            detail: `IndexNow HTTP ${response.status}`,
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
  };
}
