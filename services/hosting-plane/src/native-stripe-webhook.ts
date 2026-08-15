/**
 * Native Stripe webhook + purchase persistence for Azure hosting plane.
 * Reuses the portfolio app contract: checkout.session.completed → record → fulfill.
 * Idempotent on Stripe event id and checkout session id.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

export type StripeCheckoutSession = {
  id: string;
  object?: string;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  customer?: string | null;
  customer_email?: string | null;
  customer_details?: { email?: string | null } | null;
  payment_intent?: string | null;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
};

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession };
};

let pool: pg.Pool | null = null;
let schemaReady = false;

function dbUrl(): string | null {
  return (
    process.env.REVENUEOS_DATABASE_URL ||
    process.env.DATABASE_URL ||
    null
  );
}

function getPool(): pg.Pool | null {
  const url = dbUrl();
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      max: 2,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function ensurePurchaseSchema(p: pg.Pool): Promise<void> {
  if (schemaReady) return;
  await p.query(`
    create table if not exists ros_stripe_events (
      event_id text primary key,
      event_type text not null,
      business_id text,
      session_id text,
      processed_at timestamptz not null default now(),
      detail jsonb not null default '{}'::jsonb
    );
    create table if not exists ros_purchases (
      id text primary key,
      business_id text not null,
      stripe_event_id text,
      stripe_session_id text not null unique,
      stripe_payment_intent text,
      stripe_customer_id text,
      email text,
      amount_cents integer not null,
      currency text not null default 'usd',
      product_id text,
      product_name text,
      offer text,
      fulfillment_status text not null default 'pending',
      download_token text,
      experiment_id text,
      acquisition_channel text,
      host text,
      meta jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      fulfilled_at timestamptz
    );
    create index if not exists ros_purchases_business_idx on ros_purchases (business_id, created_at desc);
    create table if not exists ros_customer_events (
      event_id text primary key,
      kind text not null,
      business_id text,
      source text not null,
      source_id text,
      amount_usd numeric,
      evidence jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  `);
  schemaReady = true;
}

/**
 * Verify Stripe-Signature header (same algorithm as stripe.webhooks.constructEvent).
 * Avoids requiring the Stripe SDK in the hosting-plane hot path.
 */
export function verifyStripeSignature(input: {
  payload: string;
  header: string;
  secret: string;
  toleranceSec?: number;
}): { ok: true; event: StripeEvent } | { ok: false; error: string } {
  const tolerance = input.toleranceSec ?? 300;
  const parts = input.header.split(",").map((p) => p.trim());
  let timestamp = "";
  const v1: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v ?? "";
    if (k === "v1" && v) v1.push(v);
  }
  if (!timestamp || v1.length === 0) {
    return { ok: false, error: "invalid_signature_header" };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, error: "invalid_timestamp" };
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > tolerance) return { ok: false, error: "timestamp_outside_tolerance" };

  const signed = `${timestamp}.${input.payload}`;
  const expected = createHmac("sha256", input.secret)
    .update(signed, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  let matched = false;
  for (const sig of v1) {
    const got = Buffer.from(sig, "utf8");
    if (
      got.length === expectedBuf.length &&
      timingSafeEqual(got, expectedBuf)
    ) {
      matched = true;
      break;
    }
  }
  if (!matched) return { ok: false, error: "signature_mismatch" };

  try {
    const event = JSON.parse(input.payload) as StripeEvent;
    if (!event?.id || !event?.type) {
      return { ok: false, error: "invalid_event_json" };
    }
    return { ok: true, event };
  } catch {
    return { ok: false, error: "invalid_json" };
  }
}

/** Generate a Stripe-compatible test signature header (safe local proof; no network charge). */
export function generateTestStripeHeader(payload: string, secret: string): string {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret)
    .update(`${t}.${payload}`, "utf8")
    .digest("hex");
  return `t=${t},v1=${v1}`;
}

function newDownloadToken(): string {
  return `dl_${Date.now().toString(36)}_${randomBytes(6).toString("hex")}`;
}

function resolveBusinessId(session: StripeCheckoutSession, hostSiteId?: string | null): string | null {
  const meta = session.metadata ?? {};
  const fromMeta = (meta.siteId || meta.business_id || meta.businessId || "").trim();
  if (fromMeta) return fromMeta;
  const ref = (session.client_reference_id || "").trim();
  if (ref) return ref;
  if (hostSiteId) return hostSiteId;
  return null;
}

function localPurchaseFallbackDir(): string {
  return (
    process.env.HOSTING_PURCHASE_DIR ||
    path.join(
      process.env.HOSTING_DATA_DIR || "/opt/revenueos/data/hosting-plane",
      "purchases",
    )
  );
}

