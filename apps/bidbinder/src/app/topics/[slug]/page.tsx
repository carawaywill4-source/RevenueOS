import { BRAND } from "@/lib/brand";
import { doorBySlug } from "@revenueos/storefront-kit";
import { notFound } from "next/navigation";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const door = doorBySlug(BRAND, slug);
  if (!door) notFound();
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
      <p>
        <a className="btn" href="/">
          Get {BRAND.product.name} — ${BRAND.product.priceUsd}
        </a>
      </p>
    </main>
  );
}
