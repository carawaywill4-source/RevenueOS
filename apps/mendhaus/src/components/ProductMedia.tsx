import Image from "next/image";
import type { Product } from "@/catalog/products";
import { getProductMedia } from "@/catalog/media";
import { getListingForProduct } from "@/lib/supplier-listings";

export async function ProductMedia({
  product,
  className = "",
  priority = false,
  showSourceBadge = false,
}: {
  product: Product;
  className?: string;
  priority?: boolean;
  showSourceBadge?: boolean;
}) {
  const listing = await getListingForProduct(product.id);
  const media = getProductMedia(product.id, product.category, product.name, listing);

  return (
    <div className={`relative overflow-hidden bg-sand ${className}`}>
      <Image
        src={media.hero}
        alt={media.alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/20 via-transparent to-transparent" />
      {showSourceBadge && media.source === "editorial" ? (
        <span className="absolute bottom-3 left-3 rounded-full bg-paper/85 px-2.5 py-1 text-[10px] uppercase tracking-wider text-ink/70 backdrop-blur">
          Lifestyle context
        </span>
      ) : null}
    </div>
  );
}
