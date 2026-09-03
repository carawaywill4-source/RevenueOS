/**
 * Authenticated storefront limb for Mac RevenueOSCore.
 * Executes the SAME permissionless actions as the Vercel cron adapter.
 * Does not host the brain — only performs selected commercial work.
 */
import { NextResponse } from "next/server";
import type { SafeAction } from "@revenueos/core";
import { createAdapter } from "@/revenueos/adapter";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { actionType?: string; payload?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const actionType = body.actionType?.trim();
  if (!actionType) {
    return NextResponse.json({ error: "actionType_required" }, { status: 400 });
  }

  const adapter = createAdapter();
  const available = await Promise.resolve(adapter.listSafeActions());
  const match = available.find((a) => a.type === actionType);
  if (!match) {
    return NextResponse.json(
      { ok: false, detail: `unknown_or_disallowed_action:${actionType}` },
      { status: 400 },
    );
  }

  const payload: NonNullable<SafeAction["payload"]> = {
    ...(match.payload ?? {}),
  };
  if (body.payload) {
    for (const [k, v] of Object.entries(body.payload)) {
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        (Array.isArray(v) && v.every((x) => typeof x === "string"))
      ) {
        payload[k] = v as string | number | boolean | string[];
      }
    }
  }

  const action: SafeAction = { ...match, payload };
  const result = await adapter.execute(action);
  const maybeUrl = (result as unknown as { url?: string }).url;

  return NextResponse.json({
    ok: result.ok,
    detail: result.detail,
    url: typeof maybeUrl === "string" ? maybeUrl : undefined,
    site: adapter.id,
    actionType,
    at: new Date().toISOString(),
  });
}
