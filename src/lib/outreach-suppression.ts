import { createHmac, timingSafeEqual } from "node:crypto";

const RESEND_API = "https://api.resend.com";

function resendHeaders() {
  return {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "User-Agent": "TributeReady/1.0",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export function suppressionIsConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.RESEND_SUPPRESSION_AUDIENCE_ID &&
      process.env.OUTREACH_UNSUBSCRIBE_SECRET,
  );
}

function normalise(email: string) {
  return email.trim().toLowerCase();
}

export function signUnsubscribe(email: string) {
  const secret = process.env.OUTREACH_UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("Unsubscribe signing is not configured");
  return createHmac("sha256", secret).update(normalise(email)).digest("hex");
}

// A signed link means an unsubscribe needs no lookup to be trusted, and nobody
// can suppress an address they were not actually sent mail at.
export function verifyUnsubscribe(email: string, token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) return false;
  try {
    return timingSafeEqual(
      Buffer.from(signUnsubscribe(email), "hex"),
      Buffer.from(token, "hex"),
    );
  } catch {
    return false;
  }
}

export function unsubscribeUrl(email: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://tributeready.org";
  const params = new URLSearchParams({
    e: Buffer.from(normalise(email)).toString("base64url"),
    t: signUnsubscribe(email),
  });
  return `${origin}/unsubscribe?${params.toString()}`;
}

export function decodeEmailParam(value: string | null) {
  if (!value) return null;
  try {
    const email = Buffer.from(value, "base64url").toString("utf8");
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? normalise(email) : null;
  } catch {
    return null;
  }
}

export async function suppressEmail(email: string) {
  const audience = process.env.RESEND_SUPPRESSION_AUDIENCE_ID;
  const response = await fetch(`${RESEND_API}/audiences/${audience}/contacts`, {
    method: "POST",
    headers: resendHeaders(),
    body: JSON.stringify({ email: normalise(email), unsubscribed: true }),
  });
  return response.ok;
}

export async function isSuppressed(email: string) {
  const audience = process.env.RESEND_SUPPRESSION_AUDIENCE_ID;
  const response = await fetch(
    `${RESEND_API}/audiences/${audience}/contacts/${encodeURIComponent(normalise(email))}`,
    { headers: resendHeaders() },
  );
  if (!response.ok) return false;
  const contact = (await response.json()) as { unsubscribed?: boolean };
  return contact.unsubscribed === true;
}
