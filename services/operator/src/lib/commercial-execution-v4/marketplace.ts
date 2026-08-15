/**
 * Gumroad marketplace — where vibe-coded packs actually sell.
 * Drafts with no files and no payout method are not a store.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import type { ListingPayload } from "./directory.js";
import { recordCommercialAction } from "./ledger.js";
import { noteFailure } from "./failure-patterns.js";

const API = "https://api.gumroad.com/v2";

const NAME_TO_APP: Record<string, string> = {
  "freelancer invoice & client crm kit": "invoicechaser",
  "etsy & shopify listing seo templates": "listinglift",
  "contractor estimate, invoice & change-order pack": "quotecraft",
  "str turnover & guest message pack": "guestlane",
  "offer & raise negotiation kit": "raiseready",
  "waitlist + launch email": "launchcopy",
  "qr + utm landing pages": "locallaunch",
  "move-in / move-out inspection pack": "depositproof",
  "ats resume rewrite": "resumeforge",
  "retail & cafe open/close sop pack": "closeshift",
  "buildgrid coordination wedge": "buildgrid",
};

export type GumroadProduct = {
  id?: string;
  name?: string;
  short_url?: string;
  url?: string;
  published?: boolean;
  price?: number;
  file_info?: Record<string, unknown>;
  files?: unknown[];
};

export function gumroadOwnerBlocker(message: string): boolean {
  return /connect at least one payment method|payment method before you can publish|payout/i.test(
    message,
  );
}

function token(): string {
  return (process.env.GUMROAD_ACCESS_TOKEN ?? "").trim();
}

async function gumroad(
  pathAndQuery: string,
  method: "GET" | "POST" | "PUT" = "GET",
  fields?: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const tok = token();
  const url =
    method === "GET"
      ? `${API}${pathAndQuery}${pathAndQuery.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(tok)}`
      : `${API}${pathAndQuery}`;
  const init: RequestInit = {
    method,
    headers: { accept: "application/json", "user-agent": "RevenueOS-acquisition/4.2" },
    signal: AbortSignal.timeout(30_000),
  };
  if (method !== "GET") {
    const body = new URLSearchParams({ ...(fields ?? {}), access_token: tok });
    init.headers = {
      ...init.headers,
      "content-type": "application/x-www-form-urlencoded",
    };
    init.body = body.toString();
  }
  try {
    const res = await fetch(url, init);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && body.success !== false, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: { message: e instanceof Error ? e.message : "gumroad_fetch_failed" },
    };
  }
}

function packMarkdown(appId: string): { filename: string; bytes: Buffer } | null {
  const root = process.env.REVENUEOS_APP_ROOT || "/opt/revenueos/app";
  const dir = path.join(root, "apps", appId, "content", "product");
  if (!existsSync(dir)) return null;
  const parts: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const fp = path.join(dir, name);
    if (!statSync(fp).isFile()) continue;
    parts.push(`# ${name}\n\n${readFileSync(fp, "utf8")}`);
  }
  if (!parts.length) return null;
  return { filename: `${appId}-pack.md`, bytes: Buffer.from(parts.join("\n\n---\n\n"), "utf8") };
}

async function uploadBytes(filename: string, bytes: Buffer): Promise<string> {
  const pre = await gumroad("/files/presign", "POST", {
    filename,
    file_size: String(bytes.length),
  });
  if (!pre.ok) throw new Error(`presign:${String(pre.body.message ?? pre.status)}`);
  const parts = (pre.body.parts as Array<{ part_number: number; presigned_url: string }>) ?? [];
  const etags: Array<{ n: number; etag: string }> = [];
  for (const part of parts) {
    const chunk = parts.length === 1 ? bytes : bytes;
    const put = await fetch(part.presigned_url, {
      method: "PUT",
      body: chunk,
      headers: { "content-type": "text/markdown" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!put.ok) throw new Error(`s3_${put.status}`);
    const etag = (put.headers.get("etag") || "").replaceAll('"', "");
    etags.push({ n: part.part_number, etag });
  }
  const completeFields: Record<string, string> = {
    upload_id: String(pre.body.upload_id),
    key: String(pre.body.key),
  };
  etags.forEach((e, i) => {
    completeFields[`parts[][part_number]`] = String(e.n);
    completeFields[`parts[][etag]`] = e.etag;
  });
  const done = await gumroad("/files/complete", "POST", completeFields);
  const fileUrl = String(done.body.file_url ?? "");
  if (!done.ok || !fileUrl) throw new Error(`complete:${String(done.body.message ?? done.status)}`);
  return fileUrl;
}

export async function listGumroadProducts(): Promise<GumroadProduct[]> {
  if (!token()) return [];
  const r = await gumroad("/products");
  return ((r.body.products as GumroadProduct[]) ?? []) as GumroadProduct[];
}

export async function ensureGumroadLive(input: {
  pool: pg.Pool;
  logger: Logger;
  businessId: string;
  listing: ListingPayload;
}): Promise<{ executed: boolean; next: string; detail: string; url?: string }> {
  if (!token()) {
    await recordCommercialAction(input.pool, {
      businessId: input.businessId,
      channel: "marketplaces",
      actionType: "gumroad_blocked",
      target: "gumroad",
      external: false,
      executed: false,
      humanExposurePossible: false,
      result: "GUMROAD_ACCESS_TOKEN missing",
      failureReason: "no_token",
      nextAction: "email_outreach",
    });
    return { executed: false, next: "email_outreach", detail: "no_token" };
  }

  const products = await listGumroadProducts();
  const needle = input.listing.name.toLowerCase();
  let match =
    products.find((p) => (p.name ?? "").toLowerCase() === needle) ||
    products.find((p) => (p.name ?? "").toLowerCase().includes(needle.slice(0, 18)));

  const appId =
    NAME_TO_APP[needle] ||
    NAME_TO_APP[(match?.name ?? "").toLowerCase()] ||
    input.businessId;
  const hasFile = Boolean(
    match &&
      ((match.file_info && Object.keys(match.file_info).length > 0) ||
        (Array.isArray(match.files) && match.files.length > 0)),
  );

  if (match?.published) {
    const recent = await input.pool.query(
      `select 1 from ros_commercial_actions
        where action_type='gumroad_already_live' and business_id=$1
          and created_at > now() - interval '6 hours' limit 1`,
      [input.businessId],
    );
    if (!recent.rows[0]) {
      await recordCommercialAction(input.pool, {
        businessId: input.businessId,
        channel: "marketplaces",
        actionType: "gumroad_already_live",
        target: match.short_url || match.url || "",
        external: true,
        executed: true,
        verified: true,
        verificationMethod: "gumroad_published",
        humanExposurePossible: true,
        result: "published",
        nextAction: "drive_traffic_to_gumroad",
      });
    }
    return {
      executed: false,
      next: "email_outreach",
      detail: "already_live",
      url: match.short_url || match.url,
    };
  }

  if (!hasFile) {
    const pack = packMarkdown(appId);
    if (!pack) {
      return { executed: false, next: "email_outreach", detail: "no_content_pack" };
    }
    try {
      const fileUrl = await uploadBytes(pack.filename, pack.bytes);
      if (!match) {
        const created = await gumroad("/products", "POST", {
          name: input.listing.name.slice(0, 120),
          price: String(Math.max(100, 8900)),
          description: input.listing.description.slice(0, 2000),
          native_type: "digital",
          "files[][url]": fileUrl,
        });
        match = (created.body.product as GumroadProduct) ?? match;
        input.logger("info", "cee.v4.gumroad.created", {
          ok: created.ok,
          url: match?.short_url,
        });
      } else {
        await gumroad(`/products/${match.id}`, "PUT", { "files[][url]": fileUrl });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "upload_failed";
      await recordCommercialAction(input.pool, {
        businessId: input.businessId,
        channel: "marketplaces",
        actionType: "gumroad_upload_failed",
        target: match?.id ?? "",
        external: false,
        executed: false,
        humanExposurePossible: false,
        result: msg,
        failureReason: msg,
        retryable: true,
        nextAction: "email_outreach",
      });
      return { executed: false, next: "email_outreach", detail: msg };
    }
  }

  if (!match?.id) {
    return { executed: false, next: "email_outreach", detail: "no_product_id" };
  }

  const enabled = await gumroad(`/products/${match.id}/enable`, "PUT");
  const product = (enabled.body.product as GumroadProduct) ?? match;
  const message = String(enabled.body.message ?? "");
  const url = product.short_url || product.url || match.short_url || "";

  if (gumroadOwnerBlocker(message)) {
    const fp = `gumroad_payout_${createHash("sha1").update(input.businessId).digest("hex").slice(0, 8)}`;
    await noteFailure(input.pool, {
      businessId: input.businessId,
      strategy: "gumroad_publish",
      channel: "marketplaces",
      target: url || "gumroad",
      failureReason: "gumroad_payment_method_missing",
      result: message,
    });
    await recordCommercialAction(input.pool, {
      businessId: input.businessId,
      channel: "marketplaces",
      actionType: "gumroad_enable_blocked",
      target: url,
      external: false,
      executed: false,
      humanExposurePossible: false,
      result: message.slice(0, 240),
      failureReason: "gumroad_payment_method_missing",
      retryable: false,
      nextAction: "owner_connect_gumroad_payouts",
      meta: { fingerprint: fp },
    });
    input.logger("warn", "cee.v4.gumroad.payout_required", { url, message });
    return { executed: false, next: "email_outreach", detail: "payout_required", url };
  }

  if (product.published) {
    await recordCommercialAction(input.pool, {
      businessId: input.businessId,
      channel: "marketplaces",
      actionType: "gumroad_published",
      target: url,
      external: true,
      executed: true,
      verified: true,
      verificationMethod: "gumroad_published_flag",
      humanExposurePossible: true,
      result: "published",
      nextAction: "drive_traffic_to_listing",
    });
    input.logger("info", "cee.v4.gumroad.published", { url, name: product.name });
    return { executed: true, next: "drive_traffic_to_listing", detail: "published", url };
  }

  await recordCommercialAction(input.pool, {
    businessId: input.businessId,
    channel: "marketplaces",
    actionType: "gumroad_enable_failed",
    target: url,
    external: false,
    executed: false,
    humanExposurePossible: false,
    result: message.slice(0, 240) || `http_${enabled.status}`,
    failureReason: message || "enable_failed",
    retryable: true,
    nextAction: "email_outreach",
  });
  return { executed: false, next: "email_outreach", detail: message || "enable_failed", url };
}

export async function applyFirstCustomerOffer(input: {
  pool: pg.Pool;
  logger: Logger;
  businessId: string;
  listing: ListingPayload;
  priceUsd: number;
}): Promise<{ ok: boolean; detail: string }> {
  if (!token()) return { ok: false, detail: "no_token" };
  const recent = await input.pool.query(
    `select 1 from ros_commercial_actions
      where action_type='gumroad_first_customer_price' and business_id=$1
        and created_at > now() - interval '3 hours' limit 1`,
    [input.businessId],
  );
  if (recent.rows[0]) return { ok: true, detail: "already_set_recently" };

  const products = await listGumroadProducts();
  const needle = input.listing.name.toLowerCase();
  const permalink = (input.listing.url || "").split("/").filter(Boolean).pop() || "";
  const match =
    products.find((p) => (p.short_url || p.url || "").includes(permalink) && permalink.length > 3) ||
    products.find((p) => (p.name ?? "").toLowerCase() === needle) ||
    products.find((p) => (p.name ?? "").toLowerCase().includes(needle.slice(0, 18)));
  if (!match?.id) return { ok: false, detail: "product_not_found" };

  const wantCents = Math.max(100, Math.round(input.priceUsd * 100));
  const updated = await gumroad(`/products/${match.id}`, "PUT", {
    price: String(wantCents),
    description: `${input.listing.description}\n\nOne-time $${input.priceUsd}. Instant download. No subscription.`,
  });
  const url = match.short_url || match.url || "";
  await recordCommercialAction(input.pool, {
    businessId: input.businessId,
    channel: "marketplaces",
    actionType: "gumroad_first_customer_price",
    target: url,
    external: true,
    executed: updated.ok,
    verified: updated.ok,
    humanExposurePossible: true,
    result: updated.ok ? `price_${input.priceUsd}` : String(updated.body.message ?? updated.status),
    failureReason: updated.ok ? "" : String(updated.body.message ?? updated.status),
    nextAction: "drive_traffic_to_gumroad",
  });
  input.logger("info", "cee.v4.gumroad.first_customer_price", {
    ok: updated.ok,
    priceUsd: input.priceUsd,
    url,
  });
  return { ok: updated.ok, detail: updated.ok ? "priced" : "put_failed" };
}
