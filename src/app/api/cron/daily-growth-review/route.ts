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

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const REPORT_RECIPIENT = "care@tributeready.org";
const MAX_CHAIN_DEPTH = 3;
const CHAIN_DELAY_MS = 4_000;

/** Hourly digest at minute 0. Chained minute hunts do not email. */
function shouldSendHourlyEmail(request: Request): boolean {
  const url = new URL(request.url);
  if (url.searchParams.get("email") === "1") return true;
  if (url.searchParams.has("chain")) return false;
  if (request.headers.get("x-revenueos-hunt") === "chain") return false;
  return new Date().getUTCMinutes() === 0;
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
      // Heartbeat ticks burn ~50s; chained ticks burn a bit less to stay nested-safe.
      budgetMs: depth === 0 ? 50_000 : 35_000,
      maxRounds: depth === 0 ? 6 : 4,
    });
    const snapshot = hunt.last;
    const durableMemory = await probeDurableLedger();

    let emailId: string | undefined;
    const sendEmail = shouldSendHourlyEmail(request);
    if (
      sendEmail &&
      process.env.RESEND_API_KEY &&
      process.env.RESEND_FROM_EMAIL
    ) {
      const text = formatHourlyProfitEmail(snapshot);
      const { data, error } = await new Resend(
        process.env.RESEND_API_KEY,
      ).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: REPORT_RECIPIENT,
        subject: hourlyEmailSubject(snapshot),
        text,
      });
      if (error) throw new Error(error.message);
      emailId = data?.id;
    }

    if (shouldChainHunt(snapshot)) {
      scheduleNextHunt(request, depth);
    }

    const executableBets =
      snapshot.cycle?.experimentsTouched.filter((e) =>
        Boolean(e.hypothesis.safeActionType),
      ).length ?? 0;
    const ownerWaiting =
      snapshot.cycle?.experimentsTouched.filter(
        (e) => !e.hypothesis.safeActionType,
      ).length ?? 0;

    return NextResponse.json({
      ok: true,
      engine: "revenueos",
      hunt: "always-on",
      mode: "continuous",
      rounds: hunt.rounds,
      elapsedMs: hunt.elapsedMs,
      chainDepth: depth,
      chained: shouldChainHunt(snapshot) && depth < MAX_CHAIN_DEPTH,
      memory: durableMemory ? "durable" : "ephemeral",
      emailed: Boolean(emailId),
      emailId,
      hourPlan: snapshot.cycle?.hourPlan ?? null,
      overdrive: snapshot.cycle?.ambition?.overdrive ?? false,
      bottleneck: snapshot.bottleneck,
      nextAction: snapshot.nextAction,
      money: snapshot.money,
      topOpportunity: snapshot.opportunities[0] ?? null,
      scorecard: snapshot.cycle?.scorecard ?? null,
      learningDelta: snapshot.cycle?.scorecard.learningDelta ?? null,
      diagnosis: snapshot.cycle?.scorecard.diagnosis ?? null,
      attributions: snapshot.cycle?.attributions ?? [],
      executed: snapshot.cycle?.executed ?? [],
      strategy: snapshot.cycle?.strategy ?? null,
      anomalies: snapshot.cycle?.anomalies ?? [],
      ambition: snapshot.cycle?.ambition ?? null,
      shortfall: snapshot.cycle?.shortfall ?? null,
      regime: snapshot.cycle?.regime ?? null,
      metaPolicy: snapshot.cycle?.metaPolicy ?? null,
      curriculum: snapshot.cycle?.curriculum
        ? {
            priority: snapshot.cycle.curriculum.priority,
            focusCategory: snapshot.cycle.curriculum.focusCategory,
            informationGap: snapshot.cycle.curriculum.informationGap,
          }
        : null,
      betMix: { executable: executableBets, ownerWaiting },
      moneyPlan: snapshot.cycle
        ? {
            totalProjectedMonthlyProfitUsd:
              snapshot.cycle.moneyPlan.totalProjectedMonthlyProfitUsd,
            effortUsed: snapshot.cycle.moneyPlan.effortUsed,
            effortBudget: snapshot.cycle.moneyPlan.effortBudget,
            marginalDollar: snapshot.cycle.moneyPlan.marginalDollar,
            items: snapshot.cycle.moneyPlan.items.slice(0, 5).map((item) => ({
              title: item.title,
              category: item.category,
              projectedMonthlyProfitUsd: item.projectedMonthlyProfitUsd,
              profitPerEffort: item.profitPerEffort,
            })),
          }
        : null,
      audience: snapshot.cycle
        ? {
            personas: snapshot.cycle.world.audience.personas.map((p) => p.label),
            salesDifficulty: snapshot.cycle.world.audience.salesDifficulty,
            resolveMultiplier: snapshot.cycle.world.audience.resolveMultiplier,
            channelPlan: snapshot.cycle.world.audience.channelPlan
              .slice(0, 8)
              .map((play) => ({
                channel: play.channel,
                persona: play.persona,
                intent: play.intent,
                fit: play.fit,
                needsOwner: play.needsOwner,
                angle: play.angle,
              })),
          }
        : null,
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
