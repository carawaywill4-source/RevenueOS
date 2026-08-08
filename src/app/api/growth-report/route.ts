import { NextResponse } from "next/server";
import {
  cronRequestIsAuthorized,
  getAggregateGrowthReport,
  growthStorageIsConfigured,
  isMissingGrowthStorageError,
} from "@/lib/growth";

export async function GET(request: Request) {
  if (!cronRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!growthStorageIsConfigured()) {
    return NextResponse.json(
      { error: "Growth reporting is not configured" },
      { status: 503 },
    );
  }

  const rawDays = new URL(request.url).searchParams.get("days");
  const days = rawDays === null ? 7 : Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > 90) {
    return NextResponse.json(
      { error: "days must be an integer from 1 to 90" },
      { status: 400 },
    );
  }

  try {
    const report = await getAggregateGrowthReport(days);
    return NextResponse.json(
      { report },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isMissingGrowthStorageError(error as { code?: string; message?: string })) {
      return NextResponse.json(
        { error: "Growth reporting schema is not installed" },
        { status: 503 },
      );
    }

    console.error("Growth report failed");
    return NextResponse.json(
      { error: "Growth reporting is temporarily unavailable" },
      { status: 500 },
    );
  }
}
