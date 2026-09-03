/**
 * Living Market Graph:
 * problem → buyer → job → alternatives → competitors → demand → channel →
 * offer → business_model → economics → operational_requirements → opportunity
 */

import { newId } from "../ledger/store";
import type {
  DerivedEconomicShape,
  EconomicOpportunity,
  MarketGraph,
  MarketGraphEdge,
  MarketGraphNode,
} from "./enterprise-types";

function node(
  kind: MarketGraphNode["kind"],
  label: string,
  evidence: string[],
  confidence: number,
  meta?: Record<string, unknown>,
): MarketGraphNode {
  return {
    id: newId(`mg_${kind}`),
    kind,
    label,
    evidence,
    confidence,
    epistemic: confidence >= 0.8 ? "OBSERVATION" : "HYPOTHESIS",
    meta,
  };
}

export function buildMarketGraph(input: {
  opportunity: EconomicOpportunity;
  economics: DerivedEconomicShape;
  competitorNames?: string[];
}): MarketGraph {
  const opp = input.opportunity;
  const nodes: MarketGraphNode[] = [];
  const edges: MarketGraphEdge[] = [];

  const problem = node("problem", opp.problem, opp.signals.pain, opp.confidence);
  const buyer = node("buyer", opp.buyer, opp.signals.communities, opp.confidence);
  const job = node("job", opp.job_to_be_done, opp.signals.demand, opp.confidence);
  const demand = node(
    "demand",
    opp.signals.demand[0] ?? "demand unspecified",
    [...opp.signals.demand, ...opp.signals.search_behavior],
    Math.min(opp.confidence, 0.7),
  );
  const offer = node(
    "offer",
    opp.title,
    [...opp.signals.pricing, ...opp.signals.willingness_to_pay],
    opp.confidence,
  );
  const model = node(
    "business_model",
    input.economics.revenue_mechanism,
    input.economics.why_this_shape,
    0.65,
    { recurrence: input.economics.recurrence },
  );
  const economics = node(
    "economics",
    `margin≈${input.economics.estimated_contribution_margin}; automation=${input.economics.fulfillment_automation_pct}%`,
    opp.signals.margins,
    0.6,
  );
  const ops = node(
    "operational_requirement",
    input.economics.required_capabilities.join(", "),
    opp.signals.operational_complexity,
    0.7,
    { required: input.economics.required_capabilities },
  );
  const opportunity = node(
    "opportunity",
    opp.title,
    [...opp.signals.ros_operational_fit],
    opp.confidence,
    { opportunity_id: opp.opportunity_id },
  );

  nodes.push(problem, buyer, job, demand, offer, model, economics, ops, opportunity);

  const link = (from: MarketGraphNode, to: MarketGraphNode, relation: string, weight = 1) => {
    edges.push({ from: from.id, to: to.id, relation, weight });
  };

  link(problem, buyer, "hurts");
  link(buyer, job, "hires_for");
  link(job, demand, "expressed_as");
  link(demand, offer, "may_buy");
  link(offer, model, "monetized_via");
  link(model, economics, "implies");
  link(economics, ops, "requires");
  link(ops, opportunity, "enables_or_blocks");
  link(problem, opportunity, "grounds");

  for (const alt of opp.signals.competitors.slice(0, 5)) {
    const c = node("competitor", alt, opp.signals.reviews, 0.55);
    nodes.push(c);
    link(buyer, c, "currently_uses_or_considers");
    link(c, opportunity, "benchmark_for");
  }

  for (const name of input.competitorNames ?? []) {
    const c = node("competitor", name, [], 0.5);
    nodes.push(c);
    link(c, offer, "competes_with");
  }

  for (const ch of opp.signals.communities.slice(0, 4)) {
    const channel = node("channel", ch, opp.signals.distribution_difficulty, 0.5);
    nodes.push(channel);
    link(buyer, channel, "hangs_out_in");
    link(channel, demand, "surfaces");
  }

  for (const a of opp.signals.existing_spending.slice(0, 3)) {
    const alt = node("alternative", a, opp.signals.existing_spending, 0.55);
    nodes.push(alt);
    link(buyer, alt, "already_pays_for");
  }

  return {
    graph_id: newId("mgraph"),
    updated_at: new Date().toISOString(),
    nodes,
    edges,
  };
}
