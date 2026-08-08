import { NextResponse } from "next/server";
import { runCycle } from "@tributeready/revenueos";
import { appendJournal } from "@/lib/events";
import { sendMendhausEmail, resendConfigured } from "@/lib/mail";
import { getLastHourPulse, getWindowSnapshot } from "@/lib/metrics";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { createMendhausAdapter } from "@/revenueos/adapter";
import {
  formatMendhausHourlyEmail,
  mendhausHourlySubject,
} from "@/revenueos/hourly-email";
import { loadDiscoveryState } from "@/lib/discovery";
import { planMendhausBrief } from "@/revenueos/ai-planner";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const OWNER_EMAIL = process.env.MENDHAUS_OWNER_EMAIL || "care@mendhaus.shop";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

/** Exactly one email per UTC hour. Uses journal — never pollutes experiments. */
async function claimHourlyEmailSlot(): Promise<boolean> {
  const hourKey = new Date().toISOString().slice(0, 13);
  const summary = `hourly-email:${hourKey}`;

  const existing = await getSupabaseAdmin()
    .from("mh_journal")
    .select("id")
    .eq("kind", "hourly_email")
    .eq("summary", summary)
    .limit(1)
    .maybeSingle();
  if (existing.data?.id) return false;

  const { error } = await getSupabaseAdmin().from("mh_journal").insert({
    kind: "hourly_email",
    summary,
    detail: { hourKey, siteId: "mendhaus" },
  });
  if (!error) return true;
  if (
    error.code === "23505" ||
    /duplicate|unique|already exists/i.test(error.message ?? "")
  ) {
    return false;
  }
  // Race: another tick inserted between select and insert
  const again = await getSupabaseAdmin()
    .from("mh_journal")
    .select("id")
    .eq("kind", "hourly_email")
    .eq("summary", summary)
    .limit(1)
    .maybeSingle();
  if (again.data?.id) return false;
  console.warn("mendhaus hourly email claim skipped", error.code, error.message);
  return false;
}

/** One autonomous decision cycle per scheduled 15-minute window. */
async function claimCycleSlot(): Promise<boolean> {
  const now = new Date();
  now.setUTCMinutes(Math.floor(now.getUTCMinutes() / 15) * 15, 0, 0);
  const summary = `revenueos-cycle:${now.toISOString()}`;
  const { error } = await getSupabaseAdmin().from("mh_journal").insert({
    kind: "revenueos_cycle",
    summary,
    detail: { siteId: "mendhaus" },
  });
  if (!error) return true;
  if (error.code === "23505" || /duplicate|unique/i.test(error.message)) return false;
  throw new Error(`Could not claim RevenueOS cycle: ${error.message}`);
}

