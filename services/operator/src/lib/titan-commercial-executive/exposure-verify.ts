/**
 * Submission verification lifecycle — honest states only.
 * DESTINATION_REACHABLE ≠ SUBMISSION_ACKNOWLEDGED ≠ ACCEPTANCE_CONFIRMED ≠ PUBLISHED ≠ EXPOSURE_CONFIRMED
 */

import type pg from "pg";
import { recordCommercialFailure } from "./failure-intelligence.js";
import { recordCommercialProgress } from "./progress.js";

const EXPIRY_HOURS = 24;

export const ACQ_STATUSES = {
  SUBMITTED: "SUBMITTED",
  DESTINATION_REACHABLE: "DESTINATION_REACHABLE",
  SUBMISSION_ACKNOWLEDGED: "SUBMISSION_ACKNOWLEDGED",
  ACCEPTANCE_CONFIRMED: "ACCEPTANCE_CONFIRMED",
  PUBLISHED: "PUBLISHED",
  EXPOSURE_CONFIRMED: "EXPOSURE_CONFIRMED",
  FAILED_NO_ACCEPTANCE: "FAILED_NO_ACCEPTANCE",
  FAILED_NO_EXPOSURE: "FAILED_NO_EXPOSURE",
  PUBLISHED_UNKNOWN_EXPOSURE: "PUBLISHED_UNKNOWN_EXPOSURE",
} as const;

async function fetchText(url: string): Promise<{ ok: boolean; text: string; status: number }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "user-agent": "RevenueOSTitanVerify/1.0 (+exposure-check; respectful)",
        accept: "text/html",
      },
    });
    const text = res.ok ? (await res.text()).slice(0, 200_000) : "";
    return { ok: res.ok, text, status: res.status };
  } catch {
    return { ok: false, text: "", status: 0 };
  }
}

function hasAckEvidence(result: Record<string, unknown>, status: string): boolean {
  if (status === "SENT" && (result.resendId || result.id)) return true;
  const detail = String(result.detail ?? result.message ?? "").toLowerCase();
  if (/thank|received|submitted|success|queued|accepted|confirmation/.test(detail))
    return true;
  const body = String(result.bodySnippet ?? result.responseBody ?? "").toLowerCase();
  if (/thank you|submission received|successfully submitted|confirmation/.test(body))
    return true;
  return false;
}

export async function ensureReceiptFollowupColumns(pool: pg.Pool): Promise<void> {
  await pool.query(`
    alter table aq_distribution_receipts
      add column if not exists followup_at timestamptz,
      add column if not exists expiry_at timestamptz,
      add column if not exists exposure_verified_at timestamptz
  `);
  await pool.query(`
    update aq_distribution_receipts
    set followup_at = least(coalesce(followup_at, now()), now()),
        expiry_at = coalesce(expiry_at, created_at + interval '24 hours')
    where is_new_audience=true
      and status in (
        'SUBMITTED','SENT','ACCEPTED','DESTINATION_REACHABLE',
        'SUBMISSION_ACKNOWLEDGED','ACCEPTANCE_CONFIRMED','PUBLISHED'
      )
      and created_at < now() - interval '20 minutes'
      and exposure_verified_at is null
  `);
}

