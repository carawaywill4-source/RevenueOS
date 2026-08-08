import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct, PRODUCTS } from "@/catalog/products";
import { getProductMedia } from "@/catalog/media";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductReviews } from "@/components/ProductReviews";
import { ProductTrust } from "@/components/ProductTrust";
import { ProductViewBeacon } from "@/components/ProductViewBeacon";
import { ScrollDepthBeacon } from "@/components/ScrollDepthBeacon";
import { effectiveCompareAt, effectiveUnitPrice, loadMerchState } from "@/lib/merch";
import { getListingForProduct, getVerifiedListingForCheckout } from "@/lib/supplier-listings";

export const revalidate = 30;

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: product.seoTitle,
    description: product.seoDescription,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const [listing, verification, merch] = await Promise.all([
    getListingForProduct(product.id),
    getVerifiedListingForCheckout(product.id),
    loadMerchState(),
  ]);
  const unitPrice = effectiveUnitPrice(product, merch.promo);
  const compareAt = effectiveCompareAt(product, merch.promo);
  const sellable =
    product.inStock &&
    product.estimatedGrossProfitUsd >= product.minMarginUsd &&
    Boolean(verification.listing);
  const media = getProductMedia(product.id, product.category, product.name, listing);

  const related = PRODUCTS.filter(
    (p) =>
      p.id !== product.id &&
      (product.bundleWith?.includes(p.slug) || p.category === product.category),
  ).slice(0, 3);

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://mendhaus.shop";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription,
    sku: product.id,
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: unitPrice,
      availability: sellable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${origin}/product/${product.slug}`,
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "d" },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: product.supplier.etaDaysMin,
            maxValue: product.supplier.etaDaysMax,
            unitCode: "d",
          },
        },
      },
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductViewBeacon productId={product.id} />
      <ScrollDepthBeacon productId={product.id} />
      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery media={media} priority />
        <div className="lg:py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-moss">{product.category}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-ink sm:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 text-lg text-ink/75">{product.tagline}</p>
          <p className="mt-6 text-2xl font-medium text-ink">
            ${unitPrice.toFixed(2)}
            {compareAt && compareAt > unitPrice ? (
              <span className="ml-2 text-base text-ink/40 line-through">
                ${compareAt.toFixed(2)}
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-sm text-ink/60">
            Ships to the US in about {product.supplier.etaDaysMin}–{product.supplier.etaDaysMax}{" "}
            days.
          </p>
          <div className="mt-8">
            <AddToCart productId={product.id} disabled={!sellable} />
            {!sellable ? (
              <p className="mt-3 text-sm text-ink/55">
                This item is temporarily unavailable while its supplier variant is being verified.
                Browse related fixes below.
              </p>
            ) : null}
          </div>
          <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-ink/70">
            <li>Clear returns within 30 days of delivery</li>
            <li>Tracked US shipping on every order</li>
            <li>No fake reviews — read the install notes below</li>
          </ul>
          <div className="mt-10 space-y-5 text-sm leading-7 text-ink/80">
            <p>
              <strong className="font-medium text-ink">The problem. </strong>
              {product.problem}
            </p>
            <p>
              <strong className="font-medium text-ink">What this does. </strong>
              {product.solution}
            </p>
          </div>
          <ProductTrust product={product} listing={listing} />
        </div>
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-ink">Questions</h2>
        <dl className="mt-4 divide-y divide-line">
          {product.faqs.map((faq) => (
            <div key={faq.q} className="py-4">
              <dt className="font-medium text-ink">{faq.q}</dt>
              <dd className="mt-2 text-sm leading-6 text-ink/75">{faq.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <ProductReviews product={product} />

      {related.length > 0 ? (
        <section className="mt-16">
          <h2 className="font-display text-2xl text-ink">Often paired with</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                priceUsd={effectiveUnitPrice(item, merch.promo)}
                compareAtUsd={effectiveCompareAt(item, merch.promo)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
