import path from "node:path";
import {
  detectBottleneck,
  buildFunnel,
  largestDrop,
  moneyFromCounts,
  estimateVariableCost,
  type ActionResult,
  type BusinessContext,
  type DiscoveryDoor,
  type MarketSignals,
  type Observation,
  type PrecursorMetric,
  type SafeAction,
  type SeedLesson,
  type SiteAdapter,
} from "@revenueos/core";
import {
  listCatalogDoors,
  measureTributeDiscoveryDoor,
  mergeDiscoveryDoors,
  nextDoorToActivate,
  pingTributeSitemap,
} from "@/lib/discovery";
import { getAggregateGrowthReport, getLastHourPulse } from "@/lib/growth";
import { readSearchConsoleCoverage } from "@/lib/search-console";
import { TRIBUTEREADY_SEED_LESSONS } from "@/revenueos/seeds";
import { createDurableExperimentStore } from "@/revenueos/durable-store";
import { planOpportunityDecision } from "@/revenueos/ai-planner";

const FUNNEL_STEPS = [
  "landing_view",
  "builder_started",
  "draft_generated",
  "checkout_started",
  "purchase_completed",
  "fulfillment_completed",
  "pdf_downloaded",
];

const PRICE_USD = 34.99;
const INDEXNOW_KEY = "4f8c2d91a6b34e70bd45e9a8312c5f76";
/** Continuous hunt runs often — don't spam IndexNow more than this often. */
const INDEXNOW_COOLDOWN_MS = 10 * 60 * 1000;
let lastIndexNowAt = 0;

const PUBLIC_URLS = [
  "https://tributeready.org/",
  "https://tributeready.org/funeral-program-maker",
  "https://tributeready.org/obituary-writer",
  "https://tributeready.org/celebration-of-life-program",
  "https://tributeready.org/funeral-program-cost",
  "https://tributeready.org/funeral-program-examples",
  "https://tributeready.org/funeral-program-template-word",
  "https://tributeready.org/funeral-program-google-docs",
  "https://tributeready.org/funeral-pamphlet-template",
  "https://tributeready.org/order-of-service-templates",
  "https://tributeready.org/obituary-templates",
  "https://tributeready.org/eulogy-examples",
  "https://tributeready.org/funeral-readings",
  "https://tributeready.org/resources",
  "https://tributeready.org/resources/obituary-family-order",
  "https://tributeready.org/where-to-print-funeral-programs",
  "https://tributeready.org/funeral-poem-copyright",
  "https://tributeready.org/partners",
  "https://tributeready.org/llms.txt",
];

function ledgerRoot() {
  if (process.env.REVENUEOS_LEDGER_DIR) return process.env.REVENUEOS_LEDGER_DIR;
  // Vercel serverless filesystem is read-only except /tmp.
  if (process.env.VERCEL) return path.join("/tmp", "revenueos");
  return path.join(process.cwd(), "data", "revenueos");
}

function count(
  events: Partial<Record<string, number>> | undefined,
  name: string,
) {
  return Number(events?.[name] ?? 0);
}

