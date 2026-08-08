import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Returns & refunds",
  description: "30-day returns for unused Mendhaus products in original condition.",
};

export default function ReturnsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-sm leading-7 text-ink/80">
      <h1 className="font-display text-4xl text-ink">Returns &amp; refunds</h1>
      <p className="mt-4">
        If an item is unused, in original packaging, and not as described, you can request a return
        within 30 days of delivery. Email {BRAND.supportEmail} with your order email, what you
        ordered, and photos if something arrived damaged. We will reply with a return authorization
        (RMA) and the warehouse address to ship to — do not mail items back without that email.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">What we refund</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Product price for approved returns after the warehouse confirms receipt.</li>
        <li>Outbound shipping if we shipped the wrong item or it arrived damaged.</li>
        <li>Return shipping is on you unless the item is defective or incorrect.</li>
      </ul>
      <h2 className="mt-8 font-display text-2xl text-ink">What we do not refund</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Used, assembled, or dirty items (except a documented defect).</li>
        <li>Items returned after 30 days without a prior exception.</li>
        <li>Change-of-mind on opened hygiene items (for example, used shower or sink tools).</li>
      </ul>
      <p className="mt-6">
        Refunds go back to the original payment method, typically within 5–10 business days after we
        receive the return. Stripe processing fees on the original charge are not always recoverable;
        we still refund you the product price we charged.
      </p>
    </article>
  );
}
