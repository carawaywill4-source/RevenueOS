import { after, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  cronRequestIsAuthorized,
  growthStorageIsConfigured,
  isMissingGrowthStorageError,
} from "@/lib/growth";
import { probeDurableLedger } from "@/revenueos/durable-store";
import {
  runContinuousHunt,
  shouldChainHunt,
} from "@/revenueos/continuous-hunt";
import {
  formatHourlyProfitEmail,
  hourlyEmailSubject,
} from "@/revenueos/hourly-email";
import { claimHourlyEmailSlot } from "@/revenueos/hourly-email-lock";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const REPORT_RECIPIENT = "care@tributeready.org";
const MAX_CHAIN_DEPTH = 3;
const CHAIN_DELAY_MS = 4_000;

/** Hourly digest once per UTC hour. Chained minute hunts do not email. */
function wantsHourlyEmail(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("email") === "1") return true;
  if (url.searchParams.has("chain")) return false;
  if (request.headers.get("x-revenueos-hunt") === "chain") return false;
  return true;
}

function chainDepth(request: Request): number {
  const url = new URL(request.url);
  const raw = url.searchParams.get("chain") ?? "0";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function scheduleNextHunt(request: Request, depth: number) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return;
  if (depth >= MAX_CHAIN_DEPTH) return;

  const url = new URL(request.url);
  url.searchParams.set("chain", String(depth + 1));
  url.searchParams.delete("email");
  const nextUrl = url.toString();
  const authorization = `Bearer ${secret}`;

  after(async () => {
    await new Promise((r) => setTimeout(r, CHAIN_DELAY_MS));
    try {
      await fetch(nextUrl, {
        method: "GET",
        headers: {
          authorization,
          "x-revenueos-hunt": "chain",
        },
        cache: "no-store",
      });
    } catch (error) {
      console.error("continuous hunt chain failed", error);
    }
  });
}

export async function GET(request: Request) {
  if (!cronRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!growthStorageIsConfigured()) {
    return NextResponse.json(
      { error: "GrowthOS is not configured" },
      { status: 503 },
    );
  }

  const depth = chainDepth(request);

  try {
    const hunt = await runContinuousHunt({
      budgetMs: depth === 0 ? 50_000 : 35_000,
      maxJobs: depth === 0 ? 8 : 6,
      skipEnqueue: depth > 0,
    });
    const snapshot = hunt.last;
    const durableMemory = await probeDurableLedger();

    let emailId: string | undefined;
    let emailSkip: string | undefined;
    const url = new URL(request.url);
    const wantEmail = wantsHourlyEmail(request);
    const forceRequested =
      url.searchParams.get("email") === "1" && url.searchParams.get("force") === "1";

    if (wantEmail && process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
      const claimed = await claimHourlyEmailSlot("tributeready");
      if (!claimed) {
        emailSkip = forceRequested ? "already_sent_this_hour" : "already_sent_this_hour";
      } else {
        try {
          const text = formatHourlyProfitEmail(hunt);
          const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: REPORT_RECIPIENT,
            subject: hourlyEmailSubject(hunt),
            text,
          });
          if (error) {
            emailSkip = error.message;
            console.error("hourly email failed", error);
          } else {
            emailId = data?.id;
          }
        } catch (error) {
          emailSkip = (error as Error).message;
          console.error("hourly email failed", error);
        }
      }
    } else if (wantEmail) {
      emailSkip = "resend_not_configured";
    } else {
      emailSkip = "chain_tick";
    }

    const chain = shouldChainHunt(hunt);
    if (chain) {
      scheduleNextHunt(request, depth);
    }

    return NextResponse.json({
      ok: true,
      engine: "revenueos",
      hunt: "pursuit",
      mode: "persistent_pursuit",
      rounds: hunt.rounds,
      elapsedMs: hunt.elapsedMs,
      chainDepth: depth,
      chained: chain && depth < MAX_CHAIN_DEPTH,
      claimableRemaining: hunt.claimableRemaining,
      drain: {
        claimed: hunt.drain.claimed,
        advanced: hunt.drain.advanced,
        executed: hunt.drain.executed,
        stillWaiting: hunt.drain.stillWaiting,
      },
      enqueued: hunt.plan.enqueuedCount,
      memory: durableMemory ? "durable" : "ephemeral",
      emailed: Boolean(emailId),
      emailId,
      emailSkip,
      ownerReport: {
        actionsCompleted: hunt.ownerReport.actionsCompleted,
        experimentsLaunched: hunt.ownerReport.experimentsLaunched,
        waitingForEvidence: hunt.ownerReport.waitingForEvidence,
        operationalFailure: hunt.ownerReport.operationalFailure,
        claimableBacklog: hunt.ownerReport.claimableBacklog,
      },
      bottleneck: snapshot.bottleneck,
      nextAction: snapshot.nextAction,
      money: snapshot.money,
      topOpportunity: snapshot.opportunities[0] ?? null,
    });
  } catch (error) {
    if (isMissingGrowthStorageError(error as { code?: string; message?: string })) {
      return NextResponse.json(
        { error: "Growth reporting schema is not installed" },
        { status: 503 },
      );
    }

    console.error("continuous revenue hunt failed");
    return NextResponse.json(
      { error: "continuous revenue hunt failed" },
      { status: 500 },
    );
  }
}
