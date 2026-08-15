import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FORGE_CONSTITUTION, FORGE_OPERATING_CONSTRAINT_QUESTION } from "./constitution";
import { evaluateEconomicOpportunity } from "./universal-engine";
import {
  evaluateHypotheticalPortfolio,
  scopeGuardOpportunity,
  propertyManagerWorkflowOpportunity,
  developerApiUtilityOpportunity,
  physicalGoodsTrapOpportunity,
  brandingOnlyMeTooOpportunity,
} from "./hypotheticals";
import { deriveEconomicShape } from "./derive-economics";
import { assessOperationalFit } from "./operational-capabilities";
import { evaluateDeserveToExist } from "./deserve-to-exist";
import { buildCompetitorProfiles } from "./competitive-intelligence";
import { inferCategoryDesign, evaluateCorporateReality } from "./corporate-reality";
import { mayRecommendRetirement } from "./lifecycle";
import { evaluateReferenceProof, forgeStopCreatingNewBusinesses } from "./reference-proof";
import {
  FORGE_EVIDENCE_CONTRACT,
  apexEvidenceAllowsProductMutation,
  forgeConfidenceVsMarket,
  forgeInvestigationFromApex,
} from "./evidence-contracts";
import { genomeFromOpportunityEvaluation } from "./genome";
import { discoverOpportunities } from "../modules/portfolio-architect";
import { evaluateAdmission, buildTenKArchitecture } from "./admission";

test("FORGE constitution is capability-driven company intelligence", () => {
  assert.equal(DEFAULT_FORGE_CONSTITUTION.forbidBusinessTypeTemplateFactory, true);
  assert.equal(DEFAULT_FORGE_CONSTITUTION.requireDeserveToExistEvidence, true);
  assert.equal(DEFAULT_FORGE_CONSTITUTION.stopNewBusinessesUntilReferenceProof, true);
  assert.match(FORGE_OPERATING_CONSTRAINT_QUESTION, /end-to-end/);
});

test("ScopeGuard opportunity deserves existence and derives digital delivery — not a type enum", () => {
  const sg = scopeGuardOpportunity();
  const ev = evaluateEconomicOpportunity({
    opportunity: sg.opportunity,
    competitors: sg.competitors,
    stop_new_builds: true,
    launched: true,
    corporate_reality_passed: true,
  });
  assert.equal(ev.deserve.deserves, true);
  assert.ok(
    ev.deserve.differentiation_quality === "meaningful" ||
      ev.deserve.differentiation_quality === "structural",
  );
  assert.equal(ev.derived_economics.recurrence, "one_time");
  assert.match(ev.derived_economics.revenue_mechanism, /digital/i);
  assert.equal(ev.operational_fit.fit, "FIT");
  assert.equal(ev.decision, "OPERATE");
  assert.equal(ev.category_design.category, "professional_documents");
  assert.equal(ev.category_design.not_a_template, true);
  assert.ok(ev.market_graph.nodes.length >= 8);
});

test("Property-manager workflow derives recurring SaaS — not forced into PDF pack", () => {
  const shape = deriveEconomicShape(propertyManagerWorkflowOpportunity());
  assert.equal(shape.recurrence, "recurring");
  assert.match(shape.revenue_mechanism, /SaaS|Recurring|membership/i);
  assert.ok(!/pdf pack|force/i.test(shape.revenue_mechanism));
  const fit = assessOperationalFit(shape);
  assert.ok(fit.fit === "PARTIAL" || fit.fit === "FIT");
  const design = inferCategoryDesign({
    opportunity: propertyManagerWorkflowOpportunity(),
    economics: shape,
  });
  assert.equal(design.category, "b2b_workflow_software");
});

test("Developer API without metering is UNFIT — DO NOT BUILD", () => {
  const ev = evaluateEconomicOpportunity({
    opportunity: developerApiUtilityOpportunity(),
    stop_new_builds: true,
  });
  assert.equal(ev.operational_fit.fit, "UNFIT");
  assert.ok(ev.operational_fit.missing.includes("usage_metering"));
  assert.equal(ev.decision, "DO_NOT_BUILD");
});

test("Physical goods trap is UNFIT", () => {
  const ev = evaluateEconomicOpportunity({
    opportunity: physicalGoodsTrapOpportunity(),
    stop_new_builds: true,
  });
  assert.equal(ev.operational_fit.fit, "UNFIT");
  assert.equal(ev.decision, "DO_NOT_BUILD");
});

