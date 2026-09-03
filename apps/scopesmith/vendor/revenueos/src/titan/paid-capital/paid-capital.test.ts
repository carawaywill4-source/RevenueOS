import { test } from "node:test";
import assert from "node:assert/strict";
import { PAID_CAPITAL_LAW, DEFAULT_OWNER_PAID_CONTROLS } from "./types";
import { computeDailyCeiling, clampOwnerControls } from "./policy";
import { computeEligibleCapital } from "./eligible-capital";
import {
  createGovernorState,
  authorizePaidSpend,
  applyOwnerPause,
  snapshotTreasury,
} from "./governor";
import { createApexPaidProposal, proposalToAuthRequest } from "./apex-proposals";
import { allocatePortfolioAdCapital } from "./portfolio-market";
import { reconcilePaidAttribution, scorePaidOutcome } from "./attribution";
import { buildPaidCapitalOwnerView } from "./owner-view";
import { executeAuthorizedAdSpend } from "./adapters";
import { runPaidCapitalAsyncSafetySimulations } from "./simulate";
import { ladderMaxSpend, nextPaidExperimentLadderStage } from "./experiment-ladder";
import { TITAN_OWNER_CONSTITUTION } from "../constitution";

test("Prime Capital Law: 5% portfolio ceiling is max not target", () => {
  assert.equal(PAID_CAPITAL_LAW.max_daily_pct_of_eligible, 0.05);
  assert.equal(PAID_CAPITAL_LAW.ceiling_is_not_a_target, true);
  assert.equal(PAID_CAPITAL_LAW.may_spend_zero, true);
  assert.equal(PAID_CAPITAL_LAW.llm_cannot_authorize, true);
  assert.equal(DEFAULT_OWNER_PAID_CONTROLS.paid_capital_enabled, false);
  assert.equal(DEFAULT_OWNER_PAID_CONTROLS.live_paid_execution_enabled, false);
  assert.equal(
    TITAN_OWNER_CONSTITUTION.hard_limits.paid_capital_max_daily_pct_of_eligible,
    0.05,
  );
  assert.equal(TITAN_OWNER_CONSTITUTION.hard_limits.no_paid_ads, true);
});

test("Owner cannot raise daily pct above 5%", () => {
  const c = clampOwnerControls({ max_daily_pct: 0.5, paid_capital_enabled: true });
  assert.equal(c.max_daily_pct, 0.05);
});

test("Eligible capital ignores gross and deducts reserves", () => {
  const snap = computeEligibleCapital({
    gross_revenue_usd: 50_000,
    settled_usd: 10_000,
    refund_reserve_usd: 1_000,
    dispute_reserve_usd: 500,
    payment_fees_usd: 300,
    tax_reserve_usd: 200,
    operating_liabilities_usd: 1_000,
    infrastructure_obligations_usd: 500,
    already_committed_ad_spend_usd: 500,
    controls: clampOwnerControls({
      paid_capital_enabled: true,
      absolute_daily_cap_usd: 10_000,
      protected_cash_floor_usd: 2_000,
      platforms_enabled: { meta: true },
    }),
  });
  // 10000 - 1000 - 500 - 300 - 200 - 1000 - 500 - 2000 - 500 = 4000
  assert.equal(snap.eligible_capital_usd, 4000);
  assert.equal(snap.daily_ceiling_usd, 200); // 5% of 4000
  assert.ok(snap.gross_revenue_usd !== snap.eligible_capital_usd);
});

