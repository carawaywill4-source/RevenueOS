import type { Metadata } from "next";
import { FREE_SHIPPING_AT_USD, SHIPPING_FLAT_USD } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Shipping",
  description: "US shipping times, costs, and tracking for Mendhaus orders.",
};

export default function ShippingPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <h1 className="font-display text-4xl text-ink">Shipping</h1>
      <p className="mt-4">
        We ship to the United States only for now. Catalog items leave a US warehouse and typically
        arrive in {3}–{7} business days after the order is paid. If an item ever ships overseas, that
        product page says so clearly.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Cost</h2>
      <p>
        Flat-rate shipping is ${SHIPPING_FLAT_USD.toFixed(2)}. Orders ${FREE_SHIPPING_AT_USD}+ ship
        free. Tax is only collected after we register for Stripe Tax where we have nexus — we will
        not invent a tax rate.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Tracking</h2>
      <p>
        When the warehouse scans the package, we email the carrier and tracking number to the
        address used at checkout. If tracking has not arrived within 3 business days of payment,
        write to care@mendhaus.shop with your order email.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Who fulfills the order</h2>
      <p>
        Your order is packed and labeled by our fulfillment partners. You shop Mendhaus; you do not
        need a supplier account. Support still comes through us.
      </p>
    </article>
  );
}
