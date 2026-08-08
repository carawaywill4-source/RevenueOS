import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const querySchema = z.object({
  session_id: z.string().trim().startsWith("cs_").max(200),
});

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(
      parsed.data.session_id,
    );
    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment is not complete." }, { status: 402 });
    }

    const { data: order, error } = await getSupabaseAdmin()
      .from("orders")
      .select("status, access_token")
      .eq("stripe_session_id", session.id)
      .single();
    if (error || !order) {
      return NextResponse.json({ status: "processing" });
    }

    return NextResponse.json({
      status: order.status === "fulfilled" ? "fulfilled" : "processing",
      memorialUrl:
        order.status === "fulfilled"
          ? `/memorial/${order.access_token}`
          : undefined,
    });
  } catch {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
}
