import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Mendhaus collects and uses order, analytics, and support data.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <h1 className="font-display text-4xl text-ink">Privacy</h1>
      <p className="mt-4">
        Mendhaus ({BRAND.domainHint}) collects what we need to sell you a product, ship it, support
        you, and understand which pages lead to purchases. We do not sell personal information and
        we do not share it for cross-context behavioral advertising.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">What we collect</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Email, shipping address, and payment confirmation from Stripe Checkout.</li>
        <li>Order contents, refunds, tracking numbers, and support messages.</li>
        <li>
          Store analytics: landing page, referrer, UTM tags, product views, carts, scroll depth, and
          checkouts. Used to improve the catalog — not to profile you across other sites.
        </li>
      </ul>
      <h2 className="mt-8 font-display text-2xl text-ink">Processors</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Stripe — payments and checkout.</li>
        <li>Supabase — order and event storage.</li>
        <li>Resend — transactional email (order and shipping notices) when configured.</li>
        <li>
          CJ Dropshipping and related warehouses — receive your shipping name, address, and SKU to
          fulfill the order. Not for marketing lists.
        </li>
        <li>Vercel — hosts the storefront.</li>
      </ul>
      <h2 className="mt-8 font-display text-2xl text-ink">Retention &amp; requests</h2>
      <p>
        We keep order records as required for tax, fraud, and accounting. Analytics events may be
        aggregated or deleted over time. Email {BRAND.supportEmail} for access or deletion requests;
        we may retain what the law requires even after a one-time purchase.
      </p>
    </article>
  );
}
