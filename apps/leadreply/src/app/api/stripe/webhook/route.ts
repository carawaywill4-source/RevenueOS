import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { getStripe } from "@/lib/stripe";
import { newDownloadToken, recordPurchase } from "@/lib/purchases";

export async function POST(request: Request) {
  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 400 });
  }
  const raw = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email ?? session.customer_email ?? "buyer@unknown";
    const token = newDownloadToken();
    await recordPurchase({
      id: session.id,
      email,
      productId: BRAND.product.id,
      amountUsd: (session.amount_total ?? 0) / 100,
      stripeSessionId: session.id,
      createdAt: new Date().toISOString(),
      downloadToken: token,
    });
    // Download link is shown on /success via session retrieval.
  }
  return NextResponse.json({ received: true });
}
