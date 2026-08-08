import type { ProductCategory } from "@/catalog/products";

const TONES: Record<ProductCategory, string> = {
  kitchen: "from-[#d7c2a4] to-[#8f6a4a]",
  bathroom: "from-[#b9c9c6] to-[#4f6f6a]",
  bedroom: "from-[#d8c8c0] to-[#7a5a52]",
  closet: "from-[#cfc6b8] to-[#6d6458]",
  desk: "from-[#c5cdd6] to-[#4a5a6a]",
  cleaning: "from-[#c9d4c0] to-[#4f6a48]",
  lighting: "from-[#efe0b8] to-[#b08a3c]",
  renter: "from-[#dccbb8] to-[#6a5340]",
};

export function ProductSwatch({
  category,
  className = "",
}: {
  category: ProductCategory;
  className?: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br ${TONES[category]} ${className}`}
      aria-hidden
    />
  );
}
