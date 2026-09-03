/**
 * PRIORITY 4 — INBOUND EMAIL, END TO END.
 *
 * Wires the missing external → sensor path:
 *
 *   Resend → HTTPS webhook (Caddy) → operator /inbound/email
 *     → HMAC verify (RESEND_WEBHOOK_SECRET or ULTRON_INBOUND_TOKEN)
 *     → ros_inbound_webhooks (raw + normalized)
 *     → ros_inbound_messages (existing table, keeps compatibility)
 *     → ros_ultron_events (EMAIL.REPLY / EMAIL.BOUNCE / EMAIL.SPAM …)
 *     → attribution edge inbound_reply → action (if in-reply-to matches)
 *
 * The route is added into Caddy via the Admin API at boot so the public
 * URL exists without an operator restart.
 */

import { randomUUID } from "node:crypto";
import type http from "node:http";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { writeEdge } from "./attribution.js";
import { verifySvixSignature } from "./svix-verify.js";
import { loadWebhookSecret } from "./resend-webhook-setup.js";

const CADDY_ADMIN = process.env.CADDY_ADMIN_ENDPOINT || "http://127.0.0.1:2019";
const PUBLIC_HOST =
  process.env.ULTRON_PUBLIC_HOST || "revenueos-core.130.131.15.68.sslip.io";
const INBOUND_TOKEN = process.env.ULTRON_INBOUND_TOKEN || "";
function webhookSecret(): string {
  return loadWebhookSecret();
}

export function inboundEmailPublicUrl(): string {
  return `https://${PUBLIC_HOST}/inbound/email`;
}

/**
 * Add a Caddy route matching /inbound/email* on the public host to be
 * reverse-proxied to 127.0.0.1:8080. Idempotent — safe to call every boot.
 */
/**
 * Talk to Caddy's admin API using raw http.request so we can be explicit
 * about headers. Caddy admin rejects requests whose Origin doesn't match
 * an allow-list; the safest path is to send no Origin header at all.
 */
