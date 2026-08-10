import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  buildPortfolioDigest,
  formatPortfolioOwnerEmail,
  portfolioDigestSubject,
  type SitePulse,
} from "@revenueos/core";
import { cronRequestIsAuthorized } from "@/lib/growth";
import { claimHourlyEmailSlot } from "@/revenueos/hourly-email-lock";
import { resolvePortfolioSites } from "@/revenueos/portfolio-sites";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type VisitorRoll = {
  pageViews: number;
  ctaClicks: number;
  checkoutStarts: number;
  checkoutCompletes: number;
};

/**
 * Roll first-party beacon events (event_type='beacon') per site over the
 * reporting window. Visitors are the missing middle of the funnel — without
 * them the digest cannot tell "action fired but nobody saw it" apart from
 * "action fired, humans arrived, but no one bought".
 */
async function rollVisitors(
  siteIds: string[],
  windowStart: string,
): Promise<Record<string, VisitorRoll>> {
  const empty: Record<string, VisitorRoll> = {};
  for (const id of siteIds) {
    empty[id] = {
      pageViews: 0,
      ctaClicks: 0,
      checkoutStarts: 0,
      checkoutCompletes: 0,
    };
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return empty;
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("revenueos_pursuit_events")
      .select("site_id,detail")
      .eq("event_type", "beacon")
      .in("site_id", siteIds)
      .gte("created_at", windowStart)
      .limit(20_000);
    if (error || !data) return empty;
    for (const row of data as Array<{
      site_id: string;
      detail: { kind?: string } | null;
    }>) {
      const bucket = empty[row.site_id];
      if (!bucket) continue;
      const kind = row.detail?.kind ?? "";
      if (kind === "page_view") bucket.pageViews += 1;
      else if (kind === "cta_click") bucket.ctaClicks += 1;
      else if (kind === "checkout_start") bucket.checkoutStarts += 1;
      else if (kind === "checkout_complete") bucket.checkoutCompletes += 1;
    }
    return empty;
  } catch {
    return empty;
  }
}

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const REPORT_RECIPIENT =
  process.env.OWNER_ALERT_EMAIL ||
  process.env.PORTFOLIO_OWNER_EMAIL ||
  "care@tributeready.org";

function pulseToken() {
  return (
    process.env.PORTFOLIO_PULSE_TOKEN ||
    process.env.PORTFOLIO_CRON_SECRET ||
    process.env.CRON_SECRET ||
    ""
  );
}

