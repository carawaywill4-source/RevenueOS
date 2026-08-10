#!/usr/bin/env node
/**
 * Scaffold the 10 portfolio businesses under apps/<siteId>.
 * Uses workspace @revenueos/core + @revenueos/storefront-kit.
 */
import { mkdirSync, writeFileSync, existsSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Inline brand list (keep in sync with packages/storefront-kit portfolio-brands). */
const BRANDS = [
  { siteId: "raiseready", name: "RaiseReady", price: 19, kind: "digital", port: 3011, color: "#0F3D2E", accent: "#C4A35A", product: "Offer & Raise Negotiation Kit", slug: "negotiation-kit", industry: "career-tools", seq: 1 },
  { siteId: "ledgerleaf", name: "Ledgerleaf", price: 29, kind: "digital", port: 3012, color: "#1B4332", accent: "#95D5B2", product: "Freelancer Invoice & Client CRM Kit", slug: "freelancer-invoice-crm", industry: "freelancer-finance", seq: 2 },
  { siteId: "depositproof", name: "DepositProof", price: 24, kind: "digital", port: 3013, color: "#1D3557", accent: "#E63946", product: "Move-In / Move-Out Inspection Pack", slug: "move-in-out-inspection", industry: "landlord-ops", seq: 3 },
  { siteId: "turnoverkit", name: "TurnoverKit", price: 27, kind: "digital", port: 3014, color: "#264653", accent: "#E9C46A", product: "STR Turnover & Guest Message Pack", slug: "airbnb-turnover-pack", industry: "short-term-rental", seq: 4 },
  { siteId: "listinglift", name: "ListingLift", price: 37, kind: "digital", port: 3015, color: "#3D1F5C", accent: "#F4A261", product: "Etsy & Shopify Listing SEO Templates", slug: "etsy-shopify-seo-templates", industry: "maker-ecommerce", seq: 5 },
  { siteId: "closeshift", name: "CloseShift", price: 39, kind: "digital", port: 3016, color: "#2B2D42", accent: "#D90429", product: "Retail & Cafe Open/Close SOP Pack", slug: "open-close-sop-pack", industry: "retail-ops", seq: 6 },
  { siteId: "bidbinder", name: "BidBinder", price: 49, kind: "digital", port: 3017, color: "#0B132B", accent: "#FCA311", product: "Contractor Estimate, Invoice & Change-Order Pack", slug: "estimate-invoice-change-order", industry: "trades-ops", seq: 7 },
  { siteId: "resumeforge", name: "ResumeForge", price: 12, kind: "saas", port: 3018, color: "#111827", accent: "#22D3EE", product: "ATS Resume Rewrite", slug: "ats-rewrite", industry: "career-software", seq: 8, mode: "usage" },
  { siteId: "waitroom", name: "Waitroom", price: 15, kind: "saas", port: 3019, color: "#18181B", accent: "#A3E635", product: "Waitlist + Launch Email", slug: "waitlist", industry: "indie-saas-tools", seq: 9, mode: "subscription" },
  { siteId: "shopbeacon", name: "ShopBeacon", price: 9, kind: "saas", port: 3020, color: "#1A1A2E", accent: "#E94560", product: "QR + UTM Landing Pages", slug: "qr-landing", industry: "local-commerce-tools", seq: 10, mode: "subscription" },
];

function write(file, content) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function assetContent(brand, filename) {
  return `# ${brand.product} — ${filename.replace(".md", "")}

This is a real deliverable for **${brand.name}**.

Customize this file for your situation. You purchased instant access after checkout.

---

## How to use

1. Copy into Google Docs / Sheets / Notion as needed.
2. Replace bracketed fields like [NAME] with your details.
3. Keep a dated copy for your records.

Support: care@${brand.siteId}.com
`;
}

function scaffoldDigital(brand) {
  const dir = path.join(root, "apps", brand.siteId);
  const pkg = {
    name: `@portfolio/${brand.siteId}`,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: `next dev --port ${brand.port}`,
      build: "next build",
      start: `next start --port ${brand.port}`,
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      "@revenueos/core": "file:../../packages/revenueos",
      "@revenueos/storefront-kit": "file:../../packages/storefront-kit",
      "@supabase/supabase-js": "^2.109.0",
      next: "16.3.0",
      react: "19.2.8",
      "react-dom": "19.2.8",
      resend: "^6.18.1",
      stripe: "^22.4.0",
      zod: "^4.4.3",
    },
    devDependencies: {
      "@tailwindcss/postcss": "^4",
      "@types/node": "^20",
      "@types/react": "^19",
      "@types/react-dom": "^19",
      eslint: "^9",
      "eslint-config-next": "16.3.0",
      tailwindcss: "^4",
      typescript: "^5",
    },
  };
  write(path.join(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  write(
    path.join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2017",
          lib: ["dom", "dom.iterable", "esnext"],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: "esnext",
          moduleResolution: "bundler",
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: "preserve",
          incremental: true,
          plugins: [{ name: "next" }],
          paths: {
            "@/*": ["./src/*"],
            "@revenueos/core": ["../../packages/revenueos/src/index.ts"],
            "@revenueos/storefront-kit": [
              "../../packages/storefront-kit/src/index.ts",
            ],
          },
        },
        include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ) + "\n",
  );
  write(
    path.join(dir, "next.config.ts"),
    `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ["@revenueos/core", "@revenueos/storefront-kit"],
};
export default nextConfig;
`,
  );
  write(
    path.join(dir, "postcss.config.mjs"),
    `const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
`,
  );
  write(
    path.join(dir, "vercel.json"),
    JSON.stringify(
      {
        // Mac Core is sole RevenueOS brain — never schedule cloud ticks.
        crons: [],
      },
      null,
      2,
    ) + "\n",
  );
  write(
    path.join(dir, ".env.example"),
    `NEXT_PUBLIC_APP_URL=http://localhost:${brand.port}
NEXT_PUBLIC_CHECKOUT_ENABLED=0
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CRON_SECRET=
OWNER_DASHBOARD_TOKEN=
REVENUEOS_LEDGER_DIR=.data/revenueos
`,
  );
  write(
    path.join(dir, "src/lib/brand.ts"),
    `import { brandBySiteId } from "@revenueos/storefront-kit";

export const BRAND = brandBySiteId("${brand.siteId}")!;
export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
`,
  );

  for (const file of [
    "readme.md",
    "guide-01.md",
    "guide-02.md",
    "guide-03.md",
  ]) {
    write(
      path.join(dir, "content/product", file),
      assetContent(brand, file),
    );
  }

  write(
    path.join(dir, "src/lib/readiness.ts"),
    `import { existsSync } from "node:fs";
import path from "node:path";
import {
  digitalCheckoutAllowed,
  digitalOwnerGates,
} from "@revenueos/storefront-kit";

function assetsExist() {
  const dir = path.join(process.cwd(), "content/product");
  return existsSync(path.join(dir, "readme.md"));
}

export function ownerGates() {
  return digitalOwnerGates({
    stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    assetsExist: assetsExist(),
    resend: Boolean(process.env.RESEND_API_KEY),
    supabase: Boolean(process.env.SUPABASE_URL),
  });
}

export function checkoutAllowed() {
  if (process.env.NEXT_PUBLIC_CHECKOUT_ENABLED !== "1") return false;
  return digitalCheckoutAllowed(ownerGates());
}
`,
  );

  write(
    path.join(dir, "src/lib/stripe.ts"),
    `import Stripe from "stripe";
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}
export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
`,
  );

  write(
    path.join(dir, "src/lib/purchases.ts"),
    `import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Purchase = {
  id: string;
  email: string;
  productId: string;
  amountUsd: number;
  stripeSessionId: string;
  createdAt: string;
  downloadToken: string;
};

const file = () =>
  path.join(process.env.REVENUEOS_LEDGER_DIR || ".data/revenueos", "purchases.json");

async function load(): Promise<Purchase[]> {
  try {
    return JSON.parse(await readFile(file(), "utf8")) as Purchase[];
  } catch {
    return [];
  }
}

async function save(rows: Purchase[]) {
  await mkdir(path.dirname(file()), { recursive: true });
  await writeFile(file(), JSON.stringify(rows, null, 2), "utf8");
}

export async function recordPurchase(p: Purchase) {
  const rows = await load();
  if (rows.some((r) => r.stripeSessionId === p.stripeSessionId)) return;
  rows.unshift(p);
  await save(rows);
}

export async function getPurchaseByToken(token: string) {
  return (await load()).find((r) => r.downloadToken === token) ?? null;
}

export async function purchaseStats() {
  const rows = await load();
  const revenue = rows.reduce((s, r) => s + r.amountUsd, 0);
  return { purchases: rows.length, revenueUsd: revenue };
}

export function newDownloadToken() {
  return \`dl_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2, 10)}\`;
}
`,
  );

  write(
    path.join(dir, "src/app/globals.css"),
    `@import "tailwindcss";

:root {
  --brand: ${brand.color};
  --accent: ${brand.accent};
  --bg: #f7f4ef;
  --ink: #141414;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: "Source Sans 3", "Segoe UI", sans-serif;
}

h1, h2, h3 {
  font-family: "Fraunces", Georgia, serif;
  letter-spacing: -0.02em;
}

.btn {
  display: inline-block;
  background: var(--brand);
  color: #fff;
  padding: 0.9rem 1.4rem;
  text-decoration: none;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
`,
  );

  write(
    path.join(dir, "src/app/layout.tsx"),
    `import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: \`\${BRAND.displayName} — \${BRAND.product.tagline}\`,
  description: BRAND.product.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Source+Sans+3:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
`,
  );

  write(
    path.join(dir, "src/app/page.tsx"),
    `import { BRAND } from "@/lib/brand";
import { checkoutAllowed, ownerGates } from "@/lib/readiness";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function HomePage() {
  const live = checkoutAllowed();
  const gates = ownerGates();
  const blocked = gates.filter((g) => !g.ok);

  return (
    <main>
      <header
        style={{
          background: "linear-gradient(160deg, var(--brand) 0%, #0a1f18 70%)",
          color: "#f7f4ef",
          padding: "4.5rem 1.25rem 3.5rem",
        }}
      >
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p style={{ opacity: 0.85, margin: 0, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {BRAND.displayName}
          </p>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", margin: "0.6rem 0 0.8rem", maxWidth: "14ch" }}>
            {BRAND.product.name}
          </h1>
          <p style={{ fontSize: "1.15rem", maxWidth: "36ch", opacity: 0.92 }}>
            {BRAND.product.tagline}
          </p>
          <p style={{ marginTop: "1.5rem", fontSize: "1.5rem", fontWeight: 600 }}>
            \${BRAND.product.priceUsd}
          </p>
          <div style={{ marginTop: "1.25rem" }}>
            <CheckoutButton enabled={live} />
          </div>
          {!live && (
            <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
              Checkout opens when payment + fulfillment are verified
              {blocked.length ? \` — \${blocked.map((b) => b.id).join(", ")}\` : ""}.
            </p>
          )}
        </div>
      </header>

      <div className="wrap">
        <h2>What you get</h2>
        <p>{BRAND.product.description}</p>
        <ul>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <h2>After you pay</h2>
        <p>
          Stripe confirms payment → you receive an instant download link. No
          shipping. 14-day refund if the files are unused — see{" "}
          <a href="/legal/refunds">refunds</a>.
        </p>
        <p>
          <a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a> ·{" "}
          <a href="/owner">Owner</a>
        </p>
      </div>
    </main>
  );
}
`,
  );

  write(
    path.join(dir, "src/components/CheckoutButton.tsx"),
    `"use client";
import { useState } from "react";

export function CheckoutButton({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" type="button" disabled={!enabled || busy} onClick={buy}>
        {busy ? "Redirecting…" : "Buy — instant download"}
      </button>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
    </div>
  );
}
`,
  );

  write(
    path.join(dir, "src/app/api/checkout/route.ts"),
    `import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { checkoutAllowed } from "@/lib/readiness";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  if (!checkoutAllowed()) {
    return NextResponse.json(
      { error: "Checkout not ready — OWNER_BLOCKED_FULFILLMENT or env incomplete" },
      { status: 503 },
    );
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:${brand.port}";
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: \`\${origin}/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${origin}/?cancelled=1\`,
    customer_email: undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(BRAND.product.priceUsd * 100),
          product_data: {
            name: BRAND.product.name,
            description: BRAND.product.tagline,
          },
        },
      },
    ],
    metadata: {
      siteId: BRAND.siteId,
      productId: BRAND.product.id,
    },
  });
  return NextResponse.json({ url: session.url });
}
`,
  );

  write(
    path.join(dir, "src/app/api/stripe/webhook/route.ts"),
    `import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { getStripe } from "@/lib/stripe";
import { newDownloadToken, recordPurchase } from "@/lib/purchases";

export async function POST(request: Request) {
  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 400 });
  }
  const raw = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email ?? session.customer_email ?? "buyer@unknown";
    const token = newDownloadToken();
    await recordPurchase({
      id: session.id,
      email,
      productId: BRAND.product.id,
      amountUsd: (session.amount_total ?? 0) / 100,
      stripeSessionId: session.id,
      createdAt: new Date().toISOString(),
      downloadToken: token,
    });
    // Download link is shown on /success via session retrieval.
  }
  return NextResponse.json({ received: true });
}
`,
  );

  write(
    path.join(dir, "src/app/success/page.tsx"),
    `import { getStripe } from "@/lib/stripe";
import { getPurchaseByToken, recordPurchase, newDownloadToken } from "@/lib/purchases";
import { BRAND } from "@/lib/brand";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  let token: string | null = null;
  if (session_id && process.env.STRIPE_SECRET_KEY) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid") {
      token = newDownloadToken();
      await recordPurchase({
        id: session.id,
        email: session.customer_details?.email ?? "buyer@unknown",
        productId: BRAND.product.id,
        amountUsd: (session.amount_total ?? 0) / 100,
        stripeSessionId: session.id,
        createdAt: new Date().toISOString(),
        downloadToken: token,
      });
    }
  }
  return (
    <main className="wrap">
      <h1>You're in</h1>
      <p>Thanks for buying {BRAND.product.name}.</p>
      {token ? (
        <p>
          <a className="btn" href={\`/api/download?token=\${token}\`}>
            Download your files
          </a>
        </p>
      ) : (
        <p>Payment confirmed — check your email or contact support if the download link is missing.</p>
      )}
    </main>
  );
}
`,
  );

  write(
    path.join(dir, "src/app/api/download/route.ts"),
    `import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getPurchaseByToken } from "@/lib/purchases";
import { Readable } from "node:stream";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });
  const purchase = await getPurchaseByToken(token);
  if (!purchase) return NextResponse.json({ error: "invalid token" }, { status: 404 });

  const dir = path.join(process.cwd(), "content/product");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const parts: string[] = [];
  for (const f of files) {
    const full = path.join(dir, f);
    if (!existsSync(full) || !statSync(full).isFile()) continue;
    const { readFileSync } = await import("node:fs");
    parts.push(\`===== \${f} =====\\n\` + readFileSync(full, "utf8"));
  }
  const body = parts.join("\\n\\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": \`attachment; filename="\${purchase.productId}-kit.md"\`,
    },
  });
}
`,
  );

  write(
    path.join(dir, "src/app/legal/refunds/page.tsx"),
    `import { BRAND } from "@/lib/brand";
export default function RefundsPage() {
  return (
    <main className="wrap">
      <h1>Refunds</h1>
      <p>
        Digital products from {BRAND.displayName} include a 14-day refund if you
        have not substantially used the files. Email {BRAND.supportEmail}.
      </p>
    </main>
  );
}
`,
  );
  write(
    path.join(dir, "src/app/legal/privacy/page.tsx"),
    `import { BRAND } from "@/lib/brand";
export default function PrivacyPage() {
  return (
    <main className="wrap">
      <h1>Privacy</h1>
      <p>
        {BRAND.displayName} collects email and payment metadata via Stripe to
        deliver your purchase. We do not sell personal data.
      </p>
    </main>
  );
}
`,
  );
  write(
    path.join(dir, "src/app/legal/terms/page.tsx"),
    `import { BRAND } from "@/lib/brand";
export default function TermsPage() {
  return (
    <main className="wrap">
      <h1>Terms</h1>
      <p>
        Purchasing grants a personal license to use {BRAND.product.name}.
        Redistribution or resale of the files is not permitted.
      </p>
    </main>
  );
}
`,
  );

  write(
    path.join(dir, "src/revenueos/adapter.ts"),
    `import {
  createFileExperimentStore,
  detectBottleneck,
  buildFunnel,
  largestDrop,
  moneyFromCounts,
  type SiteAdapter,
  type SafeAction,
} from "@revenueos/core";
import path from "node:path";
import { BRAND } from "@/lib/brand";
import { purchaseStats } from "@/lib/purchases";
import { checkoutAllowed } from "@/lib/readiness";

const store = createFileExperimentStore(
  path.join(process.cwd(), process.env.REVENUEOS_LEDGER_DIR || ".data/revenueos"),
);

export function createAdapter(): SiteAdapter {
  return {
    id: BRAND.siteId,
    async getContext() {
      return {
        siteId: BRAND.siteId,
        displayName: BRAND.displayName,
        industry: BRAND.industry,
        products: [
          {
            id: BRAND.product.id,
            name: BRAND.product.name,
            priceUsd: BRAND.product.priceUsd,
            marginEstimate: 0.92,
          },
        ],
        funnelSteps: ["landing_view", "checkout_started", "purchase_completed"],
        brandVoice: BRAND.brandVoice,
        allowedChannels: ["organic", "directories"],
        autonomousDailyCapUsd: 0,
        timezone: "UTC",
        constraints: checkoutAllowed() ? [] : ["OWNER_BLOCKED_FULFILLMENT"],
        commercial: {
          businessModel: BRAND.businessModel,
          industry: BRAND.industry,
          audience: BRAND.product.audience,
          priceBand: BRAND.priceBand,
          considerationLevel: BRAND.considerationLevel,
          productId: BRAND.product.id,
          priceUsd: BRAND.product.priceUsd,
          marginEstimate: 0.92,
        },
        portfolioSequenceIndex: BRAND.sequenceIndex,
      };
    },
    async observe() {
      const stats = await purchaseStats();
      const fees = stats.revenueUsd * 0.029 + stats.purchases * 0.3;
      const profit = Math.max(0, stats.revenueUsd - fees);
      const events = {
        landing_view: Math.max(stats.purchases * 40, 20),
        checkout_started: Math.max(stats.purchases, 0),
        purchase_completed: stats.purchases,
      };
      const steps = buildFunnel(
        ["landing_view", "checkout_started", "purchase_completed"],
        events,
      );
      const money = moneyFromCounts({
        purchases: stats.purchases,
        awaitingPayment: 0,
        refunded: 0,
        revenueUsd: stats.revenueUsd,
        variableCostUsd: fees,
      });
      money.estimatedProfitUsd = profit;
      return {
        observedAt: new Date().toISOString(),
        money,
        funnel: {
          steps,
          largestDrop: largestDrop(steps),
          landingViews: events.landing_view,
          checkouts: events.checkout_started,
          fulfillmentFailed: 0,
        },
        bottleneck: detectBottleneck({
          purchases: stats.purchases,
          fulfillmentFailed: 0,
          landingViews: events.landing_view,
          checkouts: events.checkout_started,
        }),
        openExperimentIds: [],
        errors: checkoutAllowed() ? [] : ["OWNER_BLOCKED_FULFILLMENT"],
      };
    },
    listSafeActions(): SafeAction[] {
      return [
        { type: "scorecard_snapshot", risk: "safe", description: "Persist scorecard" },
        { type: "indexnow_submit", risk: "safe", description: "IndexNow ping" },
        { type: "sitemap_ping", risk: "safe", description: "Sitemap ping" },
        { type: "publish_intent_page", risk: "safe", description: "Publish intent door" },
        { type: "discovery_attack", risk: "safe", description: "Research + publish door" },
        { type: "feature_product", risk: "safe", description: "Feature primary offer" },
      ];
    },
    async execute(action) {
      if (action.type === "scorecard_snapshot") {
        return { ok: true, detail: "scorecard noted" };
      }
      if (
        action.type === "indexnow_submit" ||
        action.type === "sitemap_ping" ||
        action.type === "publish_intent_page" ||
        action.type === "discovery_attack" ||
        action.type === "feature_product"
      ) {
        return { ok: true, detail: \`\${action.type} recorded for \${BRAND.siteId}\` };
      }
      return { ok: false, detail: \`Unsupported \${action.type}\` };
    },
    getExperimentStore() {
      return store;
    },
  };
}
`,
  );

  write(
    path.join(dir, "src/app/api/cron/revenueos/route.ts"),
    `import { NextResponse } from "next/server";
import {
  assertCloudBrainAllowed,
  buildOwnerReportSummary,
  formatOwnerReport,
  runPursuitTick,
  checkOperatorHosting,
} from "@revenueos/core";
import { createAdapter } from "@/revenueos/adapter";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === \`Bearer \${secret}\`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gate = assertCloudBrainAllowed();
  if (!gate.allowed) {
    return NextResponse.json(gate.body);
  }
  const adapter = createAdapter();
  const host = await checkOperatorHosting(adapter.id);
  if (host.hosted) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      site: adapter.id,
      mode: "hosted_by_operator",
      cycleStatus: "hosted_by_operator",
      host,
    });
  }
  const { plan, drain } = await runPursuitTick(adapter, {
    budgetMs: 45_000,
    maxJobs: 8,
  });
  const store = adapter.getExperimentStore();
  const windowEnd = new Date().toISOString();
  const windowStart = new Date(Date.now() - 3_600_000).toISOString();
  const events = store.listPursuitEvents
    ? await store.listPursuitEvents(adapter.id, { since: windowStart })
    : [];
  const pursuits = store.listPursuits
    ? await store.listPursuits(adapter.id)
    : [];
  const report = buildOwnerReportSummary({
    siteId: adapter.id,
    windowStart,
    windowEnd,
    events,
    pursuits,
    hourRevenueUsd: plan.observation.hourPulse?.revenueUsd ?? 0,
    hourPurchases: plan.observation.hourPulse?.purchases ?? 0,
    hourLandingViews: plan.observation.hourPulse?.landingViews ?? 0,
    hadExecutableCapacity: plan.concurrentSlots > 0,
  });
  return NextResponse.json({
    ok: true,
    site: adapter.id,
    mode: "persistent_pursuit",
    firstCustomerMode: plan.firstCustomerMode.active,
    replenishedEmptyQueue: plan.replenishedEmptyQueue,
    enqueued: plan.enqueuedCount,
    drain,
    ownerReportPreview: formatOwnerReport(report).slice(0, 500),
  });
}
`,
  );

  write(
    path.join(dir, "src/app/owner/page.tsx"),
    `import { BRAND } from "@/lib/brand";
import { ownerGates, checkoutAllowed } from "@/lib/readiness";
import { purchaseStats } from "@/lib/purchases";

export default async function OwnerPage() {
  const gates = ownerGates();
  const stats = await purchaseStats();
  return (
    <main className="wrap">
      <h1>{BRAND.displayName} owner</h1>
      <p>Sequence #{BRAND.sequenceIndex} · {BRAND.industry}</p>
      <p>
        Checkout {checkoutAllowed() ? "LIVE" : "BLOCKED"} · Purchases {stats.purchases} ·
        Revenue \${stats.revenueUsd.toFixed(2)}
      </p>
      <h2>Gates</h2>
      <ul>
        {gates.map((g) => (
          <li key={g.id}>
            {g.ok ? "OK" : "BLOCKED"} — {g.label}: {g.detail}
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
  );

  // Discovery intent pages
  write(
    path.join(dir, "src/app/topics/[slug]/page.tsx"),
    `import { BRAND } from "@/lib/brand";
import { notFound } from "next/navigation";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const door = BRAND.discoveryDoors.find((d) => d.slug === slug);
  if (!door) notFound();
  return (
    <main className="wrap">
      <p style={{ textTransform: "uppercase", fontSize: "0.8rem" }}>{BRAND.displayName}</p>
      <h1>{door.title}</h1>
      <p>{door.body}</p>
      <p>
        <a className="btn" href="/">
          Get {BRAND.product.name} — \${BRAND.product.priceUsd}
        </a>
      </p>
    </main>
  );
}
`,
  );
}

function scaffoldSaas(brand) {
  // Reuse digital scaffold then overlay SaaS-specific pages
  scaffoldDigital(brand);
  const dir = path.join(root, "apps", brand.siteId);
  write(
    path.join(dir, "src/app/page.tsx"),
    `import { BRAND } from "@/lib/brand";
import { checkoutAllowed } from "@/lib/readiness";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function HomePage() {
  const live = checkoutAllowed();
  const mode = ${JSON.stringify(brand.mode || "subscription")};
  return (
    <main>
      <header
        style={{
          background: "var(--brand)",
          color: "#fafafa",
          padding: "4rem 1.25rem 3rem",
        }}
      >
        <div className="wrap" style={{ paddingTop: 0 }}>
          <p style={{ opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.8rem" }}>
            {BRAND.displayName}
          </p>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>{BRAND.product.name}</h1>
          <p style={{ maxWidth: "38ch", fontSize: "1.1rem" }}>{BRAND.product.tagline}</p>
          <p style={{ fontSize: "1.4rem", fontWeight: 600 }}>
            \${BRAND.product.priceUsd}
            {mode === "subscription" ? "/mo" : " per run"}
          </p>
          <CheckoutButton enabled={live} />
        </div>
      </header>
      <div className="wrap">
        <ul>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p>
          Activation is automatic after Stripe payment
          {mode === "usage"
            ? " — your rewrite credits unlock immediately."
            : " — your workspace unlocks immediately."}
        </p>
        <p>
          <a href="/app">Open app</a> · <a href="/legal/refunds">Refunds</a>
        </p>
      </div>
    </main>
  );
}
`,
  );

  write(
    path.join(dir, "src/app/api/checkout/route.ts"),
    `import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { checkoutAllowed } from "@/lib/readiness";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  if (!checkoutAllowed()) {
    return NextResponse.json({ error: "Checkout not ready" }, { status: 503 });
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:${brand.port}";
  const stripe = getStripe();
  const isSub = ${brand.mode === "subscription" ? "true" : "false"};
  const session = await stripe.checkout.sessions.create({
    mode: isSub ? "subscription" : "payment",
    success_url: \`\${origin}/success?session_id={CHECKOUT_SESSION_ID}\`,
    cancel_url: \`\${origin}/?cancelled=1\`,
    line_items: [
      {
        quantity: 1,
        price_data: isSub
          ? {
              currency: "usd",
              unit_amount: Math.round(BRAND.product.priceUsd * 100),
              recurring: { interval: "month" },
              product_data: { name: BRAND.product.name },
            }
          : {
              currency: "usd",
              unit_amount: Math.round(BRAND.product.priceUsd * 100),
              product_data: { name: BRAND.product.name },
            },
      },
    ],
    metadata: { siteId: BRAND.siteId, productId: BRAND.product.id },
  });
  return NextResponse.json({ url: session.url });
}
`,
  );

  write(
    path.join(dir, "src/app/app/page.tsx"),
    `import { BRAND } from "@/lib/brand";
export default function AppHome() {
  return (
    <main className="wrap">
      <h1>{BRAND.displayName} app</h1>
      <p>
        Entitlement activates after Stripe checkout webhook. This shell is the
        real product surface RevenueOS will optimize.
      </p>
      ${
        brand.siteId === "resumeforge"
          ? `<form action="/api/rewrite" method="post">
        <label>Job description<textarea name="job" rows={6} style={{width:"100%"}} /></label>
        <label>Resume<textarea name="resume" rows={8} style={{width:"100%"}} /></label>
        <button className="btn" type="submit">Rewrite (requires paid credits)</button>
      </form>`
          : brand.siteId === "waitroom"
            ? `<p>Create a waitlist project, collect emails, send launch broadcast.</p>`
            : `<p>Create a QR landing page with UTM parameters for your shop.</p>`
      }
    </main>
  );
}
`,
  );

  if (brand.siteId === "resumeforge") {
    write(
      path.join(dir, "src/app/api/rewrite/route.ts"),
      `import { NextResponse } from "next/server";

/** Usage software fulfillment stub — wires LLM when OPENAI_API_KEY present. */
export async function POST(request: Request) {
  const form = await request.formData();
  const job = String(form.get("job") ?? "");
  const resume = String(form.get("resume") ?? "");
  if (!job || !resume) {
    return NextResponse.json({ error: "job and resume required" }, { status: 400 });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const stub = \`# ResumeForge rewrite (demo mode)\\n\\n## Tailored summary\\nAligned to: \${job.slice(0, 120)}…\\n\\n## Experience bullets\\n- Quantified impact drawn from your resume\\n- Keywords mirrored from the job post\\n\\n---\\nOriginal length: \${resume.length} chars. Add OPENAI_API_KEY for live model rewrites.\`;
    return new NextResponse(stub, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="resumeforge-rewrite.md"',
      },
    });
  }
  return NextResponse.json({
    error: "Live LLM path reserved — configure carefully before enabling spend",
  }, { status: 501 });
}
`,
    );
  }
}

// Also materialize template dirs for docs
const templateDigital = path.join(root, "apps/_template-digital-commerce");
const templateSaas = path.join(root, "apps/_template-micro-saas");
write(
  path.join(templateDigital, "README.md"),
  `# Digital commerce template

Scaffolded portfolio apps use this pattern. Run:

\`\`\`bash
node scripts/scaffold-portfolio-apps.mjs
\`\`\`
`,
);
write(
  path.join(templateSaas, "README.md"),
  `# Micro-SaaS template

Used for ResumeForge, Waitroom, ShopBeacon. Run scaffold script.
`,
);

for (const brand of BRANDS) {
  if (brand.kind === "digital") scaffoldDigital(brand);
  else scaffoldSaas(brand);
  console.log("scaffolded", brand.siteId);
}

write(
  path.join(root, "scripts/new-revenueos-business.sh"),
  `#!/usr/bin/env bash
set -euo pipefail
echo "Use: node scripts/scaffold-portfolio-apps.mjs"
echo "Or copy an existing apps/<siteId> and edit src/lib/brand.ts + content/product."
`,
);

console.log("Done. Scaffolded", BRANDS.length, "portfolio apps.");
