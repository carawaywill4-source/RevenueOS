/**
 * FORGE quality auditor — static evidence against constitution + premium bar.
 */

import { scanCopyForSlop, scanDesignForSlopSignals } from "./anti-slop";
import { scopeGuardGenome } from "./genome";
import { evaluatePremiumBar } from "./premium-bar";
import type { BusinessGenome, ForgeAuditResult, ForgeGap } from "./types";

export type StorefrontAuditInput = {
  businessId: string;
  brand: {
    displayName: string;
    primaryColor: string;
    accentColor: string;
    fontDisplay: string;
    fontBody: string;
    supportEmail: string;
    domain: string;
    product: {
      name: string;
      tagline: string;
      description: string;
      priceUsd: number;
      bullets: string[];
      audience: string;
    };
    discoveryDoors?: Array<{ slug: string; title: string; body: string }>;
  };
  /** Concatenated page / layout source for pattern scans. */
  sourceTexts: Array<{ path: string; text: string }>;
  fontsLoadedInLayout?: string[];
  checkoutRouteExists?: boolean;
  legalPages?: string[];
  genome?: BusinessGenome;
  purchases?: number;
};

function colorLooksTerracotta(hex: string): boolean {
  const h = hex.replace("#", "").toLowerCase();
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return r > 180 && g > 80 && g < 160 && b < 120;
}

