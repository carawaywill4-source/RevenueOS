import Image from "next/image";
import { KITS, kitPriceUsd, kitProducts } from "@/catalog/kits";
import { PRODUCTS, getProductById } from "@/catalog/products";
import { SITE_HERO } from "@/catalog/media";
import { AddKitButton } from "@/components/AddKitButton";
import { ProductCard } from "@/components/ProductCard";
import { ScrollDepthBeacon } from "@/components/ScrollDepthBeacon";
import { TrackLink } from "@/components/TrackLink";
import { BRAND } from "@/lib/brand";
import {
  effectiveCompareAt,
  effectiveCartUnitPrice,
  effectiveUnitPrice,
  loadMerchState,
} from "@/lib/merch";
import { listPublishedTopics } from "@/lib/discovery";

export const revalidate = 30;

export default async function HomePage() {
  const [merch, topics] = await Promise.all([loadMerchState(), listPublishedTopics()]);
  const featuredIds =
    merch.featuredProductIds.length > 0
      ? merch.featuredProductIds
      : [
          "mh-tension-shower-caddy",
          "mh-under-sink-caddy",
          "mh-freestanding-coat-tree",
          "mh-aluminum-laptop-riser",
          "mh-monitor-stand-drawer",
          "mh-rubber-pet-broom",
        ];
  const featured = featuredIds
    .map((id) => getProductById(id))
    .filter((p): p is (typeof PRODUCTS)[number] => Boolean(p));

  const kits = merch.featuredKitIds.length
    ? merch.featuredKitIds
        .map((id) => KITS.find((k) => k.id === id))
        .filter((k): k is (typeof KITS)[number] => Boolean(k))
    : KITS;
  // Keep full kit list but order featured first.
  const orderedKits = [
    ...kits,
    ...KITS.filter((k) => !kits.some((f) => f.id === k.id)),
  ];

  return (
    <div>
      <ScrollDepthBeacon />
      <section className="relative min-h-[90vh] overflow-hidden border-b border-line">
        <Image
          src={SITE_HERO}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center animate-ken"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/50 to-ink/20" />
        <div className="relative mx-auto flex min-h-[90vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:justify-center sm:pb-24">
          <p className="animate-rise font-display text-5xl tracking-tight text-paper sm:text-7xl md:text-8xl">
            {BRAND.name}
          </p>
          <div className="animate-rule mt-4 h-px w-24 bg-paper/70" />
          <h1 className="animate-rise-delay mt-5 max-w-lg font-display text-2xl leading-snug text-paper sm:text-3xl">
            {BRAND.tagline}
          </h1>
          <p className="animate-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-paper/80">
            Problem kits for the rooms that wear you down — kitchen, bath, desk, entry. Measure once.
            Ship from US stock.
          </p>
          <div className="animate-rise-delay-2 mt-8 flex flex-wrap gap-3">
            <TrackLink
              href="#kits"
              label="hero_kits"
              className="rounded-full bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-sand"
            >
              Shop problem kits
            </TrackLink>
            <TrackLink
              href="/shop"
              label="hero_shop"
              className="rounded-full border border-paper/35 px-6 py-3 text-sm font-medium text-paper transition hover:bg-paper/10"
            >
              Browse all fixes
            </TrackLink>
          </div>
          <p className="mt-6 text-sm text-paper/65">
            Free US shipping at ${merch.freeShippingAtUsd}+ · Typical delivery 3–7 days
          </p>
        </div>
      </section>

      <section id="kits" className="mx-auto max-w-6xl px-4 py-20">
        <p className="text-xs uppercase tracking-[0.2em] text-spruce">Built for volume</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl text-ink sm:text-4xl">
          Four kits. Four rooms. Higher average order — fewer half-fixed apartments.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-6 text-ink/70">
          ${BRAND.dailyRevenueTargetUsd.toLocaleString()}/day is the operating target. Kits raise AOV
          into the $100–$165 band so organic traffic can actually pay for the business.
        </p>
        <div className="mt-12 space-y-10">
          {orderedKits.map((kit) => {
            const items = kitProducts(kit);
            const listPrice = kitPriceUsd(kit);
            const salePrice = items.reduce(
              (sum, p) => sum + effectiveCartUnitPrice(p, merch.promo, kit.productIds),
              0,
            );
            const onSale = salePrice < listPrice - 0.01;
            return (
              <article
                key={kit.id}
                className="grid gap-8 border-t border-line pt-10 lg:grid-cols-[1.1fr_0.9fr]"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-steel">{kit.badge}</p>
                  <h3 className="mt-2 font-display text-3xl text-ink">{kit.name}</h3>
                  <p className="mt-3 text-lg text-ink/75">{kit.tagline}</p>
                  <p className="mt-3 text-sm leading-6 text-ink/65">{kit.problem}</p>
                  <ul className="mt-5 space-y-1 text-sm text-ink/80">
                    {items.map((p) => (
                      <li key={p.id}>
                        {p.name} · $
                        {effectiveCartUnitPrice(p, merch.promo, kit.productIds).toFixed(0)}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    <p className="text-2xl font-medium text-ink">
                      ${salePrice.toFixed(0)}
                      {onSale ? (
                        <span className="ml-2 text-base font-normal text-ink/40 line-through">
                          ${listPrice.toFixed(0)}
                        </span>
                      ) : null}
                    </p>
                    <AddKitButton kit={kit} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {items.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      priceUsd={effectiveUnitPrice(p, merch.promo)}
                      compareAtUsd={effectiveCompareAt(p, merch.promo)}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-paper/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3">
          {[
            [
              "One annoyance each",
              "We do not sell décor. We sell the thing that stops the nightly leak, the wet sponge, or the chair that kills your back.",
            ],
            [
              "Install notes first",
              "Tension, adhesive, and cabinet widths are stated before checkout. No landlord fairy tales.",
            ],
            [
              "US warehouse speed",
              "Typical 3–7 day delivery. Tracking when the warehouse scans. Returns within 30 days.",
            ],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-display text-2xl text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/70">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-spruce">Singles</p>
            <h2 className="mt-2 font-display text-3xl text-ink">High-signal SKUs</h2>
          </div>
          <TrackLink href="/shop" label="home_all_products" className="text-sm text-spruce">
            Full catalog
          </TrackLink>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              priceUsd={effectiveUnitPrice(product, merch.promo)}
              compareAtUsd={effectiveCompareAt(product, merch.promo)}
            />
          ))}
        </div>
      </section>

      {topics.length > 0 ? (
        <section className="border-t border-line bg-sand/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="text-xs uppercase tracking-[0.18em] text-spruce">From live demand research</p>
            <h2 className="mt-2 font-display text-3xl text-ink">Problems people are searching now</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {topics.slice(0, 4).map((topic) => (
                <li key={topic.slug}>
                  <TrackLink
                    href={`/topics/${topic.slug}`}
                    label={`topic_${topic.slug}`}
                    className="block border-b border-line pb-4 transition hover:text-clay"
                  >
                    <span className="font-display text-xl text-ink">{topic.title}</span>
                    <span className="mt-1 block text-sm text-ink/60">{topic.metaDescription}</span>
                  </TrackLink>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}
