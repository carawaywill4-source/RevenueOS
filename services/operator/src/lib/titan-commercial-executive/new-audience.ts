/**
 * NEW_AUDIENCE distribution — third-party surfaces only.
 * Own pages / RSS / WebSub / IndexNow / portfolio crosslinks DO NOT qualify.
 */

import { randomBytes } from "node:crypto";
import type pg from "pg";
import { searchDuckDuckGo } from "../titan-research-engine.js";
import { buildBuyerHabitat } from "../acquisitionos/buyer-habitat.js";
import { writeDistributionReceipt } from "../acquisitionos/receipts.js";
import { recordCommercialProgress } from "./progress.js";
import { upsertCapabilityGap } from "./capability-gaps.js";
import { scheduleSubmissionFollowup } from "./exposure-verify.js";
import {
  buildResourcePlacementBrief,
  composeCommercialEmail,
  loadCommercialCommsLessons,
  applyCommercialLessonBias,
} from "../capability-reality/commercial-comms.js";
// COMMERCIAL_MEMORY_STEERING_V1

function eid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function publicBase(): string {
  return process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io";
}

function trackedUrl(businessId: string, surface: string): string {
  const p = new URLSearchParams({
    utm_source: "acquisitionos",
    utm_medium: "new_audience",
    utm_campaign: businessId,
    utm_content: surface.slice(0, 32),
  });
  return `https://${businessId}.${publicBase()}/?${p.toString()}`;
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "user-agent": "RevenueOSTitanOutreach/1.0 (+legitimate-commercial; respectful)",
        accept: "text/html",
      },
    });
    if (!res.ok) return "";
    return (await res.text()).slice(0, 180_000);
  } catch {
    return "";
  }
}

function extractEmails(html: string, pageUrl: string): string[] {
  const found = new Set<string>();
  const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const email = m[0]!.toLowerCase();
    if (
      /example\.com|domain\.com|sentry\.|wixpress|schema\.|github\.|png|jpg|webp|gov\./.test(
        email,
      )
    ) {
      continue;
    }
    found.add(email);
    if (found.size >= 3) break;
  }
  // Prefer same-domain contacts
  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, "");
    return [...found].sort((a, b) => {
      const aOwn = a.endsWith(host) ? 0 : 1;
      const bOwn = b.endsWith(host) ? 0 : 1;
      return aOwn - bOwn;
    });
  } catch {
    return [...found];
  }
}

function extractFormAction(html: string, pageUrl: string): string | null {
  const m = html.match(
    /<form[^>]+action=["']([^"']+)["'][^>]*>/i,
  );
  if (!m?.[1]) return null;
  try {
    return new URL(m[1], pageUrl).toString();
  } catch {
    return null;
  }
}

async function suppressed(
  pool: pg.Pool,
  contactKey: string,
): Promise<boolean> {
  const res = await pool.query(
    `select 1 from aq_suppression where contact_key=$1 limit 1`,
    [contactKey],
  );
  return Boolean(res.rows[0]);
}

async function markSuppression(
  pool: pg.Pool,
  contactKey: string,
  reason: string,
): Promise<void> {
  const exists = await pool.query(
    `select 1 from aq_suppression where contact_key=$1 limit 1`,
    [contactKey],
  );
  if (exists.rows[0]) return;
  await pool.query(
    `insert into aq_suppression (id, scope, contact_key, reason)
     values ($1,'global',$2,$3)`,
    [eid("sup"), contactKey, reason],
  );
}

async function sendResend(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; id?: string; detail: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.length < 10) {
    return { ok: false, detail: "RESEND_API_KEY missing" };
  }
  const from =
    process.env.OUTREACH_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    "RevenueOS <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        detail: `resend_${res.status}:${body.message ?? ""}`.slice(0, 160),
      };
    }
    return { ok: true, id: body.id, detail: "sent" };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message.slice(0, 120) : "send_failed",
    };
  }
}

/**
 * Ranked new-audience attempt for one business.
 * Tries: public contact email (Resend) → public form POST → owner queue package.
 */
const CHANNEL_FAMILIES = [
  "directories",
  "earned",
  "communities",
  "creators",
  "marketplaces",
  "partnerships",
] as const;

