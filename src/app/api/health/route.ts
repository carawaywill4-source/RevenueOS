import { NextResponse } from "next/server";
import {
  fulfillmentIsConfigured,
  getSupabaseAdmin,
} from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!fulfillmentIsConfigured() || !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { status: "setup_required" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("orders")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { status: "healthy" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
