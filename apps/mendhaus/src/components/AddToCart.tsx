"use client";

import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { track } from "@/lib/track";

export function AddToCart({
  productId,
  disabled = false,
}: {
  productId: string;
  disabled?: boolean;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-full bg-ink/20 px-7 py-3.5 text-sm font-medium text-ink/50"
      >
        Currently unavailable
      </button>
    );
  }

  return (
    <button
      type="button"
      className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper shadow-sm transition hover:bg-moss active:scale-[0.98]"
      onClick={() => {
        add(productId);
        setAdded(true);
        track("add_to_cart", { productId, immediate: true });
        track("cta_click", {
          productId,
          metadata: { label: "add_to_cart" },
          immediate: true,
        });
      }}
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
