/**
 * Zero-spend autonomous business launcher.
 * Scaffolds a digital storefront from a PortfolioArchitect opportunity,
 * deploys to Vercel, verifies production journey gates.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { BusinessOpportunity } from "@revenueos/core";
import { opportunityToManifest } from "@revenueos/core";
import { themeForIndustry } from "@revenueos/storefront-kit";

export type LaunchResult = {
  ok: boolean;
  siteId: string;
  appDir: string;
  productionUrl?: string;
  manifest?: ReturnType<typeof opportunityToManifest>;
  verification: Record<string, unknown>;
  detail: string;
};

function rootDir() {
  // services/operator/src/lib → repo root
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function sh(cmd: string, args: string[], cwd: string, input?: string) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    input,
    stdio: input !== undefined ? ["pipe", "pipe", "pipe"] : "inherit",
  });
  return r;
}

export function materializeBusinessApp(input: {
  opportunity: BusinessOpportunity;
  templateSiteId?: string;
}): { appDir: string; brandPath: string } {
  const root = rootDir();
  const template = input.templateSiteId ?? "ledgerleaf";
  const siteId = input.opportunity.siteId;
  const appDir = path.join(root, "apps", siteId);
  const templateDir = path.join(root, "apps", template);
  if (!existsSync(templateDir)) {
    throw new Error(`template missing: ${template}`);
  }
  if (existsSync(appDir)) {
    rmSync(appDir, { recursive: true, force: true });
  }
  mkdirSync(path.dirname(appDir), { recursive: true });
  cpSync(templateDir, appDir, {
    recursive: true,
    filter: (src) =>
      !src.includes("node_modules") &&
      !src.includes(".next") &&
      !src.includes(".git") &&
      !src.includes("vendor") &&
      !src.includes(".vercel"),
  });

  const theme = themeForIndustry(input.opportunity.industry);
  const opp = {
    ...input.opportunity,
    primaryColor: input.opportunity.primaryColor || theme.primaryColor,
    accentColor: input.opportunity.accentColor || theme.accentColor,
    fontDisplay: input.opportunity.fontDisplay || theme.fontDisplay,
    fontBody: input.opportunity.fontBody || theme.fontBody,
  };

  const brandTs = `import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — ${new Date().toISOString()} */
export const BRAND: BrandConfig = ${JSON.stringify(
    {
      siteId: opp.siteId,
      displayName: opp.displayName,
      domain: `${opp.siteId}.vercel.app`,
      industry: opp.industry,
      businessModel: "digital_download",
      priceBand: opp.priceUsd < 20 ? "under_20" : opp.priceUsd < 50 ? "20_50" : "50_100",
      considerationLevel: "utilitarian",
      brandVoice: opp.brandVoice,
      primaryColor: opp.primaryColor,
      accentColor: opp.accentColor,
      fontDisplay: opp.fontDisplay,
      fontBody: opp.fontBody,
      supportEmail: `care@${opp.siteId}.com`,
      product: {
        id: `${opp.siteId}-pack`,
        slug: `${opp.siteId}-pack`,
        name: opp.productName,
        tagline: opp.problem.slice(0, 120),
        description: opp.productDescription,
        priceUsd: opp.priceUsd,
        assetFiles: ["readme.md", "guide-01.md", "guide-02.md", "guide-03.md"],
        bullets: opp.bullets,
        audience: opp.buyer,
        intentKeywords: opp.intentKeywords,
      },
      discoveryDoors: opp.intentKeywords.slice(0, 3).map((q, i) => ({
        slug: q.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48),
        title: q,
        intentQuery: q,
        body: `${opp.productDescription}\n\nThis page targets: ${q}`,
      })),
      sequenceIndex: 100 + Math.floor(Math.random() * 50),
    },
    null,
    2,
  )};

export const SITE_ID = BRAND.siteId;
export const PRICE_USD = BRAND.product.priceUsd;
`;
  writeFileSync(path.join(appDir, "src/lib/brand.ts"), brandTs);

  writeFileSync(
    path.join(appDir, "src/app/globals.css"),
    `@import "tailwindcss";

:root {
  --brand: ${opp.primaryColor};
  --accent: ${opp.accentColor};
  --bg: #f6f5f2;
  --ink: #161616;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: "${opp.fontBody}", "Segoe UI", sans-serif;
}