export function auditStorefront(input: StorefrontAuditInput): ForgeAuditResult {
  const gaps: ForgeGap[] = [];
  const genome =
    input.genome ?? scopeGuardGenome({ purchases: input.purchases });

  const allCopy = [
    input.brand.product.tagline,
    input.brand.product.description,
    ...input.brand.product.bullets,
    ...(input.brand.discoveryDoors ?? []).map((d) => d.body),
    ...input.sourceTexts.map((s) => s.text),
  ].join("\n");

  gaps.push(...scanCopyForSlop(allCopy, "brand+pages"));

  for (const door of input.brand.discoveryDoors ?? []) {
    if (/this page targets:/i.test(door.body) || door.body.trim().length < 120) {
      gaps.push({
        id: `thin_door_${door.slug}`,
        category: "anti_slop",
        severity: "HIGH",
        title: `Thin SEO door: ${door.slug}`,
        detail: "Discovery door body is keyword shell, not useful content.",
        evidence: [door.slug, door.body.slice(0, 160)],
        recommended_fix:
          "Rewrite as a useful mini-guide answering the searcher's job; link to product honestly.",
        blocks_premium_bar: true,
      });
    }
  }

  // Font mismatch
  if (input.fontsLoadedInLayout?.length) {
    const loaded = input.fontsLoadedInLayout.map((f) => f.toLowerCase()).join(" ");
    const wantDisplay = input.brand.fontDisplay.toLowerCase();
    const wantBody = input.brand.fontBody.toLowerCase();
    if (!loaded.includes(wantDisplay.split(" ")[0]!) || !loaded.includes(wantBody.split(" ")[0]!)) {
      gaps.push({
        id: "font_mismatch",
        category: "typography",
        severity: "CRITICAL",
        title: "Brand fonts not loaded in layout",
        detail: `Brand specifies ${input.brand.fontDisplay} / ${input.brand.fontBody}; layout loads ${input.fontsLoadedInLayout.join(", ")}.`,
        evidence: input.fontsLoadedInLayout,
        recommended_fix: "Load exactly the brand typefaces; remove unused font requests.",
        blocks_premium_bar: true,
      });
    }
  }

  gaps.push(
    ...scanDesignForSlopSignals({
      usesCreamTerracottaSerifCluster:
        colorLooksTerracotta(input.brand.accentColor) &&
        /baskerville|fraunces|serif/i.test(input.brand.fontDisplay),
      genericFeatureGridOnly:
        /what you get/i.test(allCopy) &&
        !/sample|preview|example|inside the pack|what is inside|guide-0\d\.md/i.test(
          allCopy,
        ),
    }),
  );

  // JTBD: tagline that only restates problem
  if (
    /unpaid work|scope creep/i.test(input.brand.product.tagline) &&
    !/get paid|boundaries|protect|change-order|billable/i.test(input.brand.product.tagline)
  ) {
    gaps.push({
      id: "jtbd_tagline_is_problem",
      category: "jtbd",
      severity: "HIGH",
      title: "Tagline states the problem, not the job/outcome",
      detail: "Customers buy the job (boundaries + paid change orders), not a reminder of pain alone.",
      evidence: [input.brand.product.tagline],
      recommended_fix: "Rewrite tagline around the outcome in the business genome job_to_be_done.",
      blocks_premium_bar: true,
    });
  }

  if (!input.checkoutRouteExists) {
    gaps.push({
      id: "checkout_missing",
      category: "checkout",
      severity: "CRITICAL",
      title: "Checkout route missing",
      detail: "No /api/checkout path detected.",
      evidence: [],
      recommended_fix: "Implement Stripe Checkout with readiness gates.",
      blocks_premium_bar: true,
    });
  }

  const legal = new Set(input.legalPages ?? []);
  for (const p of ["privacy", "terms", "refunds"]) {
    if (![...legal].some((x) => x.includes(p))) {
      gaps.push({
        id: `legal_${p}`,
        category: "trust",
        severity: "HIGH",
        title: `Missing legal page: ${p}`,
        detail: "Trust model requires clear policies.",
        evidence: [],
        recommended_fix: `Add /legal/${p}.`,
        blocks_premium_bar: true,
      });
    }
  }

  if (
    !/preview|sample|example|what's inside|what is inside|what you download|guide-0\d\.md|readme\.md/i.test(
      allCopy,
    )
  ) {
    gaps.push({
      id: "no_product_demo",
      category: "product",
      severity: "HIGH",
      title: "No product demonstration",
      detail: "Show-don't-claim: customer cannot see deliverables before paying.",
      evidence: ["home_copy"],
      recommended_fix: "Add concrete pack contents + sample excerpt / file list with real names.",
      blocks_premium_bar: true,
    });
  }

  if ((input.brand.domain.includes("vercel.app") || input.brand.domain.includes("localhost")) &&
      input.purchases === 0) {
    gaps.push({
      id: "domain_preview",
      category: "trust",
      severity: "MEDIUM",
      title: "Still on preview hosting domain",
      detail: `${input.brand.domain} weakens first-impression trust for a paid legal-adjacent pack.`,
      evidence: [input.brand.domain],
      recommended_fix: "Attach a dedicated domain when dual-run hosting plane is ready.",
      blocks_premium_bar: false,
    });
  }

  // Deduplicate by id
  const byId = new Map<string, ForgeGap>();
  for (const g of gaps) byId.set(g.id, g);
  const unique = [...byId.values()];

  const premium_bar = evaluatePremiumBar({
    businessId: input.businessId,
    gaps: unique,
  });

  const summary = {
    critical: unique.filter((g) => g.severity === "CRITICAL").length,
    high: unique.filter((g) => g.severity === "HIGH").length,
    medium: unique.filter((g) => g.severity === "MEDIUM").length,
    low: unique.filter((g) => g.severity === "LOW").length,
    ready_for_public_launch: premium_bar.passed,
  };

  return {
    business_id: input.businessId,
    audited_at: new Date().toISOString(),
    genome,
    gaps: unique.sort((a, b) => severityRank(a.severity) - severityRank(b.severity)),
    premium_bar,
    summary,
    directive: summary.ready_for_public_launch
      ? "Premium bar passed — eligible as FORGE reference proof."
      : "NOT READY — fix CRITICAL/HIGH gaps before celebrating launch quality. Do not spawn Business #12.",
  };
}

function severityRank(s: ForgeGap["severity"]): number {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[s];
}
