import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordServerGrowthEvent } from "@/lib/growth";

const reviewSchema = z.object({
  reviewToken: z.string().uuid(),
  displayName: z.string().trim().min(2).max(60),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(600),
  purchaseReason: z
    .enum(["ease", "writing", "design", "privacy", "speed", "bundle", "price", "other"])
    .optional(),
  improvement: z.string().trim().max(600).optional(),
  publicConsent: z.literal(true),
});

export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("reviews")
      .select("id, display_name, rating, body, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) throw new Error(error.message);

    return NextResponse.json(
      { reviews: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Review retrieval failed", error);
    return NextResponse.json({ reviews: [] });
  }
}

export async function POST(request: Request) {
  const parsed = reviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please complete every review field." },
      { status: 400 },
    );
  }

  if (containsPrivateContact(parsed.data.body)) {
    return NextResponse.json(
      {
        error:
          "Please remove email addresses, phone numbers, or web links from the public review.",
      },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, growth_session_id")
      .eq("review_token", parsed.data.reviewToken)
      .eq("status", "fulfilled")
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "We could not verify this order yet. Please try again shortly." },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("reviews").upsert(
      {
        order_id: order.id,
        display_name: parsed.data.displayName,
        rating: parsed.data.rating,
        body: parsed.data.body,
        purchase_reason: parsed.data.purchaseReason ?? null,
        improvement: parsed.data.improvement || null,
        public_consent_at: new Date().toISOString(),
        status: "published",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "order_id" },
    );

    if (error) throw new Error(error.message);
    await recordServerGrowthEvent(order.growth_session_id, {
      name: "review_submitted",
      metadata: { rating: parsed.data.rating },
    });

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Review submission failed", error);
    return NextResponse.json(
      { error: "Your review could not be saved. Please try again." },
      { status: 500 },
    );
  }
}

function containsPrivateContact(value: string) {
  return (
    /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value) ||
    /(?:https?:\/\/|www\.)\S+/i.test(value) ||
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(value)
  );
}
