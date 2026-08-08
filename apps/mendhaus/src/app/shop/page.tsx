import type { Metadata } from "next";
import { CATEGORIES, PRODUCTS } from "@/catalog/products";
import { ProductCard } from "@/components/ProductCard";
import { ScrollDepthBeacon } from "@/components/ScrollDepthBeacon";

export const metadata: Metadata = {
  title: "Shop",
  description: "Small home upgrades for kitchen, bathroom, desk, closet, cleaning, and renters.",
};

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <ScrollDepthBeacon />
      <p className="text-xs uppercase tracking-[0.18em] text-moss">Catalog</p>
      <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Shop</h1>
      <p className="mt-3 max-w-2xl text-ink/70">
        {PRODUCTS.length} products. Each one is meant to solve one annoying thing — not decorate a
        warehouse.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {CATEGORIES.map((category) => (
          <a
            key={category}
            href={`/category/${category}`}
            className="rounded-full border border-line bg-paper px-3 py-1.5 capitalize text-ink/80 transition hover:border-moss/40"
          >
            {category}
          </a>
        ))}
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
