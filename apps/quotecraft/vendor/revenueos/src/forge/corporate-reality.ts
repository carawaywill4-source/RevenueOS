/**
 * Corporate Reality Standard — category-aware.
 * Goal: looks like a successful company in THIS category — not "expensive AI slop",
 * not a RevenueOS template, not a dropshipping store, not a generic AI startup.
 */

import type {
  CategoryDesignInference,
  CorporateRealityCheck,
  CorporateRealityResult,
  DerivedEconomicShape,
  EconomicOpportunity,
} from "./enterprise-types";
import type { ForgeGap } from "./types";

export function inferCategoryDesign(input: {
  opportunity: EconomicOpportunity;
  economics: DerivedEconomicShape;
}): CategoryDesignInference {
  const blob = [
    input.opportunity.problem,
    input.opportunity.buyer,
    input.opportunity.job_to_be_done,
    input.economics.revenue_mechanism,
    input.economics.customer_receives,
  ]
    .join(" ")
    .toLowerCase();

  if (/legal|contract|sow|document|compliance|policy/.test(blob)) {
    return {
      category: "professional_documents",
      buyer_psychology: "Risk-avoidant professionals who need legitimacy and clarity",
      trust_means: [
        "plain legal-adjacent seriousness",
        "transparent contents",
        "clear disclaimers",
        "no fake testimonials",
      ],
      premium_means: [
        "document-category typography",
        "restrained color",
        "precise copy",
        "obvious deliverable preview",
      ],
      anti_patterns: [
        "trendy AI startup gradients",
        "neon glow",
        "dropshipping energy",
        "fake dashboard screenshots",
      ],
      typography_direction: "Serif display + humanist sans; court/document calm",
      visual_hierarchy: "Brand + one promise + one deliverable proof; no card spam",
      not_a_template: true,
      reference_feeling:
        "A focused professional publisher — not JPMorgan, not a vibe-coded SaaS landing page",
    };
  }

  if (/saas|workflow|subscription|dashboard|property\s+manager|b2b/.test(blob)) {
    return {
      category: "b2b_workflow_software",
      buyer_psychology: "Operators buying time back; skeptical of onboarding friction",
      trust_means: [
        "clear workflow demo",
        "security posture",
        "pricing honesty",
        "implementation clarity",
      ],
      premium_means: [
        "product UI as hero truth",
        "crisp information architecture",
        "boring-in-a-good-way reliability cues",
      ],
      anti_patterns: [
        "dropshipping product grids",
        "consumer meme energy",
        "template marketplace look",
        "empty feature icon rows",
      ],
      typography_direction: "Neutral grotesque / product UI type; high legibility",
      visual_hierarchy: "Problem → product surface → proof of job done",
      not_a_template: true,
      reference_feeling:
        "A credible vertical SaaS — better onboarding than incumbents, not a PDF store",
    };
  }

  if (/api|developer|sdk|meter/.test(blob)) {
    return {
      category: "developer_tools",
      buyer_psychology: "Engineers trust docs, uptime, and precise claims",
      trust_means: ["excellent docs", "status honesty", "clear limits", "fast time-to-hello-world"],
      premium_means: ["monospace comfort", "dense but clear docs", "minimal chrome"],
      anti_patterns: ["lifestyle brand photography", "fake social proof counters", "enterprise purple haze"],
      typography_direction: "Technical sans + monospace for code",
      visual_hierarchy: "What it does → code sample → pricing",
      not_a_template: true,
      reference_feeling: "A sharp utility API company — Stripe/docs energy, not agency portfolio",
    };
  }

  if (/consumer|utility|\$1[0-9]\b|simple\s+tool/.test(blob)) {
    return {
      category: "consumer_utility",
      buyer_psychology: "Wants instant clarity and low commitment",
      trust_means: ["speed", "plain language", "obvious refund", "no dark patterns"],
      premium_means: ["delightful simplicity", "one job done well"],
      anti_patterns: ["JPMorgan gravitas", "enterprise nav forests", "fake Fortune-500 logos"],
      typography_direction: "Friendly but specific display; avoid Inter-default sameness",
      visual_hierarchy: "One action above the fold",
      not_a_template: true,
      reference_feeling: "A focused $19 utility — not a bank, not a VC-pitch theater",
    };
  }

  if (/membership|education|course|newsletter|media/.test(blob)) {
    return {
      category: "education_media",
      buyer_psychology: "Buys taste, curriculum clarity, and instructor credibility",
      trust_means: ["curriculum outline", "sample lesson", "instructor specificity"],
      premium_means: ["editorial craft", "coherent series design"],
      anti_patterns: ["get-rich-quick funnels", "fake scarcity timers", "SEO door farms"],
      typography_direction: "Editorial serif or distinctive display with calm body",
      visual_hierarchy: "Promise → curriculum → membership terms",
      not_a_template: true,
      reference_feeling: "An independent publisher/school — not a dropshipping theme",
    };
  }

  return {
    category: "general_commercial",
    buyer_psychology: "Needs category-appropriate trust before paying strangers online",
    trust_means: ["clear offer", "policies", "working checkout", "human support path"],
    premium_means: ["coherent brand system", "real product depth"],
    anti_patterns: ["RevenueOS template sameness", "AI startup clichés", "SEO shells"],
    typography_direction: "Category-derived; never default Inter/purple stack",
    visual_hierarchy: "One composition; brand-first; no card collage hero",
    not_a_template: true,
    reference_feeling:
      "A serious independent company appropriate to its market — better than most peers",
  };
}

