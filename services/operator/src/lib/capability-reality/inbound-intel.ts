/**
 * Inbound commercial intelligence — classify replies and attach to experiments.
 */

import { randomBytes } from "node:crypto";
import type pg from "pg";

export type ReplyClass =
  | "automated_response"
  | "delivery_failure"
  | "human_acknowledgment"
  | "support_routing"
  | "internal_referral"
  | "question"
  | "objection"
  | "interest"
  | "strong_interest"
  | "partnership_interest"
  | "listing_accepted"
  | "publication_accepted"
  | "customer_intent"
  | "purchase"
  | "rejection"
  | "unsubscribe"
  | "unknown";

export function classifyInboundReply(input: {
  subject?: string;
  body: string;
}): { classification: ReplyClass; confidence: number; notes: string } {
  const text = `${input.subject ?? ""}\n${input.body}`.toLowerCase();
  if (/mailer-daemon|delivery status notification|undeliverable|mailbox unavailable/.test(text)) {
    return { classification: "delivery_failure", confidence: 0.95, notes: "bounce" };
  }
  if (/unsubscribe|stop|remove me|do not contact/.test(text)) {
    return { classification: "unsubscribe", confidence: 0.9, notes: "opt_out" };
  }
  if (/out of office|automatic reply|autoreply|auto-reply/.test(text)) {
    return { classification: "automated_response", confidence: 0.9, notes: "ooo" };
  }
  if (/forwarding (this )?to (our )?management|i'?ll pass this along|routing to/.test(text)) {
    return {
      classification: "internal_referral",
      confidence: 0.8,
      notes: "weak_positive_routing_not_partnership_success",
    };
  }
  if (/support ticket|case #|helpdesk|zendesk|freshdesk/.test(text)) {
    return { classification: "support_routing", confidence: 0.75, notes: "support_queue" };
  }
  if (/we (have )?listed|listing (is )?live|approved your (listing|submission)/.test(text)) {
    return { classification: "listing_accepted", confidence: 0.85, notes: "listing" };
  }
  if (/published|went live|posted your/.test(text)) {
    return { classification: "publication_accepted", confidence: 0.8, notes: "published" };
  }
  if (/partnership|collaborate|co-market/.test(text)) {
    return { classification: "partnership_interest", confidence: 0.75, notes: "partner" };
  }
  if (/buy|purchase|pricing|checkout|how much|invoice/.test(text)) {
    return { classification: "customer_intent", confidence: 0.7, notes: "intent" };
  }
  if (/interested|tell me more|send more|sounds useful/.test(text)) {
    return { classification: "interest", confidence: 0.65, notes: "interest" };
  }
  if (/very interested|let'?s do it|ready to proceed/.test(text)) {
    return { classification: "strong_interest", confidence: 0.7, notes: "strong" };
  }
  if (/not interested|no thank|pass for now|don'?t contact/.test(text)) {
    return { classification: "rejection", confidence: 0.8, notes: "reject" };
  }
  if (/\?/.test(text) && text.length < 800) {
    return { classification: "question", confidence: 0.55, notes: "question" };
  }
  if (/thanks|thank you|received|got it/.test(text)) {
    return { classification: "human_acknowledgment", confidence: 0.55, notes: "ack" };
  }
  return { classification: "unknown", confidence: 0.3, notes: "unclassified" };
}

export async function ingestInboundMessage(
  pool: pg.Pool,
  input: {
    provider: string;
    from?: string;
    to?: string;
    subject?: string;
    body: string;
    businessId?: string;
    experimentId?: string;
    receiptId?: string;
    threadKey?: string;
  },
): Promise<{ messageId: string; classification: ReplyClass }> {
  const cls = classifyInboundReply({
    subject: input.subject,
    body: input.body,
  });
  const messageId = `in_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  await pool.query(
    `insert into ros_inbound_messages
       (message_id, provider, thread_key, business_id, experiment_id, receipt_id,
        direction, from_addr, to_addr, subject, body_text, classification, confidence, meta)
     values ($1,$2,$3,$4,$5,$6,'inbound',$7,$8,$9,$10,$11,$12,$13::jsonb)`,
    [
      messageId,
      input.provider,
      input.threadKey ?? null,
      input.businessId ?? null,
      input.experimentId ?? null,
      input.receiptId ?? null,
      input.from ?? null,
      input.to ?? null,
      input.subject ?? null,
      input.body.slice(0, 20_000),
      cls.classification,
      cls.confidence,
      JSON.stringify({ notes: cls.notes }),
    ],
  );

  // Learn from ONE LICENSE-style weak routing: unclear CTA → persist lesson
  if (cls.classification === "internal_referral" || cls.classification === "support_routing") {
    await pool.query(
      `insert into ros_config_meta (key, value, updated_at, provenance)
       values ('commercial_comms_lessons', $1::jsonb, now(), 'INBOUND_INTEL')
       on conflict (key) do update set
         value = jsonb_set(
           coalesce(ros_config_meta.value,'{"lessons":[]}'::jsonb),
           '{lessons}',
           coalesce(ros_config_meta.value->'lessons','[]'::jsonb) || $2::jsonb
         ),
         updated_at=now()`,
      [
        JSON.stringify({
          lessons: [
            {
              at: new Date().toISOString(),
              classification: cls.classification,
              lesson:
                "Routing/support replies imply weak CTA — require commercial brief approval before send",
            },
          ],
        }),
        JSON.stringify([
          {
            at: new Date().toISOString(),
            classification: cls.classification,
            lesson:
              "Routing/support replies imply weak CTA — require commercial brief approval before send",
          },
        ]),
      ],
    );
  }

  return { messageId, classification: cls.classification };
}

/** Seed the ONE LICENSE regression lesson into commercial memory (no resend). */
export async function persistOneLicenseRegressionLesson(pool: pg.Pool): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('commercial_comms_lessons', $1::jsonb, now(), 'CAPABILITY_REALITY')
     on conflict (key) do update set
       value = jsonb_set(
         coalesce(ros_config_meta.value, '{"lessons":[]}'::jsonb),
         '{lessons}',
         (
           select jsonb_agg(x)
           from (
             select distinct on ((elem->>'id')) elem as x
             from jsonb_array_elements(
               coalesce(ros_config_meta.value->'lessons','[]'::jsonb) || $2::jsonb
             ) elem
             order by (elem->>'id'), (elem->>'at') desc
           ) s
         )
       ),
       updated_at=now()`,
    [
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        lessons: [
          {
            id: "one_license_regression",
            at: new Date().toISOString(),
            lesson:
              "ONE LICENSE outreach: heavy research, weak commercial ask. Recipient could not determine offer, desired outcome, or single management action. Require WHO/WHY/OBJECTIVE/VALUE/OFFER/CTA/WHY_NOW gate before send.",
            oldFailure:
              "research-flex + vague 'use or ignore' CTA → support/management routing, not partnership",
          },
        ],
      }),
      JSON.stringify([
        {
          id: "one_license_regression",
          at: new Date().toISOString(),
          lesson:
            "ONE LICENSE outreach: heavy research, weak commercial ask. Require commercial quality gate before send.",
        },
      ]),
    ],
  );
}
