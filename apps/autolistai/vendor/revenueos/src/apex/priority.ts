/**
 * Global priority ≈ expected commercial value + VoI + urgency − cost − risk − opportunity cost.
 * Under insufficient evidence, acquisition actions dominate; product mutations are demoted.
 */

import type { BottleneckKind, DemandSignal, EvidenceLevel, LearningClock } from "./types";
import { inferRiskClass } from "./governor";
import { classifyActionClock } from "./learning-clocks";
import { trafficInsufficient } from "./evidence-sufficiency";

export type RankedAction = {
  action: string;
  channel: string;
  audience: string;
  expected_value: number;
  information_value: number;
  urgency: number;
  cost: number;
  risk_penalty: number;
  score: number;
  hypothesis: string;
  clock?: LearningClock;
};

const BOTTLENECK_ACTIONS: Record<BottleneckKind, RankedAction[]> = {
  NO_IMPRESSIONS: [
    {
      action: "publish_discovery_door",
      channel: "owned_seo",
      audience: "high_intent_search",
      expected_value: 0.55,
      information_value: 0.7,
      urgency: 0.8,
      cost: 0.15,
      risk_penalty: 0.05,
      score: 0,
      hypothesis:
        "Owned discovery doors can produce qualified visits without paid ads",
    },
    {
      action: "distribute_owned_urls",
      channel: "indexnow_sitemap",
      audience: "search_crawlers",
      expected_value: 0.4,
      information_value: 0.45,
      urgency: 0.7,
      cost: 0.05,
      risk_penalty: 0.02,
      score: 0,
      hypothesis: "Indexing owned URLs reduces discovery latency",
    },
    {
      action: "list_gumroad",
      channel: "gumroad",
      audience: "freelance_buyers",
      expected_value: 0.5,
      information_value: 0.6,
      urgency: 0.65,
      cost: 0.1,
      risk_penalty: 0.08,
      score: 0,
      hypothesis: "Marketplace listing reaches buyers already shopping for tools",
    },
  ],
  IMPRESSIONS_NO_CLICKS: [
    {
      action: "message_genome_test",
      channel: "owned_landing",
      audience: "existing_traffic",
      expected_value: 0.45,
      information_value: 0.75,
      urgency: 0.6,
      cost: 0.1,
      risk_penalty: 0.05,
      score: 0,
      hypothesis: "Customer-language headlines improve CTR on existing impressions",
    },
  ],
  CLICKS_NO_ENGAGEMENT: [
    {
      action: "offer_clarity_update",
      channel: "owned_landing",
      audience: "problem_aware_freelancers",
      expected_value: 0.5,
      information_value: 0.7,
      urgency: 0.65,
      cost: 0.12,
      risk_penalty: 0.05,
      score: 0,
      hypothesis: "Job-to-be-done framing reduces bounce after click",
    },
  ],
  ENGAGEMENT_NO_INTENT: [
    {
      action: "conversion_lab_cta",
      channel: "owned_landing",
      audience: "engaged_visitors",
      expected_value: 0.55,
      information_value: 0.65,
      urgency: 0.6,
      cost: 0.1,
      risk_penalty: 0.05,
      score: 0,
      hypothesis: "Clearer CTA path converts engagement to checkout intent",
    },
  ],
  INTENT_NO_CHECKOUT: [
    {
      action: "trust_signal_pack",
      channel: "owned_checkout",
      audience: "high_intent",
      expected_value: 0.6,
      information_value: 0.55,
      urgency: 0.7,
      cost: 0.1,
      risk_penalty: 0.05,
      score: 0,
      hypothesis: "Transparent pricing + refund policy reduces trust deficit",
    },
  ],
  CHECKOUT_NO_PURCHASE: [
    {
      action: "checkout_friction_audit",
      channel: "owned_checkout",
      audience: "checkout_starters",
      expected_value: 0.7,
      information_value: 0.8,
      urgency: 0.85,
      cost: 0.15,
      risk_penalty: 0.05,
      score: 0,
      hypothesis: "Technical/payment friction — not messaging — blocks purchase",
    },
  ],
  PURCHASE_NO_PROFIT: [
    {
      action: "unit_economics_review",
      channel: "internal",
      audience: "n/a",
      expected_value: 0.4,
      information_value: 0.9,
      urgency: 0.9,
      cost: 0.05,
      risk_penalty: 0,
      score: 0,
      hypothesis: "Contribution margin must be positive before scaling acquisition",
    },
  ],
  PROFIT_NO_SCALE: [
    {
      action: "scale_proven_channel",
      channel: "proven",
      audience: "lookalike_demand",
      expected_value: 0.75,
      information_value: 0.4,
      urgency: 0.7,
      cost: 0.2,
      risk_penalty: 0.1,
      score: 0,
      hypothesis: "Reproduce Success DNA on adjacent authorized channels",
    },
  ],
  UNKNOWN: [
    {
      action: "demand_radar_sweep",
      channel: "research",
      audience: "problem_cluster",
      expected_value: 0.35,
      information_value: 0.85,
      urgency: 0.5,
      cost: 0.1,
      risk_penalty: 0.02,
      score: 0,
      hypothesis: "Insufficient signal — gather demand evidence before heavy execution",
    },
  ],
};

