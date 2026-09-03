import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ingestApexPurchase } from "@revenueos/core";
import { BRAND } from "@/lib/brand";
import { getStripe } from "@/lib/stripe";
import { newDownloadToken, recordPurchase } from "@/lib/purchases";
import { createAdapter } from "@/revenueos/adapter";

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
    const email =
      session.customer_details?.email ?? session.customer_email ?? "buyer@unknown";
    const token = newDownloadToken();
    const amountUsd = (session.amount_total ?? 0) / 100;
    await recordPurchase({
      id: session.id,
      email,
      productId: BRAND.product.id,
      amountUsd,
      stripeSessionId: session.id,
      createdAt: new Date().toISOString(),
      downloadToken: token,
    });

    // APEX commercial truth — never blocks fulfillment on learning failure.
    try {
      const adapter = createAdapter();
      const store = adapter.getExperimentStore();
      const successUrl =
        typeof session.success_url === "string" ? session.success_url : undefined;
      const emailHash = createHash("sha256").update(email).digest("hex").slice(0, 16);
      await ingestApexPurchase({
        store,
        businessId: adapter.id,
        stripeSessionId: session.id,
        amountUsd,
        productId: BRAND.product.id,
        requestUrl: successUrl,
        emailHash,
      });
    } catch {
      // fulfillment already recorded
    }
  }
  return NextResponse.json({ received: true });
}
