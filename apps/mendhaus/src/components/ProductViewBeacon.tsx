"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export function ProductViewBeacon({ productId }: { productId: string }) {
  useEffect(() => {
    track("product_view", { productId, immediate: true });
    const timer = window.setTimeout(() => {
      track("engagement", {
        productId,
        metadata: { seconds: 8 },
      });
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [productId]);
  return null;
}
