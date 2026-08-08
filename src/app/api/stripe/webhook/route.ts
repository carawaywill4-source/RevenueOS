import { NextResponse } from "next/server";
import { Resend } from "resend";
import Stripe from "stripe";
import { createMemorialPdf } from "@/lib/memorial-pdf";
import {
  getSupabaseAdmin,
  type MemorialDetails,
  type MemorialDraft,
} from "@/lib/supabase-admin";
import { recordServerGrowthEvent } from "@/lib/growth";

export async function POST(request: Request) {
  if (
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM_EMAIL
  ) {
    return NextResponse.json(
      { error: "Fulfillment is not configured" },
      { status: 503 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  let growthSessionId: string | null = null;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const paymentIntent =
      typeof charge.payment_intent === "string" ? charge.payment_intent : null;
    if (paymentIntent) {
      const supabase = getSupabaseAdmin();
      await supabase
        .from("orders")
        .update({ status: "refunded" })
        .eq("payment_intent_id", paymentIntent);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.expired") {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) await markAbandonedOrder(orderId);
    return NextResponse.json({ received: true });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object;
  const orderId = session.metadata?.order_id;
  const email = session.customer_details?.email;
  if (!orderId || !email) {
    return NextResponse.json(
      { error: "Paid session is missing fulfillment details" },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, memorial_name, details, draft, photo_path, access_token, review_token, growth_session_id, status")
      .eq("id", orderId)
      .single();

    if (error || !order) throw new Error(error?.message || "Order not found");
    growthSessionId = order.growth_session_id;
    if (order.status === "fulfilled") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await recordServerGrowthEvent(growthSessionId, {
      name: "purchase_completed",
    });

    const draft = order.draft as MemorialDraft;
    const details = order.details as MemorialDetails;
    let photoDataUri: string | undefined;
    if (order.photo_path) {
      const { data: photo, error: photoError } = await supabase.storage
        .from("memorial-photos")
        .download(order.photo_path);
      if (photoError) throw new Error(photoError.message);
      const photoBuffer = Buffer.from(await photo.arrayBuffer());
      photoDataUri = `data:${photo.type || "image/jpeg"};base64,${photoBuffer.toString("base64")}`;
    }
    const pdf = await createMemorialPdf(
      order.memorial_name,
      draft,
      details,
      photoDataUri,
    );
    const filePath = `${order.id}/memorial-collection.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("memorial-files")
      .upload(filePath, pdf, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) throw new Error(uploadError.message);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";
    const memorialUrl = `${appUrl}/memorial/${order.access_token}`;
    const reviewUrl = `${appUrl}/review/${order.review_token}`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: `${order.memorial_name} — your memorial collection is ready`,
      html: deliveryEmail(order.memorial_name, memorialUrl, reviewUrl),
      attachments: [
        {
          filename: `${safeFilename(order.memorial_name)}-memorial.pdf`,
          content: pdf,
        },
      ],
    });
    if (emailError) throw new Error(emailError.message);

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        email,
        payment_intent_id:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
        pdf_path: filePath,
        status: "fulfilled",
        fulfilled_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (updateError) throw new Error(updateError.message);
    await recordServerGrowthEvent(growthSessionId, {
      name: "fulfillment_completed",
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    await recordServerGrowthEvent(growthSessionId, {
      name: "fulfillment_failed",
      metadata: { stage: "unknown" },
    });
    console.error("Automated fulfillment failed", error);
    return NextResponse.json(
      { error: "Fulfillment will be retried" },
      { status: 500 },
    );
  }
}

async function markAbandonedOrder(orderId: string) {
  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from("orders")
    .select("photo_path")
    .eq("id", orderId)
    .eq("status", "awaiting_payment")
    .single();
  if (!order) return;
  if (order.photo_path) {
    await supabase.storage.from("memorial-photos").remove([order.photo_path]);
  }
  await supabase
    .from("orders")
    .update({
      memorial_name: "Abandoned order",
      draft: {},
      details: {},
      photo_path: null,
      status: "abandoned",
    })
    .eq("id", orderId)
    .eq("status", "awaiting_payment");
}

function safeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function deliveryEmail(name: string, memorialUrl: string, reviewUrl: string) {
  return `
    <div style="background:#f8f6f1;padding:40px 16px;font-family:Arial,sans-serif;color:#173e35">
      <div style="max-width:560px;margin:auto;background:#fffdf8;border-radius:24px;padding:40px;border:1px solid #e3e8e4">
        <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c7b45;font-weight:bold">TributeReady</p>
        <h1 style="font-family:Georgia,serif;font-size:34px;line-height:1.1;margin:16px 0">Your collection for ${escapeHtml(name)} is ready.</h1>
        <p style="font-size:14px;line-height:1.7;color:#526762">The print-ready memorial collection is attached to this email. Your private memorial page is available through the button below.</p>
        <a href="${memorialUrl}" style="display:inline-block;margin-top:18px;background:#173e35;color:white;text-decoration:none;border-radius:999px;padding:14px 22px;font-size:13px;font-weight:bold">Open private memorial</a>
        <p style="margin-top:26px;font-size:13px;line-height:1.7;color:#526762"><strong>Printing the bifold program:</strong> choose US Letter, double-sided, actual size, and flip on the short edge. Fold the page down the center after printing.</p>
        <p style="margin-top:22px;font-size:13px;line-height:1.7;color:#526762">After you have reviewed the finished collection, you may <a href="${reviewUrl}" style="color:#173e35;font-weight:bold">share an honest verified review</a>. Reviews of every rating are welcome.</p>
        <p style="margin-top:28px;font-size:11px;line-height:1.6;color:#82908c">Keep this email private. Anyone with the memorial link can view the page.</p>
      </div>
    </div>`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character,
  );
}
