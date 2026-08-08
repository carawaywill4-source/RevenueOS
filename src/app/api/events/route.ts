import { NextResponse } from "next/server";
import {
  growthEventSchema,
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

  const parsed = growthEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  if (!growthStorageIsConfigured()) {
    return NextResponse.json({ accepted: true, stored: false }, { status: 202 });
  }

  const { error } = await getSupabaseAdmin().from("growth_events").insert({
    event_name: parsed.data.name,
    session_id: parsed.data.sessionId,
    metadata: parsed.data.metadata,
  });

  if (!error) {
    return NextResponse.json({ accepted: true, stored: true });
  }

  if (isMissingGrowthStorageError(error)) {
    return NextResponse.json({ accepted: true, stored: false }, { status: 202 });
  }

  console.error("Growth event storage failed", { code: error.code });
  return NextResponse.json(
    { error: "Event storage is temporarily unavailable" },
    { status: 503 },
  );
}
