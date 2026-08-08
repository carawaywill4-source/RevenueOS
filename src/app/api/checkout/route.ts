import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import {
  fulfillmentIsConfigured,
  getSupabaseAdmin,
} from "@/lib/supabase-admin";

const checkoutSchema = z.object({
  details: z.object({
    name: z.string().trim().min(2).max(100),
    birthYear: z.string().trim().max(4),
    passingYear: z.string().trim().max(4),
    relationship: z.string().trim().max(40),
    qualities: z.string().trim().max(300),
    memories: z.string().trim().min(15).max(3000),
    saying: z.string().trim().max(300),
    serviceDetails: z.string().trim().max(1500),
    programFormat: z.enum(["bifold", "keepsake"]).optional(),
    serviceTitle: z.string().trim().max(120).optional(),
    serviceDate: z.string().trim().max(120).optional(),
    serviceLocation: z.string().trim().max(180).optional(),
    orderOfService: z.string().trim().max(2000).optional(),
    readingOrPoem: z.string().trim().max(1200).optional(),
    acknowledgments: z.string().trim().max(600).optional(),
    theme: z.enum(["garden", "classic", "sky"]),
  }),
  draft: z.object({
    heading: z.string().max(100),
    obituary: z.string().max(2000),
    remembrance: z.string().max(1000),
    closing: z.string().max(150),
  }),
  photoData: z
    .string()
    .max(2_500_000)
    .refine(
      (value) => value === "" || value.startsWith("data:image/jpeg;base64,"),
      "Invalid photo",
    ),
  growth: z
    .object({
      sessionId: z.string().uuid().nullable(),
      attribution: z
        .object({
          source: z.string().regex(/^[a-zA-Z0-9._~-]{1,64}$/).optional(),
          medium: z.string().regex(/^[a-zA-Z0-9._~-]{1,64}$/).optional(),
          campaign: z.string().regex(/^[a-zA-Z0-9._~-]{1,64}$/).optional(),
          referrerHost: z
            .string()
            .regex(/^[a-zA-Z0-9.-]{1,253}$/)
            .optional(),
          capturedAt: z.iso.datetime(),
        })
        .strict()
        .nullable(),
    })
    .strict()
    .optional(),
});

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please finish and review the tribute before checkout." },
      { status: 400 },
    );
  }

  if (!fulfillmentIsConfigured()) {
    return NextResponse.json(
      {
        error:
          "Secure checkout and delivery will open once the owner connects Stripe, storage, and email. Your preview remains in this browser.",
      },
      { status: 503 },
    );
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const supabase = getSupabaseAdmin();
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.headers.get("origin") ||
      "http://localhost:3000";

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        memorial_name: parsed.data.details.name,
        details: parsed.data.details,
        draft: parsed.data.draft,
        status: "awaiting_payment",
        growth_session_id: parsed.data.growth?.sessionId ?? null,
        first_touch_attribution: parsed.data.growth?.attribution ?? {},
        last_touch_attribution: parsed.data.growth?.attribution ?? {},
      })
      .select("id")
      .single();

    if (orderError || !order) {
      throw new Error(`Could not create order: ${orderError?.message}`);
    }

    let photoPath: string | null = null;
    if (parsed.data.photoData) {
      photoPath = `${order.id}/portrait.jpg`;
      const photo = Buffer.from(
        parsed.data.photoData.replace("data:image/jpeg;base64,", ""),
        "base64",
      );
      const { error: photoError } = await supabase.storage
        .from("memorial-photos")
        .upload(photoPath, photo, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (photoError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw new Error(`Could not store photo: ${photoError.message}`);
      }
      await supabase
        .from("orders")
        .update({ photo_path: photoPath })
        .eq("id", order.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      integration_identifier: "tributeready_checkout_qmzptkva",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      customer_creation: "always",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 3499,
            product_data: {
              name: "TributeReady Memorial Collection",
              description:
                "Private memorial page and coordinated print-ready keepsakes",
            },
          },
        },
      ],
      metadata: {
        memorial_name: parsed.data.details.name,
        product: "memorial_collection",
        order_id: order.id,
        growth_session_id: parsed.data.growth?.sessionId ?? "",
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled#create`,
    });

    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", error);
    return NextResponse.json(
      { error: "Secure checkout is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
