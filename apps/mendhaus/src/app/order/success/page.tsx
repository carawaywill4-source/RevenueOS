import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { resendConfigured } from "@/lib/mail";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const emailReady = resendConfigured();

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-display text-4xl text-ink">Order confirmed</h1>
      <p className="mt-4 text-ink/75">
        {emailReady
          ? "A receipt is on its way. Tracking follows when the warehouse scans the package — usually within a few business days."
          : `Payment received. Save your Stripe receipt. Questions: ${BRAND.supportEmail}.`}
      </p>
      {session_id ? (
        <p className="mt-3 text-xs text-ink/50">Checkout reference: {session_id.slice(0, 18)}…</p>
      ) : null}
      <Link href="/shop" className="mt-8 inline-block text-sm text-moss underline">
        Continue shopping
      </Link>
    </div>
  );
}
