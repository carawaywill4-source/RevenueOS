/**
 * PortfolioArchitect — evolve the RevenueOS portfolio.
 *
 * Extends the existing brain. Does NOT replace pursuit/plan/attribution.
 * Discovers → evaluates → incubates → launches → ranks → soft-retires.
 *
 * Safety defaults: zero autonomous spend, max 50 active, preserve all learning.
 */

import type { OperatorBusinessManifest } from "./operator-adapter";
import { getOpenAICapabilityStatus, callOpenAI, hasOpenAIKey, DEFAULT_MODELS } from "./openai-client";
import {
  evaluateReferenceProof,
  forgeStopCreatingNewBusinesses,
} from "../forge/reference-proof";

export type PortfolioLifecycle =
  | "idea"
  | "research"
  | "validated_hypothesis"
  | "incubating"
  | "launch_candidate"
  | "active"
  | "growing"
  | "needs_work"
  | "at_risk"
  | "retirement_candidate"
  | "soft_retired"
  | "archived";

export type PortfolioFitnessLabel =
  | "star"
  | "promising"
  | "experimental"
  | "needs_work"
  | "at_risk"
  | "retirement_candidate"
  | "retired";

export type PortfolioArchitectSafety = {
  maxActiveBusinesses: number;
  autonomousBusinessDiscovery: boolean;
  autonomousIncubation: boolean;
  autonomousZeroCostLaunch: boolean;
  autonomousSiteImprovement: boolean;
  autonomousSoftRetirement: boolean;
  autonomousPermanentSourceDeletion: boolean;
  autonomousSpending: boolean;
  autonomousPaidAds: boolean;
  autonomousDomainPurchase: boolean;
  preserveAllLearning: boolean;
  /** Prefer improving existing over spawning when true. */
  prioritizeExistingOverNew: boolean;
  stopCreatingNewBusinesses: boolean;
};

export const DEFAULT_ARCHITECT_SAFETY: PortfolioArchitectSafety = {
  maxActiveBusinesses: 50,
  autonomousBusinessDiscovery: true,
  autonomousIncubation: true,
  autonomousZeroCostLaunch: true,
  autonomousSiteImprovement: true,
  autonomousSoftRetirement: true,
  autonomousPermanentSourceDeletion: false,
  autonomousSpending: false,
  autonomousPaidAds: false,
  autonomousDomainPurchase: false,
  preserveAllLearning: true,
  prioritizeExistingOverNew: true,
  stopCreatingNewBusinesses: false,
};

export type OwnerPortfolioPolicy = {
  bannedMarkets: string[];
  requestedMarkets: string[];
  lockedSiteIds: string[];
  maxActiveBusinesses?: number;
  stopCreatingNewBusinesses?: boolean;
  prioritizeExistingOverNew?: boolean;
  /**
   * Owner final intervention: allow FORGE/architect creation even when
   * reference-proof stranger purchase is not yet observed.
   */
  allowCreationWithoutReferenceProof?: boolean;
  /** Marks that the 50-business reset was owner-authorized. */
  portfolioResetAuthorizedAt?: string;
  updatedAt: string;
};

export const DEFAULT_OWNER_PORTFOLIO_POLICY: OwnerPortfolioPolicy = {
  bannedMarkets: [],
  requestedMarkets: [],
  lockedSiteIds: [],
  updatedAt: new Date(0).toISOString(),
};

export type BusinessOpportunity = {
  id: string;
  title: string;
  siteId: string;
  displayName: string;
  industry: string;
  buyer: string;
  problem: string;
  productName: string;
  productDescription: string;
  bullets: string[];
  priceUsd: number;
  fulfillment: "digital_download";
  brandVoice: string;
  primaryColor: string;
  accentColor: string;
  fontDisplay: string;
  fontBody: string;
  intentKeywords: string[];
  acquisitionHypothesis: string;
  expectedEconomics: {
    marginEstimate: number;
    timeToFirstSaleDays: number;
    supportBurden: "low" | "medium";
    organicPotential: "low" | "medium" | "high";
  };
  evidence: string[];
  score: number;
  rejectReasons: string[];
  requiresOwnerSpend: boolean;
  ownerSpendNote?: string;
  lifecycle: PortfolioLifecycle;
  createdAt: string;
};

