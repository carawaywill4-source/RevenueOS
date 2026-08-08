import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of sale for Mendhaus.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <h1 className="font-display text-4xl text-ink">Terms</h1>
      <p className="mt-4">
        These terms cover purchases from {BRAND.name} at {BRAND.domainHint}. By placing an order you
        agree to buy the listed product at the stated price, plus shipping, for delivery in the
        United States. Product pages describe install constraints honestly; you are responsible for
        measuring cabinets, desks, and door thickness before you buy.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Seller</h2>
      <p>
        Orders are sold by Mendhaus ({BRAND.domainHint}), operated from Colorado, United States.
        Support: {BRAND.supportEmail}.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">No medical or landlord promises</h2>
      <p>
        Lighting, desk, and cleaning products are not medical devices. Renter-friendly items are
        not a guarantee against lease violations, paint damage, or deposit loss. Follow your lease.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">Limitation &amp; law</h2>
      <p>
        Our liability for a product is limited to the amount you paid for that product (excluding
        shipping unless we shipped the wrong or damaged item). These terms are governed by the laws
        of the State of Colorado, without regard to conflict-of-law rules. Disputes are resolved in
        Colorado courts unless applicable consumer law requires otherwise.
      </p>
    </article>
  );
}
