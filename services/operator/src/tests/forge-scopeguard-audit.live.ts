/**
 * FORGE Phase 1 — ScopeGuard quality audit (no Business #12).
 *
 *   npm --workspace @revenueos/operator-service exec tsx src/tests/forge-scopeguard-audit.live.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditStorefront, type ForgeAuditResult } from "@revenueos/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "../../../..");
const APP = path.join(REPO, "apps/scopeguard");

function read(rel: string) {
  const p = path.join(APP, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

function main() {
  const brandMod = read("src/lib/brand.ts");
  // Evaluate brand via dynamic import of compiled path — use JSON extract from file.
  const brandJsonMatch = brandMod.match(/export const BRAND[^=]*=\s*(\{[\s\S]*?\n\});/);
  if (!brandJsonMatch) {
    // brand is TS object — import via tsx
  }

  void import(path.join(APP, "src/lib/brand.ts")).then(async (mod) => {
    const BRAND = (mod as { BRAND: Record<string, unknown> }).BRAND as {
      siteId: string;
      displayName: string;
      domain: string;
      primaryColor: string;
      accentColor: string;
      fontDisplay: string;
      fontBody: string;
      supportEmail: string;
      product: {
        name: string;
        tagline: string;
        description: string;
        priceUsd: number;
        bullets: string[];
        audience: string;
      };
      discoveryDoors: Array<{ slug: string; title: string; body: string }>;
    };

    const layout = read("src/app/layout.tsx");
    const fontMatches = [...layout.matchAll(/family=([^:&]+)/g)].map((m) =>
      decodeURIComponent(m[1]!.replace(/\+/g, " ")),
    );

    const audit: ForgeAuditResult = auditStorefront({
      businessId: "scopeguard",
      brand: {
        displayName: BRAND.displayName,
        primaryColor: BRAND.primaryColor,
        accentColor: BRAND.accentColor,
        fontDisplay: BRAND.fontDisplay,
        fontBody: BRAND.fontBody,
        supportEmail: BRAND.supportEmail,
        domain: BRAND.domain,
        product: BRAND.product,
        discoveryDoors: BRAND.discoveryDoors,
      },
      sourceTexts: [
        { path: "page.tsx", text: read("src/app/page.tsx") },
        { path: "layout.tsx", text: layout },
        { path: "globals.css", text: read("src/app/globals.css") },
        { path: "topics", text: read("src/app/topics/[slug]/page.tsx") },
      ],
      fontsLoadedInLayout: fontMatches.length
        ? fontMatches
        : ["Fraunces", "Source Sans 3"],
      checkoutRouteExists: existsSync(path.join(APP, "src/app/api/checkout/route.ts")),
      legalPages: ["privacy", "terms", "refunds"].filter((p) =>
        existsSync(path.join(APP, `src/app/legal/${p}/page.tsx`)),
      ),
      purchases: 0,
    });

    const outDir = path.join(REPO, ".data");
    mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonPath = path.join(outDir, `forge-scopeguard-audit-${stamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(audit, null, 2));

    const md = renderGapMarkdown(audit);
    const mdPath = path.join(REPO, "docs/SCOPEGUARD_FORGE_GAP_ANALYSIS.md");
    writeFileSync(mdPath, md);

    console.log(
      JSON.stringify(
        {
          ok: true,
          summary: audit.summary,
          premium_bar_passed: audit.premium_bar.passed,
          directive: audit.directive,
          json: jsonPath,
          markdown: mdPath,
          top_gaps: audit.gaps.slice(0, 12).map((g) => ({
            severity: g.severity,
            id: g.id,
            title: g.title,
          })),
        },
        null,
        2,
      ),
    );
    process.exit(audit.summary.ready_for_public_launch ? 0 : 2);
  });
}

function renderGapMarkdown(audit: ForgeAuditResult): string {
  const lines: string[] = [
    "# ScopeGuard FORGE Gap Analysis",
    "",
    `Audited: ${audit.audited_at}`,
    "",
    "## Directive",
    "",
    audit.directive,
    "",
    "## Business genome (v1)",
    "",
    `- **Job-to-be-done:** ${audit.genome.job_to_be_done}`,
    `- **Value proposition:** ${audit.genome.value_proposition}`,
    `- **Maturity:** ${audit.genome.maturity}`,
    `- **Customer:** ${audit.genome.customer}`,
    "",
    "## Summary",
    "",
    `| Severity | Count |`,
    `| --- | ---: |`,
    `| CRITICAL | ${audit.summary.critical} |`,
    `| HIGH | ${audit.summary.high} |`,
    `| MEDIUM | ${audit.summary.medium} |`,
    `| LOW | ${audit.summary.low} |`,
    `| Premium bar | ${audit.premium_bar.passed ? "PASS" : "FAIL"} |`,
    "",
    "## Gaps",
    "",
  ];
  for (const g of audit.gaps) {
    lines.push(`### [${g.severity}] ${g.title}`);
    lines.push("");
    lines.push(`- **id:** \`${g.id}\``);
    lines.push(`- **category:** ${g.category}`);
    lines.push(`- **blocks premium bar:** ${g.blocks_premium_bar}`);
    lines.push(`- **detail:** ${g.detail}`);
    lines.push(`- **fix:** ${g.recommended_fix}`);
    if (g.evidence.length) {
      lines.push(`- **evidence:** ${g.evidence.map((e) => `\`${e.slice(0, 80)}\``).join(", ")}`);
    }
    lines.push("");
  }
  lines.push("## Premium bar checks");
  lines.push("");
  for (const c of audit.premium_bar.checks) {
    lines.push(`- ${c.pass ? "PASS" : "FAIL"} — ${c.label} (${c.detail})`);
  }
  lines.push("");
  lines.push("## Next actions");
  lines.push("");
  lines.push("1. Fix all CRITICAL and HIGH gaps that block the premium bar.");
  lines.push("2. Re-run this audit until `ready_for_public_launch` is true.");
  lines.push("3. Do **not** create Business #12 until ScopeGuard is the FORGE reference proof.");
  lines.push("");
  return lines.join("\n");
}

main();
