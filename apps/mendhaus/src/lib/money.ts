import { FREE_SHIPPING_AT_USD, SHIPPING_FLAT_USD, STRIPE_FIXED_USD, STRIPE_PERCENT } from "./brand";
import type { Product } from "@/catalog/products";

export type CartLine = {
  productId: string;
  quantity: number;
};

export function stripeFeeUsd(amountUsd: number) {
  return Number((amountUsd * STRIPE_PERCENT + STRIPE_FIXED_USD).toFixed(2));
}

export function shippingUsd(subtotalUsd: number) {
  return subtotalUsd >= FREE_SHIPPING_AT_USD ? 0 : SHIPPING_FLAT_USD;
}

export function quoteCart(lines: Array<CartLine & { product: Product }>) {
  const subtotal = Number(
    lines.reduce((sum, line) => sum + line.product.priceUsd * line.quantity, 0).toFixed(2),
  );
  const shipping = shippingUsd(subtotal);
  const tax = 0; // Stripe Tax after owner registers — do not fake collection.
  const gross = Number((subtotal + shipping + tax).toFixed(2));
  const cogs = Number(
    lines.reduce((sum, line) => sum + line.product.cogsUsd * line.quantity, 0).toFixed(2),
  );
  const shipCost = Number(
    lines.reduce((sum, line) => sum + line.product.shippingCostUsd * line.quantity, 0).toFixed(2),
  );
  const fulfill = Number(
    lines.reduce((sum, line) => sum + line.product.fulfillmentFeeUsd * line.quantity, 0).toFixed(2),
  );
  const fee = stripeFeeUsd(gross);
  const estimatedProfit = Number((gross - cogs - shipCost - fulfill - fee - tax).toFixed(2));
  return {
    subtotalUsd: subtotal,
    shippingUsd: shipping,
    taxUsd: tax,
    grossRevenueUsd: gross,
    cogsUsd: cogs,
    shippingCostUsd: shipCost,
    fulfillmentFeeUsd: fulfill,
    stripeFeeUsd: fee,
    estimatedProfitUsd: estimatedProfit,
  };
}