export function scoreAction(a: RankedAction): number {
  const riskClass = inferRiskClass(a.action);
  const riskExtra =
    riskClass === "R3" || riskClass === "R4" ? 10 : a.risk_penalty;
  return (
    a.expected_value * 1.2 +
    a.information_value * 0.9 +
    a.urgency * 0.5 -
    a.cost -
    riskExtra
  );
}

/** Extra acquisition limbs forced when evidence is insufficient (do not wait). */
const ACQUISITION_SURGE: RankedAction[] = [
  {
    action: "publish_discovery_door",
    channel: "owned_seo",
    audience: "high_intent_search",
    expected_value: 0.6,
    information_value: 0.75,
    urgency: 0.95,
    cost: 0.15,
    risk_penalty: 0.05,
    score: 0,
    hypothesis: "Zero/low traffic hour → publish useful acquisition assets",
  },
  {
    action: "distribute_owned_urls",
    channel: "indexnow_sitemap",
    audience: "search_crawlers",
    expected_value: 0.45,
    information_value: 0.5,
    urgency: 0.9,
    cost: 0.05,
    risk_penalty: 0.02,
    score: 0,
    hypothesis: "Earn exposure via indexing; measure qualified landings",
  },
  {
    action: "list_gumroad",
    channel: "gumroad",
    audience: "freelance_buyers",
    expected_value: 0.55,
    information_value: 0.65,
    urgency: 0.85,
    cost: 0.1,
    risk_penalty: 0.08,
    score: 0,
    hypothesis: "Marketplace buyers already shopping for tools",
  },
  {
    action: "demand_radar_sweep",
    channel: "research",
    audience: "problem_cluster",
    expected_value: 0.4,
    information_value: 0.9,
    urgency: 0.8,
    cost: 0.1,
    risk_penalty: 0.02,
    score: 0,
    hypothesis: "Find where qualified demand naturally exists",
  },
];

export function rankActionsForBottleneck(input: {
  bottleneck: BottleneckKind;
  demand?: DemandSignal[];
  evidenceLevel?: EvidenceLevel;
  acquisitionUrgency?: "low" | "normal" | "high" | "critical";
}): RankedAction[] {
  const insufficient =
    input.evidenceLevel != null && trafficInsufficient(input.evidenceLevel);

  let base = (
    insufficient
      ? ACQUISITION_SURGE
      : (BOTTLENECK_ACTIONS[input.bottleneck] ?? BOTTLENECK_ACTIONS.UNKNOWN)
  ).map((a) => ({ ...a, clock: classifyActionClock(a.action) }));

  // When insufficient, still allow merging unique acquisition ideas from bottleneck list.
  if (insufficient) {
    const seen = new Set(base.map((a) => a.action));
    for (const a of BOTTLENECK_ACTIONS.NO_IMPRESSIONS) {
      if (!seen.has(a.action)) {
        base.push({ ...a, clock: classifyActionClock(a.action) });
        seen.add(a.action);
      }
    }
  }

  const topDemand = input.demand?.[0];
  if (topDemand) {
    for (const a of base) {
      a.audience = topDemand.persona || a.audience;
      a.expected_value += topDemand.commerciality * 0.1;
      a.information_value += topDemand.evidence_quality * 0.05;
    }
  }

  const urgencyBoost =
    input.acquisitionUrgency === "critical"
      ? 0.25
      : input.acquisitionUrgency === "high"
        ? 0.15
        : 0;

  for (const a of base) {
    a.clock = classifyActionClock(a.action);
    if (insufficient && a.clock === "SLOW_PRODUCT_CONVERSION") {
      a.score = -100; // demote — ExperimentGuard will block
      continue;
    }
    if (insufficient && a.clock === "FAST_ACQUISITION") {
      a.urgency = Math.min(1, a.urgency + urgencyBoost);
    }
    a.score = scoreAction(a);
  }
  return base.sort((x, y) => y.score - x.score);
}

/** Lean DemandRadar from observation notes / market signals. */
export function leanDemandSignals(input: {
  businessId: string;
  demandNotes?: string[];
  industry?: string;
}): DemandSignal[] {
  if (input.businessId === "scopeguard") {
    return [
      {
        problem: "unpaid scope expansion / scope creep",
        persona: "experienced freelancer",
        intent: "SOLUTION_AWARE",
        urgency: 0.7,
        recency: new Date().toISOString(),
        volume_estimate: 0.4,
        growth_rate: 0.1,
        commerciality: 0.65,
        competition: 0.55,
        accessibility: 0.6,
        evidence_quality: 0.45,
        cluster_id: "protect_freelancer_unpaid_expansion",
      },
    ];
  }
  const notes = input.demandNotes ?? [];
  if (!notes.length) return [];
  return [
    {
      problem: notes[0]!.slice(0, 120),
      persona: input.industry ?? "unknown",
      intent: "EXPLORING",
      urgency: 0.4,
      recency: new Date().toISOString(),
      volume_estimate: 0.2,
      growth_rate: 0,
      commerciality: 0.4,
      competition: 0.5,
      accessibility: 0.4,
      evidence_quality: 0.3,
    },
  ];
}