async function fetchPulse(url: string, token: string): Promise<SitePulse> {
  const base = url.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/owner/pulse`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      // Pulse is a thin ledger read — 45s covers cold starts without aborting
      // half the portfolio as "timeout" every hour.
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
    }
    return (await res.json()) as SitePulse;
  } catch (e) {
    return {
      siteId: base,
      displayName: base,
      url: base,
      commerciallyLive: false,
      checkoutOpen: false,
      purchases: 0,
      revenueUsd: 0,
      firstCustomerMode: true,
      actionsCompleted: 0,
      exposureNotes: [],
      blockers: [],
      error: (e as Error).message,
    };
  }
}

/** Local TR/MH pulses without requiring their pulse routes yet. */
async function legacyPulse(
  siteId: "tributeready" | "mendhaus",
  displayName: string,
  url: string,
): Promise<SitePulse> {
  if (siteId === "tributeready") {
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/api/health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const ok = res.ok;
      return {
        siteId,
        displayName,
        url,
        commerciallyLive: ok,
        checkoutOpen: ok,
        purchases: 0,
        revenueUsd: 0,
        firstCustomerMode: true,
        firstCustomerStage: "buyer_exposure",
        actionsCompleted: 0,
        exposureNotes: ["TributeReady production — checkout requires tribute draft"],
        blockers: ok ? [] : ["health check failed"],
      };
    } catch (e) {
      return {
        siteId,
        displayName,
        url,
        commerciallyLive: false,
        checkoutOpen: false,
        purchases: 0,
        revenueUsd: 0,
        firstCustomerMode: true,
        actionsCompleted: 0,
        exposureNotes: [],
        blockers: [],
        error: (e as Error).message,
      };
    }
  }
  // Mendhaus: supplier-gated ecommerce
  return {
    siteId,
    displayName,
    url,
    commerciallyLive: process.env.MENDHAUS_SUPPLIER_READY === "1",
    checkoutOpen: process.env.MENDHAUS_SUPPLIER_READY === "1",
    purchases: 0,
    revenueUsd: 0,
    firstCustomerMode: true,
    firstCustomerStage: "buyer_exposure",
    actionsCompleted: 0,
    exposureNotes: ["Physical goods — supplier gate required for paid orders"],
    blockers:
      process.env.MENDHAUS_SUPPLIER_READY === "1"
        ? []
        : ["MENDHAUS_SUPPLIER_READY not set — do not take paid orders"],
  };
}

export async function GET(request: Request) {
  if (!cronRequestIsAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // PHASE 2 — portfolio orchestration/reporting belongs on Mac Core.
  if (process.env.REVENUEOS_VERCEL_BRAIN !== "1") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      mode: "mac_brain_only",
      cycleStatus: "refused_cloud_orchestration",
      note: "Portfolio digest moved off Vercel — Mac Core owns continuous portfolio work",
    });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const claimed = await claimHourlyEmailSlot("portfolio");
  if (!claimed && !force) {
    return NextResponse.json({
      ok: true,
      skipped: "already_sent_this_hour",
      note: "One portfolio email per UTC hour",
    });
  }

  const token = pulseToken();
  const refs = resolvePortfolioSites();
  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - 3_600_000).toISOString();

  const sites: SitePulse[] = await Promise.all(
    refs.map(async (ref) => {
      if (ref.siteId === "tributeready" || ref.siteId === "mendhaus") {
        return legacyPulse(
          ref.siteId as "tributeready" | "mendhaus",
          ref.displayName,
          ref.url,
        );
      }
      if (!token) {
        return {
          siteId: ref.siteId,
          displayName: ref.displayName,
          url: ref.url,
          commerciallyLive: false,
          checkoutOpen: false,
          purchases: 0,
          revenueUsd: 0,
          firstCustomerMode: true,
          actionsCompleted: 0,
          exposureNotes: [],
          blockers: ["PORTFOLIO_PULSE_TOKEN / CRON_SECRET missing on TributeReady"],
          error: "no_pulse_token",
        } satisfies SitePulse;
      }
      const pulse = await fetchPulse(ref.url, token);
      if (pulse.siteId === ref.url || pulse.error) {
        pulse.siteId = ref.siteId;
        pulse.displayName = ref.displayName;
        pulse.url = ref.url;
      }
      return pulse;
    }),
  );

  const visitors = await rollVisitors(
    sites.map((s) => s.siteId),
    windowStart,
  );
  for (const s of sites) {
    const v = visitors[s.siteId];
    if (!v) continue;
    s.thisHour = {
      ...(s.thisHour ?? { actionsExecuted: s.actionsCompleted }),
      pageViews: v.pageViews,
      ctaClicks: v.ctaClicks,
      checkoutStarts: v.checkoutStarts,
      checkoutCompletes: v.checkoutCompletes,
    };
  }

  const digest = buildPortfolioDigest({ windowStart, windowEnd, sites });
  const text = formatPortfolioOwnerEmail(digest);
  const subject = portfolioDigestSubject(digest);

  let emailId: string | undefined;
  let emailSkip: string | undefined;
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    try {
      const { data, error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: REPORT_RECIPIENT,
        subject,
        text,
      });
      if (error) {
        emailSkip = error.message;
      } else {
        emailId = data?.id;
      }
    } catch (e) {
      emailSkip = (e as Error).message;
    }
  } else {
    emailSkip = "resend_not_configured";
  }

  return NextResponse.json({
    ok: digest.cycleStatus === "ok",
    mode: "single_portfolio_digest",
    cycleStatus: digest.cycleStatus,
    subject,
    emailId,
    emailSkip,
    recipient: REPORT_RECIPIENT,
    liveCount: digest.liveCount,
    purchases: digest.portfolioPurchases,
    revenueUsd: digest.portfolioRevenueUsd,
    totalActionsCompleted: digest.totalActionsCompleted,
    visitors: {
      pageViews: digest.portfolioPageViews,
      ctaClicks: digest.portfolioCtaClicks,
      checkoutStarts: digest.portfolioCheckoutStarts,
      checkoutCompletes: digest.portfolioCheckoutCompletes,
    },
    preview: text.slice(0, 1200),
  });
}
