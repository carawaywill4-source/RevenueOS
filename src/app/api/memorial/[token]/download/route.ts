import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { recordServerGrowthEvent } from "@/lib/growth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: order } = await supabase
      .from("orders")
      .select("pdf_path, growth_session_id")
      .eq("access_token", token)
      .eq("status", "fulfilled")
      .single();
    if (!order?.pdf_path) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabase.storage
      .from("memorial-files")
      .createSignedUrl(order.pdf_path, 5 * 60, {
        download: "memorial-collection.pdf",
      });
    if (error || !data?.signedUrl) throw new Error(error?.message);
    await recordServerGrowthEvent(order.growth_session_id, {
      name: "pdf_downloaded",
    });
    return NextResponse.redirect(data.signedUrl);
  } catch {
    return NextResponse.json(
      { error: "The download link could not be created." },
      { status: 503 },
    );
  }
}
