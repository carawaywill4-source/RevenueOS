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
      signal: AbortSignal.timeout(20_000),
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

  const sites: SitePulse[] = [];
  for (const ref of refs) {
    if (ref.siteId === "tributeready" || ref.siteId === "mendhaus") {
      sites.push(
        await legacyPulse(
          ref.siteId as "tributeready" | "mendhaus",
          ref.displayName,
          ref.url,
        ),
      );
      continue;
    }
    if (!token) {
      sites.push({
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
      });
      continue;
    }
    const pulse = await fetchPulse(ref.url, token);
    if (pulse.siteId === ref.url || pulse.error) {
      // keep display names from catalog when fetch failed
      pulse.siteId = ref.siteId;
      pulse.displayName = ref.displayName;
      pulse.url = ref.url;
    }
    sites.push(pulse);
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
    ok: true,
    mode: "single_portfolio_digest",
    subject,
    emailId,
    emailSkip,
    recipient: REPORT_RECIPIENT,
    liveCount: digest.liveCount,
    purchases: digest.portfolioPurchases,
    revenueUsd: digest.portfolioRevenueUsd,
    preview: text.slice(0, 1200),
  });
}
