import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact",
  description: "Mendhaus support for orders, shipping, and returns.",
};

export default function ContactPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <h1 className="font-display text-4xl text-ink">Contact</h1>
      <p className="mt-4">
        Mendhaus is a US home-goods storefront at {BRAND.domainHint}, operated from Colorado.
        Email{" "}
        <a className="text-moss underline" href={`mailto:${BRAND.supportEmail}`}>
          {BRAND.supportEmail}
        </a>
        . Include your order email and, if you have it, the order ID from your receipt.
      </p>
      <p className="mt-4">
        We handle order questions, tracking, damage, and returns. We typically reply within one
        business day (Mountain Time).
      </p>
    </article>
  );
}
