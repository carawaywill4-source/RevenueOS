import { NextResponse } from "next/server";
import {
  decodeEmailParam,
  suppressEmail,
  suppressionIsConfigured,
  verifyUnsubscribe,
} from "@/lib/outreach-suppression";

// RFC 8058 one-click: mail clients POST here directly from the header, with no
// human involved, so it must suppress immediately and never ask a question.
export async function POST(request: Request) {
  if (!suppressionIsConfigured()) {
    return NextResponse.json(
      { error: "Unsubscribe is not configured" },
      { status: 503 },
    );
  }

  const params = new URL(request.url).searchParams;
  const email = decodeEmailParam(params.get("e"));
  const token = params.get("t");
  if (!email || !token || !verifyUnsubscribe(email, token)) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }

  const suppressed = await suppressEmail(email);
  if (!suppressed) {
    return NextResponse.json(
      { error: "Unsubscribe failed, please reply to the email instead" },
      { status: 502 },
    );
  }

  return NextResponse.json({ unsubscribed: true });
}