export function evaluateCorporateReality(input: {
  businessId: string;
  opportunity: EconomicOpportunity;
  economics: DerivedEconomicShape;
  gaps?: ForgeGap[];
  signals?: {
    checkoutVerified?: boolean;
    fulfillmentVerified?: boolean;
    policiesPresent?: boolean;
    mobilePass?: boolean;
    analyticsPresent?: boolean;
    productDemoPresent?: boolean;
    customDomain?: boolean;
  };
}): CorporateRealityResult {
  const category_design = inferCategoryDesign({
    opportunity: input.opportunity,
    economics: input.economics,
  });
  const gaps = input.gaps ?? [];
  const s = input.signals ?? {};

  const checks: CorporateRealityCheck[] = [
    dim("brand_identity", !gaps.some((g) => g.category === "brand" && g.severity === "CRITICAL"), 0.8, category_design.reference_feeling),
    dim("visual_hierarchy", !gaps.some((g) => g.id.includes("hero") || g.category === "design" && g.severity === "CRITICAL"), 0.75, category_design.visual_hierarchy),
    dim("typography", !gaps.some((g) => g.id === "font_mismatch"), 0.8, category_design.typography_direction),
    dim("responsive_design", s.mobilePass !== false, 0.7, "mobile PASS required"),
    dim("copy", !gaps.some((g) => g.category === "anti_slop" || g.category === "copy") || gaps.filter((g) => g.category === "anti_slop" && g.blocks_premium_bar).length === 0, 0.7, "no AI sludge"),
    dim("product_depth", s.productDemoPresent !== false, 0.75, "actual usefulness / product contents visible"),
    dim("policies", s.policiesPresent !== false, 0.8, "privacy/terms/refunds"),
    dim("checkout_billing", s.checkoutVerified !== false, 0.9, "checkout verified"),
    dim("fulfillment", s.fulfillmentVerified !== false, 0.9, "fulfillment verified"),
    dim("analytics", s.analyticsPresent !== false, 0.7, "beacon/analytics present"),
    dim("category_fit", true, 0.85, `category=${category_design.category}`),
    dim("actual_usefulness", !gaps.some((g) => g.category === "jtbd" && g.blocks_premium_bar), 0.8, "JTBD clear"),
  ];

  // Anti-patterns as soft fails when gaps mention them
  for (const ap of category_design.anti_patterns) {
    const hit = gaps.some((g) => g.detail.toLowerCase().includes(ap.slice(0, 12).toLowerCase()));
    if (hit) {
      checks.push(dim("category_fit", false, 0.2, `anti_pattern:${ap}`));
    }
  }

  const blocking = checks.filter((c) => !c.pass && c.score < 0.5).map((c) => c.dimension);
  const avg =
    checks.reduce((a, c) => a + (c.pass ? c.score : c.score * 0.3), 0) / Math.max(checks.length, 1);

  const independent_company_test = {
    passed:
      blocking.length === 0 &&
      avg >= 0.7 &&
      s.checkoutVerified !== false &&
      s.fulfillmentVerified !== false,
    rationale: blocking.length
      ? `Fails independent-company test: ${blocking.join(", ")}`
      : s.customDomain === false
        ? "Mostly credible; custom domain debt remains (MEDIUM) — not automatic fail if otherwise professional"
        : "Would reasonably read as a professionally operated independent company in-category",
  };

  return {
    business_id: input.businessId,
    passed: independent_company_test.passed && blocking.length === 0,
    category_design,
    checks,
    independent_company_test,
    blocking,
  };
}

function dim(
  dimension: CorporateRealityCheck["dimension"],
  pass: boolean,
  score: number,
  detail: string,
): CorporateRealityCheck {
  return {
    dimension,
    pass,
    score,
    detail,
    evidence: [detail],
  };
}
