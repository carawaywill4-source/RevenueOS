"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProductMedia } from "@/catalog/media";
import { PRODUCTS, getProductById } from "@/catalog/products";
import { useCart } from "@/components/CartProvider";
import { FREE_SHIPPING_AT_USD } from "@/lib/brand";
import { quoteCart } from "@/lib/money";
import { checkoutAllowed } from "@/lib/readiness-public";
import { getOrCreateSessionId, readAttributionCookie } from "@/lib/session";
import { track } from "@/lib/track";

export function CartClient() {
  const { lines, setQty, remove, clear } = useCart();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const canCheckout = checkoutAllowed();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") === "1") setCancelled(true);
  }, []);

  useEffect(() => {
    if (lines.length) track("cart_view", { immediate: true, metadata: { items: lines.length } });
  }, [lines.length]);

  const priced = useMemo(() => {
    const resolved = lines
      .map((line) => {
        const product = getProductById(line.productId) ?? PRODUCTS.find((p) => p.id === line.productId);
        return product ? { ...line, product } : null;
      })
      .filter(Boolean) as Array<{
      productId: string;
      quantity: number;
      product: (typeof PRODUCTS)[number];
    }>;
    return { resolved, quote: resolved.length ? quoteCart(resolved) : null };
  }, [lines]);

  async function checkout() {
    setBusy(true);
    setError(null);
    track("cta_click", { metadata: { label: "checkout" }, immediate: true });
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines,
          email: email || undefined,
          sessionId: getOrCreateSessionId(),
          attribution: readAttributionCookie(),
        }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout is not ready yet");
      }
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return (
      <p className="mt-6 text-ink/70">
        Your cart is empty.{" "}
        <Link href="/shop" className="text-moss underline">
          Browse products
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {cancelled ? (
        <p className="rounded-xl border border-sand bg-sand/40 p-4 text-sm text-ink/80">
          Checkout was cancelled. Your cart is still here whenever you are ready.
        </p>
      ) : null}
      {priced.resolved.map((line) => {
        const media = getProductMedia(line.product.id, line.product.category, line.product.name);
        return (
          <div
            key={line.productId}
            className="flex items-start justify-between gap-4 border-b border-line py-4"
          >
            <div className="flex gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand">
                <Image src={media.hero} alt="" fill sizes="80px" className="object-cover" />
              </div>
              <div>
                <Link href={`/product/${line.product.slug}`} className="font-medium text-ink">
                  {line.product.name}
                </Link>
                <p className="text-sm text-ink/60">${line.product.priceUsd.toFixed(2)}</p>
                <label className="mt-2 block text-xs text-ink/60">
                  Qty
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={line.quantity}
                    className="ml-2 w-16 rounded border border-line bg-paper px-2 py-1"
                    onChange={(e) => setQty(line.productId, Number(e.target.value))}
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              className="text-sm text-clay"
              onClick={() => remove(line.productId)}
            >
              Remove
            </button>
          </div>
        );
      })}

      {priced.quote ? (
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>${priced.quote.subtotalUsd.toFixed(2)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>
              {priced.quote.shippingUsd === 0
                ? "Free"
                : `$${priced.quote.shippingUsd.toFixed(2)}`}
            </dd>
          </div>
          <div className="flex justify-between font-medium text-ink">
            <dt>Total</dt>
            <dd>${priced.quote.grossRevenueUsd.toFixed(2)}</dd>
          </div>
          {priced.quote.subtotalUsd < FREE_SHIPPING_AT_USD ? (
            <p className="text-xs text-ink/60">
              Add ${(FREE_SHIPPING_AT_USD - priced.quote.subtotalUsd).toFixed(2)} for free shipping.
            </p>
          ) : null}
        </dl>
      ) : null}

      <label className="block text-sm">
        Email (optional, used for the receipt)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
        />
      </label>

      {!canCheckout ? (
        <p className="rounded-xl border border-sand bg-sand/40 p-4 text-sm text-ink/80">
          Checkout is temporarily paused. You can still browse and build a cart — payment unlocks
          again shortly.
        </p>
      ) : null}

      {error ? <p className="text-sm text-clay">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy || !canCheckout}
          onClick={() => void checkout()}
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper disabled:opacity-40"
        >
          {busy ? "Redirecting…" : "Checkout"}
        </button>
        <button type="button" onClick={clear} className="text-sm text-ink/60">
          Clear cart
        </button>
      </div>
    </div>
  );
}
