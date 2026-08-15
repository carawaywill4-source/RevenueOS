/**
 * Anti-AI-slop standard — reject generic generated surfaces.
 */

import { ANTI_AI_SLOP_MARKERS } from "./constitution";
import type { ForgeGap } from "./types";

export function scanCopyForSlop(copy: string, source: string): ForgeGap[] {
  const lower = copy.toLowerCase();
  const gaps: ForgeGap[] = [];
  for (const marker of ANTI_AI_SLOP_MARKERS) {
    if (lower.includes(marker)) {
      gaps.push({
        id: `slop_${marker.replace(/\W+/g, "_").slice(0, 40)}`,
        category: "anti_slop",
        severity: marker.includes("this page targets") ? "HIGH" : "CRITICAL",
        title: `Anti-slop: "${marker}"`,
        detail: `Copy in ${source} matches a banned generic/AI pattern.`,
        evidence: [source, marker],
        recommended_fix: "Rewrite with specific customer language tied to the job-to-be-done.",
        blocks_premium_bar: true,
      });
    }
  }
  return gaps;
}

export function scanDesignForSlopSignals(input: {
  usesPurpleGradientTheme?: boolean;
  usesCreamTerracottaSerifCluster?: boolean;
  fakeTestimonials?: boolean;
  fakeStats?: boolean;
  floatingCardCollage?: boolean;
  genericFeatureGridOnly?: boolean;
}): ForgeGap[] {
  const gaps: ForgeGap[] = [];
  if (input.usesPurpleGradientTheme) {
    gaps.push({
      id: "slop_purple_gradient",
      category: "design",
      severity: "HIGH",
      title: "Generic purple/gradient AI aesthetic",
      detail: "Visual language clusters with common AI template themes.",
      evidence: ["design_tokens"],
      recommended_fix: "Adopt category-appropriate art direction (document/legal: paper, ink, restraint).",
      blocks_premium_bar: true,
    });
  }
  if (input.usesCreamTerracottaSerifCluster) {
    gaps.push({
      id: "slop_cream_terracotta",
      category: "design",
      severity: "HIGH",
      title: "Cream + terracotta + serif AI design cluster",
      detail: "Matches a common generative-default look; weak category differentiation for contracts.",
      evidence: ["--bg cream", "accent terracotta", "serif display"],
      recommended_fix: "Re-art-direct for document professionalism without the default cluster.",
      blocks_premium_bar: false,
    });
  }
  if (input.fakeTestimonials || input.fakeStats) {
    gaps.push({
      id: "slop_fake_proof",
      category: "trust",
      severity: "CRITICAL",
      title: "Fake social proof / statistics",
      detail: "Fabricated trust signals are constitutionally forbidden.",
      evidence: ["fake_proof"],
      recommended_fix: "Remove entirely. Earn trust with real product demos and clear policies.",
      blocks_premium_bar: true,
    });
  }
  if (input.floatingCardCollage) {
    gaps.push({
      id: "slop_floating_cards",
      category: "design",
      severity: "MEDIUM",
      title: "Floating card collage aesthetic",
      detail: "Looks generated; weak hierarchy.",
      evidence: ["layout"],
      recommended_fix: "One composition; cards only for real interaction.",
      blocks_premium_bar: false,
    });
  }
  if (input.genericFeatureGridOnly) {
    gaps.push({
      id: "slop_feature_grid",
      category: "design",
      severity: "MEDIUM",
      title: "Generic feature-card grid as primary content",
      detail: "Does not demonstrate the product.",
      evidence: ["home_structure"],
      recommended_fix: "Show sample deliverables / walkthrough of the job.",
      blocks_premium_bar: false,
    });
  }
  return gaps;
}
