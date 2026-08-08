import type { CommercialContext, Lesson } from "../types";

/**
 * Similarity-aware lesson application + negative-transfer guards.
 * Question: under what commercial conditions did this work, and how similar
 * is that to the present opportunity?
 */

const HARD_INDUSTRY_BLOCKS: Record<string, string[]> = {
  // Death-care priors must not steer freelancer tools, etc.
  "death-care": [
    "freelancer-finance",
    "career-tools",
    "career-software",
    "maker-ecommerce",
    "retail-ops",
    "trades-ops",
    "short-term-rental",
    "landlord-ops",
    "indie-saas-tools",
    "local-commerce-tools",
  ],
  funeral: [
    "freelancer-finance",
    "career-tools",
    "career-software",
    "maker-ecommerce",
  ],
};

export function commercialSimilarity(
  a: CommercialContext | undefined,
  b: CommercialContext | undefined,
): number {
  if (!a || !b) return 0.35;
  let score = 0;
  let weight = 0;
  const pairs: Array<[keyof CommercialContext, number]> = [
    ["businessModel", 1.2],
    ["industry", 1.5],
    ["audience", 1],
    ["priceBand", 0.9],
    ["considerationLevel", 0.8],
    ["channel", 0.7],
  ];
  for (const [key, w] of pairs) {
    weight += w;
    const av = a[key];
    const bv = b[key];
    if (av && bv && av === bv) score += w;
    else if (av && bv) score += w * 0.15;
  }
  return weight > 0 ? score / weight : 0.35;
}

/** True when applying lesson from A onto business B would be harmful. */
export function isNegativeTransfer(
  lessonIndustry: string | undefined,
  targetIndustry: string | undefined,
): boolean {
  if (!lessonIndustry || !targetIndustry) return false;
  const blocked = HARD_INDUSTRY_BLOCKS[lessonIndustry.toLowerCase()];
  if (blocked?.includes(targetIndustry.toLowerCase())) return true;
  // Soft block: fashion/physical ecommerce lessons ↔ pure digital kits
  if (
    lessonIndustry.includes("fashion") &&
    targetIndustry.includes("freelancer")
  ) {
    return true;
  }
  return false;
}

export function filterTransferableLessons(input: {
  lessons: Lesson[];
  target: CommercialContext & { industry?: string; siteId?: string };
}): Lesson[] {
  return input.lessons.filter((lesson) => {
    if (
      isNegativeTransfer(
        lesson.industry ?? lesson.commercial?.industry,
        input.target.industry,
      )
    ) {
      return false;
    }
    if (lesson.scope === "site" || lesson.scope === "business") {
      return lesson.siteId === input.target.siteId;
    }
    const sim = commercialSimilarity(lesson.commercial, input.target);
    // Keep broad global lessons; require moderate similarity for mid scopes.
    if (
      lesson.scope === "business_model" ||
      lesson.scope === "price_band" ||
      lesson.scope === "consideration"
    ) {
      return sim >= 0.35;
    }
    if (lesson.scope === "industry" || lesson.scope === "audience") {
      return sim >= 0.4 || lesson.industry === input.target.industry;
    }
    return true;
  });
}

/** Ranking weight adjusted by similarity (and cut for negative transfer). */
export function transferWeight(
  lesson: Lesson,
  target: CommercialContext & { industry?: string },
): number {
  if (
    isNegativeTransfer(
      lesson.industry ?? lesson.commercial?.industry,
      target.industry,
    )
  ) {
    return 0;
  }
  const base = lesson.rankingWeight ?? 1;
  const sim = commercialSimilarity(lesson.commercial, target);
  return Number((base * (0.5 + sim)).toFixed(3));
}