export async function executeNewAudienceBet(input: {
  pool: pg.Pool;
  businessId: string;
  /** Force a different channel family than recent bets (zero-exposure escalation). */
  preferFamily?: string;
  /** Skip destinations already attempted recently. */
  avoidDestinations?: string[];
  /** Ban public_form_resource_pitch — keep email/directory/utility distribution alive. */
  banPublicForms?: boolean;
}): Promise<{
  ok: boolean;
  kind: string;
  detail: string;
  newAudience: boolean;
  destination?: string;
  channelFamily?: string;
}> {
  const habitat = buildBuyerHabitat(input.businessId);
  const commercialLessons = await loadCommercialCommsLessons(input.pool); // COMMERCIAL_MEMORY_STEERING_V1

  // Recent action kinds for this business — diversify away from repeats
  const recentKinds = await input.pool.query(
    `select external_action, count(*)::int as n
     from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true
       and created_at > now() - interval '48 hours'
     group by 1`,
    [input.businessId],
  );
  const lessonPreferFamily = commercialLessons.some((l) => /form flood|failed_no_acceptance|public_form/i.test(l))
    ? "partnerships"
    : commercialLessons.some((l) => /cta|one license|unclear/i.test(l))
      ? "directories"
      : undefined; // COMMERCIAL_MEMORY_STEERING_V1
  const effectivePrefer = input.preferFamily || lessonPreferFamily;
  const formHeavy =
    input.banPublicForms === true ||
    recentKinds.rows.some(
      (r) =>
        String(r.external_action).includes("form") && Number(r.n) >= 2,
    );

  // Soft signal: form spam history — never abort the whole bet
  const flood = await input.pool.query(
    `select count(*)::int as forms,
            count(*) filter (where status in ('PUBLISHED','EXPOSURE_CONFIRMED','EXPOSED'))::int as pub
     from aq_distribution_receipts
     where business_id=$1 and is_new_audience=true
       and external_action='public_form_resource_pitch'
       and created_at > now() - interval '24 hours'`,
    [input.businessId],
  );
  const banForms =
    input.banPublicForms === true ||
    (Number(flood.rows[0]?.forms ?? 0) >= 6 &&
      Number(flood.rows[0]?.pub ?? 0) === 0);

  // Prefer free utility URL when CAE already built one (product-led distribution)
  let link = trackedUrl(input.businessId, "resource_pitch");
  const util = await input.pool.query(
    `select public_url from aq_distribution_receipts
     where business_id=$1 and external_action='publish_free_utility'
       and status='PUBLISHED' and coalesce(public_url,'') <> ''
     order by created_at desc limit 1`,
    [input.businessId],
  );
  if (util.rows[0]?.public_url) {
    const u = String(util.rows[0].public_url);
    const sep = u.includes("?") ? "&" : "?";
    link = `${u}${sep}utm_source=acquisitionos&utm_medium=free_utility&utm_campaign=${input.businessId}`;
  }

  // Keep queries simple — DDG HTML drops complex boolean/quoted queries.
  const queries = [
    habitat.searchQueries[0],
    habitat.searchQueries[1],
    formHeavy
      ? `${habitat.industry.replace(/_/g, " ")} directory submit listing`
      : `${habitat.industry.replace(/_/g, " ")} templates resources`,
    `${habitat.industry.replace(/_/g, " ")} newsletter partners`,
  ].filter((q): q is string => Boolean(q && q.length > 3));

  type Hit = { url: string; title: string; snippet: string };
  const candidates: Hit[] = [];
  const seen = new Set<string>();
  for (const q of queries.slice(0, 2)) {
    const hits = await searchDuckDuckGo(q, 6);
    for (const h of hits) {
      if (
        !h.url ||
        seen.has(h.url) ||
        /duckduckgo\.com|sslip\.io|vercel\.app|google\.com\/search|bing\.com\/search/i.test(
          h.url,
        )
      ) {
        continue;
      }
      seen.add(h.url);
      candidates.push(h);
    }
  }

  // Fallback: ranked third-party surfaces already in AcquisitionOS channel graph
  if (candidates.length < 3) {
    const families = effectivePrefer
      ? [effectivePrefer, ...CHANNEL_FAMILIES.filter((f) => f !== effectivePrefer)]
      : formHeavy
        ? ["directories", "marketplaces", "partnerships", "creators", "communities", "earned"]
        : [...CHANNEL_FAMILIES];
    const graph = await input.pool.query(
      `select s.surface_url, s.surface_name, s.audience, s.channel_family
       from aq_business_surfaces b
       join aq_channel_surfaces s on s.channel_surface_id=b.channel_surface_id
       where b.business_id=$1
         and s.channel_family = any($2::text[])
         and s.surface_url like 'http%'
         and s.surface_url not like '%sslip.io%'
         and s.surface_url not like '%google.com/search%'
       order by
         array_position($2::text[], s.channel_family),
         b.fit_score desc
       limit 10`,
      [input.businessId, families],
    );
    for (const r of graph.rows) {
      const url = String(r.surface_url);
      if (seen.has(url)) continue;
      if (input.avoidDestinations?.includes(url)) continue;
      seen.add(url);
      candidates.push({
        url,
        title: String(r.surface_name ?? url),
        snippet: String(r.audience ?? r.channel_family ?? ""),
      });
    }
  }

  if (!candidates.length) {
    await upsertCapabilityGap(input.pool, {
      businessId: input.businessId,
      gap: "no_reachable_new_audience_surfaces_from_search",
      proposed:
        "DIRECTORY_SUBMIT + RESOURCE_PITCH adapters with verified endpoints",
    });
    return {
      ok: false,
      kind: "discovery_empty",
      detail: "no third-party surfaces from search or channel graph",
      newAudience: false,
    };
  }

  // Commercial brief is built per destination — never send research-flex essays.
  let lastSubject = "";
  let lastBody = "";
  for (const hit of candidates.slice(0, 4)) {
    const html = await fetchText(hit.url);
    if (!html) continue;

    const brief = buildResourcePlacementBrief({
      businessId: input.businessId,
      buyerRole: habitat.buyerRole,
      problem: habitat.problem,
      destinationUrl: link,
      contextUrl: hit.url,
      contextSnippet: hit.snippet.slice(0, 180),
      pageTitle: hit.title,
    });
    const composed = composeCommercialEmail(brief);
    const biased = applyCommercialLessonBias(composed.scores, commercialLessons);
    composed.scores = biased;
    composed.approved = biased.total >= 0.68 && biased.rejectReasons.length === 0; // COMMERCIAL_MEMORY_STEERING_V1
    if (!composed.approved) {
      await recordCommercialProgress(input.pool, {
        businessId: input.businessId,
        eventKind: "commercial_comms_rejected",
        isNewAudience: false,
        detail: `quality_gate: ${composed.scores.rejectReasons.join(",") || "low_score"} score=${composed.scores.total.toFixed(2)}`,
        meta: {
          destination: hit.url,
          score: composed.scores.total,
          reasons: composed.scores.rejectReasons,
        },
      }).catch(() => undefined);
      // Keep best rejected copy for owner-queue fallback (still structured).
      if (!lastBody || composed.scores.total > 0.5) {
        lastSubject = composed.subject;
        lastBody = composed.text;
      }
      continue;
    }
    const subject = composed.subject;
    const bodyBase = composed.text;
    lastSubject = subject;
    lastBody = bodyBase;

    // Path A: public email
    const emails = extractEmails(html, hit.url);
    for (const email of emails.slice(0, 1)) {
      if (await suppressed(input.pool, email)) continue;
      // Domain cooldown via aq_suppression after send
      const recent = await input.pool.query(
        `select 1 from aq_distribution_receipts
         where external_destination=$1 and created_at > now() - interval '7 days' limit 1`,
        [email],
      );
      if (recent.rows[0]) continue;

      const sent = await sendResend({
        to: email,
        subject,
        text: bodyBase,
      });

      const receiptId = await writeDistributionReceipt(input.pool, {
        businessId: input.businessId,
        buyer: habitat.buyerPersona,
        hypothesis: `Resource pitch to public contact on ${hit.url}`,
        externalDestination: email,
        externalAction: "resource_email_pitch",
        executorType: "EMAIL_OUTREACH",
        requestResult: {
          ok: sent.ok,
          detail: sent.detail,
          page: hit.url,
          resendId: sent.id,
        },
        publicUrl: link,
        platformReceipt: sent.id ?? null,
        status: sent.ok ? "SENT" : "FAILED",
        expectedExposure: "inbox_of_resource_curator",
        countsAsDistribution: sent.ok,
        kind: "resource_email_pitch",
        referralTracking: { utm: link, page: hit.url },
      });

      // Mark new_audience on receipt
      await input.pool.query(
        `update aq_distribution_receipts set is_new_audience=$2, counts_as_distribution=$2
         where action_id=$1`,
        [receiptId, sent.ok],
      );

      if (sent.ok) {
        await markSuppression(input.pool, email, "outreach_sent");
        await scheduleSubmissionFollowup(input.pool, receiptId);
        await recordCommercialProgress(input.pool, {
          businessId: input.businessId,
          eventKind: "new_audience_distribution",
          isNewAudience: true,
          detail: `email_pitch → ${email} via ${hit.url}`,
          meta: { receiptId, hit: hit.url },
        });
        return {
          ok: true,
          kind: "email_pitch",
          detail: `sent to ${email}`,
          newAudience: true,
          destination: email,
          channelFamily: "earned",
        };
      }

      if (sent.detail.includes("RESEND") || sent.detail.includes("resend_")) {
        await upsertCapabilityGap(input.pool, {
          businessId: input.businessId,
          gap: "email_outreach_sender_or_deliverability",
          proposed: "Verified OUTREACH_FROM_EMAIL domain for Resend",
          evidence: { detail: sent.detail },
        });
      }
    }

    // Path B: simple public form (no captcha detectable) — banned after form flood
    if (banForms) {
      continue;
    }
    if (/recaptcha|hcaptcha|cf-turnstile/i.test(html)) {
      continue;
    }
    const action = extractFormAction(html, hit.url);
    if (action && /^https?:/i.test(action)) {
      try {
        const params = new URLSearchParams({
          name: `${input.businessId} Titan`,
          email: process.env.OUTREACH_REPLY_EMAIL || "care@revenueos.local",
          message: bodyBase.slice(0, 700),
          url: link,
          subject,
        });
        const res = await fetch(action, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            "user-agent": "RevenueOSTitanOutreach/1.0",
          },
          body: params.toString(),
          signal: AbortSignal.timeout(12_000),
          redirect: "follow",
        });
        const ok = res.status >= 200 && res.status < 400;
        const receiptId = await writeDistributionReceipt(input.pool, {
          businessId: input.businessId,
          buyer: habitat.buyerPersona,
          hypothesis: `Public form resource pitch on ${hit.url}`,
          externalDestination: action,
          externalAction: "public_form_resource_pitch",
          executorType: "PUBLIC_FORM_SUBMIT",
          requestResult: { status: res.status, page: hit.url },
          publicUrl: link,
          status: ok ? "SUBMITTED" : "FAILED",
          expectedExposure: "site_owner_inbox_or_moderation_queue",
          countsAsDistribution: ok,
          kind: "public_form_resource_pitch",
        });
        await input.pool.query(
          `update aq_distribution_receipts set is_new_audience=$2 where action_id=$1`,
          [receiptId, ok],
        );
        if (ok) {
          await scheduleSubmissionFollowup(input.pool, receiptId);
          await recordCommercialProgress(input.pool, {
            businessId: input.businessId,
            eventKind: "new_audience_distribution",
            isNewAudience: true,
            detail: `form_post → ${action}`,
            meta: { receiptId, page: hit.url },
          });
          return {
            ok: true,
            kind: "public_form",
            detail: `form ${res.status} ${action}`,
            newAudience: true,
            destination: action,
            channelFamily: "directories",
          };
        }
      } catch {
        /* try next */
      }
    }
  }

  // Path C: prepare highest-leverage owner action (not fake distribution)
  const top = candidates[0]!;
  const pending = await input.pool.query(
    `select 1 from aq_owner_actions
     where business_id=$1 and link=$2 and status='PENDING' limit 1`,
    [input.businessId, top.url],
  );
  if (!pending.rows[0]) {
    await input.pool.query(
      `insert into aq_owner_actions (
         id, business_id, platform, action_title, why_it_matters, expected_value,
         exact_action, prepared_content, link, estimated_minutes, status, priority, meta
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,3,'PENDING',5,$10::jsonb)`,
      [
        eid("own"),
        input.businessId,
        new URL(top.url).hostname,
        `Pitch resource on ${top.title.slice(0, 80)}`,
        `Third-party audience for ${habitat.buyerPersona}; auto email/form unavailable`,
        "New-audience exposure outside RevenueOS",
        "Open page → submit resource suggestion / contact with prepared copy → mark done",
        `${lastSubject || "Resource placement ask"}\n\n${lastBody || composeCommercialEmail(buildResourcePlacementBrief({
          businessId: input.businessId,
          buyerRole: habitat.buyerRole,
          problem: habitat.problem,
          destinationUrl: link,
          contextUrl: top.url,
          contextSnippet: top.snippet.slice(0, 180),
          pageTitle: top.title,
        })).text}\n\nTarget: ${top.url}`,
        top.url,
        JSON.stringify({
          source: "commercial_executive_new_audience",
          snippet: top.snippet,
          qualityGated: true,
        }),
      ],
    );
  }

  return {
    ok: false,
    kind: "owner_action_prepared",
    detail: `queued owner pitch for ${top.url}`,
    newAudience: false,
    destination: top.url,
  };
}
