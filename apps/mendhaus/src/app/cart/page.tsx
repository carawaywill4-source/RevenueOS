import type { Metadata } from "next";
import { CartClient } from "@/components/CartClient";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl text-ink">Cart</h1>
      <CartClient />
    </div>
  );
}
