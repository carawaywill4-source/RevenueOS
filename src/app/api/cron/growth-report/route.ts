import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  cronRequestIsAuthorized,
  getAggregateGrowthReport,
  growthStorageIsConfigured,
  isMissingGrowthStorageError,
  purgeExpiredGrowthEvents,
} from "@/lib/growth";

const REPORT_RECIPIENT = "care@tributeready.org";

export async function GET(request: Request) {
  if (!cronRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !growthStorageIsConfigured() ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM_EMAIL
  ) {
    return NextResponse.json(
      { error: "Weekly growth reporting is not configured" },
      { status: 503 },
    );
  }

  try {
    const report = await getAggregateGrowthReport(7);
    const purgedEvents = await purgeExpiredGrowthEvents();
    const { data, error } = await new Resend(
      process.env.RESEND_API_KEY,
    ).emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: REPORT_RECIPIENT,
      subject: `TributeReady weekly growth report — ${new Date()
        .toISOString()
        .slice(0, 10)}`,
      text: [
        "TributeReady privacy-safe aggregate growth report",
        "",
        JSON.stringify(report, null, 2),
        "",
        `Expired events removed: ${purgedEvents}`,
      ].join("\n"),
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      sent: true,
      emailId: data?.id,
      purgedEvents,
    });
  } catch (error) {
    if (isMissingGrowthStorageError(error as { code?: string; message?: string })) {
      return NextResponse.json(
        { error: "Growth reporting schema is not installed" },
        { status: 503 },
      );
    }

    console.error("Weekly growth report failed");
    return NextResponse.json(
      { error: "Weekly growth report failed" },
      { status: 500 },
    );
  }
}
