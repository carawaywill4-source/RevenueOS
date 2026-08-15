/**
 * Capability gap lifecycle — OPEN is never an end state.
 * DETECTED → classify → design/implement OR owner-block → measure → CLOSE.
 */

import { randomBytes } from "node:crypto";
import type pg from "pg";

export type GapClass =
  | "AUTONOMOUSLY_SOLVABLE"
  | "OWNER_DEPENDENCY"
  | "EXTERNAL_PLATFORM_DEPENDENCY"
  | "NOT_WORTH_BUILDING";

export type GapStage =
  | "DETECTED"
  | "CLASSIFIED"
  | "DESIGN"
  | "IMPLEMENTING"
  | "OWNER_BLOCKED"
  | "DEPLOYED"
  | "MEASURING"
  | "CLOSED"
  | "REVERTED"
  | "DEFERRED";

function eid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

export function classifyCapabilityGap(gap: string): {
  class: GapClass;
  commercialValue: number;
  nextAction: string;
} {
  if (/email_outreach|resend|deliverability|from_email/i.test(gap)) {
    const fromReady = Boolean(
      process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL,
    );
    const keyReady = Boolean(process.env.RESEND_API_KEY);
    if (keyReady && fromReady) {
      return {
        class: "AUTONOMOUSLY_SOLVABLE",
        commercialValue: 0.85,
        nextAction:
          "Resend from-domain is configured — close gap after successful EMAIL_OUTREACH + quality gate",
      };
    }
    return {
      class: "OWNER_DEPENDENCY",
      commercialValue: 0.85,
      nextAction:
        "Owner verifies Resend sending domain DNS; Titan resumes EMAIL_OUTREACH immediately after",
    };
  }
  if (
    /directory|resource_pitch|public_form|no_reachable_new_audience|adapter/i.test(
      gap,
    )
  ) {
    return {
      class: "AUTONOMOUSLY_SOLVABLE",
      commercialValue: 0.9,
      nextAction:
        "Advance PUBLIC_FORM / DIRECTORY / RESOURCE_PITCH generic executors; verify exposure",
    };
  }
  if (/captcha|login_wall|oauth|account_required/i.test(gap)) {
    return {
      class: "EXTERNAL_PLATFORM_DEPENDENCY",
      commercialValue: 0.4,
      nextAction: "Route to OWNER_ACTION or abandon surface family",
    };
  }
  if (/gsc|bing_webmaster|search_console/i.test(gap)) {
    return {
      class: "OWNER_DEPENDENCY",
      commercialValue: 0.55,
      nextAction: "Owner connects Search Console; Titan continues other channels",
    };
  }
  return {
    class: "NOT_WORTH_BUILDING",
    commercialValue: 0.2,
    nextAction: "Defer; reallocate to higher-EV channels",
  };
}

export async function ensureCapabilityGapColumns(pool: pg.Pool): Promise<void> {
  await pool.query(`
    alter table titan_acquisition_capability_gaps
      add column if not exists solvability text,
      add column if not exists commercial_value numeric not null default 0.5,
      add column if not exists businesses_blocked int not null default 1,
      add column if not exists stage text not null default 'DETECTED',
      add column if not exists next_action text,
      add column if not exists work_started_at timestamptz,
      add column if not exists closed_at timestamptz,
      add column if not exists owner_required boolean not null default false,
      add column if not exists can_autofix boolean not null default false,
      add column if not exists meta jsonb not null default '{}'::jsonb
  `);
}