h1, h2, h3 {
  font-family: "${opp.fontDisplay}", Georgia, serif;
  letter-spacing: -0.02em;
}

.btn {
  display: inline-block;
  background: var(--brand);
  color: #fff;
  padding: 0.95rem 1.5rem;
  text-decoration: none;
  font-weight: 600;
  border: none;
  cursor: pointer;
  border-radius: 2px;
}

.btn:disabled { opacity: 0.45; cursor: not-allowed; }

.wrap {
  max-width: 720px;
  margin: 0 auto;
  padding: 2.5rem 1.25rem;
}
`,
  );

  writeFileSync(
    path.join(appDir, "src/app/page.tsx"),
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
          background: \`linear-gradient(155deg, var(--brand) 0%, #0c0c0c 78%)\`,
          color: "#f4f1ea",
          padding: "5rem 1.25rem 4rem",
        }}
      >
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p style={{ opacity: 0.8, margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.78rem" }}>
            {BRAND.displayName}
          </p>
          <h1 style={{ fontSize: "clamp(2.4rem, 5.5vw, 3.6rem)", margin: "0.75rem 0 0.9rem", maxWidth: "16ch", lineHeight: 1.05 }}>
            {BRAND.product.name}
          </h1>
          <p style={{ fontSize: "1.15rem", maxWidth: "38ch", opacity: 0.92, lineHeight: 1.45 }}>
            {BRAND.product.tagline}
          </p>
          <p style={{ marginTop: "1.6rem", fontSize: "1.65rem", fontWeight: 600 }}>
            \${BRAND.product.priceUsd}
          </p>
          <div style={{ marginTop: "1.35rem" }}>
            <CheckoutButton enabled={live} />
          </div>
          {!live && (
            <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.75 }}>
              Checkout opens when payment + fulfillment are verified
              {blocked.length ? \` — \${blocked.map((b) => b.id).join(", ")}\` : ""}.
            </p>
          )}
        </div>
      </header>

      <div className="wrap">
        <h2>Built for {BRAND.product.audience}</h2>
        <p>{BRAND.product.description}</p>
        <h2>What you get</h2>
        <ul>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <h2>After you pay</h2>
        <p>
          Stripe confirms payment → instant download. No shipping. See{" "}
          <a href="/legal/refunds">refunds</a>,{" "}
          <a href="/legal/terms">terms</a>, and{" "}
          <a href="/legal/privacy">privacy</a>.
        </p>
      </div>
    </main>
  );
}
`,
  );

  const contentDir = path.join(appDir, "content/product");
  mkdirSync(contentDir, { recursive: true });
  writeFileSync(
    path.join(contentDir, "readme.md"),
    `# ${opp.productName}

Thanks for purchasing **${opp.displayName}**.

## Who this is for
${opp.buyer}

## Problem
${opp.problem}

## Files in this pack
${opp.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Support: care@${opp.siteId}.com
`,
  );
  for (let i = 1; i <= 3; i++) {
    writeFileSync(
      path.join(contentDir, `guide-0${i}.md`),
      `# ${opp.productName} — Guide ${i}

${opp.bullets[i - 1] ?? opp.productDescription}

Use this section as a working document. Replace bracketed fields with your details.
`,
    );
  }

  const pkgPath = path.join(appDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    name: string;
    scripts: Record<string, string>;
  };
  pkg.name = `@portfolio/${siteId}`;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  return { appDir, brandPath: path.join(appDir, "src/lib/brand.ts") };
}