export type ActiveBusinessFitness = {
  siteId: string;
  label: PortfolioFitnessLabel;
  score: number;
  factors: Record<string, number>;
  ownerLocked: boolean;
  notes: string[];
};

export type RetirementDecision = {
  siteId: string;
  mode: "soft" | "archive";
  why: string;
  evidence: Record<string, unknown>;
  whatWasTried: string[];
  whatWasLearned: string[];
  replacementOpportunityId?: string;
  reversible: boolean;
  at: string;
};

export type PortfolioArchitectEvent = {
  at: string;
  kind: string;
  summary: string;
  siteId?: string;
};

export type PortfolioArchitectState = {
  safety: PortfolioArchitectSafety;
  ownerPolicy: OwnerPortfolioPolicy;
  opportunities: BusinessOpportunity[];
  fitness: ActiveBusinessFitness[];
  retirementDecisions: RetirementDecision[];
  launches: Array<{
    siteId: string;
    opportunityId: string;
    at: string;
    productionUrl?: string;
    reason: string;
  }>;
  events: PortfolioArchitectEvent[];
  updatedAt: string;
};

export type PortfolioArchitectInput = {
  activeSiteIds: string[];
  activeIndustries: string[];
  /** Lightweight commercial telemetry per site (zeros ok). */
  telemetry: Array<{
    siteId: string;
    purchases: number;
    revenueUsd: number;
    landingViews: number;
    checkoutStarts: number;
    ageDays: number;
    experimentCount: number;
    ownerLocked?: boolean;
    /**
     * When RevenueOS itself is broken for this business, Titan must not
     * commercially kill/retire — repair first, then evaluate commerce.
     */
    engineeringBlocked?: boolean;
  }>;
  portableLessonHints?: string[];
  safety?: Partial<PortfolioArchitectSafety>;
  ownerPolicy?: Partial<OwnerPortfolioPolicy>;
  /** Cap how many new opportunities to mint this cycle. */
  maxNewOpportunities?: number;
  /**
   * FORGE reference-proof inputs (ScopeGuard lab).
   * When absent, treated as unproven → FORGE constitution blocks new creation.
   */
  referenceProof?: {
    premium_bar_passed?: boolean;
    independent_company_test?: boolean;
    stranger_purchases?: number;
  };
};

const FORBIDDEN_MARKETS =
  /illegal|scam|counterfeit|fake testimonial|impersonat|spam|malware|spyware|weapon|gun|cannabis|controlled substance|gambling|porn|casino|crypto pump|unlicensed (legal|medical|financ)|phishing/i;

