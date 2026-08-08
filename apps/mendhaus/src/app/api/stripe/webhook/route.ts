import { NextResponse } from "next/server";
import Stripe from "stripe";
import { recordEvent } from "@/lib/events";
import { sendMendhausEmail } from "@/lib/mail";
import { stripeFeeUsd } from "@/lib/money";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error: claimError } = await supabase.from("mh_journal").insert({
    kind: "stripe_event",
    summary: `stripe-event:${event.id}`,
    detail: { type: event.type },
  });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json(
      { error: `Could not persist Stripe event idempotency key: ${claimError.message}` },
      { status: 500 },
    );
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntent =
      typeof charge.payment_intent === "string" ? charge.payment_intent : null;
    if (paymentIntent) {
      const { data: order } = await supabase
        .from("mh_orders")
        .select("id,session_id,gross_revenue_usd,attribution,estimated_profit_usd")
        .eq("payment_intent_id", paymentIntent)
        .maybeSingle();
      await supabase
        .from("mh_orders")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString(),
          realized_profit_usd: 0,
        })
        .eq("payment_intent_id", paymentIntent);
      if (order?.session_id) {
        await recordEvent({
          name: "refund",
          sessionId: order.session_id,
          orderId: order.id,
          attribution: order.attribution ?? {},
          metadata: { gross: order.gross_revenue_usd },
        });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.expired") {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) {
      await supabase
        .from("mh_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "awaiting_payment");
    }
    return NextResponse.json({ received: true });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, awaitingAsynchronousPayment: true });
  }
  const orderId = session.metadata?.order_id;
  const email = session.customer_details?.email;
  if (!orderId || !email) {
    return NextResponse.json({ error: "Missing order details" }, { status: 400 });
  }

  const { data: order, error } = await supabase
    .from("mh_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (error || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  const paidTotal = (session.amount_total ?? 0) / 100;
  const taxTotal = (session.total_details?.amount_tax ?? 0) / 100;
  const shippingTotal = (session.total_details?.amount_shipping ?? 0) / 100;
  const fee = stripeFeeUsd(paidTotal);
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : null;
  const realized = Number(
    (
      paidTotal -
      Number(order.cogs_usd) -
      Number(order.shipping_cost_usd) -
      Number(order.fulfillment_fee_usd) -
      fee -
      taxTotal
    ).toFixed(2),
  );

  const shippingDetails = session.collected_information?.shipping_details ?? null;
  const shipTo = shippingDetails?.address;
  const shippingAddress =
    shipTo ?
      {
        name: shippingDetails?.name ?? session.customer_details?.name ?? null,
        phone: session.customer_details?.phone ?? null,
        line1: shipTo.line1,
        line2: shipTo.line2,
        city: shipTo.city,
        state: shipTo.state,
        postal_code: shipTo.postal_code,
        country: shipTo.country,
      }
    : session.customer_details?.address
      ? {
          name: session.customer_details.name ?? null,
          phone: session.customer_details.phone ?? null,
          line1: session.customer_details.address.line1,
          line2: session.customer_details.address.line2,
          city: session.customer_details.address.city,
          state: session.customer_details.address.state,
          postal_code: session.customer_details.address.postal_code,
          country: session.customer_details.address.country,
        }
      : null;

  await supabase
    .from("mh_customers")
    .upsert({ email: email.toLowerCase() }, { onConflict: "email" });

  const orderUpdate: Record<string, unknown> = {
    // Payment is not fulfillment. A supplier submission must transition this
    // separately after a reviewed SKU/variant is accepted.
    status: "paid",
    email: email.toLowerCase(),
    paid_at: new Date().toISOString(),
    payment_intent_id: paymentIntent,
    gross_revenue_usd: paidTotal,
    shipping_usd: shippingTotal,
    tax_usd: taxTotal,
    stripe_fee_usd: fee,
    realized_profit_usd: realized,
  };
  if (shippingAddress) {
    orderUpdate.shipping_address = shippingAddress;
  }

  const { data: transitioned, error: orderUpdateError } = await supabase
    .from("mh_orders")
    .update(orderUpdate)
    .eq("id", orderId)
    .eq("status", "awaiting_payment")
    .select("id");

  // If shipping_address column is not migrated yet, retry without it. Do not
  // duplicate customer address data into a general-purpose journal.
  if (orderUpdateError && shippingAddress) {
    delete orderUpdate.shipping_address;
    const retry = await supabase
      .from("mh_orders")
      .update(orderUpdate)
      .eq("id", orderId)
      .eq("status", "awaiting_payment")
      .select("id");
    if (retry.error) {
      return NextResponse.json({ error: retry.error.message }, { status: 500 });
    }
    if (!retry.data?.length) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } else if (orderUpdateError) {
    return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });
  } else if (!transitioned?.length) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await recordEvent({
    name: "purchase",
    sessionId: order.session_id ?? session.metadata?.session_id ?? crypto.randomUUID(),
    orderId,
    attribution: order.attribution ?? {},
    metadata: {
      gross: paidTotal,
      profit: realized,
      patternKey: session.metadata?.pattern_key,
    },
  });

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    const items = (order.items as Array<{ name: string; quantity: number }>) ?? [];
    await sendMendhausEmail({
      to: email,
      subject: `Mendhaus order confirmed`,
      text: [
        `Thanks for your order.`,
        ``,
        items.map((i) => `${i.quantity}× ${i.name}`).join("\n"),
        ``,
        `Total: $${paidTotal.toFixed(2)}`,
        `We'll email tracking when the package ships (typically 3–7 business days for US-warehouse items).`,
        ``,
        `Questions: ${process.env.RESEND_REPLY_TO || "care@mendhaus.shop"}`,
      ].join("\n"),
    });
  }

  return NextResponse.json({ received: true });
}
