import { NextResponse } from "next/server";
import { ingestBeaconEvent, type BeaconEvent } from "@revenueos/core";
import { createAdapter } from "@/revenueos/adapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteIdFromAdapter(): string {
  return createAdapter().id;
}

function pickString(v: unknown, cap = 400): string | undefined {
  return typeof v === "string" ? v.slice(0, cap) : undefined;
}

const ALLOWED_KINDS = new Set([
  "page_view",
  "cta_click",
  "checkout_start",
  "checkout_complete",
  "scroll_depth",
]);

export async function POST(request: Request) {
  const siteId = siteIdFromAdapter();
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  const kind = typeof body.kind === "string" ? body.kind : "page_view";
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ ok: false, reason: "invalid_kind" }, { status: 400 });
  }
  const ua = request.headers.get("user-agent") ?? undefined;
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined;
  const event: BeaconEvent = {
    kind: kind as BeaconEvent["kind"],
    siteId,
    url: pickString(body.url) ?? "",
    referrer: pickString(body.referrer),
    path: pickString(body.path),
    slug: pickString(body.slug, 200),
    ua,
    ip,
  };
  if (!event.url) {
    return NextResponse.json({ ok: false, reason: "missing_url" }, { status: 400 });
  }
  const adapter = createAdapter();
  const store = adapter.getExperimentStore();
  const result = await ingestBeaconEvent({ event, store });
  return NextResponse.json({
    ok: result.ok,
    ...(result.ok ? { actionClass: result.actionClass } : { reason: result.reason }),
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: "POST { kind, url, path, slug, referrer } — page_view | cta_click | checkout_start | checkout_complete | scroll_depth",
  });
}
