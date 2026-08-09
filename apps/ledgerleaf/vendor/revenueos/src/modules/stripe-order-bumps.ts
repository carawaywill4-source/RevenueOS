/**
 * Stripe order-bump upsell composer.
 *
 * Given a Checkout Session's line items and a catalog of related products,
 * this returns an augmented `line_items` array with one order bump appended.
 * The bump is presented as a low-priced, high-relevance addition — never a
 * price-changer to the primary product.
 *
 * NO direct Stripe API calls happen here. The caller (app-level checkout
 * handler) is responsible for actually creating the session. This module
 * just picks the bump and formats the payload.
 *
 * Config lives in `.data/stripe-order-bumps/<siteId>.json`:
 *   {
 *     "enabled": true,
 *     "primaryPriceId": "price_...",
 *     "bumpPriceId": "price_...",
 *     "bumpLabel": "Add coaching (15 min)",
 *     "cooldownMinutes": 10080
 *   }
 *
 * `executeStripeOrderBumpDeploy` writes the config for a site so the checkout
 * handler can read it. Idempotent.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StripeOrderBumpConfig = {
  enabled: boolean;
  primaryPriceId?: string;
  bumpPriceId?: string;
  bumpLabel?: string;
  bumpPriceUsd?: number;
  bumpDescription?: string;
  version: string;
  updatedAt: string;
};

const CONFIG_VERSION = "1.0.0";

function configFile(rootDir: string, siteId: string): string {
  return path.join(rootDir, ".data", "stripe-order-bumps", `${siteId}.json`);
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(p: string, data: unknown) {
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(data, null, 2));
}

export async function loadStripeOrderBumpConfig(input: {
  rootDir: string;
  siteId: string;
}): Promise<StripeOrderBumpConfig | null> {
  const file = configFile(input.rootDir, input.siteId);
  return readJson<StripeOrderBumpConfig | null>(file, null);
}

type StripeLineItem = {
  price?: string;
  price_data?: Record<string, unknown>;
  quantity?: number;
  adjustable_quantity?: Record<string, unknown>;
};

/**
 * Given a proposed line_items list, append the configured order bump (if any).
 * Idempotent — if the bump price is already present, returns line_items
 * unchanged.
 */
export function withStripeOrderBump(input: {
  lineItems: StripeLineItem[];
  config: StripeOrderBumpConfig | null;
}): StripeLineItem[] {
  const cfg = input.config;
  if (!cfg || !cfg.enabled) return input.lineItems;
  if (!cfg.bumpPriceId && !cfg.bumpPriceUsd) return input.lineItems;
  if (cfg.bumpPriceId) {
    if (input.lineItems.some((li) => li.price === cfg.bumpPriceId)) {
      return input.lineItems;
    }
    return [
      ...input.lineItems,
      { price: cfg.bumpPriceId, quantity: 1 },
    ];
  }
  const priceCents = Math.max(50, Math.round((cfg.bumpPriceUsd ?? 0) * 100));
  return [
    ...input.lineItems,
    {
      price_data: {
        currency: "usd",
        unit_amount: priceCents,
        product_data: {
          name: cfg.bumpLabel ?? "Add-on",
          description: cfg.bumpDescription ?? "",
        },
      },
      quantity: 1,
      adjustable_quantity: { enabled: false },
    },
  ];
}

export type StripeOrderBumpDeployInput = {
  rootDir: string;
  siteId: string;
  bumpPriceId?: string;
  bumpPriceUsd?: number;
  bumpLabel: string;
  bumpDescription?: string;
  primaryPriceId?: string;
  now?: Date;
};

/**
 * Write the order-bump config for a site. Idempotent — if the config is
 * unchanged, the file's `updatedAt` is refreshed but nothing else moves.
 * Returns { changed: boolean }.
 */
export async function executeStripeOrderBumpDeploy(
  input: StripeOrderBumpDeployInput,
): Promise<
  | {
      ok: true;
      detail: string;
      url?: string;
      config: StripeOrderBumpConfig;
      changed: boolean;
    }
  | { ok: false; detail: string }
> {
  if (!input.bumpPriceId && !input.bumpPriceUsd) {
    return {
      ok: false,
      detail:
        "stripe_order_bump_deploy: needs either bumpPriceId (existing Stripe price) or bumpPriceUsd (inline price_data)",
    };
  }
  const now = input.now ?? new Date();
  const next: StripeOrderBumpConfig = {
    enabled: true,
    primaryPriceId: input.primaryPriceId,
    bumpPriceId: input.bumpPriceId,
    bumpPriceUsd: input.bumpPriceUsd,
    bumpLabel: input.bumpLabel,
    bumpDescription: input.bumpDescription,
    version: CONFIG_VERSION,
    updatedAt: now.toISOString(),
  };
  const file = configFile(input.rootDir, input.siteId);
  const prev = await readJson<StripeOrderBumpConfig | null>(file, null);
  const same =
    !!prev &&
    prev.enabled === next.enabled &&
    prev.primaryPriceId === next.primaryPriceId &&
    prev.bumpPriceId === next.bumpPriceId &&
    prev.bumpPriceUsd === next.bumpPriceUsd &&
    prev.bumpLabel === next.bumpLabel &&
    prev.bumpDescription === next.bumpDescription &&
    prev.version === next.version;
  await writeJson(file, next);
  return {
    ok: true,
    detail: same
      ? `stripe_order_bump_deploy: config unchanged for ${input.siteId} (v${CONFIG_VERSION})`
      : `stripe_order_bump_deploy: activated "${input.bumpLabel}" for ${input.siteId} (v${CONFIG_VERSION})`,
    url: file,
    config: next,
    changed: !same,
  };
}