export async function launchBusinessZeroSpend(input: {
  opportunity: BusinessOpportunity;
  cronSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  sequenceIndex?: number;
}): Promise<LaunchResult> {
  const opp = input.opportunity;
  const { appDir } = materializeBusinessApp({ opportunity: opp });

  // Vendor packages for Vercel
  const prep = sh(
    "bash",
    [path.join(rootDir(), "scripts/prepare-portfolio-deploy.sh"), opp.siteId],
    rootDir(),
  );
  if (prep.status !== 0) {
    return {
      ok: false,
      siteId: opp.siteId,
      appDir,
      verification: {},
      detail: "prepare-portfolio-deploy failed",
    };
  }

  // Ensure a dedicated Vercel project (never reuse template .vercel)
  rmSync(path.join(appDir, ".vercel"), { recursive: true, force: true });
  const link = spawnSync(
    "vercel",
    ["link", "--yes", "--project", opp.siteId],
    { cwd: appDir, encoding: "utf8" },
  );
  if (link.status !== 0) {
    // fallback: let first deploy create project named from directory
    spawnSync("vercel", ["link", "--yes"], { cwd: appDir, encoding: "utf8" });
  }

  // Sync live Supabase + cron (+ Stripe if present on Core) to Vercel production
  const stripe = process.env.STRIPE_SECRET_KEY;
  const envPairs: Array<[string, string]> = [
    ["SUPABASE_URL", input.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", input.supabaseServiceRoleKey],
    ["CRON_SECRET", input.cronSecret],
  ];
  if (stripe) envPairs.push(["STRIPE_SECRET_KEY", stripe]);
  for (const [name, value] of envPairs) {
    spawnSync("vercel", ["env", "rm", name, "production", "--yes"], {
      cwd: appDir,
      encoding: "utf8",
    });
    spawnSync("vercel", ["env", "add", name, "production"], {
      cwd: appDir,
      encoding: "utf8",
      input: value + "\n",
    });
  }

  const deploy = spawnSync("vercel", ["--prod", "--yes"], {
    cwd: appDir,
    encoding: "utf8",
  });
  if (deploy.status !== 0) {
    return {
      ok: false,
      siteId: opp.siteId,
      appDir,
      verification: {
        deployFailed: true,
        stderr: (deploy.stderr || "").slice(0, 400),
      },
      detail: "vercel deploy failed",
    };
  }

  const deployOut = `${deploy.stdout || ""}\n${deploy.stderr || ""}`;
  const aliased =
    deployOut.match(/Aliased\s+(https:\/\/[^\s]+)/i)?.[1] ||
    deployOut.match(/Production\s+(https:\/\/[^\s]+)/i)?.[1];
  const productionUrl =
    aliased?.replace(/\/$/, "") || `https://${opp.siteId}.vercel.app`;
  const verification: Record<string, unknown> = {
    productionUrl,
    deployAliased: aliased ?? null,
  };

  try {
    const home = await fetch(productionUrl, {
      signal: AbortSignal.timeout(30_000),
      redirect: "follow",
    });
    const body = await home.text();
    verification.homeStatus = home.status;
    verification.brandHit = new RegExp(opp.displayName, "i").test(body);
    // Product title may use HTML entities / soft hyphens — match distinctive tokens
    const productTokens = opp.productName
      .split(/[^A-Za-z0-9]+/)
      .filter((t) => t.length > 3)
      .slice(0, 3);
    verification.productHit =
      productTokens.length > 0 &&
      productTokens.every((t) => new RegExp(t, "i").test(body));
    verification.homeBytes = body.length;
  } catch (e) {
    verification.homeError = e instanceof Error ? e.message : String(e);
  }

  // Checkout route should exist (may be closed until Stripe env present)
  try {
    const checkout = await fetch(`${productionUrl}/api/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
    verification.checkoutStatus = checkout.status;
    verification.checkoutBodyHead = (await checkout.text()).slice(0, 200);
    // 400/402/503 acceptable for closed/incomplete checkout — 404 is not
    verification.checkoutRoutePresent = checkout.status !== 404;
  } catch (e) {
    verification.checkoutError = e instanceof Error ? e.message : String(e);
  }

  // Fulfillment assets present locally (deployed with app)
  verification.fulfillmentAssets = existsSync(
    path.join(appDir, "content/product/readme.md"),
  );

  const homeOk =
    verification.homeStatus === 200 &&
    verification.brandHit === true &&
    verification.productHit === true;
  const journeyOk =
    homeOk &&
    verification.fulfillmentAssets === true &&
    verification.checkoutRoutePresent === true;

  const manifest = opportunityToManifest(
    opp,
    productionUrl,
    input.sequenceIndex ?? 100,
  );

  return {
    ok: journeyOk,
    siteId: opp.siteId,
    appDir,
    productionUrl,
    manifest,
    verification,
    detail: journeyOk
      ? "Production home + brand + product + fulfillment assets + checkout route verified"
      : "Launch incomplete — see verification",
  };
}