/** One-time honest reclassification of overstated ACCEPTED receipts. */
export async function reclassifyOverstatedAccepted(
  pool: pg.Pool,
): Promise<{ downgraded: number }> {
  await ensureReceiptFollowupColumns(pool);
  // ACCEPTED that only had destination_reachable evidence → DESTINATION_REACHABLE
  const res = await pool.query(
    `update aq_distribution_receipts
     set status='DESTINATION_REACHABLE',
         measured_exposure = measured_exposure || $1::jsonb
     where is_new_audience=true
       and status='ACCEPTED'
       and (
         measured_exposure->>'method' = 'destination_reachable_post_submit'
         or measured_exposure->>'pageReachable' = 'true'
         or measured_exposure = '{}'::jsonb
         or measured_exposure is null
       )
     returning action_id`,
    [
      JSON.stringify({
        reclassifiedAt: new Date().toISOString(),
        from: "ACCEPTED",
        to: "DESTINATION_REACHABLE",
        reason: "HTTP reachability is not submission acceptance",
      }),
    ],
  );
  // SENT with Resend id → SUBMISSION_ACKNOWLEDGED
  await pool.query(
    `update aq_distribution_receipts
     set status='SUBMISSION_ACKNOWLEDGED',
         measured_exposure = measured_exposure || $1::jsonb
     where is_new_audience=true
       and status='SENT'
       and (
         request_result ? 'resendId'
         or coalesce(platform_receipt,'') <> ''
       )`,
    [
      JSON.stringify({
        reclassifiedAt: new Date().toISOString(),
        to: "SUBMISSION_ACKNOWLEDGED",
        reason: "provider_receipt_id",
      }),
    ],
  );
  return { downgraded: res.rowCount ?? 0 };
}

export async function scheduleSubmissionFollowup(
  pool: pg.Pool,
  actionId: string,
): Promise<void> {
  await ensureReceiptFollowupColumns(pool);
  await pool.query(
    `update aq_distribution_receipts
     set followup_at = now() + interval '20 minutes',
         expiry_at = now() + interval '24 hours'
     where action_id=$1`,
    [actionId],
  );
}

