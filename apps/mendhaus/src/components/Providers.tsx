"use client";

import { Suspense } from "react";
import { CartProvider } from "@/components/CartProvider";
import { AttributionCapture } from "@/components/AttributionCapture";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Suspense fallback={null}>
        <AttributionCapture />
      </Suspense>
      {children}
    </CartProvider>
  );
}
