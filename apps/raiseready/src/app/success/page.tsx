import { getStripe } from "@/lib/stripe";
import { getPurchaseByToken, recordPurchase, newDownloadToken } from "@/lib/purchases";
import { BRAND } from "@/lib/brand";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let token: string | null = null;
  if (session_id && process.env.STRIPE_SECRET_KEY) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid") {
      token = newDownloadToken();
      await recordPurchase({
        id: session.id,
        email: session.customer_details?.email ?? "buyer@unknown",
        productId: BRAND.product.id,
        amountUsd: (session.amount_total ?? 0) / 100,
        stripeSessionId: session.id,
        createdAt: new Date().toISOString(),
        downloadToken: token,
      });
    }
  }
  return (
    <main className="wrap">
      <h1>You're in</h1>
      <p>Thanks for buying {BRAND.product.name}.</p>
      {token && session_id ? (
        <p>
          <a
            className="btn"
            href={`/api/download?token=${token}&session_id=${session_id}`}
          >
            Download your files
          </a>
        </p>
      ) : (
        <p>Payment confirmed — check your email or contact support if the download link is missing.</p>
      )}
    </main>
  );
}
