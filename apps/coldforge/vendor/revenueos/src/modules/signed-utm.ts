/**
 * Signed UTM attribution.
 *
 * When RevenueOS emits an outbound URL (in a Reddit reply, an IH product
 * listing, a Show HN post, an outbound email, a directory listing, etc.) it
 * needs to know that the click-back actually came from THAT surface — not
 * from someone rewriting UTMs client-side.
 *
 * We sign the (business_id, source, medium, campaign, timestamp) tuple with
 * an HMAC-SHA256 keyed on `REVENUEOS_ATTRIBUTION_SECRET`. The signature rides
 * on `utm_sig`. Attribution ML trusts a signed UTM verbatim; unsigned UTMs
 * are downgraded to "self-reported" confidence.
 *
 * All functions are pure and never throw. Signing works in Node + browser
 * (uses Node's `crypto` on the server, WebCrypto in the browser).
 */

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export type SignedUtmPayload = UtmParams & {
  business_id: string;
  ts: number;
};

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function base64url(input: Uint8Array | string): string {
  const buf =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  // Prefer Buffer if available (Node), otherwise use btoa (browser).
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buf)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }
  let bin = "";
  for (const byte of buf) bin += String.fromCharCode(byte);
  return btoa(bin)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    "=",
  );
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(padded, "base64"));
  }
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  if (
    typeof crypto !== "undefined" &&
    typeof (crypto as { subtle?: SubtleCrypto }).subtle !== "undefined"
  ) {
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
    return new Uint8Array(sig);
  }
  const { createHmac } = await import("node:crypto");
  return new Uint8Array(
    createHmac("sha256", secret).update(message).digest(),
  );
}

function canonicalMessage(payload: SignedUtmPayload): string {
  const keys: Array<keyof SignedUtmPayload> = [
    "business_id",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "ts",
  ];
  return keys.map((k) => `${k}=${payload[k] ?? ""}`).join("&");
}

function getSecret(): string | null {
  const s = process.env.REVENUEOS_ATTRIBUTION_SECRET;
  if (!s || s.length < 16) return null;
  return s;
}

export function hasAttributionSecret(): boolean {
  return Boolean(getSecret());
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Sign a UTM payload and return a compact `utm_sig` string.
 * `utm_sig = base64url(hmac_sha256(secret, canonicalMessage))` prefixed with
 * `v1.<ts>.`. When no secret is configured, returns null (caller may still
 * emit unsigned UTMs; attribution ML will downgrade them).
 */
export async function signUtm(
  payload: SignedUtmPayload,
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const msg = canonicalMessage(payload);
  const sig = await hmacSha256(secret, msg);
  return `v1.${payload.ts}.${base64url(sig)}`;
}

export type VerifyResult =
  | { valid: true; payload: SignedUtmPayload; ageSeconds: number }
  | { valid: false; reason: string };

/**
 * Verify a signed UTM sig against the params from the incoming URL. Never
 * throws. If the secret isn't configured, returns
 * `{ valid: false, reason: "no_secret" }` so callers can decide the fallback.
 */
export async function verifyUtm(input: {
  sig: string;
  businessId: string;
  utm: UtmParams;
  now?: number;
  maxAgeSeconds?: number;
}): Promise<VerifyResult> {
  const secret = getSecret();
  if (!secret) return { valid: false, reason: "no_secret" };
  const parts = input.sig.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return { valid: false, reason: "bad_format" };
  }
  const ts = Number(parts[1]);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { valid: false, reason: "bad_ts" };
  }
  const payload: SignedUtmPayload = {
    business_id: input.businessId,
    ts,
    utm_source: input.utm.utm_source,
    utm_medium: input.utm.utm_medium,
    utm_campaign: input.utm.utm_campaign,
    utm_content: input.utm.utm_content,
    utm_term: input.utm.utm_term,
  };
  const expected = await hmacSha256(secret, canonicalMessage(payload));
  const given = fromBase64url(parts[2] ?? "");
  if (!timingSafeEqual(expected, given)) {
    return { valid: false, reason: "bad_sig" };
  }
  const now = input.now ?? Date.now();
  const ageSeconds = Math.max(0, Math.floor((now - ts) / 1000));
  const max = input.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  if (ageSeconds > max) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, payload, ageSeconds };
}

/**
 * Append signed UTM params to a URL. Existing UTMs are preserved (this only
 * ADDS what's missing) so callers can seed defaults without clobbering.
 */
export async function attachSignedUtm(input: {
  url: string;
  businessId: string;
  source: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  now?: number;
}): Promise<string> {
  let base: URL;
  try {
    base = new URL(input.url);
  } catch {
    return input.url;
  }
  const ts = input.now ?? Date.now();
  const payload: SignedUtmPayload = {
    business_id: input.businessId,
    ts,
    utm_source: input.source,
    utm_medium: input.medium ?? "revenueos",
    utm_campaign: input.campaign ?? "autonomous",
    utm_content: input.content,
    utm_term: input.term,
  };
  if (!base.searchParams.has("utm_source"))
    base.searchParams.set("utm_source", payload.utm_source!);
  if (!base.searchParams.has("utm_medium"))
    base.searchParams.set("utm_medium", payload.utm_medium!);
  if (!base.searchParams.has("utm_campaign"))
    base.searchParams.set("utm_campaign", payload.utm_campaign!);
  if (payload.utm_content && !base.searchParams.has("utm_content"))
    base.searchParams.set("utm_content", payload.utm_content);
  if (payload.utm_term && !base.searchParams.has("utm_term"))
    base.searchParams.set("utm_term", payload.utm_term);
  if (!base.searchParams.has("revos_biz"))
    base.searchParams.set("revos_biz", payload.business_id);
  const sig = await signUtm(payload);
  if (sig && !base.searchParams.has("utm_sig")) {
    base.searchParams.set("utm_sig", sig);
  }
  return base.toString();
}

/**
 * Convenience helper: given an incoming request URL, return the attribution
 * verdict — trusted signed UTM, self-reported UTM, or none.
 */
export async function classifyIncomingAttribution(input: {
  requestUrl: string;
  businessId: string;
  now?: number;
  maxAgeSeconds?: number;
}): Promise<
  | { source: "signed"; verdict: VerifyResult; utm: UtmParams }
  | { source: "self_reported"; utm: UtmParams }
  | { source: "none" }
> {
  let url: URL;
  try {
    url = new URL(input.requestUrl);
  } catch {
    return { source: "none" };
  }
  const utm: UtmParams = {
    utm_source: url.searchParams.get("utm_source") ?? undefined,
    utm_medium: url.searchParams.get("utm_medium") ?? undefined,
    utm_campaign: url.searchParams.get("utm_campaign") ?? undefined,
    utm_content: url.searchParams.get("utm_content") ?? undefined,
    utm_term: url.searchParams.get("utm_term") ?? undefined,
  };
  const sig = url.searchParams.get("utm_sig");
  if (!sig) {
    if (!Object.values(utm).some(Boolean)) return { source: "none" };
    return { source: "self_reported", utm };
  }
  const verdict = await verifyUtm({
    sig,
    businessId: input.businessId,
    utm,
    now: input.now,
    maxAgeSeconds: input.maxAgeSeconds,
  });
  if (verdict.valid) return { source: "signed", verdict, utm };
  // Signed but invalid: keep the UTM as self-reported, note the reason.
  return { source: "self_reported", utm };
}
