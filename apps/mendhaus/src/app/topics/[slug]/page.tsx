import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCTS, getProductById } from "@/catalog/products";
import { ProductCard } from "@/components/ProductCard";
import { TopicTracker } from "@/components/TopicTracker";
import { TrackLink } from "@/components/TrackLink";
import {
  effectiveCompareAt,
  effectiveUnitPrice,
  loadMerchState,
} from "@/lib/merch";
import { getPublishedTopic, listPublishedTopics } from "@/lib/discovery";

export const revalidate = 30;

export async function generateStaticParams() {
  const topics = await listPublishedTopics();
  return topics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getPublishedTopic(slug);
  if (!topic) return { title: "Topic" };
  return {
    title: topic.title,
    description: topic.metaDescription,
    alternates: { canonical: `/topics/${topic.slug}` },
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [topic, merch] = await Promise.all([getPublishedTopic(slug), loadMerchState()]);
  if (!topic) notFound();

  const products = topic.productIds
    .map((id) => getProductById(id))
    .filter((p): p is (typeof PRODUCTS)[number] => Boolean(p));

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <TopicTracker slug={topic.slug} />
      <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Intent topic</p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
        {topic.title}
      </h1>
      <p className="mt-3 text-sm text-ink/55">
        Research query: {topic.query}
      </p>
      <div className="prose prose-neutral mt-8 max-w-none whitespace-pre-wrap text-base leading-relaxed text-ink/85">
        {topic.body}
      </div>
      {products.length > 0 ? (
        <section className="mt-14">
          <h2 className="font-display text-2xl text-ink">Products that answer this</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                priceUsd={effectiveUnitPrice(product, merch.promo)}
                compareAtUsd={effectiveCompareAt(product, merch.promo)}
              />
            ))}
          </div>
        </section>
      ) : null}
      <div className="mt-12">
        <TrackLink
          href="/shop"
          label="topic_shop"
          className="rounded-full bg-ink px-5 py-3 text-sm text-paper"
        >
          Browse the shop
        </TrackLink>
      </div>
    </main>
  );
}