export async function upsertCapabilityGap(
  pool: pg.Pool,
  input: {
    businessId: string;
    gap: string;
    proposed: string;
    evidence?: Record<string, unknown>;
    expectedValue?: string;
  },
): Promise<string> {
  await ensureCapabilityGapColumns(pool);
  const classified = classifyCapabilityGap(input.gap);
  const existing = await pool.query(
    `select id, status, stage from titan_acquisition_capability_gaps
     where gap=$1 and status in ('OPEN','OWNER_BLOCKED','IMPLEMENTING','MEASURING')
     order by created_at desc limit 1`,
    [input.gap],
  );
  if (existing.rows[0]) {
    const id = String(existing.rows[0].id);
    await pool.query(
      `update titan_acquisition_capability_gaps set
         businesses_blocked = businesses_blocked + 1,
         evidence = evidence || $2::jsonb,
         updated_at = now(),
         commercial_value = greatest(commercial_value, $3),
         next_action = coalesce(next_action, $4)
       where id=$1`,
      [
        id,
        JSON.stringify([input.evidence ?? {}]),
        classified.commercialValue,
        classified.nextAction,
      ],
    );
    return id;
  }
  const id = eid("gap");
  await pool.query(
    `insert into titan_acquisition_capability_gaps
     (id, business_id, gap, evidence, expected_value, proposed_capability, status,
      solvability, commercial_value, stage, next_action, owner_required, can_autofix, meta)
     values ($1,$2,$3,$4::jsonb,$5,$6,'OPEN',$7,$8,'CLASSIFIED',$9,$10,$11,$12::jsonb)`,
    [
      id,
      input.businessId,
      input.gap,
      JSON.stringify([input.evidence ?? {}]),
      input.expectedValue ?? "Unlock new-audience distribution",
      input.proposed,
      classified.class,
      classified.commercialValue,
      classified.nextAction,
      classified.class === "OWNER_DEPENDENCY",
      classified.class === "AUTONOMOUSLY_SOLVABLE",
      JSON.stringify({ classifiedAt: new Date().toISOString() }),
    ],
  );
  return id;
}

async function enqueuePreciseResendOwnerAction(pool: pg.Pool): Promise<void> {
  const domain =
    process.env.OUTREACH_FROM_DOMAIN ||
    process.env.RESEND_FROM_DOMAIN ||
    "revenueos.app";
  const from =
    process.env.OUTREACH_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    `outreach@${domain}`;
  const pending = await pool.query(
    `select 1 from aq_owner_actions
     where meta->>'kind'='resend_domain_verify' and status='PENDING' limit 1`,
  );
  if (pending.rows[0]) return;
  await pool.query(
    `insert into aq_owner_actions (
       id, business_id, platform, action_title, why_it_matters, expected_value,
       exact_action, prepared_content, link, estimated_minutes, status, priority, meta
     ) values ($1,'portfolio','resend',$2,$3,$4,$5,$6,$7,8,'PENDING',95,$8::jsonb)`,
    [
      eid("own"),
      "Verify Resend sending domain (unlocks compliant email outreach)",
      "Email outreach is blocked on Resend test-mode; hundreds of high-fit resource pitches need a verified from-domain",
      "Unblocks EMAIL_OUTREACH for all war-room businesses; expected new-audience channel family restored",
      [
        "1. Open https://resend.com/domains → Add Domain",
        `2. Add domain: ${domain}`,
        "3. Create the DNS records Resend shows (SPF + DKIM; DMARC optional)",
        "4. Click Verify in Resend",
        `5. Set OUTREACH_FROM_EMAIL=${from} in /etc/revenueos/revenueos.env`,
        "6. Restart revenueos-operator (or wait for next env reload)",
        "7. Titan automatically resumes EMAIL_OUTREACH — no further owner action",
      ].join("\n"),
      `From address after verify: ${from}\nReply-To: ${process.env.OUTREACH_REPLY_EMAIL || "same"}\nALLOW_PAID_AI remains false.`,
      "https://resend.com/domains",
      JSON.stringify({
        kind: "resend_domain_verify",
        domain,
        from,
        after: "titan_resumes_email_outreach",
        commercialValue: 0.85,
      }),
    ],
  );
}

/**
 * Advance all open gaps one stage. Autonomous gaps implement/close;
 * owner gaps get precise tasks and stop blocking other channels.
 */
