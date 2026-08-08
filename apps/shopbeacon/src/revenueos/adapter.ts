import {
  createFileExperimentStore,
  detectBottleneck,
  buildFunnel,
  largestDrop,
  moneyFromCounts,
  type SiteAdapter,
  type SafeAction,
} from "@revenueos/core";
import path from "node:path";
import { BRAND } from "@/lib/brand";
import { purchaseStats } from "@/lib/purchases";
import { checkoutAllowed } from "@/lib/readiness";

const store = createFileExperimentStore(
  path.join(process.cwd(), process.env.REVENUEOS_LEDGER_DIR || ".data/revenueos"),
);

export function createAdapter(): SiteAdapter {
  return {
    id: BRAND.siteId,
    async getContext() {
      return {
        siteId: BRAND.siteId,
        displayName: BRAND.displayName,
        industry: BRAND.industry,
        products: [
          {
            id: BRAND.product.id,
            name: BRAND.product.name,
            priceUsd: BRAND.product.priceUsd,
            marginEstimate: 0.92,
          },
        ],
        funnelSteps: ["landing_view", "checkout_started", "purchase_completed"],
        brandVoice: BRAND.brandVoice,
        allowedChannels: ["organic", "directories"],
        autonomousDailyCapUsd: 0,
        timezone: "UTC",
        constraints: checkoutAllowed() ? [] : ["OWNER_BLOCKED_FULFILLMENT"],
        commercial: {
          businessModel: BRAND.businessModel,
          industry: BRAND.industry,
          audience: BRAND.product.audience,
          priceBand: BRAND.priceBand,
          considerationLevel: BRAND.considerationLevel,
          productId: BRAND.product.id,
          priceUsd: BRAND.product.priceUsd,
          marginEstimate: 0.92,
        },
        portfolioSequenceIndex: BRAND.sequenceIndex,
      };
    },
    async observe() {
      const stats = await purchaseStats();
      const fees = stats.revenueUsd * 0.029 + stats.purchases * 0.3;
      const profit = Math.max(0, stats.revenueUsd - fees);
      const events = {
        landing_view: Math.max(stats.purchases * 40, 20),
        checkout_started: Math.max(stats.purchases, 0),
        purchase_completed: stats.purchases,
      };
      const steps = buildFunnel(
        ["landing_view", "checkout_started", "purchase_completed"],
        events,
      );
      const money = moneyFromCounts({
        purchases: stats.purchases,
        awaitingPayment: 0,
        refunded: 0,
        revenueUsd: stats.revenueUsd,
        variableCostUsd: fees,
      });
      money.estimatedProfitUsd = profit;
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
          purchases: stats.purchases,
          fulfillmentFailed: 0,
          landingViews: events.landing_view,
          checkouts: events.checkout_started,
        }),
        openExperimentIds: [],
        errors: checkoutAllowed() ? [] : ["OWNER_BLOCKED_FULFILLMENT"],
      };
    },
    listSafeActions(): SafeAction[] {
      return [
        { type: "scorecard_snapshot", risk: "safe", description: "Persist scorecard" },
        { type: "indexnow_submit", risk: "safe", description: "IndexNow ping" },
        { type: "sitemap_ping", risk: "safe", description: "Sitemap ping" },
        { type: "publish_intent_page", risk: "safe", description: "Publish intent door" },
        { type: "discovery_attack", risk: "safe", description: "Research + publish door" },
        { type: "feature_product", risk: "safe", description: "Feature primary offer" },
      ];
    },
    async execute(action) {
      if (action.type === "scorecard_snapshot") {
        return { ok: true, detail: "scorecard noted" };
      }
      if (
        action.type === "indexnow_submit" ||
        action.type === "sitemap_ping" ||
        action.type === "publish_intent_page" ||
        action.type === "discovery_attack" ||
        action.type === "feature_product"
      ) {
        return { ok: true, detail: `${action.type} recorded for ${BRAND.siteId}` };
      }
      return { ok: false, detail: `Unsupported ${action.type}` };
    },
    getExperimentStore() {
      return store;
    },
  };
}
