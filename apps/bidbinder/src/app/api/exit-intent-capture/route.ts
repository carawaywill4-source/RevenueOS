import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CaptureBody = {
  email?: string;
  siteId?: string;
  source?: string;
  url?: string;
  referrer?: string;
  ts?: string;
};

function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function appendCapture(row: Record<string, unknown>) {
  const root =
    process.env.REVENUEOS_DATA_DIR ||
    (process.env.VERCEL ? "/tmp/revenueos" : path.join(process.cwd(), ".data"));
  const file = path.join(root, "exit-intent", "captures.json");
  let rows: unknown[] = [];
  try {
    rows = JSON.parse(await readFile(file, "utf8")) as unknown[];
    if (!Array.isArray(rows)) rows = [];
  } catch {
    rows = [];
  }
  rows.unshift(row);
  rows = rows.slice(0, 5000);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rows, null, 2));

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key && typeof row.email === "string" && typeof row.siteId === "string") {
    try {
      await fetch(`${url}/rest/v1/revenueos_captured_emails`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          site_id: row.siteId,
          email: row.email,
          source: row.source ?? "exit_intent",
          page_url: row.url ?? null,
          referrer: row.referrer ?? null,
        }),
      });
    } catch {
      // file capture already succeeded
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CaptureBody;
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!looksLikeEmail(email)) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }
    await appendCapture({
      email,
      siteId: String(body.siteId ?? "").slice(0, 64),
      source: String(body.source ?? "exit_intent").slice(0, 64),
      url: String(body.url ?? "").slice(0, 500),
      referrer: String(body.referrer ?? "").slice(0, 500),
      ts: body.ts ?? new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
}