/** Deterministic opportunity priors grounded in digital/zero-spend structural advantages. */
const OPPORTUNITY_PRIORS: Array<Omit<BusinessOpportunity, "id" | "score" | "rejectReasons" | "lifecycle" | "createdAt" | "evidence">> = [
  {
    title: "Manager 1:1 & performance conversation pack",
    siteId: "oneononekit",
    displayName: "OneOnOneKit",
    industry: "people_ops_management",
    buyer: "first-time people managers who dread weekly 1:1s",
    problem: "Managers improvise 1:1s and miss coaching moments that later show up in attrition.",
    productName: "Manager 1:1 & Performance Pack",
    productDescription:
      "Ready-to-use 1:1 agendas, feedback scripts, and promotion-readiness checklists for new managers — instant digital download.",
    bullets: [
      "Weekly 1:1 agenda templates by role seniority",
      "Difficult feedback scripts that stay respectful",
      "Promotion / PIP readiness checklists",
      "Async update prompts for hybrid teams",
    ],
    priceUsd: 39,
    fulfillment: "digital_download",
    brandVoice: "calm, managerial, practical",
    primaryColor: "#1C2541",
    accentColor: "#5BC0BE",
    fontDisplay: "Fraunces",
    fontBody: "Source Sans 3",
    intentKeywords: [
      "manager 1:1 agenda template",
      "how to run a one on one meeting",
      "performance conversation script",
    ],
    acquisitionHypothesis:
      "Permissionless SEO on manager 1:1 intent + free agenda sample door → checkout for full pack.",
    expectedEconomics: {
      marginEstimate: 0.95,
      timeToFirstSaleDays: 21,
      supportBurden: "low",
      organicPotential: "high",
    },
    requiresOwnerSpend: false,
  },
  {
    title: "Freelance SOW & change-order pack",
    siteId: "scopeguard",
    displayName: "ScopeGuard",
    industry: "freelancer_contracts",
    buyer: "solo freelancers losing money to scope creep",
    problem: "Verbal project changes become unpaid work without a clean SOW/change-order habit.",
    productName: "Freelance SOW & Change-Order Pack",
    productDescription:
      "Plain-language statements of work, change-order forms, and kickoff checklists for freelancers — download instantly after purchase.",
    bullets: [
      "SOW templates for design, writing, and dev",
      "Change-order form that protects margin",
      "Kickoff questionnaire clients actually finish",
      "Late-payment reminder scripts",
    ],
    priceUsd: 45,
    fulfillment: "digital_download",
    brandVoice: "direct, protective, no-nonsense",
    primaryColor: "#2D1E2F",
    accentColor: "#E07A5F",
    fontDisplay: "Libre Baskerville",
    fontBody: "IBM Plex Sans",
    intentKeywords: [
      "freelance statement of work template",
      "scope creep change order",
      "freelancer contract template",
    ],
    acquisitionHypothesis:
      "High-intent SOW/change-order queries → comparison pages vs free Google Docs → paid pack.",
    expectedEconomics: {
      marginEstimate: 0.94,
      timeToFirstSaleDays: 18,
      supportBurden: "low",
      organicPotential: "high",
    },
    requiresOwnerSpend: false,
  },
  {
    title: "HOA board meeting & motion kit",
    siteId: "boardmotion",
    displayName: "BoardMotion",
    industry: "hoa_governance",
    buyer: "volunteer HOA board secretaries drowning in Robert's Rules",
    problem: "Volunteer boards run messy meetings and create liability with poorly documented motions.",
    productName: "HOA Board Meeting & Motion Kit",
    productDescription:
      "Agenda templates, motion language, and minutes checklists for HOA/condo boards — digital files, instant delivery.",
    bullets: [
      "Annual + monthly board agenda templates",
      "Motion and second language library",
      "Minutes checklist that survives disputes",
      "Owner-communication scripts",
    ],
    priceUsd: 49,
    fulfillment: "digital_download",
    brandVoice: "civic, clear, steady",
    primaryColor: "#1B3A4B",
    accentColor: "#D4A373",
    fontDisplay: "Cormorant Garamond",
    fontBody: "Nunito Sans",
    intentKeywords: [
      "hoa board meeting agenda template",
      "hoa motion wording",
      "condo board minutes template",
    ],
    acquisitionHypothesis:
      "Niche HOA secretary search + board facebook groups → sample motion page → kit purchase.",
    expectedEconomics: {
      marginEstimate: 0.95,
      timeToFirstSaleDays: 28,
      supportBurden: "low",
      organicPotential: "medium",
    },
    requiresOwnerSpend: false,
  },
  {
    title: "Podcast guest outreach pack",
    siteId: "guestlane",
    displayName: "GuestLane",
    industry: "creator_ops",
    buyer: "experts who want podcast guest slots but hate cold pitching",
    problem: "Generic pitch emails get ignored; guests need research-backed outreach templates.",
    productName: "Podcast Guest Outreach Pack",
    productDescription:
      "Research worksheets, pitch email templates, and follow-up sequences for landing podcast interviews — instant download.",
    bullets: [
      "Host research worksheet",
      "Pitch emails that reference recent episodes",
      "Follow-up cadence without spammy pressure",
      "Bio + talk-track prep sheet",
    ],
    priceUsd: 29,
    fulfillment: "digital_download",
    brandVoice: "warm, media-savvy, concise",
    primaryColor: "#241C15",
    accentColor: "#F4A261",
    fontDisplay: "Playfair Display",
    fontBody: "Lato",
    intentKeywords: [
      "podcast guest pitch template",
      "how to get on podcasts",
      "podcast outreach email",
    ],
    acquisitionHypothesis:
      "Creator SEO + free pitch example door → pack. Avoids paid guest-booking services.",
    expectedEconomics: {
      marginEstimate: 0.96,
      timeToFirstSaleDays: 20,
      supportBurden: "low",
      organicPotential: "high",
    },
    requiresOwnerSpend: false,
  },
  {
    title: "Nonprofit grant narrative starter kit",
    siteId: "grantframe",
    displayName: "GrantFrame",
    industry: "nonprofit_ops",
    buyer: "small nonprofit program managers writing their first grants",
    problem: "Grant narratives stall because teams lack a reusable evidence + impact structure.",
    productName: "Grant Narrative Starter Kit",
    productDescription:
      "Need/impact/budget narrative scaffolds and reviewer checklists for small nonprofits — digital delivery only.",
    bullets: [
      "Need statement scaffold with evidence prompts",
      "Impact measurement worksheet",
      "Budget narrative outline",
      "Reviewer rejection checklist",
    ],
    priceUsd: 59,
    fulfillment: "digital_download",
    brandVoice: "mission-forward, precise, hopeful",
    primaryColor: "#0F4C5C",
    accentColor: "#E36414",
    fontDisplay: "DM Serif Display",
    fontBody: "DM Sans",
    intentKeywords: [
      "nonprofit grant writing template",
      "grant narrative example",
      "how to write a need statement",
    ],
    acquisitionHypothesis:
      "Grant-writing intent pages + nonprofit communities → kit. No grant-writing license required (templates only).",
    expectedEconomics: {
      marginEstimate: 0.94,
      timeToFirstSaleDays: 30,
      supportBurden: "low",
      organicPotential: "medium",
    },
    requiresOwnerSpend: false,
  },
];

