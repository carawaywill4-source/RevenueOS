import QRCode from "qrcode";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: order } = await getSupabaseAdmin()
    .from("orders")
    .select("id")
    .eq("access_token", token)
    .eq("status", "fulfilled")
    .single();
  if (!order) return Response.json({ error: "Not found" }, { status: 404 });

  const origin =
    process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const png = await QRCode.toBuffer(`${origin}/memorial/${token}`, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 900,
    color: { dark: "#173e35", light: "#fffdf8" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="private-memorial-qr.png"',
      "Content-Type": "image/png",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
