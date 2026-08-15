/**
 * Premium release bar — critical failure blocks launch regardless of averages.
 */

import type { ForgeGap, PremiumBarCheck, PremiumBarResult } from "./types";

const REQUIRED_CHECKS: Array<{
  id: string;
  label: string;
  gapIds?: string[];
  categories?: string[];
}> = [
  { id: "no_placeholder", label: "No placeholder content" },
  { id: "no_broken_critical_flow", label: "No unfinished critical flows" },
  { id: "no_fake_proof", label: "No fake social proof", gapIds: ["slop_fake_proof"] },
  { id: "no_generic_ai_copy", label: "No generic AI copy / SEO sludge", categories: ["anti_slop", "copy"] },
  { id: "mobile_ok", label: "No broken mobile layout intent", categories: ["design"] },
  { id: "checkout_path", label: "Checkout path defined", categories: ["checkout"] },
  { id: "fulfillment_clear", label: "Fulfillment explained", categories: ["fulfillment"] },
  { id: "trust_policies", label: "Trust policies present", categories: ["trust"] },
  { id: "jtbd_clear", label: "Job-to-be-done clear in product thesis", categories: ["jtbd", "thesis"] },
  { id: "no_font_mismatch", label: "Typography loads match brand system", gapIds: ["font_mismatch"] },
];

export function evaluatePremiumBar(input: {
  businessId: string;
  gaps: ForgeGap[];
}): PremiumBarResult {
  const criticalBlocking = input.gaps.filter((g) => g.blocks_premium_bar && g.severity === "CRITICAL");
  const highBlocking = input.gaps.filter((g) => g.blocks_premium_bar && g.severity === "HIGH");

  const checks: PremiumBarCheck[] = REQUIRED_CHECKS.map((req) => {
    const hit = input.gaps.find((g) => {
      if (req.gapIds?.includes(g.id)) return true;
      if (req.categories?.includes(g.category) && (g.severity === "CRITICAL" || g.severity === "HIGH") && g.blocks_premium_bar) {
        return true;
      }
      return false;
    });
    return {
      id: req.id,
      label: req.label,
      pass: !hit,
      detail: hit ? hit.title : "ok",
      severity: hit?.severity ?? "LOW",
    };
  });

  // Extra: any CRITICAL gap blocks
  for (const g of criticalBlocking) {
    if (!checks.some((c) => c.detail === g.title)) {
      checks.push({
        id: `critical_${g.id}`,
        label: g.title,
        pass: false,
        detail: g.detail,
        severity: "CRITICAL",
      });
    }
  }

  const blocking_failures = [
    ...checks.filter((c) => !c.pass).map((c) => c.id),
    ...highBlocking.map((g) => g.id),
  ];
  const unique = [...new Set(blocking_failures)];

  return {
    business_id: input.businessId,
    passed: unique.length === 0 && criticalBlocking.length === 0 && highBlocking.length === 0,
    checks,
    blocking_failures: unique,
  };
}
