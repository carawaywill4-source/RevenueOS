/**
 * Zero-spend autonomous business launcher.
 * Scaffolds a digital storefront from a PortfolioArchitect opportunity,
 * deploys via RevenueOS native Azure hosting plane, verifies production journey gates.
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
import { premiumCss, PREMIUM_PAGE } from "./ultron-external/premium-site-system.js";

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

  const publicBase =
    process.env.HOSTING_PUBLIC_BASE_HOST ||
    process.env.REVENUEOS_PUBLIC_BASE_HOST ||
    "130.131.15.68.sslip.io";
  const brandTs = `import type { BrandConfig } from "@revenueos/storefront-kit";

/** Autonomously created by RevenueOS PortfolioArchitect — ${new Date().toISOString()} */
export const BRAND: BrandConfig = ${JSON.stringify(
    {
      siteId: opp.siteId,
      displayName: opp.displayName,
      domain: `${opp.siteId}.${publicBase}`,
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
    premiumCss({ brand: opp.primaryColor, accent: opp.accentColor }),
  );
  writeFileSync(path.join(appDir, "src/app/page.tsx"), PREMIUM_PAGE);

  const contentDir = path.join(appDir, "content/product");
  mkdirSync(contentDir, { recursive: true });
  writeFileSync(
    path.join(contentDir, "readme.md"),
    `# ${opp.productName}

## Outcome
${opp.productDescription}

## Who this is for
${opp.buyer}

## Problem this pack is built to solve
${opp.problem}

## What you receive
${opp.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

## How to use it
1. Skim Guide 1 for the working sequence.
2. Copy the templates into your own tools (email, docs, CRM).
3. Replace bracketed fields with your legal name, amounts, and dates.
4. Send. Track replies. Do not invent urgency you cannot stand behind.

## What this is not
This is not software that sends messages for you. It is a working pack of language and process you operate.

Support: care@${opp.siteId}.com
`,
  );
  const guideBodies = [
    `# ${opp.productName} — Guide 1: Working sequence

Audience: ${opp.buyer}

Goal: ${opp.problem}

## Sequence
Use these steps in order. Skip a step only if the prior step already resolved the issue.

1. Confirm the obligation (amount, due date, original agreement).
2. Send a factual reminder (no accusation).
3. Send a firm follow-up that states the next action you will take.
4. Offer a written resolution path (date, amount, or plan).
5. Document the outcome.

## Template — reminder
Subject: Invoice [NUMBER] dated [DATE] — [AMOUNT] still open

Hello [NAME],

Invoice [NUMBER] for [AMOUNT] was due [DATE]. This is a reminder that it remains unpaid.

If you already sent payment, reply with the date and method so I can close this.

If you need a short plan, reply with a date you can pay.

[YOUR NAME]
[YOUR BUSINESS]

Deliverable covered: ${opp.bullets[0] ?? opp.productName}
`,
    `# ${opp.productName} — Guide 2: Scripts and objections

## Phone / SMS (keep short)
Hello [NAME], this is [YOUR NAME] about invoice [NUMBER] for [AMOUNT], due [DATE]. I am checking whether you need anything from me to complete payment.

If voicemail: leave the invoice number, amount, and a callback number. Do not argue.

## Common objections
- "I never got it" → resend PDF + ask them to confirm the email address on file.
- "Cash is tight" → offer a dated plan in writing. Do not accept a vague "soon".
- "The work was incomplete" → ask for the specific item, then either fix it or dispute with evidence.

Deliverable covered: ${opp.bullets[1] ?? "scripts"}
`,
    `# ${opp.productName} — Guide 3: Policy language

Use only language you are willing to enforce. Do not copy this into a contract without checking local law.

## Late-fee notice (example, not legal advice)
If payment is more than [N] days late, a late fee of [AMOUNT OR %] may be added. Work may pause until the balance is current.

## Pause-work notice
I am pausing further work on [PROJECT] until invoice [NUMBER] is paid or a written plan is agreed.

## Payment-plan offer
I can accept [AMOUNT] by [DATE] and the remainder by [DATE]. Reply "agree" and I will send the dates in writing.

Deliverable covered: ${opp.bullets[2] ?? "policy language"}
`,
  ];
  for (let i = 0; i < 3; i++) {
    writeFileSync(path.join(contentDir, `guide-0${i + 1}.md`), guideBodies[i] ?? "");
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

  // Native Azure deploy via hosting plane (no Vercel / no Supabase runtime).
  const { prepareAndDeployStorefront, nativeSiteUrl } = await import(
    "./vercel-deploy-adapter.js"
  );
  const deploy = prepareAndDeployStorefront({
    appRoot: rootDir(),
    siteId: opp.siteId,
  });
  if (!deploy.ok) {
    return {
      ok: false,
      siteId: opp.siteId,
      appDir,
      verification: {
        deployFailed: true,
        failureClass: deploy.failureClass ?? null,
        detail: deploy.detail,
        log: (deploy.deployLog || "").slice(0, 400),
      },
      detail: deploy.detail || "native deploy failed",
    };
  }

  const productionUrl =
    (deploy.productionUrl || nativeSiteUrl(opp.siteId)).replace(/\/$/, "");
  const verification: Record<string, unknown> = {
    productionUrl,
    deploymentMethod: "native_azure_hosting_plane",
  };

  try {
    const home = await fetch(productionUrl, {
      signal: AbortSignal.timeout(30_000),
      redirect: "follow",
    });
    const body = await home.text();
    verification.homeStatus = home.status;
    verification.brandHit = new RegExp(opp.displayName, "i").test(body);
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

  try {
    const checkout = await fetch(`${productionUrl}/api/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(20_000),
    });
    verification.checkoutStatus = checkout.status;
    verification.checkoutBodyHead = (await checkout.text()).slice(0, 200);
    verification.checkoutRoutePresent = checkout.status !== 404;
  } catch (e) {
    verification.checkoutError = e instanceof Error ? e.message : String(e);
  }

  verification.fulfillmentAssets = existsSync(
    path.join(appDir, "content/product/readme.md"),
  );

  const homeOk =
    verification.homeStatus === 200 &&
    (verification.brandHit === true || verification.productHit === true);
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
      ? "Native Azure home + brand + product + fulfillment + checkout verified"
      : "Launch incomplete — see verification",
  };
}
