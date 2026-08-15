import { NextResponse } from "next/server";
import { handleOwnerMessage, type OwnerDialogState } from "@revenueos/core";
import { createAdapter } from "@/revenueos/adapter";
import { purchaseStats } from "@/lib/purchases";
import { checkoutAllowed } from "@/lib/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret =
    process.env.OWNER_DIALOG_TOKEN ||
    process.env.PORTFOLIO_PULSE_TOKEN ||
    process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message : "";
  if (!message.trim()) {
    return NextResponse.json({ ok: false, reason: "empty_message" }, { status: 400 });
  }

  const adapter = createAdapter();
  const stats = await purchaseStats();
  const state: OwnerDialogState = {
    activeBusinesses: [
      {
        siteId: adapter.id,
        displayName: adapter.id,
        revenueUsd: stats.revenueUsd,
        firstCustomerMode: stats.purchases === 0,
        paused: !checkoutAllowed(),
      },
    ],
  };

  const result = await handleOwnerMessage({ message, state });
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST { message: "..." } — returns { answer, proposedChanges, toolCalls?, source }',
  });
}
