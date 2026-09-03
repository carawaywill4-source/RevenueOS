import { BRAND } from "@/lib/brand";
import { doorBySlug } from "@revenueos/storefront-kit";
import { CheckoutButton } from "@/components/CheckoutButton";
import { checkoutAllowed } from "@/lib/readiness";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const door = doorBySlug(BRAND, slug);
  if (!door) notFound();
  const live = checkoutAllowed();
  const paragraphs = door.body.split(/\n\n+/).filter(Boolean);

  return (
    <>
      <header className="site-header" style={{ padding: "2.5rem 1.25rem 2rem" }}>
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85 }}>
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
              {BRAND.displayName}
            </Link>
          </p>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.4rem)", margin: "0.6rem 0 0" }}>
            {door.title}
          </h1>
        </div>
      </header>
      <main id="main" className="wrap">
        {paragraphs.map((p) => (
          <p key={p.slice(0, 48)}>{p}</p>
        ))}
        <div className="panel">
          <p style={{ marginTop: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            {BRAND.product.name} — ${BRAND.product.priceUsd}
          </p>
          <p className="muted">{BRAND.product.tagline}</p>
          <CheckoutButton enabled={live} />
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
            Instant download after payment. 14-day refund if unused.
          </p>
        </div>
      </main>
    </>
  );
}
