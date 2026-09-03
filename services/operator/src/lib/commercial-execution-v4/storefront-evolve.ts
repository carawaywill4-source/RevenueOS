/**
 * RevenueOS owns storefront copy. Cursor is training wheels, not the webmaster.
 * Writes evolved-copy.json from brand.ts; hosting-plane renders it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import type { Logger } from "../ultron-core/types.js";
import { FIRST_CUSTOMER_PRICE_USD } from "./first-customer.js";
import { recordCommercialAction } from "./ledger.js";

type Card = { title: string; body: string };
type Faq = { q: string; a: string };
export type EvolvedCopy = {
  headline: string;
  lede: string;
  inside: Card[];
  without: string[];
  withThis: string[];
  notFor: string[];
  faqs: Faq[];
  cta: string;
  priceUsd: number;
  evolvedBy: string;
  evolvedAt: string;
};

function appRoot(): string {
  return process.env.REVENUEOS_APP_ROOT || process.env.REVENUEOS_REPO_ROOT || "/opt/revenueos/app";
}

function copyPath(businessId: string): string {
  return path.join(appRoot(), "apps", businessId, "src/lib/evolved-copy.json");
}

function loadBrandBits(businessId: string): {
  displayName: string;
  product: string;
  tagline: string;
  description: string;
  audience: string;
  bullets: string[];
  email: string;
} {
  const p = path.join(appRoot(), "apps", businessId, "src/lib/brand.ts");
  const src = existsSync(p) ? readFileSync(p, "utf8") : "";
  const grab = (k: string, fb: string) => {
    const m = src.match(new RegExp(`["']${k}["']\\s*:\\s*["']([^"']+)["']`));
    return m?.[1] || fb;
  };
  const bullets =
    [...src.matchAll(/["']([A-Z][^"']{8,80})["']/g)]
      .map((x) => x[1]!)
      .filter((s) => /log|ahead|punch|tracker|template|invoice|quote|resume/i.test(s))
      .slice(0, 4) || [];
  return {
    displayName: grab("displayName", businessId),
    product: grab("name", `${businessId} pack`),
    tagline: grab("tagline", "The work is improvised every week."),
    description: grab("description", "Working files. One payment."),
    audience: grab("audience", "operators who need working files"),
    bullets: bullets.length ? bullets : ["Ready-to-use templates", "Clear workflow", "Reuse on the next job"],
    email: grab("supportEmail", `care@${businessId}.com`),
  };
}

export function evolveCopyFromBrand(businessId: string, priceUsd: number): EvolvedCopy {
  const existingPath = copyPath(businessId);
  if (existsSync(existingPath)) {
    try {
      const prior = JSON.parse(readFileSync(existingPath, "utf8")) as EvolvedCopy;
      if (prior.headline && prior.inside?.length) {
        if (prior.priceUsd === priceUsd) return prior;
        return {
          ...prior,
          priceUsd,
          evolvedBy: "revenueos-storefront-evolve",
          evolvedAt: new Date().toISOString(),
        };
      }
    } catch {
      /* regenerate */
    }
  }
  const b = loadBrandBits(businessId);
  const headline = b.tagline.replace(/\.$/, "");
  return {
    headline,
    lede: `${b.displayName} is ${b.product} for ${b.audience}. ${b.description} One payment. Yours to reuse.`,
    inside: b.bullets.slice(0, 4).map((title) => ({
      title,
      body: `${title} — written so ${b.audience} can use it the same day.`,
    })),
    without: [
      "You keep rebuilding the same documents because nothing is the system.",
      b.tagline,
      "Handoffs live in email. The next person starts from zero.",
    ],
    withThis: b.bullets.map((x) => `${x} — already structured, copy onto the next job.`),
    notFor: [
      "Teams that need live SaaS with seats and SSO.",
      "Anyone looking for a course instead of working files.",
    ],
    faqs: [
      {
        q: "What do I download?",
        a: `${b.product}: ${b.bullets.join(", ")}. Digital files, delivered immediately after payment.`,
      },
      {
        q: "Is this a subscription?",
        a: "No. One payment. You keep the files.",
      },
      { q: "Who is this for?", a: b.audience },
      {
        q: "How do I get support?",
        a: `Email ${b.email}. We do not invent testimonials or customer counts.`,
      },
    ],
    cta: `Get ${b.displayName}`,
    priceUsd,
    evolvedBy: "revenueos-storefront-evolve",
    evolvedAt: new Date().toISOString(),
  };
}

export async function evolveStorefrontForSale(input: {
  pool: pg.Pool;
  logger: Logger;
  businessId: string;
  purchases: number;
}): Promise<{ wrote: boolean; priceUsd: number; path: string }> {
  const wait = input.purchases > 0 ? 89 : FIRST_CUSTOMER_PRICE_USD;
  const copy = evolveCopyFromBrand(input.businessId, wait);
  const dest = copyPath(input.businessId);
  mkdirSync(path.dirname(dest), { recursive: true });
  const prev = existsSync(dest) ? readFileSync(dest, "utf8") : "";
  const next = `${JSON.stringify(copy, null, 2)}\n`;
  const wrote = prev !== next;
  if (wrote) writeFileSync(dest, next);
  if (wrote) {
    await recordCommercialAction(input.pool, {
      businessId: input.businessId,
      channel: "owned_storefront",
      actionType: "storefront_evolved_by_revenueos",
      target: dest,
      external: false,
      executed: true,
      humanExposurePossible: false,
      result: `price_${copy.priceUsd}`,
      nextAction: "redeploy_static",
    }).catch(() => undefined);
    input.logger("info", "cee.v4.storefront.evolved", {
      businessId: input.businessId,
      priceUsd: copy.priceUsd,
    });
  }
  return { wrote, priceUsd: copy.priceUsd, path: dest };
}
