import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-gradient-to-b from-paper to-sand/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:grid-cols-3 text-sm text-ink/80">
        <div>
          <p className="font-display text-2xl text-ink">Mendhaus</p>
          <p className="mt-3 max-w-xs leading-relaxed">
            {BRAND.tagline} Ships to the US. No fake reviews.
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-ink">Shop</p>
          <Link className="block" href="/shop">
            All products
          </Link>
          <Link className="block" href="/category/kitchen">
            Kitchen
          </Link>
          <Link className="block" href="/category/bathroom">
            Bathroom
          </Link>
          <Link className="block" href="/category/cleaning">
            Cleaning
          </Link>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-ink">Help</p>
          <Link className="block" href="/shipping">
            Shipping
          </Link>
          <Link className="block" href="/returns">
            Returns
          </Link>
          <Link className="block" href="/privacy">
            Privacy
          </Link>
          <Link className="block" href="/terms">
            Terms
          </Link>
          <Link className="block" href="/contact">
            Contact
          </Link>
          <Link className="block" href="/order/track">
            Track order
          </Link>
        </div>
      </div>
    </footer>
  );
}