function slugifySiteId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function marketBanned(text: string, policy: OwnerPortfolioPolicy): boolean {
  if (FORBIDDEN_MARKETS.test(text)) return true;
  const hay = text.toLowerCase();
  return policy.bannedMarkets.some((m) => hay.includes(m.toLowerCase()));
}

export function scoreBusinessOpportunity(
  opp: Omit<BusinessOpportunity, "score" | "rejectReasons">,
  input: PortfolioArchitectInput,
): { score: number; rejectReasons: string[] } {
  const rejectReasons: string[] = [];
  const text = `${opp.title} ${opp.industry} ${opp.productDescription}`;
  const policy = { ...DEFAULT_OWNER_PORTFOLIO_POLICY, ...input.ownerPolicy };
  if (marketBanned(text, policy)) {
    rejectReasons.push("compliance_or_banned_market");
  }
  if (opp.fulfillment !== "digital_download") {
    rejectReasons.push("fulfillment_not_autonomous");
  }
  if (opp.requiresOwnerSpend) {
    rejectReasons.push("requires_owner_spend");
  }
  if (input.activeSiteIds.includes(opp.siteId)) {
    rejectReasons.push("site_already_active");
  }
  if (input.activeIndustries.includes(opp.industry)) {
    // Not a hard reject — soft penalty for crowded portfolio niche.
  }

  let score = 40;
  score += opp.expectedEconomics.marginEstimate * 25;
  score += opp.expectedEconomics.organicPotential === "high" ? 15 : opp.expectedEconomics.organicPotential === "medium" ? 8 : 2;
  score += opp.expectedEconomics.supportBurden === "low" ? 10 : 4;
  score += Math.max(0, 20 - opp.expectedEconomics.timeToFirstSaleDays * 0.4);
  score += Math.min(15, opp.priceUsd / 5);
  if (input.activeIndustries.includes(opp.industry)) score -= 18;
  if (policy.requestedMarkets.some((m) => text.toLowerCase().includes(m.toLowerCase()))) {
    score += 20;
  }
  const lessonBoost = (input.portableLessonHints ?? []).some((h) =>
    /digital|template|pack|intent|document|organic/i.test(h),
  );
  if (lessonBoost) score += 8;
  if (rejectReasons.length) score = Math.min(score, 5);

  return { score: Math.round(score * 10) / 10, rejectReasons };
}

