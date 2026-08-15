/**
 * Shared storefront API — one process serves /api/* for all native sites.
 * Site resolved from Host header: {siteId}.*.sslip.io
 * Stripe webhook is host-agnostic (attribution via session.metadata.siteId).
 */

import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { nativeSiteDomain } from "./public-domain.js";
import {
  handleStripeWebhook,
  lookupPurchaseBySession,
} from "./native-stripe-webhook.js";
import { recordBeaconEvent } from "./traffic-beacon.js";

type Brand = {
  siteId: string;
  displayName?: string;
  product: {
    id: string;
    name: string;
    tagline?: string;
    priceUsd: number;
  };
};

function siteIdFromHost(host: string): string | null {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  if (!h) return null;
  const base = (
    process.env.HOSTING_PUBLIC_BASE_HOST || "130.131.15.68.sslip.io"
  ).toLowerCase();
  if (h.endsWith(`.${base}`)) {
    return h.slice(0, -(base.length + 1)) || null;
  }
  const first = h.split(".")[0];
  return first && first !== "www" && first !== "revenueos-core" ? first : null;
}

function loadBrand(repoRoot: string, siteId: string): Brand | null {
  const p = path.join(repoRoot, "apps", siteId, "src/lib/brand.ts");
  if (!existsSync(p)) return null;
  const src = readFileSync(p, "utf8");
  const m = src.match(/export const BRAND[^=]*=\s*(\{[\s\S]*?\n\});/);
  if (!m?.[1]) return null;
  try {
    // eslint-disable-next-line no-new-func
    const brand = new Function(`return (${m[1]})`)() as Brand;
    if (!brand?.siteId || !brand?.product?.priceUsd) return null;
    return brand;
  } catch {
    return null;
  }
}

async function readRawBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