test("Branding-only me-too fails deserve-to-exist", () => {
  const opp = brandingOnlyMeTooOpportunity();
  const shape = deriveEconomicShape(opp);
  const fit = assessOperationalFit(shape);
  const deserve = evaluateDeserveToExist({
    opportunity: opp,
    competitors: buildCompetitorProfiles(opp),
    operational_fit: fit,
  });
  assert.equal(deserve.deserves, false);
  assert.ok(
    deserve.differentiation_quality === "none" ||
      deserve.differentiation_quality === "superficial",
  );
});

test("Hypothetical portfolio proves multiple economic models without launching #12", () => {
  const rows = evaluateHypotheticalPortfolio();
  assert.ok(rows.length >= 5);
  const decisions = new Set(rows.map((r) => r.decision));
  assert.ok(decisions.has("OPERATE") || decisions.has("DO_NOT_BUILD"));
  // At least one non-digital-pack derived recurrence among hypothetics
  assert.ok(rows.some((r) => r.derived_economics.recurrence === "recurring"));
  assert.ok(rows.some((r) => r.derived_economics.recurrence === "usage"));
  assert.ok(rows.some((r) => r.decision === "DO_NOT_BUILD"));
  // No new business launch decision while reference stop active
  assert.ok(!rows.some((r) => r.decision === "LAUNCH" && r.opportunity.reference_label !== "scopeguard_digital_pack"));
});

test("Corporate Reality Standard category-aware for ScopeGuard", () => {
  const sg = scopeGuardOpportunity();
  const shape = deriveEconomicShape(sg.opportunity);
  const reality = evaluateCorporateReality({
    businessId: "scopeguard",
    opportunity: sg.opportunity,
    economics: shape,
    signals: {
      checkoutVerified: true,
      fulfillmentVerified: true,
      policiesPresent: true,
      mobilePass: true,
      analyticsPresent: true,
      productDemoPresent: true,
      customDomain: false,
    },
  });
  assert.equal(reality.category_design.category, "professional_documents");
  assert.ok(reality.independent_company_test.passed);
});

test("Reference proof blocks PortfolioArchitect discovery (no Business #12)", () => {
  const proof = evaluateReferenceProof({
    premium_bar_passed: true,
    independent_company_test: true,
    stranger_purchases: 0,
  });
  assert.equal(forgeStopCreatingNewBusinesses(proof), true);

  const opps = discoverOpportunities({
    activeSiteIds: ["scopeguard"],
    activeIndustries: ["freelance"],
    telemetry: [],
    safety: {
      autonomousBusinessDiscovery: true,
      stopCreatingNewBusinesses: false,
    },
    ownerPolicy: { stopCreatingNewBusinesses: false },
    referenceProof: { premium_bar_passed: true, independent_company_test: true, stranger_purchases: 0 },
  });
  assert.equal(opps.length, 0);
});

test("Evidence contracts: weak APEX cannot mutate; market can override forge_confidence", () => {
  assert.equal(FORGE_EVIDENCE_CONTRACT.weak_apex_blocks_product_mutation, true);
  assert.equal(apexEvidenceAllowsProductMutation("WEAK_SIGNAL"), false);
  assert.equal(apexEvidenceAllowsProductMutation("STRONG_EVIDENCE"), true);

  const override = forgeConfidenceVsMarket({
    forge_confidence: 0.91,
    market_evidence_level: "ACTIONABLE_SIGNAL",
    qualified_visits: 500,
    checkouts: 70,
    purchases: 0,
  });
  assert.equal(override.market_overrides_forge, true);

  const weakInvest = forgeInvestigationFromApex({
    business_id: "scopeguard",
    persona: "Agency",
    signal: "asks for agency edition",
    lift: 4.7,
    sample_size: 5,
    evidence_level: "WEAK_SIGNAL",
    suggested_forge_investigation: "Agency Edition",
  });
  assert.equal(weakInvest.accept, false);

  const strongInvest = forgeInvestigationFromApex({
    business_id: "scopeguard",
    persona: "Agency",
    signal: "asks for agency edition",
    lift: 4.7,
    sample_size: 40,
    evidence_level: "ACTIONABLE_SIGNAL",
    suggested_forge_investigation: "Investigate Agency Edition",
  });
  assert.equal(strongInvest.accept, true);
});

test("Kill discipline refuses tiny-sample liquidation", () => {
  const no = mayRecommendRetirement({
    qualified_visits: 2,
    experiments_run: 0,
    pricing_tests: 0,
    product_iterations: 0,
    contribution_margin: 0,
    purchases: 0,
  });
  assert.equal(no.allowed, false);

  const yes = mayRecommendRetirement({
    qualified_visits: 500,
    experiments_run: 5,
    pricing_tests: 2,
    product_iterations: 3,
    contribution_margin: 0.05,
    purchases: 0,
  });
  assert.equal(yes.allowed, true);
});

