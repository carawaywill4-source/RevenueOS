/**
 * Portable operator adapter.
 *
 * Every app in the portfolio has its own SiteAdapter wired into a Next.js
 * runtime — great for Vercel cron, useless for a long-lived process that
 * lives outside the app. The persistent operator needs an adapter it can
 * construct anywhere given a business manifest entry, a Supabase-backed
 * ExperimentStore, and a small executor pluggable for platform actions.
 *
 * This module does NOT implement the pursuit engine or planner. It only
 * exposes a plug-compatible SiteAdapter that reads observation state from
 * the same beacon+purchase ledger the serverless form uses.
 */

import type { SiteAdapter } from "../adapters/types";
import { buildFunnel, largestDrop, moneyFromCounts } from "./economics";
import { detectBottleneck } from "./conversion";
import { summarizeBeaconEvents } from "./beacon";
import type { ExperimentStore } from "../ledger/store";
import type {
  ActionResult,
  BusinessContext,
  Observation,
  SafeAction,
} from "../types";

/**
 * Static description of a portfolio business that the operator schedules.
 * The operator ships one of these per business; the operator service holds
 * a manifest of ten and iterates over them.
 */
export type OperatorBusinessManifest = {
  siteId: string;
  displayName: string;
  industry: string;
  brandVoice: string;
  appUrl: string;
  product: {
    id: string;
    name: string;
    priceUsd: number;
    marginEstimate?: number;
    audience?: string;
  };
  businessModel?: string;
  priceBand?: string;
  considerationLevel?: string;
  timezone?: string;
  autonomousDailyCapUsd?: number;
  sequenceIndex?: number;
  /** Extra constraints (e.g. OWNER_BLOCKED_FULFILLMENT). */
  extraConstraints?: string[];
};

/**
 * Contract for executing a permissionless safe action. The operator service
 * plugs in an executor that routes platform actions (Reddit, HN, Substack)
 * to the browser sidecar via HTTP, and reports non-supported actions as
 * "delegated" so the brain learns the operator hosts a narrower set than
 * the app cron does.
 */
export type OperatorActionExecutor = (
  action: SafeAction,
  context: { businessId: string; appUrl: string },
) => Promise<ActionResult>;

const DEFAULT_ACTION_EXECUTOR: OperatorActionExecutor = async (action) => ({
  ok: false,
  detail: `operator did not execute ${action.type} — no executor registered`,
});

/**
 * Purchase snapshot for a business. In production the operator queries
 * Stripe or the portfolio's purchases table; the manifest just wires in a
 * function so tests can inject stubs.
 */
export type OperatorPurchaseStats = {
  purchases: number;
  revenueUsd: number;
};

export type OperatorPurchaseSource = (
  input: { businessId: string },
) => Promise<OperatorPurchaseStats>;

const DEFAULT_PURCHASE_SOURCE: OperatorPurchaseSource = async () => ({
  purchases: 0,
  revenueUsd: 0,
});

export type OperatorSafeActionSource = () => SafeAction[];

const DEFAULT_SAFE_ACTIONS: OperatorSafeActionSource = () => [];

/**
 * Build a portable SiteAdapter suitable for the operator service. The
 * adapter reads observation state from the same beacon+purchase ledger as
 * the serverless form, and delegates action execution to the injected
 * executor (which typically routes to the browser sidecar).
 */
export function createOperatorAdapter(input: {
  manifest: OperatorBusinessManifest;
  store: ExperimentStore;
  executor?: OperatorActionExecutor;
  purchaseSource?: OperatorPurchaseSource;
  safeActionSource?: OperatorSafeActionSource;
  /** Observation window in ms, defaults to the last hour of beacon events. */
  observationWindowMs?: number;
}): SiteAdapter {
  const {
    manifest,
    store,
    executor = DEFAULT_ACTION_EXECUTOR,
    purchaseSource = DEFAULT_PURCHASE_SOURCE,
    safeActionSource = DEFAULT_SAFE_ACTIONS,
    observationWindowMs = 3_600_000,
  } = input;

  return {
    id: manifest.siteId,
    async getContext(): Promise<BusinessContext> {
      return {
        siteId: manifest.siteId,
        displayName: manifest.displayName,
        industry: manifest.industry,
        products: [
          {
            id: manifest.product.id,
            name: manifest.product.name,
            priceUsd: manifest.product.priceUsd,
            marginEstimate: manifest.product.marginEstimate ?? 0.9,
          },
        ],
        funnelSteps: ["landing_view", "checkout_started", "purchase_completed"],
        brandVoice: manifest.brandVoice,
        allowedChannels: ["organic", "owned_property", "public_indexes"],
        autonomousDailyCapUsd: manifest.autonomousDailyCapUsd ?? 0,
        timezone: manifest.timezone ?? "UTC",
        constraints: [
          "permissionless_organic_default",
          "no_third_party_account_login",
          ...(manifest.extraConstraints ?? []),
        ],
        commercial: {
          businessModel: manifest.businessModel ?? "digital_product",
          industry: manifest.industry,
          audience: manifest.product.audience,
          priceBand: manifest.priceBand,
          considerationLevel: manifest.considerationLevel,
          productId: manifest.product.id,
          priceUsd: manifest.product.priceUsd,
          marginEstimate: manifest.product.marginEstimate ?? 0.9,
        },
        portfolioSequenceIndex: manifest.sequenceIndex,
      };
    },
    async observe(): Promise<Observation> {
      const stats = await purchaseSource({ businessId: manifest.siteId }).catch(
        () => ({ purchases: 0, revenueUsd: 0 }),
      );
      const fees = stats.revenueUsd * 0.029 + stats.purchases * 0.3;
      const profit = Math.max(0, stats.revenueUsd - fees);

      let beaconViews = 0;
      let beaconIntents = 0;
      try {
        if (store.listPursuitEvents) {
          const since = new Date(
            Date.now() - observationWindowMs,
          ).toISOString();
          const events = await store.listPursuitEvents(manifest.siteId, {
            since,
            limit: 500,
          });
          const summary = summarizeBeaconEvents(events);
          beaconViews = summary.verifiedExposures;
          beaconIntents = summary.intents;
        }
      } catch {
        // Beacon read failures don't sink the tick — the brain still runs.
      }

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
        errors: [],
      };
    },
    listSafeActions(): SafeAction[] {
      return safeActionSource();
    },
    async execute(action: SafeAction): Promise<ActionResult> {
      return executor(action, {
        businessId: manifest.siteId,
        appUrl: manifest.appUrl,
      });
    },
    getExperimentStore() {
      return store;
    },
  };
}
