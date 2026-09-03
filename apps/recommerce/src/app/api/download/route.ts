import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPurchaseByToken } from "@/lib/purchases";
import { getStripe } from "@/lib/stripe";
import { BRAND } from "@/lib/brand";

function kitBody() {
  const dir = path.join(process.cwd(), "content/product");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const parts: string[] = [];
  for (const f of files) {
    const full = path.join(dir, f);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    parts.push(`===== ${f} =====\n` + readFileSync(full, "utf8"));
  }
  return parts.join("\n\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const sessionId = url.searchParams.get("session_id");

  let productId = BRAND.product.id;
  let authorized = false;

  if (token) {
    const purchase = await getPurchaseByToken(token);
    if (purchase) {
      authorized = true;
      productId = purchase.productId;
    }
  }

  // Durable fulfillment: Stripe session is source of truth across serverless instances.
  if (!authorized && sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (
        session.payment_status === "paid" &&
        session.metadata?.siteId === BRAND.siteId
      ) {
        authorized = true;
        productId = session.metadata?.productId || productId;
      }
    } catch {
      /* ignore */
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  }

  return new NextResponse(kitBody(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${productId}-kit.md"`,
    },
  });
}