test("Disabled paid capital → ceiling 0 and auth rejects", () => {
  assert.equal(
    computeDailyCeiling({
      eligible_capital_usd: 10_000,
      controls: DEFAULT_OWNER_PAID_CONTROLS,
    }),
    0,
  );
  const state = createGovernorState({
    controls: {},
    capital: {
      gross_revenue_usd: 5000,
      settled_usd: 4000,
      provider_settled_usd: 4000,
    },
  });
  const p = createApexPaidProposal({
    business_id: "scopeguard",
    platform: "meta",
    campaign_key: "c1",
    hypothesis: "h",
    audience: "a",
    message: "m",
    offer: "o",
    landing_path: "/",
    organic_prior_keys: ["persona:x"],
    organic_evidence_summary: "organic proof",
    requested_spend_usd: 50,
    expected_incremental_contribution_usd: 100,
    expected_cac_usd: 20,
    expected_cvr: 0.02,
    expected_aov_usd: 45,
    expected_incremental_roas: 2,
    confidence: 0.7,
  });
  const { decision } = authorizePaidSpend(state, proposalToAuthRequest(p), {
    proposal: p,
  });
  assert.equal(decision.authorized, false);
  assert.equal(decision.authorized_by, "DETERMINISTIC_GOVERNOR");
});

test("Portfolio market gives more capital to higher marginal return", () => {
  const controls = clampOwnerControls({
    paid_capital_enabled: true,
    absolute_daily_cap_usd: 10_000,
    platforms_enabled: { meta: true },
  });
  const treasury = computeEligibleCapital({
    gross_revenue_usd: 20_000,
    settled_usd: 12_000,
    refund_reserve_usd: 500,
    provider_settled_usd: 12_000,
    controls,
  });
  const strong = createApexPaidProposal({
    business_id: "scopeguard",
    platform: "meta",
    campaign_key: "sg",
    hypothesis: "strong",
    audience: "a",
    message: "m",
    offer: "o",
    landing_path: "/",
    organic_prior_keys: ["organic"],
    organic_evidence_summary: "validated",
    requested_spend_usd: 200,
    expected_incremental_contribution_usd: 460,
    expected_cac_usd: 15,
    expected_cvr: 0.03,
    expected_aov_usd: 45,
    expected_incremental_roas: 2.3,
    confidence: 0.8,
  });
  const weak = createApexPaidProposal({
    business_id: "otherbiz",
    platform: "meta",
    campaign_key: "ob",
    hypothesis: "weak",
    audience: "a",
    message: "m",
    offer: "o",
    landing_path: "/",
    organic_prior_keys: ["organic"],
    organic_evidence_summary: "thin",
    requested_spend_usd: 200,
    expected_incremental_contribution_usd: 40,
    expected_cac_usd: 40,
    expected_cvr: 0.01,
    expected_aov_usd: 45,
    expected_incremental_roas: 1.18,
    confidence: 0.5,
  });
  const plan = allocatePortfolioAdCapital({
    treasury,
    proposals: [strong, weak],
  });
  const sg = plan.allocations.find((a) => a.business_id === "scopeguard");
  const ob = plan.allocations.find((a) => a.business_id === "otherbiz");
  assert.ok(sg);
  assert.ok((sg?.authorized_usd ?? 0) > (ob?.authorized_usd ?? 0));
});

test("Ladder prevents jumping to full ceiling at SMALLEST_USEFUL", () => {
  assert.ok(ladderMaxSpend("SMALLEST_USEFUL", 1000) <= 50 + 0.01);
  assert.equal(nextPaidExperimentLadderStage("SMALLEST_USEFUL", {
    profitable: true,
    sample_acquisitions: 3,
    incremental_contribution_positive: true,
  }), "CONFIRM");
});

test("Attribution prefers Stripe truth over platform ROAS", () => {
  const rec = reconcilePaidAttribution({
    platform_reported_conversions: 10,
    beacon_sessions: 40,
    checkouts: 5,
    stripe_purchases: 3,
    refunds: 0,
    realized_contribution_usd: 90,
    identity_linked: false,
  });
  assert.equal(rec.uncertainty, "high");
  const score = scorePaidOutcome({
    spend_usd: 50,
    realized_contribution_usd: 90,
    attribution: rec,
  });
  assert.equal(score.primary_metric, "incremental_contribution_profit");
  assert.equal(score.reliable, false);
});

