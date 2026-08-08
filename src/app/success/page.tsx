import { Check, Leaf } from "lucide-react";
import Link from "next/link";
import Stripe from "stripe";
import { FulfillmentStatus } from "@/components/fulfillment-status";

export const metadata = {
  title: "Your collection is being prepared",
};

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const paid = await verifyPaidSession(sessionId);

  return (
    <main className="botanical-glow soft-grid grid min-h-screen place-items-center px-5 py-16">
      <div className="w-full max-w-xl rounded-[2rem] border border-forest/10 bg-paper p-8 text-center paper-shadow sm:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-forest text-white">
          <Check size={28} />
        </span>
        <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.24em] text-gold">
          {paid ? "Payment received" : "Order status"}
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-forest sm:text-5xl">
          {paid
            ? "Their collection is being prepared with care."
            : "We could not verify this payment link."}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-forest/55">
          {paid
            ? "Your print-ready files and private memorial link will arrive at the email used during checkout."
            : "If you completed a purchase, use the return link from Stripe or email care@tributeready.org for help."}
        </p>
        {paid && sessionId ? <FulfillmentStatus sessionId={sessionId} /> : null}
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 text-xs font-bold text-forest"
        >
          <Leaf size={14} className="text-sage" />
          Return to TributeReady
        </Link>
      </div>
    </main>
  );
}

async function verifyPaidSession(sessionId?: string) {
  if (
    !sessionId?.startsWith("cs_") ||
    !process.env.STRIPE_SECRET_KEY
  ) {
    return false;
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session.payment_status === "paid";
  } catch {
    return false;
  }
}
