import { BRAND } from "@/lib/brand";
import { notFound } from "next/navigation";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const door = BRAND.discoveryDoors.find((d) => d.slug === slug);
  if (!door) notFound();
  return (
    <main className="wrap">
      <p style={{ textTransform: "uppercase", fontSize: "0.8rem" }}>{BRAND.displayName}</p>
      <h1>{door.title}</h1>
      <p>{door.body}</p>
      <p>
        <a className="btn" href="/">
          Get {BRAND.product.name} — ${BRAND.product.priceUsd}
        </a>
      </p>
    </main>
  );
}
