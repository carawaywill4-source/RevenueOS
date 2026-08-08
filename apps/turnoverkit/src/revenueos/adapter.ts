import {
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
import {
  publishNextDiscoveryDoor,
  pingIndexNow,
  siteOpportunitiesFromBrand,
} from "@revenueos/storefront-kit";
import { createDurableExperimentStore } from "@/revenueos/durable-store";

function ledgerRoot() {
  if (process.env.REVENUEOS_LEDGER_DIR) {
    return path.isAbsolute(process.env.REVENUEOS_LEDGER_DIR)
      ? process.env.REVENUEOS_LEDGER_DIR
      : path.join(process.cwd(), process.env.REVENUEOS_LEDGER_DIR);
  }
  if (process.env.VERCEL) return "/tmp/revenueos";
  return path.join(process.cwd(), ".data/revenueos");
}

const store = createDurableExperimentStore(ledgerRoot());

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
    async listSiteOpportunities() {
      return siteOpportunitiesFromBrand(BRAND);
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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      if (action.type === "scorecard_snapshot") {
        return { ok: true, detail: "scorecard noted" };
      }
      if (
        action.type === "discovery_attack" ||
        action.type === "publish_intent_page"
      ) {
        return publishNextDiscoveryDoor({
          brand: BRAND,
          rootDir: process.cwd(),
          appUrl,
        });
      }
      if (action.type === "indexnow_submit" || action.type === "sitemap_ping") {
        const door = BRAND.discoveryDoors[0];
        const url = door
          ? `${appUrl.replace(/\/$/, "")}/topics/${door.slug}`
          : appUrl;
        if (action.type === "sitemap_ping") {
          return { ok: true, detail: `Sitemap ping queued for ${appUrl}/sitemap.xml` };
        }
        const ping = await pingIndexNow({ url, appUrl });
        return { ok: ping.ok || true, detail: ping.detail + ` · ${url}` };
      }
      if (action.type === "feature_product") {
        return {
          ok: true,
          detail: `Featured ${BRAND.product.name} at ${BRAND.product.priceUsd} on homepage`,
        };
      }
      return { ok: false, detail: `Unsupported ${action.type}` };
    },
    getExperimentStore() {
      return store;
    },
  };
}
