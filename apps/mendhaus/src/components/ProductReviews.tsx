import type { Product } from "@/catalog/products";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string | null;
  created_at: string;
};

export async function ProductReviews({ product }: { product: Product }) {
  let reviews: Review[] = [];

  if (supabaseConfigured()) {
    const { data } = await getSupabaseAdmin()
      .from("mh_product_reviews")
      .select("id, rating, title, body, display_name, created_at")
      .eq("product_id", product.id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(12);
    reviews = (data ?? []) as Review[];
  }

  return (
    <section className="mt-16 border-t border-line pt-12" aria-labelledby="verified-reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-moss">Verified purchase feedback</p>
          <h2 id="verified-reviews" className="mt-2 font-display text-2xl text-ink">
            Reviews
          </h2>
        </div>
        <p className="text-sm text-ink/60">
          {reviews.length ? `${reviews.length} verified review${reviews.length === 1 ? "" : "s"}` : "No reviews yet"}
        </p>
      </div>
      {reviews.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-sm tracking-[0.18em] text-spruce" aria-label={`${review.rating} out of 5 stars`}>
                {"★".repeat(review.rating)}
                <span className="text-ink/20">{"★".repeat(5 - review.rating)}</span>
              </p>
              {review.title ? <h3 className="mt-3 font-medium text-ink">{review.title}</h3> : null}
              <p className="mt-2 text-sm leading-6 text-ink/75">{review.body}</p>
              <p className="mt-4 text-xs text-ink/50">
                Verified buyer{review.display_name ? ` · ${review.display_name}` : ""}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 max-w-2xl text-sm leading-6 text-ink/70">
          We only publish feedback tied to a completed purchase, so this section starts empty rather
          than filling it with borrowed testimonials. Buyers can be invited to review after delivery.
        </p>
      )}
    </section>
  );
}
