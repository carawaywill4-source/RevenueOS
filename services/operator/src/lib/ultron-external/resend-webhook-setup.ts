/**
 * FIX 1 — Configure Resend Svix webhook secret from the live Resend API.
 *
 * Resend does not let you re-read an existing signing secret. If a webhook
 * for our inbound URL already exists, we record an owner blocker.
 * If none exists and RESEND_API_KEY is present, we create one and persist
 * the signing_secret to a 0600 file the operator can load.
 *
 * Never logs the secret. Never weakens verification.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import type { Logger } from "../ultron-core/types.js";

export const WEBHOOK_SECRET_FILE =
  process.env.RESEND_WEBHOOK_SECRET_FILE ||
  "/opt/revenueos/data/secrets/resend_webhook_secret";

export function loadWebhookSecret(): string {
  if (process.env.RESEND_WEBHOOK_SECRET) return process.env.RESEND_WEBHOOK_SECRET;
  try {
    if (existsSync(WEBHOOK_SECRET_FILE)) {
      return readFileSync(WEBHOOK_SECRET_FILE, "utf8").trim();
    }
  } catch {
    /* ignore */
  }
  return "";
}

function persistSecret(secret: string): { ok: boolean; detail: string } {
  try {
    mkdirSync(dirname(WEBHOOK_SECRET_FILE), { recursive: true, mode: 0o700 });
    writeFileSync(WEBHOOK_SECRET_FILE, secret, { mode: 0o600 });
    chmodSync(WEBHOOK_SECRET_FILE, 0o600);
    return { ok: true, detail: `wrote ${WEBHOOK_SECRET_FILE}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

type EnsureResult = {
  status: "CONFIGURED" | "ALREADY" | "OWNER_BLOCKER" | "NO_API_KEY" | "API_FAILED";
  detail: string;
  webhookId?: string;
};

export async function ensureResendInboundWebhook(logger: Logger): Promise<EnsureResult> {
  if (loadWebhookSecret()) {
    return { status: "ALREADY", detail: "RESEND_WEBHOOK_SECRET present (env or file)" };
  }
  const apiKey = process.env.RESEND_API_KEY ?? "";
  if (!apiKey) {
    return {
      status: "NO_API_KEY",
      detail: "owner_blocker: RESEND_API_KEY missing — cannot create webhook",
    };
  }

  const endpoint =
    process.env.ULTRON_INBOUND_URL ||
    `https://${process.env.ULTRON_PUBLIC_HOST || "revenueos-core.130.131.15.68.sslip.io"}/inbound/email`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };

  try {
    const list = await fetch("https://api.resend.com/webhooks", { headers, signal: AbortSignal.timeout(15_000) });
    const listBody = (await list.json().catch(() => ({}))) as {
      data?: Array<{ id?: string; endpoint?: string }>;
      object?: string;
    };
    const existing = (listBody.data ?? []).find((w) => String(w.endpoint ?? "") === endpoint);
    if (existing) {
      logger("warn", "ultron.resend.webhook.exists_no_secret", { webhookId: existing.id });
      return {
        status: "OWNER_BLOCKER",
        detail:
          `owner_blocker: Resend webhook ${existing.id} already exists for ${endpoint} but signing_secret cannot be re-read. Paste RESEND_WEBHOOK_SECRET from Resend dashboard.`,
        webhookId: existing.id,
      };
    }

    const created = await fetch("https://api.resend.com/webhooks", {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        endpoint,
        events: [
          "email.sent",
          "email.delivered",
          "email.bounced",
          "email.complained",
          "email.received",
          "email.opened",
          "email.clicked",
        ],
      }),
    });
    const body = (await created.json().catch(() => ({}))) as {
      id?: string;
      signing_secret?: string;
      message?: string;
      name?: string;
    };
    if (!created.ok || !body.signing_secret) {
      return {
        status: "API_FAILED",
        detail: `resend_create_failed status=${created.status} ${body.message ?? body.name ?? ""}`.trim(),
      };
    }
    const persisted = persistSecret(body.signing_secret);
    if (!persisted.ok) {
      return {
        status: "OWNER_BLOCKER",
        detail: `webhook created id=${body.id} but secret file write failed: ${persisted.detail}. Owner must set RESEND_WEBHOOK_SECRET.`,
        webhookId: body.id,
      };
    }
    process.env.RESEND_WEBHOOK_SECRET = body.signing_secret;
    logger("info", "ultron.resend.webhook.configured", { webhookId: body.id, endpoint });
    return { status: "CONFIGURED", detail: `created webhook ${body.id}`, webhookId: body.id };
  } catch (e) {
    return { status: "API_FAILED", detail: e instanceof Error ? e.message : String(e) };
  }
}
