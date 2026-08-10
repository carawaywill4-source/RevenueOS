/**
 * Hypothetical economic opportunities for architecture proof.
 * Demonstrate multiple models WITHOUT launching Business #12.
 * ScopeGuard remains the reference lab business.
 */

import type { CompetitorProfile, EconomicOpportunity } from "./enterprise-types";
import { evaluateEconomicOpportunity } from "./universal-engine";
import type { OpportunityEvaluation } from "./enterprise-types";

export function scopeGuardOpportunity(): {
  opportunity: EconomicOpportunity;
  competitors: Array<Partial<CompetitorProfile> & { name: string }>;
} {
  return {
    opportunity: {
      opportunity_id: "opp_scopeguard",
      title: "ScopeGuard — freelance scope-creep protection pack",
      problem: "Unpaid scope expansion erodes freelancer margins",
      buyer: "Experienced freelancers and small agencies",
      job_to_be_done:
        "Establish professional boundaries and get paid when project scope expands",
      reference_label: "scopeguard_digital_pack",
      evidence_grade: "OBSERVATION",
      confidence: 0.72,
      signals: {
        demand: [
          "High-intent searches for SOW templates and change orders",
          "Freelancer communities repeatedly discuss scope creep",
        ],
        pain: [
          "Verbal client changes become unpaid work",
          "Generic contracts feel awkward to send mid-project",
        ],
        existing_spending: [
          "Customers already buy contract template packs online",
          "LegalZoom/adjacent doc tools see category spend",
        ],
        willingness_to_pay: ["$29–$79 one-time packs common in category"],
        market_growth: ["Independent work remains large addressable base"],
        competitors: [
          "Generic contract template marketplaces",
          "Broad freelance admin suites",
        ],
        reviews: ["Template sites rated useful but generic"],
        complaints: [
          "Generic templates ignore scope-creep moments",
          "Weak UX for change-order workflow",
          "Too legalistic or too vague",
        ],
        search_behavior: ["sow template freelancer", "change order template"],
        communities: ["r/freelance", "Indie Hackers", "agency Slack groups"],
        pricing: ["$45 initial product viable"],
        margins: ["Digital delivery → high contribution margin"],
        distribution_difficulty: [
          "Organic/community viable; APEX has several acquisition routes",
        ],
        operational_complexity: ["Instant download after Stripe — fully automatable"],
        regulatory: ["Informational documents; not attorney-client advice"],
        defensibility: ["Niche JTBD + workflow-specific docs; brand trust"],
        ros_operational_fit: [
          "Stripe checkout + digital file delivery already verified on ScopeGuard",
        ],
      },
    },
    competitors: [
      {
        name: "Generic template marketplace",
        sells: "Broad contract templates",
        buyers: "Anyone needing a contract",
        why_customers_choose: ["SEO presence", "large catalog"],
        why_customers_leave: ["Generic", "not built for mid-project scope changes"],
        pricing: "$20–$60 packs",
        positioning: "Everything templates",
        distribution: ["SEO", "marketplaces"],
        seo_footprint: "strong",
        features: ["many templates"],
        trust_signals: ["volume"],
        brand_quality: "commodity",
        onboarding: "download and edit",
        sales_process: "self-serve",
        retention: [],
        reviews_summary: "Fine but generic",
        complaints: ["Weak UX for change orders", "Not freelancer-specific"],
        missing_capabilities: ["scope-creep workflow", "agency framing"],
        switching_costs: "low",
        moat: "SEO catalog",
        weaknesses: ["generic", "weak UX", "no JTBD focus on unpaid scope"],
        recent_changes: [],
        evidence: ["category reviews", "template sameness"],
        confidence: 0.7,
      },
    ],
  };
}

/** Recurring vertical workflow — must NOT be forced into a PDF pack. */
export function propertyManagerWorkflowOpportunity(): EconomicOpportunity {
  return {
    opportunity_id: "opp_pm_workflow",
    title: "Property-manager recurring ops workflow",
    problem: "Small property managers repeatedly perform fragmented manual ops (X)",
    buyer: "Small residential property managers",
    job_to_be_done: "Automate repeating coordination workflow end-to-end",
    evidence_grade: "HYPOTHESIS",
    confidence: 0.55,
    signals: {
      demand: ["Managers spend hours weekly on repetitive coordination"],
      pain: ["Terrible onboarding on incumbent SaaS", "Spreadsheet chaos"],
      existing_spending: ["Existing SaaS costs ~$149/month"],
      willingness_to_pay: ["$99–$149/mo already in market"],
      market_growth: ["SMB property tech expanding"],
      competitors: ["Legacy PM suites with weak onboarding"],
      reviews: ["App store/G2 complaints about complexity"],
      complaints: ["Onboarding takes weeks", "UI dated", "overbuilt for small portfolios"],
      search_behavior: ["property manager software small portfolio"],
      communities: ["BiggerPockets forums", "PM Facebook groups"],
      pricing: ["$149/mo incumbents"],
      margins: ["SaaS margins attractive if support controlled"],
      distribution_difficulty: ["Content + community; sales-assisted possible"],
      operational_complexity: ["RevenueOS can automate ~90% of workflow if product built"],
      regulatory: ["Tenant data handling — medium"],
      defensibility: ["Workflow depth + switching costs once data imported"],
      ros_operational_fit: [
        "Requires SaaS accounts + subscriptions — partial limbs today",
      ],
    },
  };
}

