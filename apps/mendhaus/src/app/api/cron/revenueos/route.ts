import { NextResponse } from "next/server";
import {
  buildOwnerReportSummary,
  runPursuitTick,
} from "@revenueos/core";
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

/** One pursuit drain per scheduled 15-minute window. */
async function claimCycleSlot(): Promise<boolean> {
  const now = new Date();
  now.setUTCMinutes(Math.floor(now.getUTCMinutes() / 15) * 15, 0, 0);
  const summary = `revenueos-cycle:${now.toISOString()}`;
  const { error } = await getSupabaseAdmin().from("mh_journal").insert({
    kind: "revenueos_cycle",
    summary,
    detail: { siteId: "mendhaus", mode: "pursuit" },
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

  const adapter = createMendhausAdapter();
  let plan: Awaited<ReturnType<typeof runPursuitTick>>["plan"];
  let drain: Awaited<ReturnType<typeof runPursuitTick>>["drain"];
  try {
    ({ plan, drain } = await runPursuitTick(adapter, {
      budgetMs: 50_000,
      maxJobs: 8,
    }));
  } catch (error) {
    console.error("mendhaus RevenueOS pursuit tick failed", error);
    return NextResponse.json(
      { ok: false, error: `RevenueOS pursuit failed: ${(error as Error).message}` },
      { status: 500 },
    );
  }

  const store = adapter.getExperimentStore();
  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - 3_600_000).toISOString();
  const events = store.listPursuitEvents
    ? await store.listPursuitEvents("mendhaus", { since: windowStart, limit: 100 })
    : [];
  const pursuits = store.listPursuits
    ? await store.listPursuits("mendhaus")
    : [];
  const hourPulse = plan.observation.hourPulse;
  const ownerReport = buildOwnerReportSummary({
    siteId: "mendhaus",
    windowStart,
    windowEnd,
    events,
    pursuits,
    hourRevenueUsd: hourPulse?.revenueUsd ?? 0,
    hourPurchases: hourPulse?.purchases ?? 0,
    hourLandingViews: hourPulse?.landingViews ?? 0,
    hadExecutableCapacity: plan.concurrentSlots > 0,
  });

  await appendJournal(
    drain.executed > 0
      ? `Pursuit drain: ${drain.executed} executed, ${drain.stillWaiting} waiting.`
      : `Pursuit tick: enqueued ${plan.enqueuedCount}, advanced ${drain.advanced}.`,
    {
      bottleneck: plan.observation.bottleneck,
      money: plan.observation.money,
      drain,
      enqueued: plan.enqueuedCount,
      attack: true,
      dailyTargetUsd: 10_000,
      mode: "pursuit",
    },
  );

  let emailId: string | undefined;
  let emailSkip: string | undefined;
  // Single portfolio digest owns owner email unless explicitly disabled.
  if (process.env.PORTFOLIO_DIGEST_ENABLED !== "0") {
    emailSkip = "deferred_to_portfolio_digest";
  } else if (resendConfigured()) {
    const launchClaimed = await claimLaunchEmail();
    const emailClaimed = launchClaimed
      ? ((await claimHourlyEmailSlot()), true)
      : await claimHourlyEmailSlot();
    if (!emailClaimed) {
      emailSkip = "already_sent_this_hour";
    } else {
      const [hour, week, discovery] = await Promise.all([
        getLastHourPulse(),
        getWindowSnapshot(7),
        loadDiscoveryState(),
      ]);
      const actionsCompleted = drain.jobs
        .filter((job) => job.workSummary?.includes("Executed") || job.state === "WAITING_FOR_EVIDENCE")
        .map((job) => job.workSummary ?? `${job.state}: ${job.title}`)
        .slice(0, 8);
      const snapshot = {
        hour,
        weekRevenueUsd: week.orders.grossRevenueUsd,
        nextAction:
          ownerReport.nextQueue[0] ??
          plan.observation.bottleneck.label,
        bottleneckLabel: plan.observation.bottleneck.label,
        actionsCompleted,
        discoverySummary: discovery.researchSummary,
        discoveryAttacks: discovery.attacks.map((a) => a.query).slice(0, 4),
        publishedTopics: discovery.publishedTopics
          .slice(0, 4)
          .map((t) => `https://mendhaus.shop/topics/${t.slug}`),
        learningDelta: discovery.lessons[0],
        ownerReport,
      };
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
          : formatMendhausHourlyEmail(snapshot),
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
    mode: "persistent_pursuit",
    dailyTargetUsd: 10_000,
    bottleneck: plan.observation.bottleneck,
    money: plan.observation.money,
    emailed: Boolean(emailId),
    emailId,
    emailSkip,
    errors: plan.observation.errors,
    drain: {
      claimed: drain.claimed,
      advanced: drain.advanced,
      executed: drain.executed,
      stillWaiting: drain.stillWaiting,
      claimableRemaining: drain.claimableRemaining,
    },
    enqueued: plan.enqueuedCount,
    ownerReport: {
      actionsCompleted: ownerReport.actionsCompleted,
      experimentsLaunched: ownerReport.experimentsLaunched,
      waitingForEvidence: ownerReport.waitingForEvidence,
      operationalFailure: ownerReport.operationalFailure,
      claimableBacklog: ownerReport.claimableBacklog,
    },
  });
}