test("Genome materializes from opportunity evaluation without template enum", () => {
  const sg = scopeGuardOpportunity();
  const ev = evaluateEconomicOpportunity({
    opportunity: sg.opportunity,
    competitors: sg.competitors,
    launched: true,
    corporate_reality_passed: true,
  });
  const g = genomeFromOpportunityEvaluation(ev, "scopeguard", "PRODUCT");
  assert.equal(g.business_id, "scopeguard");
  assert.match(g.job_to_be_done, /boundaries|paid/i);
  assert.ok(g.business_model.length > 10);
});

test("Autonomous Business Admission — 10 gates for ScopeGuard", () => {
  const sg = scopeGuardOpportunity();
  const economics = deriveEconomicShape(sg.opportunity);
  const fit = assessOperationalFit(economics);
  const competitors = buildCompetitorProfiles(sg.opportunity, sg.competitors);
  const deserve = evaluateDeserveToExist({
    opportunity: sg.opportunity,
    competitors,
    operational_fit: fit,
  });
  const admission = evaluateAdmission({
    opportunity: sg.opportunity,
    economics,
    operational_fit: fit,
    deserve,
    competitors,
    portfolio: { already_launched: true, stop_new_businesses: false },
  });

  assert.equal(admission.gates.length, 10);
  const ids = admission.gates.map((g) => g.id);
  for (const required of [
    "DEMAND",
    "WILLINGNESS_TO_PAY",
    "ECONOMIC_QUALITY",
    "AUTONOMY_FIT",
    "COMPETITIVE_RIGHT_TO_WIN",
    "DISTRIBUTION_ACCESS",
    "TEN_K_DAY_ARCHITECTURE",
    "DEFENSIBILITY",
    "FAILURE_SURFACE",
    "PORTFOLIO_OPPORTUNITY_COST",
  ] as const) {
    assert.ok(ids.includes(required), `missing gate ${required}`);
  }

  assert.equal(admission.ten_k_architecture.north_star_is_stretch_not_fact, true);
  assert.equal(admission.ten_k_architecture.assumed_price_or_arpu_usd, 45);
  assert.equal(admission.ten_k_architecture.customers_per_day, Math.ceil(10_000 / 45));
  assert.ok(admission.ten_k_architecture.qualified_exposures_per_day > admission.ten_k_architecture.customers_per_day);
  assert.equal(admission.decision, "ADMIT_OPERATE");
  assert.ok(!admission.blocking_gates.includes("AUTONOMY_FIT"));
  assert.ok(!admission.blocking_gates.includes("DEMAND"));
});

test("Admission rejects physical goods on autonomy / failure surface", () => {
  const opp = physicalGoodsTrapOpportunity();
  const economics = deriveEconomicShape(opp);
  const fit = assessOperationalFit(economics);
  const competitors = buildCompetitorProfiles(opp);
  const deserve = evaluateDeserveToExist({ opportunity: opp, competitors, operational_fit: fit });
  const admission = evaluateAdmission({
    opportunity: opp,
    economics,
    operational_fit: fit,
    deserve,
    competitors,
  });
  assert.equal(admission.decision, "REJECT");
  assert.ok(
    admission.blocking_gates.includes("AUTONOMY_FIT") ||
      admission.blocking_gates.includes("FAILURE_SURFACE"),
  );
});

test("Admission opportunity cost favors scaling a winner over weak new admit", () => {
  const opp = brandingOnlyMeTooOpportunity();
  const economics = deriveEconomicShape(opp);
  const fit = assessOperationalFit(economics);
  const competitors = buildCompetitorProfiles(opp);
  const deserve = evaluateDeserveToExist({ opportunity: opp, competitors, operational_fit: fit });
  const admission = evaluateAdmission({
    opportunity: opp,
    economics,
    operational_fit: fit,
    deserve,
    competitors,
    portfolio: {
      existing_winners: [
        {
          business_id: "scopeguard",
          daily_revenue_usd: 200,
          stranger_purchases: 12,
          growing: true,
        },
      ],
    },
  });
  assert.equal(admission.decision, "REJECT");
  const cost = admission.gates.find((g) => g.id === "PORTFOLIO_OPPORTUNITY_COST");
  assert.ok(cost);
});

test("$10k architecture is stretch math not a forecast", () => {
  const arch = buildTenKArchitecture({
    opportunity: scopeGuardOpportunity().opportunity,
    economics: deriveEconomicShape(scopeGuardOpportunity().opportunity),
    priceUsd: 45,
  });
  assert.equal(arch.north_star_is_stretch_not_fact, true);
  assert.ok(arch.what_must_become_true.some((w) => /stretch|not a fact/i.test(w)));
});
