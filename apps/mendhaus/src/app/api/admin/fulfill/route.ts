import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { BRAND } from "@/lib/brand";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

const Body = z.object({
  orderId: z.string().uuid(),
  trackingNumber: z.string().min(4).max(64),
  carrier: z.string().min(2).max(40),
  supplierOrderId: z.string().max(80).optional(),
});

function authorized(request: Request) {
  const secret = process.env.OWNER_DASHBOARD_TOKEN || process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fulfillment payload" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: loadError } = await supabase
    .from("mh_orders")
    .select("id,email,status,items")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (loadError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (!["paid", "fulfilling"].includes(order.status)) {
    return NextResponse.json({ error: "Order is not fulfillable" }, { status: 400 });
  }

  const { error } = await supabase
    .from("mh_orders")
    .update({
      status: "shipped",
      tracking_number: parsed.data.trackingNumber,
      carrier: parsed.data.carrier,
      supplier_order_id: parsed.data.supplierOrderId ?? null,
      shipped_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.orderId)
    .in("status", ["paid", "fulfilling"]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL && order.email) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const items = (order.items as Array<{ name: string; quantity: number }>) ?? [];
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: order.email,
      subject: `Your Mendhaus order shipped`,
      text: [
        `Your order is on the way.`,
        ``,
        items.map((i) => `${i.quantity}× ${i.name}`).join("\n"),
        ``,
        `Carrier: ${parsed.data.carrier}`,
        `Tracking: ${parsed.data.trackingNumber}`,
        ``,
        `Questions: ${BRAND.supportEmail}`,
      ].join("\n"),
    });
  }

  return NextResponse.json({ ok: true });
}
