import Image from "next/image";
import { PRODUCTS } from "@/catalog/products";
import { SITE_HERO } from "@/catalog/media";
import { ProductCard } from "@/components/ProductCard";
import { ScrollDepthBeacon } from "@/components/ScrollDepthBeacon";
import { TrackLink } from "@/components/TrackLink";
import { BRAND, FREE_SHIPPING_AT_USD } from "@/lib/brand";

export default function HomePage() {
  const featured = PRODUCTS.filter((p) =>
    [
      "mh-under-sink-caddy",
      "mh-over-door-hook-rack",
      "mh-rubber-pet-broom",
      "mh-aluminum-laptop-riser",
      "mh-tension-shower-caddy",
      "mh-desk-cable-clips",
    ].includes(p.id),
  );

  return (
    <div>
      <ScrollDepthBeacon />
      <section className="relative min-h-[88vh] overflow-hidden border-b border-line">
        <Image
          src={SITE_HERO}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center animate-ken"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-ink/45 to-ink/15" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(251,248,242,0.18),transparent_55%)]" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:justify-center sm:pb-24">
          <p className="animate-rise font-display text-5xl tracking-tight text-paper sm:text-7xl md:text-8xl">
            {BRAND.name}
          </p>
          <h1 className="animate-rise-delay mt-4 max-w-xl font-display text-2xl leading-snug text-paper/95 sm:text-3xl">
            {BRAND.tagline}
          </h1>
          <p className="animate-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-paper/80">
            Useful products for the annoying bits of a home — under the sink, behind the door, under
            the desk. Honest install notes. US shipping.
          </p>
          <div className="animate-rise-delay-2 mt-8 flex flex-wrap gap-3">
            <TrackLink
              href="/shop"
              label="hero_shop"
              className="rounded-full bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-sand"
            >
              Shop the fixes
            </TrackLink>
            <TrackLink
              href="/guides/renter-friendly-upgrades"
              label="hero_guide"
              className="rounded-full border border-paper/40 px-6 py-3 text-sm font-medium text-paper transition hover:bg-paper/10"
            >
              Renter-friendly guide
            </TrackLink>
          </div>
          <p className="mt-6 text-sm text-paper/65">
            Free shipping on orders ${FREE_SHIPPING_AT_USD}+ · Typically 3–7 day US delivery
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-moss">Curated fixes</p>
            <h2 className="mt-2 font-display text-3xl text-ink sm:text-4xl">Start here</h2>
          </div>
          <TrackLink href="/shop" label="home_all_products" className="text-sm text-moss">
            All products
          </TrackLink>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-line">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#e8dfd0_0%,#f4f1ea_45%,#d9e0d8_100%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-3">
          {[
            [
              "A real problem, in one glance",
              "Every product is chosen because the annoyance is obvious: dripping bottles, pet hair, dark closets, cable mess.",
            ],
            [
              "Honest about install",
              "If it needs tension, adhesive, or a measured cabinet opening, we say so. No fake damage-free forever claims.",
            ],
            [
              "Ships like a normal store",
              "US-warehouse first. Typical delivery 3–7 business days. Tracking when it leaves the warehouse.",
            ],
          ].map(([title, body]) => (
            <div key={title}>
              <h3 className="font-display text-2xl text-ink">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/75">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-moss">How it works</p>
        <h2 className="mt-2 max-w-xl font-display text-3xl text-ink">
          Pick the fix. We ship from US stock when we can.
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            ["01", "Choose the annoyance", "Kitchen, bathroom, desk, closet, cleaning, renters."],
            ["02", "Checkout securely", "Stripe-powered. Clear shipping and returns before you pay."],
            ["03", "Track the package", "Warehouse dispatch with a tracking number when it ships."],
          ].map(([n, t, b]) => (
            <div key={n} className="border-t border-line pt-4">
              <p className="text-xs tracking-widest text-clay">{n}</p>
              <h3 className="mt-2 font-display text-xl text-ink">{t}</h3>
              <p className="mt-2 text-sm text-ink/70">{b}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
