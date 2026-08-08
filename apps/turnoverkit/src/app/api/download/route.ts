import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPurchaseByToken } from "@/lib/purchases";
import { Readable } from "node:stream";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  const purchase = await getPurchaseByToken(token);
  if (!purchase) return NextResponse.json({ error: "invalid token" }, { status: 404 });

  const dir = path.join(process.cwd(), "content/product");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const parts: string[] = [];
  for (const f of files) {
    const full = path.join(dir, f);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    const { readFileSync } = await import("node:fs");
    parts.push(`===== ${f} =====\n` + readFileSync(full, "utf8"));
  }
  const body = parts.join("\n\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${purchase.productId}-kit.md"`,
    },
  });
}
