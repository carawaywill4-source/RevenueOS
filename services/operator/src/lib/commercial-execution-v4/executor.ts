/**
 * AcquisitionExecutor — DISCOVERED → EXECUTED → VERIFIED.
 * Hunt the open web, send a burst of emails, then still try directories.
 * Internal research does not count.
 */

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import {
  researchSurfacePolicy,
} from "../ultron-external/surface-intelligence.js";
import { recordCommercialAction, refreshExposureClock, refreshFunnelTruth, polishAllowed, shouldEnterZeroExposure, commercialExecutionRatio } from "./ledger.js";
import { noteFailure } from "./failure-patterns.js";
import { diagnoseEmailSendability, sendCompliantEmail, composeSalesEmail } from "./email.js";
import { buyUrlFor, GUMROAD_LIVE, trackedBuyUrl } from "./offer.js";
import { listingDeskEmails, siblingSubmitUrls, composeListingAsk, shouldAbandonResult } from "./climb.js";
import { executeProductHuntFrontierBet } from "../capability-reality/producthunt-adapter.js";
import { execSearchSubmission } from "../acquisitionos/executors.js";
import {
  classifyDirectoryPage,
  isJunkDirectoryUrl,
  listingFormBody,
  listingLooksAccepted,
  type ListingPayload,
} from "./directory.js";
import { ensureGumroadLive } from "./marketplace.js";
import {
  discoverContactsFromSearch,
  markContactAttempt,
  nextSendableContacts,
  persistContacts,
} from "./contacts.js";
import { extractSignupForm, attemptPermittedSignup } from "./signup.js";
import {
  EMAIL_BURST,
  DAILY_EMAIL_CAP,
  emailsSentLast24h,
  huntSubmitSurfaces,
} from "./hunt.js";
import { seedChannelUniverse } from "./channel-universe.js";
import {
  choosePlacement,
  hostOfUrl,
  recordChannelEvent,
  refreshChannelMemory,
} from "./learn.js";
import { writeDistributionReceipt } from "../acquisitionos/receipts.js";
import { beat } from "./watchdog.js";
import {
  countRealPurchases,
  firstCustomerFrontier,
  FIRST_CUSTOMER_PRICE_USD,
} from "./first-customer.js";
import { evolveStorefrontForSale } from "./storefront-evolve.js";
import { createHostingPlaneClient } from "../hosting-plane-client.js";

function publicUrl(businessId: string): string {
  const host = process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io";
  return `https://${businessId}.${host}/`;
}