async function caddyAdmin<T = unknown>(
  method: string,
  pathname: string,
  body?: unknown,
): Promise<{ status: number; body: T | string }> {
  const http = await import("node:http");
  const admin = new URL(CADDY_ADMIN);
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        hostname: admin.hostname,
        port: Number(admin.port || 2019),
        path: pathname,
        method,
        headers: {
          host: `${admin.hostname}:${admin.port || 2019}`,
          "content-type": "application/json",
          ...(payload ? { "content-length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: unknown = raw;
          try {
            parsed = raw ? JSON.parse(raw) : "";
          } catch { /* leave raw */ }
          resolve({ status: res.statusCode ?? 0, body: parsed as T | string });
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export async function ensureCaddyInboundRoute(logger: Logger): Promise<{ ok: boolean; detail: string }> {
  try {
    const routesRes = await caddyAdmin<Array<Record<string, unknown>>>(
      "GET",
      "/config/apps/http/servers/srv0/routes",
    );
    if (routesRes.status < 200 || routesRes.status >= 300) {
      return { ok: false, detail: `caddy_admin_unreachable:${routesRes.status}` };
    }
    const routes = Array.isArray(routesRes.body) ? routesRes.body : [];
    const hostMatch = routes.findIndex((route) => {
      const match = (route as { match?: Array<{ host?: string[] }> }).match ?? [];
      return match.some((m) => (m.host ?? []).includes(PUBLIC_HOST));
    });
    const alreadyHasInbound = JSON.stringify(routes).includes("/inbound/email");
    if (alreadyHasInbound) {
      logger("info", "ultron.inbound.caddy_route.exists", {});
      return { ok: true, detail: "already_configured" };
    }

    // INSERT before the host catch-all. Never PUT-replace that catch-all.
    const newRoute = {
      handle: [
        {
          handler: "subroute",
          routes: [
            {
              handle: [
                { handler: "reverse_proxy", upstreams: [{ dial: "127.0.0.1:8080" }] },
              ],
            },
          ],
        },
      ],
      match: [
        {
          host: [PUBLIC_HOST],
          path: ["/inbound/email", "/inbound/email/*"],
        },
      ],
      terminal: true,
    };

    if (hostMatch >= 0) {
      const inserted = await caddyAdmin(
        "POST",
        `/config/apps/http/servers/srv0/routes/${hostMatch}`,
        newRoute,
      );
      if (inserted.status < 200 || inserted.status >= 300) {
        return { ok: false, detail: `caddy_insert_failed:${inserted.status}:${String(inserted.body).slice(0, 200)}` };
      }
    } else {
      const post = await caddyAdmin(
        "POST",
        `/config/apps/http/servers/srv0/routes/...`,
        newRoute,
      );
      if (post.status < 200 || post.status >= 300) {
        return { ok: false, detail: `caddy_append_failed:${post.status}:${String(post.body).slice(0, 200)}` };
      }
    }
    logger("info", "ultron.inbound.caddy_route.added", { url: inboundEmailPublicUrl() });
    return { ok: true, detail: `added ${inboundEmailPublicUrl()}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

type TrustStatus = "TRUSTED" | "TRUSTED_INTERNAL" | "QUARANTINED" | "REJECTED";

function classifyTrust(
  rawBody: string,
  headers: http.IncomingHttpHeaders,
): { status: TrustStatus; via: string; svixId: string | null; reason: string } {
  const token = String(headers["x-ultron-inbound-token"] ?? "");
  if (INBOUND_TOKEN && token && token === INBOUND_TOKEN) {
    return {
      status: "TRUSTED_INTERNAL",
      via: "ULTRON_TOKEN",
      svixId: null,
      reason: "internal_probe_token — never counts as customer EMAIL.REPLY",
    };
  }

  const secret = webhookSecret();
  if (!secret) {
    return { status: "QUARANTINED", via: "NO_SECRET", svixId: null, reason: "RESEND_WEBHOOK_SECRET missing" };
  }

  const svix = verifySvixSignature(rawBody, headers, secret);
  if (svix.ok) {
    return { status: "TRUSTED", via: "SVIX", svixId: svix.svixId, reason: "svix_hmac_ok" };
  }
  if (svix.reason === "svix_timestamp_outside_tolerance") {
    return { status: "REJECTED", via: "SVIX", svixId: null, reason: svix.reason };
  }
  if (svix.reason === "svix_signature_mismatch" || svix.reason === "missing_svix_headers") {
    return { status: "REJECTED", via: "SVIX", svixId: null, reason: svix.reason };
  }
  return { status: "QUARANTINED", via: "SVIX", svixId: null, reason: svix.reason };
}

function classifyEmailPayload(payload: Record<string, unknown>): {
  classification: string;
  fromAddr: string | null;
  toAddr: string | null;
  subject: string | null;
  bodyText: string | null;
  inReplyTo: string | null;
} {
  const p = payload as Record<string, unknown>;
  const data = (p.data as Record<string, unknown>) ?? p;
  const type = String(p.type ?? p.event ?? data.type ?? "").toLowerCase();
  const from = String((data.from as string | undefined) ?? (data.from_email as string | undefined) ?? "");
  const to = Array.isArray(data.to) ? String((data.to as string[])[0]) : String(data.to ?? data.to_email ?? "");
  const subject = String((data.subject as string | undefined) ?? "");
  const bodyText = String((data.text as string | undefined) ?? (data.plain as string | undefined) ?? "");
  const inReplyTo = String((data.in_reply_to as string | undefined) ?? (data.reply_to as string | undefined) ?? "");
  let classification: string = "REPLY";
  if (/bounce|bounced|delivery\.delayed|delivery\.failed/.test(type)) classification = "BOUNCE";
  else if (/spam|complaint/.test(type)) classification = "SPAM";
  else if (/opened|open/.test(type)) classification = "OPEN";
  else if (/clicked|click/.test(type)) classification = "CLICK";
  else if (/unsubscribe/.test(type) || /\bunsubscribe\b/i.test(bodyText)) classification = "UNSUBSCRIBE";
  else if (/auto\-?reply|out of office|vacation/i.test(subject) || /auto\-?reply|out of office|vacation/i.test(bodyText)) {
    classification = "AUTO_REPLY";
  } else if (/^re:/i.test(subject) || bodyText.length > 30) {
    classification = "REPLY";
  }
  return {
    classification,
    fromAddr: from || null,
    toAddr: to || null,
    subject: subject || null,
    bodyText: bodyText || null,
    inReplyTo: inReplyTo || null,
  };
}

/**
 * The HTTP handler. Register this from the health-server's request
 * dispatcher (see wiring below).
 */
export async function handleInboundEmailRequest(
  pool: pg.Pool,
  logger: Logger,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "method_not_allowed" }));
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");

  const trust = classifyTrust(raw, req.headers);
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  const webhookId = `wh_${randomUUID().slice(0, 12)}`;
  const classify = classifyEmailPayload(payload);

  if (trust.svixId) {
    const replay = await pool.query(
      `select webhook_id from ros_inbound_webhooks where svix_id = $1 limit 1`,
      [trust.svixId],
    );
    if ((replay.rowCount ?? 0) > 0) {
      logger("warn", "ultron.inbound.email.replay", { svixId: trust.svixId });
      res.writeHead(409, { "content-type": "application/json" });
      res.end(JSON.stringify({ received: false, trust: "REJECTED", reason: "replay_svix_id" }));
      return;
    }
  }

  // RAW QUARANTINE RECORD always — even rejects stay for diagnostics.
  await pool.query(
    `insert into ros_inbound_webhooks
       (webhook_id, provider, route, signature_ok, payload, raw_body,
        classification, business_id, created_at, trust_status, svix_id, verify_reason)
     values ($1, 'resend','/inbound/email', $2, $3::jsonb, $4, $5, $6, now(), $7, $8, $9)`,
    [
      webhookId,
      trust.status === "TRUSTED",
      JSON.stringify(payload),
      raw.slice(0, 20_000),
      classify.classification,
      null,
      trust.status,
      trust.svixId,
      trust.reason,
    ],
  );

  if (trust.status !== "TRUSTED") {
    logger("warn", "ultron.inbound.email.untrusted", {
      via: trust.via,
      webhookId,
      status: trust.status,
      reason: trust.reason,
    });
    const code = trust.status === "REJECTED" ? 401 : 202;
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify({
      received: true,
      verified: false,
      trust: trust.status,
      id: webhookId,
      reason: trust.reason,
    }));
    return;
  }

  // TRUSTED only from here: normalize → inbound_messages → EMAIL.* → attribution.
  const messageId = `msg_${randomUUID().slice(0, 12)}`;
  await pool.query(
    `insert into ros_inbound_messages
       (message_id, provider, thread_key, from_addr, to_addr, subject,
        body_text, classification, confidence, meta, direction, created_at)
     values ($1, 'resend', $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'inbound', now())
     on conflict (message_id) do nothing`,
    [
      messageId,
      classify.inReplyTo || classify.subject,
      classify.fromAddr,
      classify.toAddr,
      classify.subject,
      classify.bodyText,
      classify.classification,
      0.95,
      JSON.stringify({ webhookId, inReplyTo: classify.inReplyTo, trust: "TRUSTED", via: trust.via }),
    ],
  );

  await pool.query(
    `insert into ros_ultron_events
       (event_id, kind, source, business_id, action_id, payload, confidence, evidence, created_at)
     values ($1, $2, 'inbound_webhook', $3, $4, $5::jsonb, 0.95, $6, now())
     on conflict (event_id) do nothing`,
    [
      `ev_${randomUUID().slice(0, 12)}`,
      `EMAIL.${classify.classification}`,
      null,
      classify.inReplyTo || null,
      JSON.stringify({ from: classify.fromAddr, to: classify.toAddr, subject: classify.subject, trust: "TRUSTED" }),
      `webhook:${webhookId}`,
    ],
  );

  if (classify.inReplyTo) {
    const match = await pool.query(
      `select action_id, business_id from aq_distribution_receipts
        where coalesce(request_result->>'resendId','') = $1
        limit 1`,
      [classify.inReplyTo],
    );
    if (match.rowCount && match.rowCount > 0) {
      await writeEdge(pool, {
        fromKind: "inbound_message",
        fromId: messageId,
        toKind: "action",
        toId: String(match.rows[0].action_id),
        relation: "reply_to",
        confidence: "DIRECT",
        businessId: match.rows[0].business_id,
        evidence: { inReplyTo: classify.inReplyTo, classification: classify.classification, trust: "TRUSTED" },
      });
    }
  }

  logger("info", "ultron.inbound.email.trusted", {
    webhookId,
    classification: classify.classification,
  });

  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ received: true, verified: true, trust: "TRUSTED", id: webhookId, class: classify.classification }));
}