export function developerApiUtilityOpportunity(): EconomicOpportunity {
  return {
    opportunity_id: "opp_dev_api",
    title: "Niche developer API utility",
    problem: "Developers stitch fragile scripts for a narrow data/transform job",
    buyer: "Indie developers and small product teams",
    job_to_be_done: "Call a reliable API that performs the job with clear limits",
    evidence_grade: "HYPOTHESIS",
    confidence: 0.5,
    signals: {
      demand: ["Stack Overflow / Discord questions about the job"],
      pain: ["Brittle open-source scripts", "no SLA"],
      existing_spending: ["Teams already pay for adjacent APIs"],
      willingness_to_pay: ["usage-based $20–$200/mo"],
      market_growth: ["API economy"],
      competitors: ["Generic iPaaS", "DIY scripts"],
      reviews: ["iPaaS overkill"],
      complaints: ["Pricing opaque", "too complex for one job"],
      search_behavior: ["api for X transform"],
      communities: ["HN", "dev Twitter/Discord"],
      pricing: ["usage tiers"],
      margins: ["High if infra controlled"],
      distribution_difficulty: ["Docs + examples; developer content"],
      operational_complexity: ["Needs metering + API keys"],
      regulatory: ["low if non-PII"],
      defensibility: ["reliability + docs"],
      ros_operational_fit: ["usage_metering unavailable — UNFIT until limb exists"],
    },
  };
}

export function physicalGoodsTrapOpportunity(): EconomicOpportunity {
  return {
    opportunity_id: "opp_physical_trap",
    title: "Trendy physical merchandise pack",
    problem: "Creators want merch",
    buyer: "Creators",
    job_to_be_done: "Sell and ship merch",
    evidence_grade: "BELIEF",
    confidence: 0.3,
    signals: {
      demand: ["Merch is popular"],
      pain: ["Fulfillment hassle"],
      existing_spending: ["Print-on-demand platforms"],
      willingness_to_pay: ["varies"],
      market_growth: ["crowded"],
      competitors: ["Printful", "Shopify POD"],
      reviews: ["saturated"],
      complaints: ["margins thin"],
      search_behavior: ["print on demand"],
      communities: ["creator twitter"],
      pricing: ["low margin"],
      margins: ["thin after shipping"],
      distribution_difficulty: ["ads-heavy category"],
      operational_complexity: ["warehouse/shipping"],
      regulatory: ["consumer goods"],
      defensibility: ["none"],
      ros_operational_fit: ["physical_fulfillment unavailable"],
    },
  };
}

export function brandingOnlyMeTooOpportunity(): EconomicOpportunity {
  return {
    opportunity_id: "opp_metoo",
    title: "AI rebrand of generic freelance contracts",
    problem: "Freelancers need contracts",
    buyer: "Freelancers",
    job_to_be_done: "Get a contract",
    evidence_grade: "BELIEF",
    confidence: 0.4,
    signals: {
      demand: ["contracts exist"],
      pain: [],
      existing_spending: [],
      willingness_to_pay: [],
      market_growth: [],
      competitors: ["same as everyone"],
      reviews: [],
      complaints: [],
      search_behavior: [],
      communities: [],
      pricing: ["cheaper than Competitor X"],
      margins: ["digital"],
      distribution_difficulty: [],
      operational_complexity: ["pdf download"],
      regulatory: [],
      defensibility: ["better branding and AI-generated copy"],
      ros_operational_fit: ["digital download possible"],
    },
  };
}

export function evaluateHypotheticalPortfolio(): OpportunityEvaluation[] {
  const sg = scopeGuardOpportunity();
  return [
    evaluateEconomicOpportunity({
      opportunity: sg.opportunity,
      competitors: sg.competitors,
      stop_new_builds: true,
      // Reference lab may continue operate path conceptually
      launched: true,
      corporate_reality_passed: true,
    }),
    evaluateEconomicOpportunity({
      opportunity: propertyManagerWorkflowOpportunity(),
      stop_new_builds: true,
    }),
    evaluateEconomicOpportunity({
      opportunity: developerApiUtilityOpportunity(),
      stop_new_builds: true,
    }),
    evaluateEconomicOpportunity({
      opportunity: physicalGoodsTrapOpportunity(),
      stop_new_builds: true,
    }),
    evaluateEconomicOpportunity({
      opportunity: brandingOnlyMeTooOpportunity(),
      stop_new_builds: true,
    }),
  ];
}
