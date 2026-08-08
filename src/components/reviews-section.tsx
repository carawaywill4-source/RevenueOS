"use client";

import { ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";

type Review = {
  id: string;
  display_name: string;
  rating: number;
  body: string;
  created_at: string;
};

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews")
      .then((response) => response.json())
      .then((result: { reviews?: Review[] }) => {
        if (active && Array.isArray(result.reviews)) {
          setReviews(result.reviews);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  if (reviews.length === 0) return null;

  const average =
    reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;

  return (
    <section className="bg-[#f4f0e6] px-5 py-24 sm:px-8" id="reviews">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
            From verified customers
          </p>
          <h2 className="mt-4 font-display text-4xl font-semibold text-forest sm:text-5xl">
            Words from families we&apos;ve helped.
          </h2>
          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="flex gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((value) => (
                <Star
                  key={value}
                  size={16}
                  className={
                    value <= Math.round(average)
                      ? "fill-gold text-gold"
                      : "text-forest/15"
                  }
                />
              ))}
            </span>
            <span className="text-xs font-bold text-forest/60">
              {average.toFixed(1)} from {reviews.length} verified{" "}
              {reviews.length === 1 ? "review" : "reviews"}
            </span>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-[1.75rem] border border-forest/10 bg-paper p-7 paper-shadow"
            >
              <div
                className="flex gap-0.5"
                aria-label={`${review.rating} out of 5 stars`}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star
                    key={value}
                    size={15}
                    className={
                      value <= review.rating
                        ? "fill-gold text-gold"
                        : "text-forest/15"
                    }
                  />
                ))}
              </div>
              <blockquote className="mt-5 text-sm leading-7 text-forest/70">
                “{review.body}”
              </blockquote>
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-forest/10 pt-5">
                <span className="text-xs font-bold text-forest">
                  {review.display_name}
                </span>
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-sage">
                  <ShieldCheck size={13} />
                  Verified purchase
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
