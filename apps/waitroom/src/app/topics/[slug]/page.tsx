import { BRAND } from "@/lib/brand";
import { doorBySlug } from "@revenueos/storefront-kit";
import { CheckoutButton } from "@/components/CheckoutButton";
import { checkoutAllowed } from "@/lib/readiness";
import { notFound } from "next/navigation";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const door = doorBySlug(BRAND, slug);
  if (!door) notFound();
  const live = checkoutAllowed();
  return (
    <main className="wrap">
      <p style={{ textTransform: "uppercase", fontSize: "0.8rem" }}>
        {BRAND.displayName}
      </p>
      <h1>{door.title}</h1>
      <p>{door.body}</p>
      <p style={{ opacity: 0.75, fontSize: "0.95rem" }}>
        Searching for “{door.intentQuery}”? This page is built for that.
      </p>
      <p style={{ marginTop: "1.5rem", fontSize: "1.4rem", fontWeight: 600 }}>
        {BRAND.product.name} — ${BRAND.product.priceUsd}
      </p>
      <div style={{ marginTop: "1rem" }}>
        <CheckoutButton enabled={live} />
      </div>
      <p style={{ opacity: 0.6, fontSize: "0.85rem", marginTop: "0.75rem" }}>
        Full refund within 14 days, no questions asked.
      </p>
    </main>
  );
}
