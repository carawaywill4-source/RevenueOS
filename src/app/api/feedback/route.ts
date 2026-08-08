import { NextResponse } from "next/server";
import {
  customerFeedbackSchema,
  growthStorageIsConfigured,
  isMissingGrowthStorageError,
  requestIsSameOrigin,
} from "@/lib/growth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MAX_BODY_BYTES = 8_192;

export async function POST(request: Request) {
  if (!requestIsSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = customerFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }

  if (!growthStorageIsConfigured()) {
    return NextResponse.json({ accepted: true, stored: false }, { status: 202 });
  }

  const feedback = parsed.data;
  const { error } = await getSupabaseAdmin().from("customer_feedback").insert({
    feedback_type: feedback.type,
    session_id: feedback.sessionId,
    rating: feedback.type === "draft_quality" ? feedback.rating : null,
    reason: feedback.reason ?? null,
  });

  if (!error) {
    return NextResponse.json({ accepted: true, stored: true });
  }

  if (isMissingGrowthStorageError(error)) {
    return NextResponse.json({ accepted: true, stored: false }, { status: 202 });
  }

  console.error("Customer feedback storage failed", { code: error.code });
  return NextResponse.json(
    { error: "Feedback storage is temporarily unavailable" },
    { status: 503 },
  );
}
