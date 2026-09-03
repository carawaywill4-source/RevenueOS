import type { SiteAdapter } from "./types";
import { createFileExperimentStore } from "../ledger/file-store";
import { detectBottleneck } from "../modules/conversion";
import { buildFunnel, largestDrop, moneyFromCounts } from "../modules/economics";
import type {
  ActionResult,
  BusinessContext,
  MarketSignals,
  Observation,
  SafeAction,
} from "../types";

/**
 * Portability proof: a second adapter with no TributeReady imports that still
 * satisfies SiteAdapter. Used in tests and as a template for Riley/etc.
 */
export function createExampleStaticAdapter(
  ledgerDir: string,
): SiteAdapter {
  const store = createFileExperimentStore(ledgerDir);
  const funnelSteps = [
    "landing_view",
    "signup_started",
    "checkout_started",
    "purchase_completed",
  ];

  return {
    id: "example-static",
    async getContext(): Promise<BusinessContext> {
      return {
        siteId: "example-static",
        displayName: "Example Static Shop",
        industry: "general-ecommerce",
        products: [
          {
            id: "sku_1",
            name: "Starter kit",
            priceUsd: 29,
            marginEstimate: 0.7,
          },
        ],
        funnelSteps,
        brandVoice: "plain and direct",
        allowedChannels: ["organic", "directories"],
        autonomousDailyCapUsd: 0,
        timezone: "UTC",
        constraints: ["demo-only"],
      };
    },
    async observe(): Promise<Observation> {
      const events = {
        landing_view: 12,
        signup_started: 2,
        checkout_started: 0,
        purchase_completed: 0,
      };
      const steps = buildFunnel(funnelSteps, events);
      const money = moneyFromCounts({
        purchases: 0,
        awaitingPayment: 0,
        refunded: 0,
        revenueUsd: 0,
        variableCostUsd: 0,
      });
      return {
        observedAt: new Date().toISOString(),
        money,
        funnel: {
          steps,
          largestDrop: largestDrop(steps),
          landingViews: events.landing_view,
          checkouts: events.checkout_started,
          fulfillmentFailed: 0,
        },
        bottleneck: detectBottleneck({
          purchases: 0,
          fulfillmentFailed: 0,
          landingViews: events.landing_view,
          checkouts: 0,
        }),
        openExperimentIds: [],
        errors: [],
      };
    },
    async getMarketSignals(): Promise<MarketSignals> {
      return {
        competitors: [{ name: "Incumbent Co", strength: "moderate" }],
        indexCoverage: { knownUrls: 8, indexedUrls: 1 },
        channels: [
          { channel: "organic", status: "open" },
          { channel: "marketplace", status: "owner_gate" },
        ],
        demandNotes: ["Category demand is unproven at current traffic."],
      };
    },
    listSafeActions(): SafeAction[] {
      return [
        {
          type: "scorecard_snapshot",
          risk: "safe",
          description: "Persist scorecard snapshot",
        },
      ];
    },
    async execute(action: SafeAction): Promise<ActionResult> {
      if (action.type === "scorecard_snapshot") {
        return { ok: true, detail: "example scorecard noted" };
      }
      return { ok: false, detail: `Unsupported action ${action.type}` };
    },
    getExperimentStore() {
      return store;
    },
  };
}