export function createTributeReadyAdapter(): SiteAdapter {
  const store = createDurableExperimentStore(ledgerRoot());

  return {
    id: "tributeready",
    planDecision: planOpportunityDecision,

    async getContext(): Promise<BusinessContext> {
      return {
        siteId: "tributeready",
        displayName: "TributeReady",
        industry: "death-care",
        products: [
          {
            id: "memorial-collection",
            name: "Memorial collection",
            priceUsd: PRICE_USD,
            marginEstimate: 0.96,
          },
        ],
        funnelSteps: FUNNEL_STEPS,
        brandVoice:
          "Warm, restrained, dignified. No fake scarcity, no guilt, no fabricated reviews.",
        allowedChannels: [
          "organic",
          "directories",
          "editorial",
          "marketplace_owner",
        ],
        autonomousDailyCapUsd: Number(
          process.env.MAX_AUTONOMOUS_DAILY_COST_USD ?? "3",
        ),
        timezone: "America/Denver",
        constraints: [
          "No invasive targeting of grieving individuals",
          "Commercial email requires postal address",
        ],
        audienceSegments: [
          {
            id: "urgent-need",
            label: "Family planning a service this week",
            traits: ["grieving", "time-pressed", "wants dignity without hassle"],
            habits: [
              "searches 'funeral program template' on a tight deadline",
              "needs a printable result today",
            ],
            channels: ["organic_search", "marketplaces", "directories"],
            triggers: ["a service date days away", "a ready-to-print result"],
            objections: ["will it look dignified?", "can I finish it tonight?"],
            messagingAngles: [
              "A dignified, printable program in minutes",
              "Ready for the funeral home or your home printer",
            ],
            intentTemperature: "hot",
          },
          {
            id: "delegator",
            label: "Funeral home / celebrant helping families",
            traits: ["professional", "repeat need", "values reliability"],
            habits: ["reuses trusted tools", "prints in volume"],
            channels: ["partnerships", "directories", "outreach_pr", "referral"],
            triggers: ["a tool that saves staff time", "consistent print quality"],
            objections: ["is it reliable for every family?"],
            messagingAngles: [
              "Help every family with a polished program, fast",
              "Reliable, print-ready output your staff can trust",
            ],
            intentTemperature: "warm",
          },
          {
            id: "researcher",
            label: "Planner comparing DIY options",
            traits: ["cost-aware", "reads examples", "cautious"],
            habits: ["compares templates and prices", "reads how-to guides first"],
            channels: ["organic_search", "content_seo", "communities"],
            triggers: ["clear examples", "transparent one-time price"],
            objections: ["is it worth paying vs free Word templates?"],
            messagingAngles: [
              "See real examples before you commit",
              "One fair price, no subscription",
            ],
            intentTemperature: "warm",
          },
        ],
      };
    },

    async observe(): Promise<Observation> {
      const [today, d7, d28, d90, hourPulse] = await Promise.all([
        getAggregateGrowthReport(1),
        getAggregateGrowthReport(7),
        getAggregateGrowthReport(28),
        getAggregateGrowthReport(90),
        getLastHourPulse(PRICE_USD),
      ]);

      const events =
        (d7 as { events?: { byName?: Partial<Record<string, number>> } }).events
          ?.byName ?? {};
      const orders =
        (d7 as { orders?: { byStatus?: Partial<Record<string, number>>; grossRevenueUsd?: number } })
          .orders?.byStatus ?? {};
      const purchases = count(orders, "fulfilled");
      const revenueUsd = Number(
        (d7 as { orders?: { grossRevenueUsd?: number } }).orders
          ?.grossRevenueUsd ?? purchases * PRICE_USD,
      );
      const drafts = count(events, "draft_generated");
      const variableCostUsd = estimateVariableCost({
        purchases,
        priceUsd: PRICE_USD,
        draftCount: drafts,
      });
      const steps = buildFunnel(FUNNEL_STEPS, events);
      const open = await store.listExperiments("tributeready");

      return {
        observedAt: new Date().toISOString(),
        money: moneyFromCounts({
          purchases,
          awaitingPayment: count(orders, "awaiting_payment"),
          refunded: count(orders, "refunded"),
          revenueUsd,
          variableCostUsd,
        }),
        funnel: {
          steps,
          largestDrop: largestDrop(steps),
          landingViews: count(events, "landing_view"),
          checkouts: count(events, "checkout_started"),
          fulfillmentFailed: count(events, "fulfillment_failed"),
        },
        bottleneck: detectBottleneck({
          purchases,
          fulfillmentFailed: count(events, "fulfillment_failed"),
          landingViews: count(events, "landing_view"),
          checkouts: count(events, "checkout_started"),
        }),
        rawWindows: { today, d7, d28, d90, hour: hourPulse },
        hourPulse,
        openExperimentIds: open
          .filter((item) => item.status === "running" || item.status === "proposed")
          .map((item) => item.id),
        errors: [],
      };
    },

    async listSiteOpportunities() {
      // Ever Loved is ONE channel. Never treat it as the plan. Keep a full
      // portfolio of open acquisition/conversion levers so money-hunting never
      // pauses while any single marketplace is pending approval.
      return [
        {
          id: "index-discovery-always",
          title: "Keep public URLs freshly discoverable (IndexNow)",
          metric: "indexed URLs / landing views",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 7,
          confidence: 0.55,
          effort: 1,
          action:
            "Submit the full public URL set via IndexNow every hunt cycle. Account-free discovery — do not wait on any marketplace.",
          safeActionType: "indexnow_submit",
          patternKey: "indexnow-discovery",
        },
        {
          id: "activate-discovery-door",
          title: "Put next high-intent page under discovery governor",
          metric: "active discovery doors",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 8,
          confidence: 0.55,
          effort: 1,
          action:
            "Activate the next static SEO page as a managed discovery door, IndexNow its URL, and start measuring landing_view.page attribution.",
          safeActionType: "publish_intent_page",
          patternKey: "acq:organic_search:urgent-need:a0",
        },
        {
          id: "discovery-attack-catalog",
          title: "Run discovery attack across SEO catalog",
          metric: "doors scored / landing views",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 7,
          confidence: 0.5,
          effort: 2,
          action:
            "Ensure catalog doors are registered, ping sitemap, and IndexNow the public URL set so the governor can kill/expand from real visits.",
          safeActionType: "discovery_attack",
          patternKey: "discovery-attack",
        },
        {
          id: "sitemap-ping",
          title: "Ping Google/Bing with sitemap.xml",
          metric: "crawl freshness",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 5,
          confidence: 0.45,
          effort: 1,
          action: "Notify Google and Bing sitemap endpoints (crawlability — not directory submission).",
          safeActionType: "sitemap_ping",
          patternKey: "sitemap-ping",
        },
        {
          id: "free-directories",
          title: "Submit to account-free directories & indexes",
          metric: "referral landing views",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 6,
          confidence: 0.45,
          effort: 1,
          action:
            "Owner: pursue reputable free/structured listings. Advisory until outreach_executor exists — not a sitemap ping.",
          patternKey: "acq:directories:urgent-need:a0",
        },
        {
          id: "gsc-bing-coverage",
          title: "Search Console + Bing Webmaster coverage",
          metric: "indexed URLs",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 6,
          confidence: 0.5,
          effort: 2,
          action:
            "Owner: verify tributeready.org in Google Search Console and Bing Webmaster, submit sitemap, connect API credentials so Indexed/Impressions/Clicks stop being null.",
          patternKey: "search-console-coverage",
        },
        {
          id: "partner-funeral-adjacent",
          title: "Complementary death-care partnerships",
          metric: "referred visits",
          category: "acquisition" as const,
          precursorMetric: "landing_views" as const,
          expectedImpact: 6,
          confidence: 0.4,
          effort: 3,
          action:
            "Owner: reach non-competing services families already use (print shops, celebrants, florists) with a truthful, helpful cross-referral — never spam.",
          patternKey: "acq:partnerships:delegator:a0",
        },
        {
          id: "everloved",
          title: "Ever Loved marketplace listing (one channel)",
          metric: "marketplace-attributed purchases",
          category: "acquisition" as const,
          precursorMetric: "purchases" as const,
          expectedImpact: 5,
          confidence: 0.55,
          effort: 2,
          action:
            "Owner: finish Ever Loved vendor listing when verified. Useful buyer intent — but only one channel. Do not pause IndexNow, SEO, directories, or other open plays while it pending.",
          patternKey: "marketplace-listing-requires-owner",
        },
      ];
    },

    async getMarketSignals(): Promise<MarketSignals> {
      const coverage = await readSearchConsoleCoverage();
      return {
        indexCoverage: {
          knownUrls: PUBLIC_URLS.length,
          ...(coverage.indexedUrls != null
            ? { indexedUrls: coverage.indexedUrls }
            : {}),
        },
        channels: [
          { channel: "organic", status: "open" },
          { channel: "directories", status: "open" },
          { channel: "editorial", status: "open" },
          { channel: "content_seo", status: "open" },
          {
            channel: "marketplace",
            status: "owner_gate",
            note: "Ever Loved is one owner-gated channel among many open ones — hunt the open set continuously.",
          },
        ],
        demandNotes: [
          "Young domain with thin indexation; qualified organic traffic is a binding constraint — attack it every cycle, never wait on marketplace approval.",
        ],
      };
    },

    async getMeasurement(metric: PrecursorMetric): Promise<number | null> {
      const d7 = await getAggregateGrowthReport(7);
      const events =
        (d7 as { events?: { byName?: Partial<Record<string, number>> } }).events
          ?.byName ?? {};
      const orders =
        (d7 as { orders?: { byStatus?: Partial<Record<string, number>>; grossRevenueUsd?: number } })
          .orders ?? {};
      const byStatus = orders.byStatus ?? {};
      const purchases = count(byStatus, "fulfilled");
      const revenueUsd = Number(orders.grossRevenueUsd ?? purchases * PRICE_USD);
      const drafts = count(events, "draft_generated");
      const variableCostUsd = estimateVariableCost({
        purchases,
        priceUsd: PRICE_USD,
        draftCount: drafts,
      });
      switch (metric) {
        case "purchases":
          return purchases;
        case "revenue":
          return revenueUsd;
        case "contribution_profit":
          return Number((revenueUsd - variableCostUsd).toFixed(2));
        case "checkout_started":
          return count(events, "checkout_started");
        case "product_started":
          return count(events, "builder_started");
        case "landing_views":
          return count(events, "landing_view");
        case "fulfillment_reliability":
          return count(events, "fulfillment_failed") === 0 ? 1 : 0;
        default:
          return null;
      }
    },

    getSeedLessons(): SeedLesson[] {
      return TRIBUTEREADY_SEED_LESSONS;
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
          description: "Submit public TributeReady URLs to IndexNow",
          payload: { urls: PUBLIC_URLS },
        },
        {
          type: "email_daily_review",
          risk: "safe",
          description: "Email the cycle report to care@",
        },
        {
          type: "sitemap_ping",
          risk: "safe",
          description: "Ping Google/Bing with sitemap.xml",
        },
        {
          type: "publish_intent_page",
          risk: "safe",
          description:
            "Activate next static SEO page as a managed discovery door under the governor",
        },
        {
          type: "discovery_attack",
          risk: "safe",
          description: "Register catalog doors + sitemap ping + IndexNow",
        },
        {
          type: "retire_discovery_door",
          risk: "safe",
          description: "Retire a killed discovery door from active investment",
        },
      ];
    },

    async listDiscoveryDoors(): Promise<DiscoveryDoor[]> {
      const ledger = store.listDiscoveryDoors
        ? await store.listDiscoveryDoors("tributeready")
        : [];
      const merged = mergeDiscoveryDoors(ledger);
      // Persist catalog doors once so governor scores compound.
      if (store.saveDiscoveryDoor && ledger.length < merged.length) {
        for (const door of merged) {
          if (!ledger.some((d) => d.id === door.id)) {
            await store.saveDiscoveryDoor(door);
          }
        }
      }
      return merged;
    },

    async measureDiscoveryDoor(door: DiscoveryDoor) {
      return measureTributeDiscoveryDoor(door);
    },

    async retireDiscoveryDoor(doorId: string, reason: string) {
      const doors = store.listDiscoveryDoors
        ? await store.listDiscoveryDoors("tributeready")
        : [];
      const door = doors.find((d) => d.id === doorId);
      if (!door) {
        return { ok: false, detail: `Door ${doorId} not found` };
      }
      const retired: DiscoveryDoor = {
        ...door,
        status: "killed",
        killedAt: new Date().toISOString(),
        killReason: reason,
      };
      if (store.saveDiscoveryDoor) await store.saveDiscoveryDoor(retired);
      return { ok: true, detail: `Retired ${door.slug}: ${reason}` };
    },

    async execute(action: SafeAction): Promise<ActionResult> {
      if (action.type === "scorecard_snapshot") {
        return { ok: true, detail: "Scorecard will be saved by runCycle" };
      }

      if (action.type === "indexnow_submit") {
        return submitIndexNow(
          Array.isArray(action.payload?.urls)
            ? (action.payload.urls as string[])
            : PUBLIC_URLS,
        );
      }

      if (action.type === "email_daily_review") {
        return { ok: true, detail: "Deferred to cron mailer" };
      }

      if (action.type === "sitemap_ping") {
        return pingTributeSitemap();
      }

      if (action.type === "publish_intent_page") {
        const existing = store.listDiscoveryDoors
          ? await store.listDiscoveryDoors("tributeready")
          : [];
        const next = nextDoorToActivate(existing);
        if (!next) {
          return {
            ok: true,
            detail: "All catalog discovery doors already active or killed",
          };
        }
        if (store.saveDiscoveryDoor) await store.saveDiscoveryDoor(next);
        const index = await submitIndexNow([next.url]);
        return {
          ok: true,
          detail: `Activated door ${next.slug}; ${index.detail}`,
        };
      }

      if (action.type === "discovery_attack") {
        const catalog = listCatalogDoors();
        const existing = store.listDiscoveryDoors
          ? await store.listDiscoveryDoors("tributeready")
          : [];
        const existingIds = new Set(existing.map((d) => d.id));
        if (store.saveDiscoveryDoor) {
          for (const door of catalog) {
            if (!existingIds.has(door.id)) await store.saveDiscoveryDoor(door);
          }
        }
        const ping = await pingTributeSitemap();
        const index = await submitIndexNow(PUBLIC_URLS);
        return {
          ok: ping.ok || index.ok,
          detail: `Catalog doors ensured (${catalog.length}). ${ping.detail}. ${index.detail}`,
        };
      }

      if (action.type === "retire_discovery_door") {
        const doorId = String(action.payload?.doorId ?? "");
        const reason = String(action.payload?.reason ?? "governor retire");
        if (!doorId) return { ok: false, detail: "Missing doorId" };
        const doors = store.listDiscoveryDoors
          ? await store.listDiscoveryDoors("tributeready")
          : [];
        const door = doors.find((d) => d.id === doorId);
        if (!door) return { ok: false, detail: `Door ${doorId} not found` };
        const retired: DiscoveryDoor = {
          ...door,
          status: "killed",
          killedAt: new Date().toISOString(),
          killReason: reason,
        };
        if (store.saveDiscoveryDoor) await store.saveDiscoveryDoor(retired);
        return { ok: true, detail: `Retired ${door.slug}: ${reason}` };
      }

      return { ok: false, detail: `Unsupported action ${action.type}` };
    },

    async listUnavailableCapabilities() {
      return [
        {
          capability: "search_console_analytics",
          reason:
            "GSC/Bing Search Analytics API not connected. Door Indexed/Impressions/Clicks stay null; governor uses landing_view.page proxies.",
        },
        {
          capability: "outreach_executor",
          reason: "Directories/outreach plays are advisory until an executor limb exists.",
        },
      ];
    },

    getExperimentStore() {
      return store;
    },
  };
}

async function submitIndexNow(urls: string[]): Promise<ActionResult> {
  const since = Date.now() - lastIndexNowAt;
  if (lastIndexNowAt > 0 && since < INDEXNOW_COOLDOWN_MS) {
    return {
      ok: true,
      detail: `IndexNow on cooldown (${Math.ceil((INDEXNOW_COOLDOWN_MS - since) / 1000)}s left) — brain still hunting other levers`,
    };
  }
  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: "tributeready.org",
        key: INDEXNOW_KEY,
        keyLocation: `https://tributeready.org/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    lastIndexNowAt = Date.now();
    return {
      ok: response.ok || response.status === 202,
      detail: `IndexNow HTTP ${response.status} (${urls.length} urls)`,
    };
  } catch (error) {
    return {
      ok: false,
      detail: `IndexNow failed: ${(error as Error).message}`,
    };
  }
}
