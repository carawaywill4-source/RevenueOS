import Link from "next/link";
import type { Product } from "@/catalog/products";
import { ProductMedia } from "@/components/ProductMedia";

type Props = {
  product: Product;
  /** Live sale unit price from merch state. */
  priceUsd?: number;
  compareAtUsd?: number;
};

export function ProductCard({ product, priceUsd, compareAtUsd }: Props) {
  const price = priceUsd ?? product.priceUsd;
  const compare = compareAtUsd ?? product.compareAtUsd;
  const onSale = compare != null && compare > price;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_1px_0_rgba(31,42,36,0.04)] transition hover:-translate-y-0.5 hover:border-moss/30"
    >
      <ProductMedia product={product} className="h-52" />
      <div className="space-y-2 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-moss">{product.category}</p>
        <h3 className="font-display text-xl leading-snug text-ink transition group-hover:text-clay">
          {product.name}
        </h3>
        <p className="line-clamp-2 text-sm text-ink/70">{product.tagline}</p>
        <div className="flex items-baseline justify-between pt-1">
          <p className="text-sm font-medium text-ink">
            ${price.toFixed(2)}
            {onSale ? (
              <span className="ml-2 text-xs font-normal text-ink/40 line-through">
                ${compare.toFixed(2)}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-ink/45">
            {product.supplier.etaDaysMin}–{product.supplier.etaDaysMax} day ship
          </p>
        </div>
      </div>
    </Link>
  );
}
