/**
 * Apply premium storefront + product pack repair to the selected frontier,
 * then ask hosting-plane to redeploy. Owned-site work is not E5.
 */

import { existsSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { applyPremiumStorefront, currentPageLooksPremium, premiumCss } from "./premium-site-system.js";
import { createHostingPlaneClient } from "../hosting-plane-client.js";
import { evaluateProductFiles } from "./product-quality-gate.js";

function appRoot(): string {
  return process.env.REVENUEOS_APP_ROOT || process.env.APP_ROOT || "/opt/revenueos/app";
}

function thickenProductPack(appDir: string, businessId: string): { wrote: boolean; detail: string } {
  const dir = path.join(appDir, "content", "product");
  const readme = path.join(dir, "readme.md");
  if (!existsSync(readme)) return { wrote: false, detail: "no_product_dir" };
  const gate = evaluateProductFiles(businessId);
  if (gate.pass || gate.bytes >= 4_000) return { wrote: false, detail: "product_already_substantial" };
  const brandPath = path.join(appDir, "src/lib/brand.ts");
  let name = businessId;
  let audience = "the buyer named on the site";
  let problem = "the problem named on the site";
  try {
    const src = readFileSync(brandPath, "utf8");
    name = src.match(/"name":\s*"([^"]+)"/)?.[1] ?? name;
    audience = src.match(/"audience":\s*"([^"]+)"/)?.[1] ?? audience;
    problem = src.match(/"tagline":\s*"([^"]+)"/)?.[1] ?? problem;
  } catch { /* keep defaults */ }
  writeFileSync(
    path.join(dir, "guide-01.md"),
    `# ${name} — Guide 1: Working sequence

Audience: ${audience}

Problem: ${problem}

## Sequence
1. Confirm the facts (amount, date, agreement).
2. Send a factual reminder. No accusation.
3. Send a firm follow-up that states the next action you will take.
4. Offer a written resolution with dates.
5. Record the outcome.

## Reminder template
Subject: [ITEM] dated [DATE] — still open

Hello [NAME],

[ITEM] for [AMOUNT] was due [DATE] and remains open. If you already completed this, reply with the date so I can close it. If you need a short plan, reply with a date.

[YOUR NAME]
`,
  );
  writeFileSync(
    path.join(dir, "guide-02.md"),
    `# ${name} — Guide 2: Objections

- "I never got it" → resend the artifact and confirm the address on file.
- "Not now" → ask for a dated commitment. Do not accept "soon".
- "This isn't right" → ask for the specific defect, then fix or dispute with evidence.

Keep messages short. Do not invent urgency you cannot stand behind.
`,
  );
  writeFileSync(
    path.join(dir, "guide-03.md"),
    `# ${name} — Guide 3: Policy language

Use only language you will enforce. This is not legal advice.

Late / pause example: If this remains unpaid more than [N] days, work may pause until a written plan exists.

Payment-plan example: I can accept [AMOUNT] by [DATE] and the remainder by [DATE]. Reply "agree".
`,
  );
  return { wrote: true, detail: "thickened_product_guides" };
}

export async function upgradeFrontierDestination(
  pool: pg.Pool,
  logger: Logger,
  businessId: string,
): Promise<Record<string, unknown>> {
  const appDir = path.join(appRoot(), "apps", businessId);
  if (!existsSync(appDir)) {
    return { ok: false, detail: `app_missing:${appDir}` };
  }
  const alreadyPremium = currentPageLooksPremium(appDir);
  const site = alreadyPremium
    ? { ok: true, detail: "already_premium_layout" }
    : applyPremiumStorefront(appDir);
  const brandPath = path.join(appDir, "src/lib/brand.ts");
  if (existsSync(brandPath) && !alreadyPremium) {
    const src = readFileSync(brandPath, "utf8");
    const brand = src.match(/"primaryColor":\s*"([^"]+)"/)?.[1];
    const accent = src.match(/"accentColor":\s*"([^"]+)"/)?.[1];
    if (brand || accent) {
      writeFileSync(path.join(appDir, "src/app/globals.css"), premiumCss({ brand, accent }));
    }
  }
  const product = thickenProductPack(appDir, businessId);

  let deploy: Record<string, unknown> = { skipped: true };
  if (site.ok && (!alreadyPremium || product.wrote)) {
    const hp = createHostingPlaneClient();
    const available = await hp.available().catch(() => false);
    if (available) {
      deploy = await hp.deploy({
        siteId: businessId,
        appDir,
        reason: "frontier_premium_commerce_upgrade",
      }).catch((e) => ({ ok: false, detail: String(e) }));
    } else {
      deploy = { ok: false, detail: "hosting_plane_unavailable" };
    }
  }

  logger("info", "ultron.frontier.upgrade", {
    businessId,
    site,
    product,
    deployOk: Boolean((deploy as { ok?: boolean }).ok) || deploy.skipped === true,
  });
  return { ok: site.ok, alreadyPremium, site, product, deploy };
}