function loadListing(businessId: string): ListingPayload {
  const appRoot = process.env.REVENUEOS_APP_ROOT || "/opt/revenueos/app";
  const brandPath = path.join(appRoot, "apps", businessId, "src/lib/brand.ts");
  let name = businessId;
  let description = `${businessId} commercial pack`;
  let email = `care@${businessId}.com`;
  const intentKeywords: string[] = [];
  let priceUsd = 89;
  if (existsSync(brandPath)) {
    const src = readFileSync(brandPath, "utf8");
    const dn = src.match(/["']displayName["']\s*:\s*["']([^"']+)["']/);
    const tag = src.match(/["']tagline["']\s*:\s*["']([^"']+)["']/);
    const em = src.match(/["']supportEmail["']\s*:\s*["']([^"']+)["']/);
    const pr = src.match(/["']priceUsd["']\s*:\s*(\d+)/);
    if (dn) name = dn[1]!;
    if (tag) description = tag[1]!;
    if (em) email = em[1]!;
    if (pr) priceUsd = Number(pr[1]);
    const kw = [...src.matchAll(/["']([a-z0-9][a-z0-9 \-]{8,60})["']/gi)]
      .map((x) => x[1]!)
      .filter((s) => /rfi|punch|schedule|template|construction|contractor|invoice|resume|etsy/i.test(s));
    intentKeywords.push(...kw.slice(0, 3));
  }
  return {
    name,
    url: buyUrlFor(businessId, publicUrl(businessId)),
    email,
    description,
    category: "software",
    intentKeywords,
    priceUsd,
  };
}


async function seedSubmitSurfaces(pool: pg.Pool): Promise<{ seeded: number; total: number }> {
  return seedChannelUniverse(pool);
}

async function fetchHtml(
  url: string,
  cookies?: string,
): Promise<{ ok: boolean; html: string; status: number }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "RevenueOS-acquisition/4.6 (legitimate commercial listing)",
        ...(cookies ? { cookie: cookies } : {}),
      },
      signal: AbortSignal.timeout(12_000),
    });
    return { ok: res.ok, html: (await res.text()).slice(0, 120_000), status: res.status };
  } catch {
    return { ok: false, html: "", status: 0 };
  }
}

async function postListingForm(input: {
  listing: ListingPayload;
  formAction: string;
  formMethod: "get" | "post";
  fieldNames: string[];
  cookies?: string;
}): Promise<{ status: number; body: string; finalUrl: string; error?: string }> {
  try {
    const encoded = listingFormBody(input.listing, input.fieldNames);
    const target =
      input.formMethod === "get"
        ? `${input.formAction}${input.formAction.includes("?") ? "&" : "?"}${encoded}`
        : input.formAction;
    const res = await fetch(target, {
      method: input.formMethod === "get" ? "GET" : "POST",
      headers: {
        ...(input.formMethod === "post"
          ? { "content-type": "application/x-www-form-urlencoded" }
          : {}),
        "user-agent": "RevenueOS-acquisition/4.6 (legitimate commercial listing)",
        ...(input.cookies ? { cookie: input.cookies } : {}),
      },
      ...(input.formMethod === "post" ? { body: encoded } : {}),
      signal: AbortSignal.timeout(15_000),
      redirect: "follow",
    });
    return {
      status: res.status,
      finalUrl: res.url || input.formAction,
      body: (await res.text()).slice(0, 4000),
    };
  } catch (e) {
    return {
      status: 0,
      body: "",
      finalUrl: input.formAction,
      error: e instanceof Error ? e.message : "fetch_failed",
    };
  }
}

async function pickFrontier(pool: pg.Pool): Promise<{ businessId: string; host: string | null; reason: string }> {
  const purchases = await countRealPurchases(pool);
  const lock = firstCustomerFrontier(purchases);
  if (lock) return lock;
  const learned = await choosePlacement(pool).catch(() => null);
  if (learned?.businessId) {
    return { businessId: learned.businessId, host: learned.host, reason: learned.reason };
  }
  const ids = Object.keys(GUMROAD_LIVE);
  return { businessId: ids[0] ?? "buildgrid", host: null, reason: "fallback_gumroad" };
}

async function upsertChannel(
  pool: pg.Pool,
  businessId: string,
  channelClass: string,
  surface: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const id = `ch_${createHash("sha1").update(`${businessId}|${channelClass}|${surface}`).digest("hex").slice(0, 16)}`;
  await pool.query(
    `insert into ros_channel_graph (
       id, business_id, channel_class, surface, attempts, last_result, last_attempt_at, updated_at
     ) values ($1,$2,$3,$4,1,$5, now(), now())
     on conflict (business_id, channel_class, surface) do update set
       attempts=ros_channel_graph.attempts+1,
       last_result=excluded.last_result,
       last_attempt_at=now(),
       updated_at=now()`,
    [id, businessId, channelClass, surface, String(patch.last_result ?? "")],
  );
}

async function executeDirectory(
  pool: pg.Pool,
  logger: Logger,
  businessId: string,
  preferredHost?: string | null,
): Promise<{ executed: boolean; next: string }> {
  const listing = loadListing(businessId);
  const seeded = await seedSubmitSurfaces(pool);
  logger("info", "cee.v4.universe.seed", seeded);
  let executedAny = false;
  let lastNext = "email_outreach";
  let wins = 0;
  const surfaces = await pool.query(
    `select s.surface_id, s.url, s.policy_class, s.reason
       from ros_external_surfaces s
      where s.policy_class in ('PERMITTED_PUBLISH','CONDITIONAL','UNKNOWN_NEEDS_RESEARCH')
        and s.url not ilike '%sslip.io%'
        and (
          s.url ilike '%/submit%' or s.url ilike '%add-%' or s.url ilike '%/new%'
          or s.url ilike '%signup%' or s.url ilike '%register%' or s.url ilike '%sign-up%'
          or s.url ilike '%/join%' or s.url ilike '%/add/%' or s.url ilike '%/contribute%'
        )
        and ($2::text is null or s.url ilike '%'||$2||'%')
        and not exists (
          select 1 from ros_channel_memory m
           where m.business_id=$1
             and s.url ilike '%'||m.host||'%'
             and m.verdict in ('DEAD','WAITING','WRONG_FIT')
        )
      order by
        case
          when s.policy_class = 'PERMITTED_PUBLISH' then 0
          when s.url ilike '%signup%' or s.url ilike '%register%' then 1
          when s.url ilike '%/submit%' then 2
          else 3
        end,
        s.last_researched_at asc nulls first
      limit 16`,
    [businessId, preferredHost ?? null],
  );
  if (!surfaces.rows.length && preferredHost) {
    const fallback = await pool.query(
      `select s.surface_id, s.url, s.policy_class, s.reason
         from ros_external_surfaces s
        where s.policy_class in ('PERMITTED_PUBLISH','CONDITIONAL','UNKNOWN_NEEDS_RESEARCH')
          and s.url not ilike '%sslip.io%'
          and (s.url ilike '%/submit%' or s.url ilike '%signup%' or s.url ilike '%register%' or s.url ilike '%/add%')
          and not exists (
            select 1 from ros_channel_memory m
             where m.business_id=$1
               and s.url ilike '%'||m.host||'%'
               and m.verdict in ('DEAD','WAITING','WRONG_FIT')
          )
        order by s.last_researched_at asc nulls first
        limit 16`,
      [businessId],
    );
    surfaces.rows = fallback.rows;
  }

  for (const row of surfaces.rows) {
    const url = String(row.url);
    const payload = {
      ...listing,
      url: trackedBuyUrl(businessId, hostOfUrl(url), listing.url),
    };
    if (isJunkDirectoryUrl(url)) {
      await noteFailure(pool, {
        businessId,
        strategy: "directory_submit",
        channel: "directories",
        target: url,
        failureReason: "junk_url_not_listing_endpoint",
      });
      continue;
    }
    const recent = await pool.query(
      `select 1 from ros_failure_patterns
        where business_id=$1 and channel='directories' and target=$2 and abandoned=true
        limit 1`,
      [businessId, url],
    );
    if (recent.rows[0]) continue;

    const page = await fetchHtml(url);
    if (!page.html) continue;

    if (String(row.policy_class) === "PERMITTED_READ") {
      continue;
    }

    const researched = await researchSurfacePolicy(url);
    await pool.query(
      `update ros_external_surfaces
          set policy_class=$2, reason=$3, posting_allowed=$4, automation_allowed=$5,
              last_researched_at=now(), updated_at=now()
        where surface_id=$1`,
      [row.surface_id, researched.policyClass, researched.reason, researched.postingAllowed, researched.automationAllowed],
    );

    const classified = classifyDirectoryPage(url, page.html);
    if (classified.hardBlocker) {
      await noteFailure(pool, {
        businessId,
        strategy: "directory_submit",
        channel: "directories",
        target: url,
        failureReason: classified.hardBlocker,
        result: classified.reason,
      });
      await recordCommercialAction(pool, {
        businessId,
        channel: "directories",
        actionType: "directory_blocked",
        target: url,
        external: false,
        executed: false,
        humanExposurePossible: false,
        result: classified.reason,
        failureReason: classified.hardBlocker,
        retryable: false,
        nextAction: "switch_channel",
      });
      await upsertChannel(pool, businessId, "directories", url, { last_result: classified.hardBlocker });
      await recordChannelEvent(pool, {
        urlOrHost: url,
        businessId,
        result: classified.hardBlocker,
        listed: false,
      });

      for (const sib of siblingSubmitUrls(url).slice(0, 6)) {
        const platform = (() => {
          try {
            return new URL(sib).hostname.replace(/^www\./, "");
          } catch {
            return sib;
          }
        })();
        const id = `surf_${createHash("sha1").update(`${platform}|${sib}`).digest("hex").slice(0, 16)}`;
        await pool.query(
          `insert into ros_external_surfaces
             (surface_id, platform, url, automation_allowed, posting_allowed, policy_class, reason, updated_at)
           values ($1,$2,$3,null,null,'UNKNOWN_NEEDS_RESEARCH','climbed_from_blocked_page', now())
           on conflict (surface_id) do nothing`,
          [id, platform, sib],
        );
      }
      const desk = listingDeskEmails(page.html, url);
      if (desk.length) {
        await persistContacts(pool, businessId, desk);
        if (diagnoseEmailSendability().sendable) {
          const ask = composeListingAsk(payload);
          const sent = await sendCompliantEmail({
            to: desk[0]!.email,
            subject: ask.subject,
            text: ask.text,
          });
          await recordCommercialAction(pool, {
            businessId,
            channel: "email_outreach",
            actionType: "listing_desk_email",
            target: desk[0]!.email,
            external: true,
            executed: sent.ok,
            verified: sent.ok,
            humanExposurePossible: true,
            result: sent.ok ? "sent" : sent.detail,
            nextAction: sent.ok ? "wait_for_listing" : "next_surface",
          });
          if (sent.ok) {
            logger("info", "cee.v4.climb.desk_email", { url, email: desk[0]!.email });
            executedAny = true;
            lastNext = "wait_for_listing";
            wins += 1;
            if (wins >= 4) break;
          }
        }
      }
      continue;
    }

    if (classified.accountNeeded && !classified.hardBlocker) {
      let signup = extractSignupForm(page.html, url);
      if (!signup) {
        let origin = "";
        try {
          origin = new URL(url).origin;
        } catch {
          origin = "";
        }
        for (const door of [`${origin}/signup`, `${origin}/register`, `${origin}/sign-up`, `${origin}/join`]) {
          if (!origin || door === url) continue;
          const doorPage = await fetchHtml(door);
          if (!doorPage.html) continue;
          signup = extractSignupForm(doorPage.html, door);
          if (signup) break;
        }
      }
      if (signup) {
        const created = await attemptPermittedSignup({
          pool,
          businessId,
          pageUrl: url,
          form: signup,
          displayName: listing.name,
        });
        await recordCommercialAction(pool, {
          businessId,
          channel: "directories",
          actionType: "account_signup",
          target: signup.action,
          external: true,
          executed: created.ok,
          humanExposurePossible: false,
          result: created.detail,
          failureReason: created.ok ? "" : created.detail,
          retryable: !created.ok,
          nextAction: created.ok ? "submit_listing_with_session" : "next_surface",
        });
        logger("info", "cee.v4.signup", { url, ok: created.ok, detail: created.detail });
        if (created.ok) {
          executedAny = true;
          lastNext = "submit_listing_with_session";
          wins += 1;
          const submitTargets = [url, ...siblingSubmitUrls(url).filter((u) => /submit|add|new/i.test(u))].slice(0, 4);
          for (const target of submitTargets) {
            const live = await fetchHtml(target, created.cookies);
            if (!live.html) continue;
            const listed = classifyDirectoryPage(target, live.html);
            if (listed.hardBlocker || !listed.formAction) continue;
            if (listed.policy !== "PERMITTED_PUBLISH" && !listed.fieldNames.length) continue;
            const posted = await postListingForm({
              listing: payload,
              formAction: listed.formAction,
              formMethod: listed.formMethod,
              fieldNames: listed.fieldNames,
              cookies: created.cookies,
            });
            const outcome = listingLooksAccepted(posted.status, posted.body, posted.finalUrl);
            await recordCommercialAction(pool, {
              businessId,
              channel: "directories",
              actionType: "directory_submit",
              target: listed.formAction,
              external: true,
              executed: outcome.executed,
              verified: outcome.verified,
              humanExposurePossible: true,
              result: outcome.result,
              nextAction: outcome.verified ? "verify_listing_live" : "next_directory",
            });
            logger("info", "cee.v4.directory.session_submit", {
              url: target,
              result: outcome.result,
              verified: outcome.verified,
            });
            await recordChannelEvent(pool, {
              urlOrHost: target,
              businessId,
              result: outcome.result,
              listed: outcome.executed,
            });
            if (outcome.executed) {
              lastNext = outcome.verified ? "verify_listing_live" : "next_directory";
              break;
            }
          }
          if (wins >= 4) break;
          continue;
        }
      }
    }

    if (classified.policy !== "PERMITTED_PUBLISH" || !classified.formAction) {
      const fail = await noteFailure(pool, {
        businessId,
        strategy: "directory_submit",
        channel: "directories",
        target: url,
        failureReason: classified.reason,
        result: classified.policy,
      });
      await recordCommercialAction(pool, {
        businessId,
        channel: "directories",
        actionType: "directory_not_executable",
        target: url,
        external: false,
        executed: false,
        humanExposurePossible: false,
        result: classified.reason,
        failureReason: classified.reason,
        retryable: !fail.abandoned,
        nextAction: fail.abandoned ? "switch_channel" : "investigate_next_surface",
      });
      continue;
    }

    // EXECUTE — leave the machine. GET listing starts (SaaSHub-style) count.
    const posted = await postListingForm({
      listing: payload,
      formAction: classified.formAction,
      formMethod: classified.formMethod,
      fieldNames: classified.fieldNames,
    });
    if (posted.error) {
      await noteFailure(pool, {
        businessId,
        strategy: "directory_submit",
        channel: "directories",
        target: classified.formAction,
        failureReason: posted.error,
      });
      await recordCommercialAction(pool, {
        businessId,
        channel: "directories",
        actionType: "directory_submit",
        target: classified.formAction,
        external: true,
        executed: false,
        humanExposurePossible: true,
        result: "network_failed",
        failureReason: posted.error,
        retryable: true,
        nextAction: "retry_or_next_directory",
      });
      continue;
    }

    const outcome = listingLooksAccepted(posted.status, posted.body, posted.finalUrl);
    await recordCommercialAction(pool, {
      businessId,
      channel: "directories",
      actionType: "directory_submit",
      target: classified.formAction,
      external: true,
      executed: outcome.executed,
      verified: outcome.verified,
      verificationMethod: outcome.verified ? "response_text" : "http_status",
      humanExposurePossible: true,
      result: outcome.result,
      response: posted.body.slice(0, 240),
      retryable: !outcome.verified,
      nextAction: outcome.verified ? "verify_listing_live" : "next_directory",
    });
    await upsertChannel(pool, businessId, "directories", url, { last_result: outcome.result });
    if (shouldAbandonResult(outcome.result)) {
      await noteFailure(pool, {
        businessId,
        strategy: "directory_submit",
        channel: "directories",
        target: url,
        failureReason: outcome.result,
        result: outcome.result,
      });
    }
    logger("info", "cee.v4.directory.submitted", {
      businessId,
      url,
      action: classified.formAction,
      result: outcome.result,
      verified: outcome.verified,
    });
    await recordChannelEvent(pool, {
      urlOrHost: url,
      businessId,
      result: outcome.result,
      listed: outcome.executed,
    });
    if (outcome.executed) {
      executedAny = true;
      lastNext = outcome.verified ? "verify_listing_live" : "next_directory";
      wins += 1;
      if (wins >= 4) break;
    }
    continue;
  }

  return { executed: executedAny, next: lastNext };
}

async function executeEmail(
  pool: pg.Pool,
  logger: Logger,
  businessId: string,
  portfolioWide: boolean,
): Promise<{ executed: boolean; next: string; sent: number }> {
  const diag = diagnoseEmailSendability();
  if (!diag.sendable) {
    await recordCommercialAction(pool, {
      businessId,
      channel: "email_outreach",
      actionType: "email_blocked",
      target: diag.from || "resend",
      external: false,
      executed: false,
      humanExposurePossible: false,
      result: diag.blocker ?? "not_sendable",
      failureReason: diag.blocker ?? "not_sendable",
      retryable: diag.blockerClass === "CONFIG",
      nextAction: "switch_channel_directories",
      meta: { blockerClass: diag.blockerClass },
    });
    await noteFailure(pool, {
      businessId,
      strategy: "email_outreach",
      channel: "email_outreach",
      target: "sender",
      failureReason: diag.blocker ?? "not_sendable",
    });
    logger("warn", "cee.v4.email.blocked", { blocker: diag.blocker, class: diag.blockerClass });
    return { executed: false, next: "directories", sent: 0 };
  }

  const already = await emailsSentLast24h(pool);
  const remaining = Math.max(0, DAILY_EMAIL_CAP - already);
  if (remaining <= 0) {
    logger("info", "cee.v4.email.daily_cap", { already, cap: DAILY_EMAIL_CAP });
    return { executed: false, next: "directories", sent: 0 };
  }

  const listing = loadListing(businessId);
  if (portfolioWide) listing.priceUsd = FIRST_CUSTOMER_PRICE_USD;
  const discovered = await discoverContactsFromSearch(pool, businessId, listing).catch(() => ({
    pages: 0,
    stored: 0,
    harvested: 0,
    queries: [] as string[],
  }));
  if (discovered.pages > 0 || discovered.stored > 0) {
    await recordCommercialAction(pool, {
      businessId,
      channel: "email_outreach",
      actionType: "contact_discovery",
      target: discovered.queries[0] ?? "",
      external: false,
      executed: false,
      humanExposurePossible: false,
      result: `pages_${discovered.pages}_stored_${discovered.stored}`,
      nextAction: discovered.stored > 0 ? "send_burst" : "search_again_or_directories",
    });
    logger("info", "cee.v4.email.discovered", discovered);
  }

  const burst = Math.min(EMAIL_BURST, remaining);
  const contacts = await nextSendableContacts(pool, businessId, burst, {
    portfolioWide,
  });
  if (!contacts.length) {
    await recordCommercialAction(pool, {
      businessId,
      channel: "email_outreach",
      actionType: "email_no_valid_contact",
      target: "",
      external: false,
      executed: false,
      humanExposurePossible: false,
      result: "no_unsuppressed_contact",
      failureReason: "no_unsuppressed_contact",
      retryable: true,
      nextAction: "directories",
    });
    return { executed: false, next: "directories", sent: 0 };
  }

  const { subject, text } = composeSalesEmail(listing);
  let sentCount = 0;
  for (const contact of contacts) {
    const sent = await sendCompliantEmail({ to: contact.email, subject, text });
    await markContactAttempt(pool, contact.email, sent.ok ? "sent" : sent.detail);
    await recordCommercialAction(pool, {
      businessId,
      channel: "email_outreach",
      actionType: "email_send",
      target: contact.email,
      external: true,
      executed: sent.ok,
      verified: sent.ok,
      verificationMethod: sent.ok ? "resend_id" : "",
      humanExposurePossible: true,
      result: sent.ok ? "sent" : sent.detail,
      failureReason: sent.ok ? "" : sent.detail,
      retryable: !sent.ok,
      nextAction: sent.ok ? "wait_for_reply" : "switch_channel_if_sender_broken",
      meta: { resendId: sent.id ?? null, sourceUrl: contact.sourceUrl },
    });
    if (sent.ok) {
      sentCount += 1;
      await writeDistributionReceipt(pool, {
        businessId,
        hypothesis: "one_to_one_operator_intro",
        externalDestination: contact.email,
        externalAction: "email_send",
        executorType: "cee_v45",
        requestResult: { resendId: sent.id ?? null, sourceUrl: contact.sourceUrl },
        status: "SENT",
        expectedExposure: "inbox",
        countsAsDistribution: true,
      }).catch(() => "");
      logger("info", "cee.v4.email.sent", { businessId, email: contact.email });
      await recordChannelEvent(pool, {
        urlOrHost: contact.email.split("@")[1] || contact.email,
        businessId,
        result: "email_sent",
        listed: true,
      });
    } else {
      await noteFailure(pool, {
        businessId,
        strategy: "email_outreach",
        channel: "email_outreach",
        target: contact.email,
        failureReason: sent.detail,
      });
      if (/resend_403|resend_401|resend_429|domain/i.test(sent.detail)) {
        break;
      }
    }
  }
  logger("info", "cee.v4.email.burst", { businessId, attempted: contacts.length, sent: sentCount });
  return {
    executed: sentCount > 0,
    // NOTE: this used to say `next: "directories"` when sent=0, but the
    // directory execution below is gated behind `purchases > 0`. Under
    // first-customer-lock (purchases always 0) that gate is dead code, so
    // the "next: directories" hint was a lie: directories never ran.
    // MissionController is now the authoritative source of what CEE should
    // do next; the string below is a diagnostic hint only, not control flow.
    next: sentCount > 0 ? "continue_hunt" : "hunt_more_contacts",
    sent: sentCount,
  };
}

export async function runAcquisitionTick(
  pool: pg.Pool,
  logger: Logger,
): Promise<Record<string, unknown>> {
  await beat(pool, "AcquisitionExecutor", true);
  const learned = await refreshChannelMemory(pool).catch(() => ({ pairs: 0, works: 0, dead: 0 }));
  const pick = await pickFrontier(pool);
  const businessId = pick.businessId;
  logger("info", "cee.v4.learn", { ...learned, ...pick });
  const clock = await refreshExposureClock(pool, businessId);
  await refreshExposureClock(pool, "portfolio");
  const funnel = await refreshFunnelTruth(pool, businessId);
  const ratio = await commercialExecutionRatio(pool, 60);
  const zero = shouldEnterZeroExposure(clock);
  await pool.query(
    `update ros_cee_mode set
       zero_exposure=$1,
       first_real_customer=true,
       last_intervention=$2,
       updated_at=now()
     where id='current'`,
    [zero, zero ? "ZERO_EXPOSURE_MODE:prioritize_distribution" : "exposure_present"],
  );

  if (!polishAllowed(clock)) {
    logger("info", "cee.v4.zero_exposure", {
      businessId,
      stage: funnel.stage,
      minutesWithoutHuman: clock.minutesSinceLastVerifiedHuman,
    });
  }

  const purchases = await countRealPurchases(pool);
  const listing = loadListing(businessId);
  if (purchases === 0) listing.priceUsd = FIRST_CUSTOMER_PRICE_USD;
  await ensureGumroadLive({ pool, logger, businessId, listing }).catch(() => undefined);
  if (purchases === 0) {
    const { applyFirstCustomerOffer } = await import("./marketplace.js");
    await applyFirstCustomerOffer({
      pool,
      logger,
      businessId,
      listing,
      priceUsd: FIRST_CUSTOMER_PRICE_USD,
    }).catch(() => undefined);
    const evolved = await evolveStorefrontForSale({
      pool,
      logger,
      businessId,
      purchases,
    }).catch(() => ({ wrote: false, priceUsd: FIRST_CUSTOMER_PRICE_USD, path: "" }));
    if (evolved.wrote) {
      const hp = createHostingPlaneClient();
      await hp
        .deploy({
          siteId: businessId,
          appDir: `apps/${businessId}`,
          version: `cee-v48-${Date.now().toString(36)}`,
          reason: "revenueos_storefront_evolve",
        })
        .catch(() => undefined);
    }
  }
  let channel = "organic";
  let result: { executed: boolean; next: string; sent?: number } = {
    executed: false,
    next: "hunt",
  };

  if (purchases > 0) {
    const buy = buyUrlFor(businessId, publicUrl(businessId));
    const sitemapUrls = await fetch(`${publicUrl(businessId)}sitemap.xml`, {
      signal: AbortSignal.timeout(8_000),
    })
      .then(async (r) => {
        const xml = await r.text();
        return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!).slice(0, 10);
      })
      .catch(() => [] as string[]);
    await execSearchSubmission({
      pool,
      businessId,
      surfaceId: "organic_indexnow",
      urls: [publicUrl(businessId), buy, ...sitemapUrls].filter(Boolean).slice(0, 10),
    }).catch(() => undefined);

    await fetch("http://rpc.pingomatic.com/", {
      method: "POST",
      headers: { "content-type": "text/xml" },
      signal: AbortSignal.timeout(8_000),
      body: `<?xml version="1.0"?><methodCall><methodName>weblogUpdates.ping</methodName><params><param><value><string>${listing.name.replace(/[<>&]/g, "")}</string></value></param><param><value><string>${buy.replace(/[<>&]/g, "")}</string></value></param></params></methodCall>`,
    }).catch(() => undefined);

    const ph = await executeProductHuntFrontierBet({
      pool,
      businessId,
      keywords: listing.intentKeywords?.length ? listing.intentKeywords : [listing.name],
      problem: listing.description,
    }).catch((e) => ({
      ok: false,
      kind: "error",
      detail: e instanceof Error ? e.message : "ph_failed",
      newAudience: false,
      stored: 0,
    }));
    logger("info", "cee.v4.ph.harvest", { businessId, kind: ph.kind, detail: ph.detail });
    if (ph.kind === "producthunt_maker_harvest") {
      await recordCommercialAction(pool, {
        businessId,
        channel: "communities",
        actionType: "producthunt_maker_harvest",
        target: "producthunt",
        external: false,
        executed: false,
        humanExposurePossible: false,
        result: ph.detail,
        nextAction: "email_burst",
      });
    }

    await huntSubmitSurfaces(pool, listing).catch(() => ({ seeded: 0, queries: [] as string[] }));
  }

  if (diagnoseEmailSendability().sendable) {
    await beat(pool, "email", true);
    result = await executeEmail(pool, logger, businessId, purchases === 0);
    channel = "email_outreach";
  }

  // Directory execution used to be gated on `purchases > 0` — the notorious
  // dead first-customer-lock gate that prevented any directory submission
  // while purchases stood at zero (i.e., always). Directory/marketplace
  // execution is now driven by mission active + executor available, NOT by
  // whether a purchase already exists. See tests/dead-directory-gate.test.ts.
  {
    const emailExecuted = Boolean(result.executed);
    const dir = await executeDirectory(pool, logger, businessId, pick.host);
    if (dir.executed) {
      result = { executed: true, next: dir.next, sent: result.sent };
      channel = emailExecuted ? "email_and_directories" : "directories";
    } else if (!result.executed) {
      result = { ...dir, sent: result.sent };
      channel = "directories";
    }
  }

  if (ratio.total >= 20 && ratio.external === 0) {
    logger("warn", "cee.v4.ratio.intervention", ratio);
  }

  await beat(pool, "AcquisitionExecutor", true, "", { businessId, ...result });
  return {
    businessId,
    zeroExposure: zero,
    stage: funnel.stage,
    channel,
    ...result,
    ratio,
    clock,
  };
}