export async function runSubmissionFollowups(input: {
  pool: pg.Pool;
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<{
  checked: number;
  destinationReachable: number;
  acknowledged: number;
  published: number;
  exposed: number;
  failedNoAcceptance: number;
  surfacesAbandoned: number;
}> {
  await ensureReceiptFollowupColumns(input.pool);
  await reclassifyOverstatedAccepted(input.pool);

  const due = await input.pool.query(
    `select action_id, business_id, external_destination, external_action,
            public_url, request_result, status, created_at, expiry_at, measured_exposure,
            platform_receipt
     from aq_distribution_receipts
     where is_new_audience=true
       and status in (
         'SUBMITTED','SENT','ACCEPTED','DESTINATION_REACHABLE',
         'SUBMISSION_ACKNOWLEDGED','ACCEPTANCE_CONFIRMED','PUBLISHED'
       )
       and (
         (followup_at is not null and followup_at <= now())
         or (expiry_at is not null and expiry_at <= now())
         or created_at < now() - interval '20 minutes'
       )
     order by created_at asc
     limit 50`,
  );

  let checked = 0;
  let destinationReachable = 0;
  let acknowledged = 0;
  let published = 0;
  let exposed = 0;
  let failedNoAcceptance = 0;
  let surfacesAbandoned = 0;

  for (const row of due.rows) {
    checked++;
    const actionId = String(row.action_id);
    const businessId = String(row.business_id);
    const publicUrl = String(row.public_url ?? "");
    const result = (row.request_result ?? {}) as Record<string, unknown>;
    const pageUrl = String(result.page ?? result.sourcePage ?? "");
    const expired =
      (row.expiry_at &&
        new Date(row.expiry_at as string | Date).getTime() <= Date.now()) ||
      Date.parse(String(row.created_at)) < Date.now() - EXPIRY_HOURS * 3_600_000;

    // 1) Referred external human traffic → EXPOSURE_CONFIRMED
    const traffic = await input.pool.query(
      `select count(*)::int as n from ros_traffic_events
       where business_id=$1
         and created_at > $2::timestamptz
         and (
           (meta->>'utm_campaign') = $1
           or path ilike '%utm_campaign=' || $1 || '%'
           or (referer ilike '%' || $1 || '%' and referer not ilike '%sslip.io%')
         )
         and class in ('LIKELY_HUMAN','QUALIFIED')
         and coalesce(referer,'') <> ''
         and referer not ilike '%sslip.io%'`,
      [businessId, row.created_at],
    );
    const referred = Number(traffic.rows[0]?.n ?? 0);
    if (referred > 0) {
      await input.pool.query(
        `update aq_distribution_receipts set
           status='EXPOSURE_CONFIRMED',
           exposure_verified_at=now(),
           measured_exposure=$2::jsonb,
           followup_at = now() + interval '24 hours'
         where action_id=$1`,
        [
          actionId,
          JSON.stringify({
            referredVisits: referred,
            verifiedAt: new Date().toISOString(),
            method: "external_referer_or_utm_traffic",
          }),
        ],
      );
      exposed++;
      await recordCommercialProgress(input.pool, {
        businessId,
        eventKind: "exposure_verified",
        isNewAudience: true,
        detail: `EXPOSURE_CONFIRMED via ${referred} referred visits`,
        meta: { actionId },
      });
      await input.pool.query(
        `update titan_commercial_stagnation_incidents
         set status='RESOLVED', resolved_at=now()
         where business_id=$1 and status='OPEN'
           and kind in ('CRITICAL_ZERO_EXPOSURE','CRITICAL_OVERNIGHT_ZERO_EXPOSURE')`,
        [businessId],
      );
      continue;
    }

    // 2) Public listing contains our asset → PUBLISHED
    let foundOnPage = false;
    let pageReachable = false;
    if (pageUrl.startsWith("http")) {
      const fetched = await fetchText(pageUrl);
      pageReachable = fetched.ok;
      if (fetched.text) {
        const needle = businessId.toLowerCase();
        const linkNeedle = publicUrl.split("?")[0] ?? "";
        foundOnPage =
          fetched.text.toLowerCase().includes(needle) ||
          (linkNeedle.length > 12 && fetched.text.includes(linkNeedle)) ||
          (publicUrl.length > 12 &&
            fetched.text.includes(publicUrl.slice(0, 48)));
      }
    }

    if (foundOnPage) {
      await input.pool.query(
        `update aq_distribution_receipts set
           status='PUBLISHED',
           public_url=coalesce(nullif(public_url,''), $3),
           exposure_verified_at=now(),
           measured_exposure=$2::jsonb,
           followup_at = now() + interval '12 hours'
         where action_id=$1`,
        [
          actionId,
          JSON.stringify({
            foundOnPage: true,
            pageUrl,
            verifiedAt: new Date().toISOString(),
            method: "public_content_scan",
            exposure: "UNKNOWN",
          }),
          pageUrl,
        ],
      );
      published++;
      await recordCommercialProgress(input.pool, {
        businessId,
        eventKind: "published_verified",
        isNewAudience: true,
        detail: `PUBLISHED content found on ${pageUrl}`,
        meta: { actionId, pageUrl },
      });
      await input.pool.query(
        `update titan_commercial_stagnation_incidents
         set status='RESOLVED', resolved_at=now()
         where business_id=$1 and status='OPEN'
           and kind in ('CRITICAL_ZERO_EXPOSURE','CRITICAL_OVERNIGHT_ZERO_EXPOSURE')`,
        [businessId],
      );
      continue;
    }

    // 3) Provider ack evidence → SUBMISSION_ACKNOWLEDGED
    if (
      hasAckEvidence(result, String(row.status)) ||
      (row.platform_receipt && String(row.platform_receipt).length > 4)
    ) {
      if (
        !["SUBMISSION_ACKNOWLEDGED", "ACCEPTANCE_CONFIRMED", "PUBLISHED"].includes(
          String(row.status),
        )
      ) {
        await input.pool.query(
          `update aq_distribution_receipts set
             status='SUBMISSION_ACKNOWLEDGED',
             measured_exposure=$2::jsonb,
             followup_at = now() + interval '2 hours'
           where action_id=$1`,
          [
            actionId,
            JSON.stringify({
              ack: true,
              verifiedAt: new Date().toISOString(),
              method: "provider_ack_or_receipt",
            }),
          ],
        );
        acknowledged++;
        continue;
      }
    }

    // 4) Destination HTTP ok only → DESTINATION_REACHABLE (NOT acceptance)
    // Expire after 6h without publish/exposure — do not loop forever.
    const ageHours =
      (Date.now() - Date.parse(String(row.created_at))) / 3_600_000;
    if (
      pageReachable &&
      ["SUBMITTED", "SENT", "ACCEPTED", "DESTINATION_REACHABLE"].includes(
        String(row.status),
      )
    ) {
      if (ageHours >= 6 || expired) {
        await input.pool.query(
          `update aq_distribution_receipts set
             status='FAILED_NO_ACCEPTANCE',
             measured_exposure=$2::jsonb,
             exposure_verified_at=now()
           where action_id=$1`,
          [
            actionId,
            JSON.stringify({
              failed: true,
              reason: "destination_reachable_but_never_accepted_or_published",
              ageHours,
              verifiedAt: new Date().toISOString(),
            }),
          ],
        );
        failedNoAcceptance++;
        surfacesAbandoned++;
        await recordCommercialFailure(input.pool, {
          businessId,
          strategyKey: `dead_destination_reachable:${String(row.external_action)}`,
          surface: String(row.external_destination).slice(0, 120),
          rootCauseHypothesis: "CHANNEL_REACHABLE_WITHOUT_ACCEPTANCE",
          evidence: { actionId, pageUrl, ageHours },
          lesson:
            "HTTP-reachable destination never accepted/published our pitch — abandon this surface and diversify channel family",
          nextDifferentAction:
            "stop_public_form_spam_try_directory_partner_marketplace_or_asset",
        });
        continue;
      }
      await input.pool.query(
        `update aq_distribution_receipts set
           status='DESTINATION_REACHABLE',
           measured_exposure=$2::jsonb,
           followup_at = now() + interval '3 hours'
         where action_id=$1`,
        [
          actionId,
          JSON.stringify({
            pageReachable: true,
            published: false,
            acceptance: false,
            verifiedAt: new Date().toISOString(),
            method: "destination_reachable_only",
            note: "HTTP 200 proves destination reachable — NOT acceptance",
          }),
        ],
      );
      destinationReachable++;
      continue;
    }

    // 5) Expired without stronger evidence
    if (expired) {
      const failStatus =
        String(row.status) === "PUBLISHED"
          ? "PUBLISHED_UNKNOWN_EXPOSURE"
          : "FAILED_NO_ACCEPTANCE";
      await input.pool.query(
        `update aq_distribution_receipts set
           status=$2,
           measured_exposure=$3::jsonb,
           exposure_verified_at=now()
         where action_id=$1`,
        [
          actionId,
          failStatus,
          JSON.stringify({
            failed: true,
            reason: "window_expired_without_acceptance_or_publication",
            pageUrl,
            verifiedAt: new Date().toISOString(),
          }),
        ],
      );
      failedNoAcceptance++;
      surfacesAbandoned++;
      await recordCommercialFailure(input.pool, {
        businessId,
        strategyKey: `no_acceptance:${String(row.external_action)}`,
        surface: String(row.external_destination).slice(0, 120),
        rootCauseHypothesis: "CHANNEL_OR_SURFACE_NO_ACCEPTANCE",
        evidence: { actionId, pageUrl, priorStatus: row.status },
        lesson:
          "Submission expired without acceptance/publication evidence — diversify channel family",
        nextDifferentAction:
          "try_different_channel_family_directory_partner_marketplace_or_asset",
      });
      input.logger?.("warn", "acquisition.failed_no_acceptance", {
        businessId,
        actionId,
        status: failStatus,
      });
    } else {
      await input.pool.query(
        `update aq_distribution_receipts
         set followup_at = now() + interval '2 hours',
             measured_exposure = measured_exposure || $2::jsonb
         where action_id=$1`,
        [
          actionId,
          JSON.stringify({
            lastCheck: new Date().toISOString(),
            foundOnPage: false,
            referred: 0,
          }),
        ],
      );
    }
  }

  return {
    checked,
    destinationReachable,
    acknowledged,
    published,
    exposed,
    failedNoAcceptance,
    surfacesAbandoned,
  };
}
