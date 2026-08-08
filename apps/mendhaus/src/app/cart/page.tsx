import type { Metadata } from "next";
import { CartClient } from "@/components/CartClient";
import { PRODUCTS } from "@/catalog/products";
import { effectiveUnitPrice, loadMerchState } from "@/lib/merch";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const merch = await loadMerchState();
  const unitPrices: Record<string, number> = {};
  for (const product of PRODUCTS) {
    unitPrices[product.id] = effectiveUnitPrice(product, merch.promo);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl text-ink">Cart</h1>
      <CartClient
        unitPrices={unitPrices}
        freeShippingAtUsd={merch.freeShippingAtUsd}
        kitPromo={
          merch.promo?.scope === "kit" && merch.promo.kitId
            ? {
                kitId: merch.promo.kitId,
                percentOff: merch.promo.percentOff,
                label: merch.promo.label,
              }
            : null
        }
      />
    </div>
  );
}