async function bumpMoneyModel(
  p: pg.Pool,
  businessId: string,
  amountUsd: number,
  sessionId: string,
): Promise<void> {
  const res = await p.query(
    `select document from titan_business_money_models where business_id=$1 limit 1`,
    [businessId],
  );
  const prev = (res.rows[0]?.document as Record<string, unknown>) ?? {};
  // Only increment if this session not already counted in document.
  const counted = Array.isArray(prev.countedSessionIds)
    ? (prev.countedSessionIds as string[])
    : [];
  if (counted.includes(sessionId)) return;
  const purchases =
    (typeof prev.purchases === "number" ? prev.purchases : 0) + 1;
  const revenueUsd =
    (typeof prev.revenueUsd === "number" ? prev.revenueUsd : 0) + amountUsd;
  const nextCounted = [...counted, sessionId].slice(-200);
  const document = {
    ...prev,
    purchases,
    revenueUsd,
    checkoutStarts:
      typeof prev.checkoutStarts === "number" ? prev.checkoutStarts : undefined,
    lastPurchaseAt: new Date().toISOString(),
    lastPurchaseSessionId: sessionId,
    countedSessionIds: nextCounted,
    note: "Measured from native Azure Stripe webhook — not invented",
    updatedAt: new Date().toISOString(),
    confidence: 0.95,
  };
  await p.query(
    `insert into titan_business_money_models (business_id, daily_target_usd, document, updated_at)
     values ($1, 10000, $2::jsonb, now())
     on conflict (business_id) do update set
       document = excluded.document,
       updated_at = now()`,
    [businessId, JSON.stringify(document)],
  );
}

export type WebhookHandleResult = {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
};

