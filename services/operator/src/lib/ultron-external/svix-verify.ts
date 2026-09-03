/**
 * FIX 1 — Resend/Svix cryptographic verification.
 *
 * Resend inbound webhooks are signed with the Svix scheme:
 *   signed_content = `${svix-id}.${svix-timestamp}.${raw_body}`
 *   secret         = base64(whsec_… payload)
 *   expected       = HMAC-SHA256(secret, signed_content) as base64
 *   header         = "v1,<b64> v1,<b64>…"
 *
 * Replay protection: reject timestamps outside ±300s, and reject
 * duplicate svix-id values (caller persists uniqueness).
 *
 * This is the provider-supported algorithm (same as `svix` Webhook.verify).
 * We implement it locally so the operator does not depend on a silent
 * false-positive HMAC.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type http from "node:http";

export const SVIX_TOLERANCE_SEC = 300;

export type SvixVerifyResult =
  | { ok: true; svixId: string; timestamp: number }
  | { ok: false; reason: string };

function header(headers: http.IncomingHttpHeaders, name: string): string {
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return String(v[0] ?? "");
  return String(v ?? "");
}

function decodeSecret(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(raw, "base64");
}

function signaturesFromHeader(sigHeader: string): string[] {
  const out: string[] = [];
  for (const part of sigHeader.split(" ")) {
    const [ver, b64] = part.split(",", 2);
    if (ver === "v1" && b64) out.push(b64);
  }
  return out;
}

function safeEqualB64(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Verify a Resend/Svix webhook. `rawBody` MUST be the exact bytes received
 * (utf8 string of the original request body), not a re-serialized JSON object.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: http.IncomingHttpHeaders,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): SvixVerifyResult {
  if (!secret) return { ok: false, reason: "missing_webhook_secret" };

  const svixId = header(headers, "svix-id");
  const tsRaw = header(headers, "svix-timestamp");
  const sigHeader = header(headers, "svix-signature");
  if (!svixId || !tsRaw || !sigHeader) {
    return { ok: false, reason: "missing_svix_headers" };
  }

  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, reason: "invalid_svix_timestamp" };
  }
  if (Math.abs(nowSec - ts) > SVIX_TOLERANCE_SEC) {
    return { ok: false, reason: "svix_timestamp_outside_tolerance" };
  }

  const passed = signaturesFromHeader(sigHeader);
  if (passed.length === 0) return { ok: false, reason: "no_v1_signatures" };

  let secretBuf: Buffer;
  try {
    secretBuf = decodeSecret(secret);
    if (secretBuf.length < 16) return { ok: false, reason: "webhook_secret_too_short" };
  } catch {
    return { ok: false, reason: "webhook_secret_not_base64" };
  }

  const toSign = `${svixId}.${tsRaw}.${rawBody}`;
  const expected = createHmac("sha256", secretBuf).update(toSign, "utf8").digest("base64");
  for (const sig of passed) {
    if (safeEqualB64(sig, expected)) {
      return { ok: true, svixId, timestamp: ts };
    }
  }
  return { ok: false, reason: "svix_signature_mismatch" };
}

export function makeSvixHeaders(rawBody: string, secret: string, svixId: string, ts: number): Record<string, string> {
  const secretBuf = decodeSecret(secret);
  const expected = createHmac("sha256", secretBuf)
    .update(`${svixId}.${ts}.${rawBody}`, "utf8")
    .digest("base64");
  return {
    "svix-id": svixId,
    "svix-timestamp": String(ts),
    "svix-signature": `v1,${expected}`,
  };
}
