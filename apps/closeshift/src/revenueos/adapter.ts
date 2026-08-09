import {
  detectBottleneck,
  buildFunnel,
  largestDrop,
  moneyFromCounts,
  summarizeBeaconEvents,
  type SiteAdapter,
  type SafeAction,
} from "@revenueos/core";
import path from "node:path";
import { BRAND } from "@/lib/brand";
import { purchaseStats } from "@/lib/purchases";
import { checkoutAllowed } from "@/lib/readiness";
import {
  executePermissionlessAction,
  listPermissionlessSafeActions,
  permissionlessOpportunities,
} from "@revenueos/storefront-kit";
import { createDurableExperimentStore } from "@/revenueos/durable-store";

function ledgerRoot() {
  if (process.env.REVENUEOS_LEDGER_DIR) {
    return path.isAbsolute(process.env.REVENUEOS_LEDGER_DIR)
      ? process.env.REVENUEOS_LEDGER_DIR
      : path.join(/*turbopackIgnore: true*/ process.cwd(), process.env.REVENUEOS_LEDGER_DIR);
  }
  if (process.env.VERCEL) return "/tmp/revenueos";
  return path.join(/*turbopackIgnore: true*/ process.cwd(), ".data/revenueos");
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
        allowedChannels: ["organic", "owned_property", "public_indexes"],
        autonomousDailyCapUsd: 0,
        timezone: "UTC",
        constraints: checkoutAllowed()
          ? [
              "permissionless_organic_default",
              "no_third_party_account_login",
            ]
          : ["OWNER_BLOCKED_FULFILLMENT"],
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
      // Read real signal from the first-party beacon ledger. If the beacon has
      // recorded page_view / cta_click / checkout_start events, those are
      // authoritative — no fabrication.
      let beaconViews = 0;
      let beaconIntents = 0;
      try {
        if (store.listPursuitEvents) {
          const windowStart = new Date(Date.now() - 3_600_000).toISOString();
          const beaconEvents = await store.listPursuitEvents(BRAND.siteId, {
            since: windowStart,
            limit: 500,
          });
          const summary = summarizeBeaconEvents(beaconEvents);
          beaconViews = summary.verifiedExposures;
          beaconIntents = summary.intents;
        }
      } catch {}
      const events = {
        landing_view: beaconViews,
        checkout_started: beaconIntents,
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
      return permissionlessOpportunities(BRAND);
    },
    listSafeActions(): SafeAction[] {
      return listPermissionlessSafeActions();
    },
    async execute(action) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      return executePermissionlessAction({
        brand: BRAND,
        rootDir: process.cwd(),
        appUrl,
        actionType: action.type,
      });
    },
    getExperimentStore() {
      return store;
    },
  };
}