test("Owner pause overrides authorized path", () => {
  let state = createGovernorState({
    controls: {
      paid_capital_enabled: true,
      absolute_daily_cap_usd: 500,
      platforms_enabled: { meta: true },
    },
    capital: {
      gross_revenue_usd: 8000,
      settled_usd: 7000,
      provider_settled_usd: 7000,
      refund_reserve_usd: 200,
    },
  });
  state = applyOwnerPause(state);
  const p = createApexPaidProposal({
    business_id: "scopeguard",
    platform: "meta",
    campaign_key: "c1",
    hypothesis: "h",
    audience: "a",
    message: "m",
    offer: "o",
    landing_path: "/",
    organic_prior_keys: ["organic"],
    organic_evidence_summary: "ok",
    requested_spend_usd: 20,
    expected_incremental_contribution_usd: 40,
    expected_cac_usd: 15,
    expected_cvr: 0.02,
    expected_aov_usd: 45,
    expected_incremental_roas: 2,
    confidence: 0.7,
  });
  const { decision } = authorizePaidSpend(state, proposalToAuthRequest(p), {
    proposal: p,
  });
  assert.equal(decision.authorized, false);
  assert.match(decision.reason, /OWNER_PAUSE|circuit_breaker/i);
});

test("Adapter refuses live spend even when capital enabled", async () => {
  const result = await executeAuthorizedAdSpend({
    controls: clampOwnerControls({
      paid_capital_enabled: true,
      live_paid_execution_enabled: false,
      platforms_enabled: { meta: true },
      absolute_daily_cap_usd: 100,
    }),
    request: {
      platform: "meta",
      campaign_id: "c",
      authorization_id: "a",
      amount_usd: 10,
    },
  });
  assert.equal(result.executed, false);
});

test("Owner view exposes required controls and treasury fields", () => {
  const controls = clampOwnerControls({
    paid_capital_enabled: true,
    absolute_daily_cap_usd: 250,
    protected_cash_floor_usd: 1000,
    platforms_enabled: { meta: true },
  });
  const treasury = computeEligibleCapital({
    gross_revenue_usd: 5000,
    settled_usd: 4000,
    provider_settled_usd: 4000,
    controls,
  });
  const view = buildPaidCapitalOwnerView({ controls, treasury });
  assert.equal(view.paid_capital, "ON");
  assert.equal(view.live_execution, "OFF");
  assert.equal(view.hard_maximum_pct, 0.05);
  assert.ok(view.treasury.remaining_hard_ceiling_usd >= 0);
});

test("All non-negotiable safety simulations fail safely", async () => {
  const results = await runPaidCapitalAsyncSafetySimulations();
  const failed = results.filter((r) => !r.pass);
  assert.equal(
    failed.length,
    0,
    failed.map((f) => `${f.name}: ${f.detail}`).join(" | "),
  );
  assert.ok(results.length >= 10);
});

test("Authorized spend still does not imply live execution", () => {
  const state = createGovernorState({
    controls: {
      paid_capital_enabled: true,
      absolute_daily_cap_usd: 500,
      platforms_enabled: { meta: true },
      live_paid_execution_enabled: false,
    },
    capital: {
      gross_revenue_usd: 8000,
      settled_usd: 7000,
      provider_settled_usd: 7000,
      refund_reserve_usd: 200,
    },
  });
  const p = createApexPaidProposal({
    business_id: "scopeguard",
    platform: "meta",
    campaign_key: "c1",
    hypothesis: "h",
    audience: "a",
    message: "m",
    offer: "o",
    landing_path: "/",
    organic_prior_keys: ["organic"],
    organic_evidence_summary: "validated organic",
    requested_spend_usd: 20,
    expected_incremental_contribution_usd: 40,
    expected_cac_usd: 15,
    expected_cvr: 0.02,
    expected_aov_usd: 45,
    expected_incremental_roas: 2,
    confidence: 0.7,
    ladder_stage: "SMALLEST_USEFUL",
  });
  const { decision, state: next } = authorizePaidSpend(
    state,
    proposalToAuthRequest(p),
    { proposal: p },
  );
  assert.equal(decision.authorized, true);
  assert.match(decision.reason, /live_execution=false/);
  const t = snapshotTreasury(next);
  assert.ok(t.daily_ceiling_usd <= t.eligible_capital_usd * 0.05 + 0.01);
});