export function scoreActiveFitness(
  row: PortfolioArchitectInput["telemetry"][number],
  ownerLocked: boolean,
): ActiveBusinessFitness {
  const factors = {
    realizedProfit: Math.min(40, row.revenueUsd),
    purchases: Math.min(20, row.purchases * 10),
    exposure: Math.min(15, row.landingViews / 20),
    checkout: Math.min(10, row.checkoutStarts * 2),
    evidence: Math.min(15, row.experimentCount / 50),
    agePenalty: row.ageDays < 14 ? -8 : 0,
  };
  const score = Object.values(factors).reduce((a, b) => a + b, 0);
  let label: PortfolioFitnessLabel = "experimental";
  if (row.purchases > 0 && row.revenueUsd > 0) label = row.revenueUsd >= 100 ? "star" : "promising";
  else if (row.landingViews > 50 && row.checkoutStarts === 0) label = "needs_work";
  else if (row.ageDays > 45 && row.purchases === 0 && row.experimentCount > 80) {
    label = "at_risk";
  }
  if (row.ageDays > 90 && row.purchases === 0 && row.experimentCount > 150) {
    label = "retirement_candidate";
  }
  const notes: string[] = [];
  if (row.ageDays < 21) notes.push("Insufficient evidence — too young to retire");
  if (ownerLocked) notes.push("Owner locked — cannot autonomous retire");
  return { siteId: row.siteId, label, score, factors, ownerLocked, notes };
}

export function evaluateRetirement(input: {
  fitness: ActiveBusinessFitness;
  telemetry: PortfolioArchitectInput["telemetry"][number];
  safety: PortfolioArchitectSafety;
}): RetirementDecision | null {
  if (!input.safety.autonomousSoftRetirement) return null;
  if (input.fitness.ownerLocked) return null;
  if (input.fitness.label !== "retirement_candidate" && input.fitness.label !== "at_risk") {
    return null;
  }
  // Reluctant kill: require age + experiments + zero purchases.
  if (input.telemetry.ageDays < 60) return null;
  if (input.telemetry.experimentCount < 120) return null;
  if (input.telemetry.purchases > 0) return null;
  if (input.fitness.label !== "retirement_candidate") return null;

  return {
    siteId: input.fitness.siteId,
    mode: "soft",
    why: "Conclusively weak expected value after substantial autonomous testing with zero purchases",
    evidence: {
      ageDays: input.telemetry.ageDays,
      experiments: input.telemetry.experimentCount,
      purchases: input.telemetry.purchases,
      revenueUsd: input.telemetry.revenueUsd,
      landingViews: input.telemetry.landingViews,
      fitness: input.fitness.label,
    },
    whatWasTried: ["permissionless acquisition", "publish/discovery limbs", "portfolio exploration budget"],
    whatWasLearned: [
      "Preserve failure evidence — do not erase experiments",
      "Slot should be released only after soft retirement cooling",
    ],
    reversible: true,
    at: new Date().toISOString(),
  };
}