export async function handleStripeWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
  hostSiteId?: string | null;
  repoRoot: string;
}): Promise<WebhookHandleResult> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      body: { error: "STRIPE_WEBHOOK_SECRET missing" },
    };
  }
  if (!input.signatureHeader) {
    return { ok: false, status: 400, body: { error: "missing_signature" } };
  }

  const verified = verifyStripeSignature({
    payload: input.rawBody,
    header: input.signatureHeader,
    secret,
  });
  if (!verified.ok) {
    return {
      ok: false,
      status: 400,
      body: { error: "signature_verification_failed", detail: verified.error },
    };
  }

  const event = verified.event;
  const p = getPool();
  if (p) await ensurePurchaseSchema(p);

  // Idempotency: stripe event id
  if (p) {
    const existing = await p.query(
      `select event_id from ros_stripe_events where event_id=$1`,
      [event.id],
    );
    if (existing.rows[0]) {
      return {
        ok: true,
        status: 200,
        body: { received: true, duplicate: true, eventId: event.id },
      };
    }
  }

  if (event.type !== "checkout.session.completed") {
    if (p) {
      await p.query(
        `insert into ros_stripe_events (event_id, event_type, detail)
         values ($1,$2,$3::jsonb)
         on conflict (event_id) do nothing`,
        [event.id, event.type, JSON.stringify({ ignored: true })],
      );
    }
    return {
      ok: true,
      status: 200,
      body: { received: true, ignored: event.type },
    };
  }

  const session = event.data.object;
  const businessId = resolveBusinessId(session, input.hostSiteId);
  if (!businessId) {
    return {
      ok: false,
      status: 422,
      body: { error: "missing_business_attribution" },
    };
  }

  const amountCents = Number(session.amount_total ?? 0);
  const amountUsd = amountCents / 100;
  const currency = (session.currency || "usd").toLowerCase();
  const email =
    session.customer_details?.email ??
    session.customer_email ??
    "buyer@unknown";
  const productId =
    session.metadata?.productId ||
    session.metadata?.product_id ||
    `${businessId}-product`;
  const downloadToken = newDownloadToken();
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : null;
  const customerId =
    typeof session.customer === "string" ? session.customer : null;

  // Load product name from brand if available
  let productName = productId;
  try {
    const brandPath = path.join(
      input.repoRoot,
      "apps",
      businessId,
      "src/lib/brand.ts",
    );
    if (existsSync(brandPath)) {
      const src = readFileSync(brandPath, "utf8");
      const m = src.match(/["']name["']\s*:\s*["']([^"']+)["']/);
      if (m?.[1]) productName = m[1];
    }
  } catch {
    /* ignore */
  }

  if (p) {
    // Session-level idempotency (retries with new event ids shouldn't double money)
    const prior = await p.query(
      `select id, download_token, fulfillment_status from ros_purchases where stripe_session_id=$1`,
      [session.id],
    );
    if (prior.rows[0]) {
      await p.query(
        `insert into ros_stripe_events (event_id, event_type, business_id, session_id, detail)
         values ($1,$2,$3,$4,$5::jsonb)
         on conflict (event_id) do nothing`,
        [
          event.id,
          event.type,
          businessId,
          session.id,
          JSON.stringify({ duplicate_session: true }),
        ],
      );
      return {
        ok: true,
        status: 200,
        body: {
          received: true,
          duplicateSession: true,
          businessId,
          downloadToken: prior.rows[0].download_token,
        },
      };
    }

    await p.query(
      `insert into ros_purchases (
         id, business_id, stripe_event_id, stripe_session_id, stripe_payment_intent,
         stripe_customer_id, email, amount_cents, currency, product_id, product_name,
         offer, fulfillment_status, download_token, experiment_id, acquisition_channel,
         host, meta, fulfilled_at
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'fulfilled',$13,$14,$15,$16,$17::jsonb,now()
       )
       on conflict (stripe_session_id) do nothing`,
      [
        session.id,
        businessId,
        event.id,
        session.id,
        paymentIntent,
        customerId,
        email,
        amountCents,
        currency,
        productId,
        productName,
        productName,
        downloadToken,
        session.metadata?.experimentId ?? null,
        session.metadata?.acquisitionChannel ?? null,
        session.metadata?.host ?? "azure_native",
        JSON.stringify({
          payment_status: session.payment_status ?? null,
        }),
      ],
    );

    await p.query(
      `insert into ros_customer_events
         (event_id, kind, business_id, source, source_id, amount_usd, evidence, created_at)
       values ($1,'PAYMENT_SUCCEEDED',$2,'stripe_webhook',$3,$4,$5::jsonb, now())
       on conflict (event_id) do nothing`,
      [
        `ce_stripe_${event.id}`.slice(0, 64),
        businessId,
        session.id,
        amountCents / 100,
        JSON.stringify({ stripeEventId: event.id, email: email ?? null }),
      ],
    ).catch(() => undefined);

    await bumpMoneyModel(p, businessId, amountUsd, session.id);

    await p.query(
      `insert into ros_stripe_events (event_id, event_type, business_id, session_id, detail)
       values ($1,$2,$3,$4,$5::jsonb)
       on conflict (event_id) do nothing`,
      [
        event.id,
        event.type,
        businessId,
        session.id,
        JSON.stringify({
          amount_cents: amountCents,
          currency,
          fulfilled: true,
        }),
      ],
    );
  } else {
    // File fallback if Postgres unavailable — still idempotent by session id
    const dir = localPurchaseFallbackDir();
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${session.id}.json`);
    if (!existsSync(file)) {
      writeFileSync(
        file,
        JSON.stringify(
          {
            businessId,
            sessionId: session.id,
            eventId: event.id,
            email,
            amountCents,
            currency,
            productId,
            productName,
            downloadToken,
            fulfillment_status: "fulfilled",
            at: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
  }

  console.log(
    JSON.stringify({
      event: "native_stripe.purchase_recorded",
      businessId,
      sessionId: session.id,
      eventId: event.id,
      amountCents,
      currency,
      // never log email/secret
      at: new Date().toISOString(),
    }),
  );

  return {
    ok: true,
    status: 200,
    body: {
      received: true,
      businessId,
      sessionId: session.id,
      fulfillment: "fulfilled",
    },
  };
}

export async function lookupPurchaseBySession(sessionId: string): Promise<{
  ok: boolean;
  businessId?: string;
  downloadToken?: string;
  productName?: string;
  fulfillmentStatus?: string;
} | null> {
  const p = getPool();
  if (p) {
    await ensurePurchaseSchema(p);
    const res = await p.query(
      `select business_id, download_token, product_name, fulfillment_status
       from ros_purchases where stripe_session_id=$1 limit 1`,
      [sessionId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      ok: true,
      businessId: row.business_id,
      downloadToken: row.download_token,
      productName: row.product_name,
      fulfillmentStatus: row.fulfillment_status,
    };
  }
  const file = path.join(localPurchaseFallbackDir(), `${sessionId}.json`);
  if (!existsSync(file)) return null;
  try {
    const j = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
    return {
      ok: true,
      businessId: j.businessId,
      downloadToken: j.downloadToken,
      productName: j.productName,
      fulfillmentStatus: j.fulfillment_status,
    };
  } catch {
    return null;
  }
}

export async function purchaseStatsForBusiness(businessId: string): Promise<{
  purchases: number;
  revenueUsd: number;
}> {
  const p = getPool();
  if (!p) return { purchases: 0, revenueUsd: 0 };
  await ensurePurchaseSchema(p);
  const res = await p.query(
    `select count(*)::int as n, coalesce(sum(amount_cents),0)::bigint as cents
     from ros_purchases where business_id=$1`,
    [businessId],
  );
  return {
    purchases: Number(res.rows[0]?.n ?? 0),
    revenueUsd: Number(res.rows[0]?.cents ?? 0) / 100,
  };
}
