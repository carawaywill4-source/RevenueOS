import { after, NextResponse } from "next/server";
import { runCycle } from "@tributeready/revenueos";
import { appendJournal } from "@/lib/events";
import { supabaseConfigured } from "@/lib/supabase";
import { createMendhausAdapter } from "@/revenueos/adapter";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured — owner must create a Mendhaus project" },
      { status: 503 },
    );
  }

  const adapter = createMendhausAdapter();
  const result = await runCycle(adapter);

  await appendJournal(
    result.hourPlan?.overdrive
      ? `Zero-hour overdrive: ${result.hourPlan.learnedFromLastHour}`
      : `Cycle complete. Bottleneck ${result.observation.bottleneck.label}.`,
    {
      bottleneck: result.observation.bottleneck,
      money: result.observation.money,
      hourPlan: result.hourPlan,
      experimentIds: result.observation.openExperimentIds,
    },
  );

  after(async () => {
    // Single extra hunt round — organic only, no spend.
    try {
      await runCycle(createMendhausAdapter());
    } catch (error) {
      console.error("mendhaus chained cycle failed", error);
    }
  });

  return NextResponse.json({
    ok: true,
    site: "mendhaus",
    bottleneck: result.observation.bottleneck,
    money: result.observation.money,
    hourPlan: result.hourPlan,
    errors: result.observation.errors,
  });
}
