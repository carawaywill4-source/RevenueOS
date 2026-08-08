import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { checkoutAllowed } from "@/lib/readiness";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  if (!checkoutAllowed()) {
    return NextResponse.json(
      { error: "Checkout not ready — OWNER_BLOCKED_FULFILLMENT or env incomplete" },
      { status: 503 },
    );
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3015";
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?cancelled=1`,
    customer_email: undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(BRAND.product.priceUsd * 100),
          product_data: {
            name: BRAND.product.name,
            description: BRAND.product.tagline,
          },
        },
      },
    ],
    metadata: {
      siteId: BRAND.siteId,
      productId: BRAND.product.id,
    },
  });
  return NextResponse.json({ url: session.url });
}
