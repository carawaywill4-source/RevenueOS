import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES, listByCategory, type ProductCategory } from "@/catalog/products";
import { ProductCard } from "@/components/ProductCard";

const COPY: Record<ProductCategory, { title: string; body: string }> = {
  kitchen: {
    title: "Kitchen",
    body: "The sink, fridge, and counters — small tools for the mess you wipe every night.",
  },
  bathroom: {
    title: "Bathroom",
    body: "Tension, drip, and storage that does not require a renovation.",
  },
  bedroom: {
    title: "Bedroom",
    body: "A laundry place that folds, a bedside pocket, a darker window without a contractor.",
  },
  closet: {
    title: "Closet",
    body: "Hangers and hanging storage that actually use the height you have.",
  },
  desk: {
    title: "Desk",
    body: "Raise the screen, clip the cables, support your back on the chair you already own.",
  },
  cleaning: {
    title: "Cleaning",
    body: "Pet hair, grout, and floors — tools you can wash, not miracle gadgets.",
  },
  lighting: {
    title: "Lighting",
    body: "Puck lights, motion closet lights, and a clip-on read light. Batteries and install noted honestly.",
  },
  renter: {
    title: "Renter-friendly",
    body: "Over-the-door hooks, tension shower storage, freestanding racks. Comes with you when the lease ends. Not a deposit guarantee.",
  },
};

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return CATEGORIES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const copy = COPY[slug as ProductCategory];
  if (!copy) return {};
  return { title: copy.title, description: copy.body };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  if (!CATEGORIES.includes(slug as ProductCategory)) notFound();
  const category = slug as ProductCategory;
  const products = listByCategory(category);
  const copy = COPY[category];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl text-ink">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-ink/70">{copy.body}</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