export function discoverOpportunities(
  input: PortfolioArchitectInput,
): BusinessOpportunity[] {
  const safety = { ...DEFAULT_ARCHITECT_SAFETY, ...input.safety };
  const policy = { ...DEFAULT_OWNER_PORTFOLIO_POLICY, ...input.ownerPolicy };
  const forgeProof = evaluateReferenceProof({
    premium_bar_passed: input.referenceProof?.premium_bar_passed ?? false,
    independent_company_test: input.referenceProof?.independent_company_test ?? false,
    stranger_purchases: input.referenceProof?.stranger_purchases ?? 0,
  });
  if (
    forgeStopCreatingNewBusinesses(forgeProof) &&
    !policy.allowCreationWithoutReferenceProof
  ) {
    return [];
  }
  if (!safety.autonomousBusinessDiscovery || policy.stopCreatingNewBusinesses || safety.stopCreatingNewBusinesses) {
    return [];
  }
  const now = new Date().toISOString();
  const max = input.maxNewOpportunities ?? 8;
  const out: BusinessOpportunity[] = [];
  for (const prior of OPPORTUNITY_PRIORS) {
    if (out.length >= max) break;
    const base = {
      ...prior,
      id: `opp_${prior.siteId}`,
      evidence: [
        "Structural prior: digital delivery, high margin, organic intent keywords",
        `Portfolio gap check vs industries: ${input.activeIndustries.join(",") || "(none)"}`,
        ...(input.portableLessonHints ?? []).slice(0, 3),
      ],
      lifecycle: "research" as const,
      createdAt: now,
      score: 0,
      rejectReasons: [] as string[],
    };
    const { score, rejectReasons } = scoreBusinessOpportunity(base, input);
    out.push({ ...base, score, rejectReasons, lifecycle: rejectReasons.length ? "idea" : "validated_hypothesis" });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

export async function enrichOpportunitiesWithModel(
  opportunities: BusinessOpportunity[],
): Promise<BusinessOpportunity[]> {
  const cap = getOpenAICapabilityStatus();
  if (cap.status !== "ok" || !hasOpenAIKey() || opportunities.length === 0) {
    return opportunities;
  }
  const top = opportunities.slice(0, 5);
  const result = await callOpenAI<{ rankings: Array<{ siteId: string; delta: number; note: string }> }>({
    model: DEFAULT_MODELS.cheap,
    messages: [
      {
        role: "system",
        content:
          "You are PortfolioArchitect for RevenueOS. Rank digital product opportunities for zero-spend organic acquisition. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Adjust scores (-15..+15) for long-term fulfillable profit potential",
          opportunities: top.map((o) => ({
            siteId: o.siteId,
            buyer: o.buyer,
            product: o.productName,
            priceUsd: o.priceUsd,
            industry: o.industry,
            hypothesis: o.acquisitionHypothesis,
          })),
        }),
      },
    ],
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        rankings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              siteId: { type: "string" },
              delta: { type: "number" },
              note: { type: "string" },
            },
            required: ["siteId", "delta", "note"],
          },
        },
      },
      required: ["rankings"],
    },
    temperature: 0.3,
    maxOutputTokens: 600,
    justification: {
      scope: "portfolio",
      subsystem: "portfolio-architect",
      purpose: "experiment_selection",
      reason: "candidate business creation / portfolio opportunity ranking",
      priority: 5,
      stateHash: top.map((o) => `${o.siteId}:${o.productName}:${o.priceUsd}`).join("|"),
    },
  });
  if (!result.ok) return opportunities;
  const map = new Map(result.data.rankings.map((r) => [r.siteId, r]));
  return opportunities
    .map((o) => {
      const adj = map.get(o.siteId);
      if (!adj) return o;
      return {
        ...o,
        score: o.score + Math.max(-15, Math.min(15, adj.delta)),
        evidence: [...o.evidence, `model_note: ${adj.note}`],
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectLaunchCandidate(input: {
  opportunities: BusinessOpportunity[];
  activeCount: number;
  safety: PortfolioArchitectSafety;
  ownerPolicy: OwnerPortfolioPolicy;
}): BusinessOpportunity | null {
  const safety = input.safety;
  const policy = input.ownerPolicy;
  if (safety.stopCreatingNewBusinesses || policy.stopCreatingNewBusinesses) return null;
  if (!safety.autonomousZeroCostLaunch || !safety.autonomousIncubation) return null;
  const max = policy.maxActiveBusinesses ?? safety.maxActiveBusinesses;
  if (input.activeCount >= max) return null;
  // Prefer improving existing: require strong score threshold when portfolio already nonempty.
  const threshold = input.activeCount >= 8 && safety.prioritizeExistingOverNew ? 62 : 50;
  const eligible = input.opportunities.filter(
    (o) =>
      o.rejectReasons.length === 0 &&
      !o.requiresOwnerSpend &&
      o.score >= threshold &&
      (o.lifecycle === "validated_hypothesis" ||
        o.lifecycle === "incubating" ||
        o.lifecycle === "launch_candidate"),
  );
  return eligible[0] ?? null;
}

export function opportunityToManifest(
  opp: BusinessOpportunity,
  appUrl: string,
  sequenceIndex: number,
): OperatorBusinessManifest {
  return {
    siteId: opp.siteId,
    displayName: opp.displayName,
    industry: opp.industry,
    brandVoice: opp.brandVoice,
    appUrl,
    product: {
      id: `${opp.siteId}-pack`,
      name: opp.productName,
      priceUsd: opp.priceUsd,
      marginEstimate: opp.expectedEconomics.marginEstimate,
      audience: opp.buyer,
    },
    businessModel: "digital_product",
    priceBand: opp.priceUsd < 20 ? "low" : opp.priceUsd < 50 ? "mid" : "mid",
    considerationLevel: "medium",
    sequenceIndex,
  };
}

export function runPortfolioArchitectCycle(
  input: PortfolioArchitectInput,
): {
  statePatch: Partial<PortfolioArchitectState>;
  launchCandidate: BusinessOpportunity | null;
  fitness: ActiveBusinessFitness[];
  retirementCandidates: RetirementDecision[];
  topAlternatives: BusinessOpportunity[];
} {
  const safety = { ...DEFAULT_ARCHITECT_SAFETY, ...input.safety };
  const ownerPolicy = { ...DEFAULT_OWNER_PORTFOLIO_POLICY, ...input.ownerPolicy };
  const fitness = input.telemetry.map((t) =>
    scoreActiveFitness(
      t,
      Boolean(t.ownerLocked) ||
        Boolean(t.engineeringBlocked) ||
        ownerPolicy.lockedSiteIds.includes(t.siteId),
    ),
  );
  const retirementCandidates = fitness
    .map((f) => {
      const tel = input.telemetry.find((t) => t.siteId === f.siteId)!;
      return evaluateRetirement({ fitness: f, telemetry: tel, safety });
    })
    .filter(Boolean) as RetirementDecision[];

  let opportunities = discoverOpportunities(input);
  // Mark incubating for top non-rejected
  opportunities = opportunities.map((o, i) =>
    o.rejectReasons.length === 0 && i < 3
      ? { ...o, lifecycle: "incubating" as const }
      : o,
  );

  const launchCandidate = selectLaunchCandidate({
    opportunities,
    activeCount: input.activeSiteIds.length,
    safety,
    ownerPolicy,
  });
  if (launchCandidate) {
    launchCandidate.lifecycle = "launch_candidate";
  }

  const events: PortfolioArchitectEvent[] = [
    {
      at: new Date().toISOString(),
      kind: "architect_cycle",
      summary: `Evaluated ${opportunities.length} opportunities; active=${input.activeSiteIds.length}; launchCandidate=${launchCandidate?.siteId ?? "none"}`,
    },
  ];
  if (launchCandidate) {
    events.push({
      at: new Date().toISOString(),
      kind: "launch_candidate_selected",
      summary: `Selected ${launchCandidate.displayName} (score ${launchCandidate.score}) — ${launchCandidate.acquisitionHypothesis}`,
      siteId: launchCandidate.siteId,
    });
  }

  return {
    statePatch: {
      safety,
      ownerPolicy,
      opportunities,
      fitness,
      retirementDecisions: retirementCandidates,
      events,
      updatedAt: new Date().toISOString(),
    },
    launchCandidate,
    fitness,
    retirementCandidates,
    topAlternatives: opportunities.filter((o) => o.siteId !== launchCandidate?.siteId).slice(0, 10),
  };
}

export function ensureUniqueSiteId(desired: string, taken: string[]): string {
  let id = slugifySiteId(desired) || `biz${Date.now().toString(36)}`;
  if (!taken.includes(id)) return id;
  let n = 2;
  while (taken.includes(`${id}${n}`)) n += 1;
  return `${id}${n}`;
}
