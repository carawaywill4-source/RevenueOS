"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { trackCta } from "@/lib/track";

export function Header() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight text-ink"
          onClick={() => trackCta("logo_home", "/")}
        >
          Mendhaus
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink/80 sm:flex">
          <Link href="/shop" onClick={() => trackCta("nav_shop", "/shop")}>
            Shop
          </Link>
          <Link href="/category/kitchen" onClick={() => trackCta("nav_kitchen", "/category/kitchen")}>
            Kitchen
          </Link>
          <Link href="/category/renter" onClick={() => trackCta("nav_renter", "/category/renter")}>
            Renters
          </Link>
          <Link href="/category/desk" onClick={() => trackCta("nav_desk", "/category/desk")}>
            Desk
          </Link>
          <Link
            href="/guides/renter-friendly-upgrades"
            onClick={() => trackCta("nav_guides", "/guides/renter-friendly-upgrades")}
          >
            Guides
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            className="text-sm font-medium text-moss"
            onClick={() => trackCta("nav_cart", "/cart")}
          >
            Cart{count > 0 ? ` (${count})` : ""}
          </Link>
          <button
            type="button"
            className="rounded-md border border-line px-2 py-1 text-xs text-ink sm:hidden"
            aria-expanded={open}
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-line bg-paper px-4 py-3 text-sm text-ink/80 sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            {[
              ["/shop", "Shop"],
              ["/category/kitchen", "Kitchen"],
              ["/category/renter", "Renters"],
              ["/category/desk", "Desk"],
              ["/guides/renter-friendly-upgrades", "Guides"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  trackCta(`mobile_${label.toLowerCase()}`, href);
                  setOpen(false);
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
