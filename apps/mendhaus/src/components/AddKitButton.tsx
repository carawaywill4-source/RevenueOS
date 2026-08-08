"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import type { Kit } from "@/catalog/kits";
import { track } from "@/lib/track";

export function AddKitButton({ kit }: { kit: Kit }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-spruce active:scale-[0.98]"
      onClick={() => {
        for (const productId of kit.productIds) add(productId);
        setAdded(true);
        track("add_to_cart", {
          productId: kit.id,
          immediate: true,
          metadata: { kit: kit.slug, items: kit.productIds.length },
        });
        track("cta_click", {
          metadata: { label: "add_kit", kit: kit.slug },
          immediate: true,
        });
      }}
    >
      {added ? "Kit in cart" : "Add kit to cart"}
    </button>
  );
}