async function createCheckoutSession(
  brand: Brand,
  origin: string,
): Promise<{ url?: string; error?: string }> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "STRIPE_SECRET_KEY missing on hosting plane" };
  const amount = Math.round(Number(brand.product.priceUsd) * 100);
  if (!Number.isFinite(amount) || amount < 50) {
    return { error: "invalid price" };
  }
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/success/?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/?cancelled=1`);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set("line_items[0][price_data][unit_amount]", String(amount));
  params.set("line_items[0][price_data][product_data][name]", brand.product.name);
  if (brand.product.tagline) {
    params.set(
      "line_items[0][price_data][product_data][description]",
      brand.product.tagline,
    );
  }
  params.set("metadata[siteId]", brand.siteId);
  params.set("metadata[productId]", brand.product.id);
  params.set("metadata[host]", "azure_native");
  params.set("client_reference_id", brand.siteId);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await res.json()) as {
    url?: string;
    error?: { message?: string };
  };
  if (!res.ok || !data.url) {
    return { error: data.error?.message ?? `stripe_${res.status}` };
  }
  return { url: data.url };
}

export function startStorefrontApi(input: {
  repoRoot: string;
  port?: number;
  bind?: string;
}): http.Server {
  const port =
    input.port ?? Number(process.env.HOSTING_STOREFRONT_API_PORT || 8091);
  const bind = input.bind ?? "127.0.0.1";

  const server = http.createServer((req, res) => {
    void (async () => {
      const host = String(req.headers.host ?? "");
      const siteId = siteIdFromHost(host);
      const url = new URL(req.url ?? "/", `http://${host || "local"}`);

      const json = (code: number, body: unknown) => {
        res.writeHead(code, {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        });
        res.end(JSON.stringify(body));
      };

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type,stripe-signature",
        });
        res.end();
        return;
      }

      // Stripe webhook — must NOT require site host (Stripe posts to registered URL).
      if (
        req.method === "POST" &&
        (url.pathname === "/api/stripe/webhook" ||
          url.pathname === "/api/stripe/webhook/")
      ) {
        const rawBuf = await readRawBody(req);
        const raw = rawBuf.toString("utf8");
        const sig = String(req.headers["stripe-signature"] ?? "") || null;
        const result = await handleStripeWebhook({
          rawBody: raw,
          signatureHeader: sig,
          hostSiteId: siteId,
          repoRoot: input.repoRoot,
        });
        json(result.status, result.body);
        return;
      }

      if (!siteId) return json(400, { error: "unknown_host" });
      const brand = loadBrand(input.repoRoot, siteId);
      if (!brand && url.pathname !== "/api/download") {
        return json(404, { error: "brand_not_found", siteId });
      }

      if (url.pathname === "/api/beacon" && req.method === "POST") {
        let body: Record<string, unknown> = {};
        try {
          const raw = await readRawBody(req);
          body = JSON.parse(raw.toString("utf8") || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          body = {};
        }
        const recorded = await recordBeaconEvent({
          siteId,
          host,
          userAgent: String(req.headers["user-agent"] ?? ""),
          referer: String(req.headers.referer ?? ""),
          remoteIp: String(
            req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "",
          ).split(",")[0]?.trim(),
          body,
        });
        json(200, {
          ok: true,
          siteId,
          class: recorded.class ?? null,
          at: new Date().toISOString(),
        });
        return;
      }

      if (url.pathname === "/api/checkout/ready" && req.method === "GET") {
        const key = Boolean(process.env.STRIPE_SECRET_KEY);
        json(200, {
          ok: key && Boolean(brand),
          stripeConfigured: key,
          siteId,
          priceUsd: brand?.product.priceUsd ?? null,
          productId: brand?.product.id ?? null,
        });
        return;
      }

      if (url.pathname === "/api/checkout" && req.method === "POST") {
        if (!brand) return json(404, { error: "brand_not_found", siteId });
        const origin = `https://${nativeSiteDomain(siteId)}`;
        const session = await createCheckoutSession(brand, origin);
        if (!session.url) return json(503, { error: session.error });
        json(200, { url: session.url });
        return;
      }

      if (url.pathname === "/api/checkout") {
        res.writeHead(405, {
          "content-type": "application/json",
          allow: "POST,OPTIONS",
          "access-control-allow-origin": "*",
        });
        res.end(
          JSON.stringify({
            error: "method_not_allowed",
            allow: ["POST"],
            siteId,
          }),
        );
        return;
      }

      if (url.pathname === "/api/fulfillment" && req.method === "GET") {
        const sessionId = url.searchParams.get("session_id") || "";
        if (!sessionId) return json(400, { error: "session_id required" });
        const purchase = await lookupPurchaseBySession(sessionId);
        if (!purchase) {
          return json(404, {
            error: "purchase_not_found",
            note: "webhook may still be processing",
          });
        }
        if (purchase.businessId && purchase.businessId !== siteId) {
          return json(403, { error: "business_mismatch" });
        }
        json(200, {
          ok: true,
          siteId,
          fulfillmentStatus: purchase.fulfillmentStatus,
          productName: purchase.productName,
          downloadToken: purchase.downloadToken,
          downloadUrl: purchase.downloadToken
            ? `/api/download?token=${encodeURIComponent(purchase.downloadToken)}&session_id=${encodeURIComponent(sessionId)}`
            : null,
        });
        return;
      }

      if (url.pathname === "/api/download") {
        const token = url.searchParams.get("token") || "";
        const sessionId = url.searchParams.get("session_id") || "";
        let purchase = sessionId
          ? await lookupPurchaseBySession(sessionId)
          : null;
        if (purchase && token && purchase.downloadToken !== token) {
          return json(403, { error: "invalid_token" });
        }
        if (!purchase && token) {
          // Token-only lookup via Postgres when session omitted
          return json(400, { error: "session_id required" });
        }
        if (!purchase) return json(404, { error: "not_found" });

        // Digital fulfillment: serve asset pack listing / zip pointer from app content.
        const contentDir = path.join(
          input.repoRoot,
          "apps",
          siteId,
          "content/product",
        );
        const files = existsSync(contentDir)
          ? readFileSync(
              existsSync(path.join(contentDir, "readme.md"))
                ? path.join(contentDir, "readme.md")
                : path.join(contentDir, "README.md"),
              "utf8",
            ).slice(0, 20_000)
          : `Purchase confirmed for ${purchase.productName ?? siteId}. Contact care@${siteId}.com if files are missing.`;

        res.writeHead(200, {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `inline; filename="${siteId}-pack.md"`,
        });
        res.end(files);
        return;
      }

      json(404, { error: "not_found", path: url.pathname, siteId });
    })().catch((e) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    });
  });

  server.listen(port, bind, () => {
    console.log(
      JSON.stringify({
        event: "storefront_api.listen",
        bind,
        port,
        at: new Date().toISOString(),
      }),
    );
  });
  return server;
}
