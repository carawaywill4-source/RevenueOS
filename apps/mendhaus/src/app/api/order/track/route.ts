import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

const Body = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Tracking is not configured yet" }, { status: 503 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("mh_orders")
    .select("id,status,created_at,tracking_number,carrier")
    .eq("email", parsed.data.email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [] });
}