export async function advanceCapabilityGaps(input: {
  pool: pg.Pool;
  logger?: (
    level: "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>,
  ) => void;
}): Promise<{
  advanced: number;
  closed: number;
  ownerBlocked: number;
  implementing: number;
}> {
  await ensureCapabilityGapColumns(input.pool);
  const open = await input.pool.query(
    `select * from titan_acquisition_capability_gaps
     where status in ('OPEN','OWNER_BLOCKED','IMPLEMENTING','MEASURING')
     order by commercial_value desc, created_at asc
     limit 20`,
  );

  let advanced = 0;
  let closed = 0;
  let ownerBlocked = 0;
  let implementing = 0;

  // Evidence: public form pitches already succeeding → close related adapter gaps
  const formOk = await input.pool.query(
    `select count(*)::int as n from aq_distribution_receipts
     where external_action='public_form_resource_pitch'
       and status in ('SUBMITTED','ACCEPTED','PUBLISHED','EXPOSED')
       and is_new_audience=true
       and created_at > now() - interval '48 hours'`,
  );
  const formsWorking = Number(formOk.rows[0]?.n ?? 0) >= 3;

  for (const row of open.rows) {
    const id = String(row.id);
    const gap = String(row.gap);
    const classified = classifyCapabilityGap(gap);
    const solvability = String(row.solvability ?? classified.class);

    if (solvability === "OWNER_DEPENDENCY") {
      if (gap.includes("email_outreach") || gap.includes("deliverability")) {
        await enqueuePreciseResendOwnerAction(input.pool);
      }
      await input.pool.query(
        `update titan_acquisition_capability_gaps set
           status='OWNER_BLOCKED', stage='OWNER_BLOCKED',
           solvability=$2, owner_required=true, can_autofix=false,
           next_action=$3, commercial_value=$4, updated_at=now(),
           meta = meta || $5::jsonb
         where id=$1`,
        [
          id,
          solvability,
          classified.nextAction,
          classified.commercialValue,
          JSON.stringify({
            ownerActionPreparedAt: new Date().toISOString(),
            note: "Other channels continue; this gap does not freeze Titan",
          }),
        ],
      );
      ownerBlocked++;
      advanced++;
      continue;
    }

    if (solvability === "NOT_WORTH_BUILDING") {
      await input.pool.query(
        `update titan_acquisition_capability_gaps set
           status='DEFERRED', stage='DEFERRED', closed_at=now(), updated_at=now(),
           next_action='reallocate_to_higher_ev'
         where id=$1`,
        [id],
      );
      closed++;
      advanced++;
      continue;
    }

    if (solvability === "EXTERNAL_PLATFORM_DEPENDENCY") {
      await input.pool.query(
        `update titan_acquisition_capability_gaps set
           status='DEFERRED', stage='DEFERRED', closed_at=now(), updated_at=now(),
           next_action='use_alternate_channel_family'
         where id=$1`,
        [id],
      );
      closed++;
      advanced++;
      continue;
    }

    // AUTONOMOUSLY_SOLVABLE
    if (formsWorking && /directory|resource|public_form|no_reachable/i.test(gap)) {
      await input.pool.query(
        `update titan_acquisition_capability_gaps set
           status='CLOSED', stage='CLOSED', closed_at=now(), updated_at=now(),
           work_started_at=coalesce(work_started_at, now()),
           next_action='executor_proven_via_public_form_receipts',
           meta = meta || $2::jsonb
         where id=$1`,
        [
          id,
          JSON.stringify({
            closedBecause: "public_form_resource_pitch_working",
            formReceipts48h: Number(formOk.rows[0]?.n ?? 0),
            closedAt: new Date().toISOString(),
          }),
        ],
      );
      closed++;
      advanced++;
      input.logger?.("info", "capability.gap.closed", {
        gap,
        reason: "executor_working",
      });
      continue;
    }

    // Mark implementing — generic executors live in AcquisitionOS / new-audience
    await input.pool.query(
      `update titan_acquisition_capability_gaps set
         status='IMPLEMENTING', stage='IMPLEMENTING',
         work_started_at=coalesce(work_started_at, now()),
         can_autofix=true, solvability=$2, commercial_value=$3,
         next_action=$4, updated_at=now()
       where id=$1`,
      [
        id,
        solvability,
        classified.commercialValue,
        "Generic PUBLIC_FORM/DIRECTORY/RESOURCE executors advancing via commercial executive",
      ],
    );
    implementing++;
    advanced++;
  }

  return { advanced, closed, ownerBlocked, implementing };
}
