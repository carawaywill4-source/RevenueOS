"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProductMedia } from "@/catalog/media";
import { KITS } from "@/catalog/kits";
import { PRODUCTS, getProductById } from "@/catalog/products";
import { useCart } from "@/components/CartProvider";
import { FREE_SHIPPING_AT_USD } from "@/lib/brand";
import { quoteCart } from "@/lib/money";
import { checkoutAllowed } from "@/lib/readiness-public";
import { getOrCreateSessionId, readAttributionCookie } from "@/lib/session";
import { track } from "@/lib/track";

type Props = {
  unitPrices: Record<string, number>;
  freeShippingAtUsd: number;
  kitPromo?: { kitId: string; percentOff: number; label: string } | null;
};

export function CartClient({
  unitPrices,
  freeShippingAtUsd = FREE_SHIPPING_AT_USD,
  kitPromo = null,
}: Props) {
  const { lines, setQty, remove, clear } = useCart();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const canCheckout = checkoutAllowed();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") === "1") queueMicrotask(() => setCancelled(true));
  }, []);

  useEffect(() => {
    if (lines.length) track("cart_view", { immediate: true, metadata: { items: lines.length } });
  }, [lines.length]);

  const priced = useMemo(() => {
    const cartProductIds = lines.map((line) => line.productId);
    const kit = kitPromo ? KITS.find((candidate) => candidate.id === kitPromo.kitId) : null;
    const kitComplete = Boolean(kit && kit.productIds.every((id) => cartProductIds.includes(id)));
    const resolved = lines
      .map((line) => {
        const product = getProductById(line.productId) ?? PRODUCTS.find((p) => p.id === line.productId);
        if (!product) return null;
        return {
          ...line,
          product,
          unitPriceUsd:
            kitComplete && kit?.productIds.includes(product.id)
              ? Number((product.priceUsd * (1 - kitPromo!.percentOff / 100)).toFixed(2))
              : (unitPrices[product.id] ?? product.priceUsd),
        };
      })
      .filter(Boolean) as Array<{
      productId: string;
      quantity: number;
      product: (typeof PRODUCTS)[number];
      unitPriceUsd: number;
    }>;
    return {
      resolved,
      quote: resolved.length
        ? quoteCart(resolved, { freeShippingAtUsd })
        : null,
    };
  }, [lines, unitPrices, freeShippingAtUsd, kitPromo]);

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
        const onSale = line.unitPriceUsd < line.product.priceUsd;
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
                <p className="text-sm text-ink/60">
                  ${line.unitPriceUsd.toFixed(2)}
                  {onSale ? (
                    <span className="ml-2 text-ink/35 line-through">
                      ${line.product.priceUsd.toFixed(2)}
                    </span>
                  ) : null}
                </p>
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
          {priced.quote.subtotalUsd < freeShippingAtUsd ? (
            <p className="text-xs text-ink/60">
              Add ${(freeShippingAtUsd - priced.quote.subtotalUsd).toFixed(2)} for free shipping.
            </p>
          ) : null}
          {kitPromo && (
            <p className="pt-2 text-xs text-spruce">
              {priced.resolved.some((line) => line.unitPriceUsd < line.product.priceUsd)
                ? `${kitPromo.label} is applied to the complete kit.`
                : `Add every item in the ${kitPromo.label} to unlock its kit price.`}
            </p>
          )}
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
