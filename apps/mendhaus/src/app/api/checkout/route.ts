import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductById } from "@/catalog/products";
import { parseAttribution } from "@/lib/attribution";
import { recordEvent } from "@/lib/events";
import { effectiveCartUnitPrice, kitPromoAppliesToCart, loadMerchState } from "@/lib/merch";
import { KITS } from "@/catalog/kits";
import { quoteCart } from "@/lib/money";
import { checkoutAllowed } from "@/lib/readiness";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getVerifiedListingForCheckout } from "@/lib/supplier-listings";

const Body = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(8),
      }),
    )
    .min(1)
    .max(20),
  email: z.string().email().optional(),
  sessionId: z.string().uuid(),
  attribution: z.unknown().optional(),
});

export async function POST(request: Request) {
  if (!checkoutAllowed()) {
    return NextResponse.json(
      {
        error:
          "Checkout is paused until Stripe, webhook, database, and supplier mapping are complete. See /owner.",
      },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cart" }, { status: 400 });
  }

  const merch = await loadMerchState();
  const cartProductIds = parsed.data.items.map((item) => item.productId);
  const qualifyingKitId = kitPromoAppliesToCart(merch.promo, cartProductIds)
    ? merch.promo?.kitId
    : undefined;
  let lines;
  try {
    lines = await Promise.all(
      parsed.data.items.map(async (item) => {
        const product = getProductById(item.productId);
        if (!product || !product.inStock) throw new Error("Unavailable product");
        const { listing, reason } = await getVerifiedListingForCheckout(product.id);
        if (!listing) throw new Error(reason ?? "Supplier inventory is unavailable");
        const cogsUsd = listing.unitCostUsd!;
        const unitPriceUsd = effectiveCartUnitPrice(product, merch.promo, cartProductIds);
        const priced = { ...product, cogsUsd };
        const fee = Number((unitPriceUsd * 0.029 + 0.3).toFixed(2));
        const profit = Number(
          (
            unitPriceUsd -
            cogsUsd -
            priced.shippingCostUsd -
            priced.fulfillmentFeeUsd -
            fee
          ).toFixed(2),
        );
        if (profit < product.minMarginUsd) throw new Error("Margin floor violated");
        return { ...item, product: priced, unitPriceUsd };
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "A product in the cart is unavailable" },
      { status: 400 },
    );
  }

  const quote = quoteCart(lines, { freeShippingAtUsd: merch.freeShippingAtUsd });

  const attribution = parseAttribution(JSON.stringify(parsed.data.attribution ?? {}));
  const supabase = getSupabaseAdmin();
  const email =
    parsed.data.email?.toLowerCase() ?? `pending+${parsed.data.sessionId}@mendhaus.invalid`;

  const { data: customer } = await supabase
    .from("mh_customers")
    .upsert({ email }, { onConflict: "email" })
    .select("id")
    .single();

  const { data: order, error: orderError } = await supabase
    .from("mh_orders")
    .insert({
      customer_id: customer?.id ?? null,
      email,
      status: "awaiting_payment",
      items: lines.map((line) => ({
        productId: line.product.id,
        slug: line.product.slug,
        name: line.product.name,
        quantity: line.quantity,
        unitPriceUsd: line.unitPriceUsd,
        cogsUsd: line.product.cogsUsd,
        kitId:
          qualifyingKitId &&
          KITS.find((kit) => kit.id === qualifyingKitId)?.productIds.includes(line.product.id)
            ? qualifyingKitId
            : undefined,
      })),
      subtotal_usd: quote.subtotalUsd,
      shipping_usd: quote.shippingUsd,
      tax_usd: quote.taxUsd,
      gross_revenue_usd: quote.grossRevenueUsd,
      cogs_usd: quote.cogsUsd,
      shipping_cost_usd: quote.shippingCostUsd,
      fulfillment_fee_usd: quote.fulfillmentFeeUsd,
      stripe_fee_usd: quote.stripeFeeUsd,
      estimated_profit_usd: quote.estimatedProfitUsd,
      attribution: attribution ?? {},
      session_id: parsed.data.sessionId,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }

  await recordEvent({
    name: "checkout_started",
    sessionId: parsed.data.sessionId,
    orderId: order.id,
    attribution: attribution ?? {},
    metadata: { gross: quote.grossRevenueUsd },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001").replace(/\/$/, "");
  const stripe = getStripe();
  const taxEnabled = process.env.MENDHAUS_STRIPE_TAX === "1";

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: parsed.data.email,
      success_url: `${appUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cart?cancelled=1`,
      metadata: {
        order_id: order.id,
        session_id: parsed.data.sessionId,
        site_id: "mendhaus",
        pattern_key: attribution?.patternKey ?? "",
        promo_id: merch.promo?.id ?? "",
        kit_id: qualifyingKitId ?? "",
        merch_updated_at: merch.updatedAt ?? "",
      },
      shipping_address_collection: { allowed_countries: ["US"] },
      line_items: [
        ...lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(line.unitPriceUsd * 100),
            product_data: {
              name: line.product.name,
              description: line.product.tagline,
            },
          },
        })),
        ...(quote.shippingUsd > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd" as const,
                  unit_amount: Math.round(quote.shippingUsd * 100),
                  product_data: { name: "Shipping" },
                },
              },
            ]
          : []),
      ],
      ...(taxEnabled ? { automatic_tax: { enabled: true } } : {}),
    });
  } catch (error) {
    await supabase.from("mh_orders").update({ status: "cancelled" }).eq("id", order.id);
    return NextResponse.json(
      { error: `Could not start secure checkout: ${(error as Error).message}` },
      { status: 502 },
    );
  }

  await supabase
    .from("mh_orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id);

  return NextResponse.json({ url: session.url, orderId: order.id });
}