/** A dedicated launch signal; independent from the regular hourly digest. */
async function claimLaunchEmail(): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from("mh_journal").insert({
    kind: "revenueos_launch",
    summary: "revenueos-launch:v1",
    detail: { siteId: "mendhaus", startedAt: new Date().toISOString() },
  });
  if (!error) return true;
  if (error.code === "23505" || /duplicate|unique/i.test(error.message)) return false;
  throw new Error(`Could not claim RevenueOS launch email: ${error.message}`);
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

  const claimed = await claimCycleSlot();
  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: "cycle_already_running_or_completed" });
  }

  let result: Awaited<ReturnType<typeof runCycle>>;
  try {
    result = await runCycle(createMendhausAdapter());
  } catch (error) {
    console.error("mendhaus RevenueOS cycle failed", error);
    return NextResponse.json(
      { ok: false, error: `RevenueOS cycle failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }

  await appendJournal(
    result.hourPlan?.overdrive
      ? `Zero-hour overdrive: ${result.hourPlan.learnedFromLastHour}`
      : `Cycle complete. Bottleneck ${result.observation.bottleneck.label}.`,
    {
      bottleneck: result.observation.bottleneck,
      money: result.observation.money,
      hourPlan: result.hourPlan,
      experimentIds: result.observation.openExperimentIds,
      attack: true,
      dailyTargetUsd: 10_000,
    },
  );

  let emailId: string | undefined;
  let emailSkip: string | undefined;
  if (resendConfigured()) {
    const launchClaimed = await claimLaunchEmail();
    // The launch notice is that hour's digest; reserve its regular slot so
    // startup never produces a duplicate owner email.
    const claimed = launchClaimed
      ? ((await claimHourlyEmailSlot()), true)
      : await claimHourlyEmailSlot();
    if (!claimed) {
      emailSkip = "already_sent_this_hour";
    } else {
      const [hour, week, discovery] = await Promise.all([
        getLastHourPulse(),
        getWindowSnapshot(7),
        loadDiscoveryState(),
      ]);
      const actionsCompleted = result.executed
        .filter(({ result: actionResult }) => actionResult.ok)
        .map(({ action, result: actionResult }) => `${action.type}: ${actionResult.detail}`)
        .slice(0, 8);
      const snapshot = {
        hour,
        weekRevenueUsd: week.orders.grossRevenueUsd,
        nextAction:
          result.hourPlan?.nextHourMoves?.[0]?.title ??
          result.observation.bottleneck.label,
        bottleneckLabel: result.observation.bottleneck.label,
        actionsCompleted,
        discoverySummary: discovery.researchSummary,
        discoveryAttacks: discovery.attacks.map((a) => a.query).slice(0, 4),
        publishedTopics: discovery.publishedTopics
          .slice(0, 4)
          .map((t) => `https://mendhaus.shop/topics/${t.slug}`),
        learningDelta:
          discovery.lessons[0] ?? result.scorecard.learningDelta ?? result.hourPlan?.learnedFromLastHour,
        plannerSource: result.plannerDecision?.source,
      };
      const aiBrief = await planMendhausBrief({
        hour,
        bottleneck: result.observation.bottleneck.label,
        executed: actionsCompleted,
        nextMove: snapshot.nextAction,
        discoverySummary: discovery.researchSummary,
        attackQueries: snapshot.discoveryAttacks,
      });
      const sent = await sendMendhausEmail({
        to: OWNER_EMAIL,
        subject: launchClaimed
          ? "Mendhaus RevenueOS launched — first-hour sales attack"
          : mendhausHourlySubject(snapshot),
        text: launchClaimed
          ? [
              "RevenueOS is live for Mendhaus.",
              "",
              formatMendhausHourlyEmail(snapshot),
              "",
              "It will research the live internet, publish intent topics, IndexNow, and merchandising only when visitors exist. Failed actions do not become learning evidence.",
            ].join("\n")
          : [
              formatMendhausHourlyEmail(snapshot),
              "",
              `Cycle analysis (${aiBrief.source}): ${aiBrief.report}`,
              `Evidence: ${aiBrief.evidence}`,
              `Next decision: ${aiBrief.nextMove}`,
              result.plannerDecision?.rationale
                ? `Planner: ${result.plannerDecision.rationale}`
                : "",
              aiBrief.fallbackReason ? `Planner fallback: ${aiBrief.fallbackReason}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
      });
      if (sent.ok) {
        emailId = sent.id;
        await appendJournal("Mendhaus owner email accepted by Resend", {
          emailId,
          recipient: OWNER_EMAIL,
          launch: launchClaimed,
        });
      } else {
        emailSkip = sent.error;
        await appendJournal("Mendhaus owner email failed to send", {
          error: sent.error,
          recipient: OWNER_EMAIL,
          launch: launchClaimed,
        });
        if (launchClaimed) {
          await getSupabaseAdmin()
            .from("mh_journal")
            .delete()
            .eq("kind", "revenueos_launch")
            .eq("summary", "revenueos-launch:v1");
        }
      }
    }
  } else {
    emailSkip = "resend_not_configured";
  }

  return NextResponse.json({
    ok: true,
    site: "mendhaus",
    attack: true,
    dailyTargetUsd: 10_000,
    bottleneck: result.observation.bottleneck,
    money: result.observation.money,
    hourPlan: result.hourPlan,
    emailed: Boolean(emailId),
    emailId,
    emailSkip,
    errors: result.observation.errors,
    executed: result.executed.map(({ action, result: actionResult }) => ({
      type: action.type,
      experimentId: action.payload?.experimentId,
      ok: actionResult.ok,
      detail: actionResult.detail,
    })),
    planner: result.plannerDecision
      ? {
          source: result.plannerDecision.source,
          selected: result.plannerDecision.selectedOpportunityIds,
          rationale: result.plannerDecision.rationale,
          fallbackReason: result.plannerDecision.fallbackReason,
        }
      : undefined,
  });
}
