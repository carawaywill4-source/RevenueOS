import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __resetAiGovernorForTests,
  authorizeAiCall,
  buildCommercialStateHash,
  getAiBudgetStatus,
  isComplimentaryEligibleModel,
  storeCachedAiDecision,
} from "./ai-budget-governor.js";

test("bootstrap denies paid when complimentary unusable", () => {
  __resetAiGovernorForTests();
  process.env.BOOTSTRAP_AI_MODE = "true";
  process.env.ALLOW_PAID_AI = "false";
  process.env.PAID_AI_BUDGET_USD = "0";
  process.env.OPENAI_COMPLIMENTARY_USABLE = "false";
  process.env.OPENAI_COMPLIMENTARY_PROGRAM = "unknown";

  const d = authorizeAiCall({
    justification: {
      purpose: "acquisition_diagnosis",
      reason: "novel engineering failure classification",
      priority: 2,
      businessId: "scopesmith",
    },
    requestedModel: "gpt-5-mini",
  });
  assert.equal(d.allow, false);
  if (!d.allow) {
    assert.ok(
      d.code === "complimentary_unproven" || d.code === "complimentary_unusable",
    );
  }
  const st = getAiBudgetStatus();
  assert.equal(st.paidAiAllowed, false);
  assert.equal(st.paidAiBudgetUsd, 0);
  assert.equal(st.mode, "AI_DEGRADED_FREE_LIMIT");
});

test("missing justification denied", () => {
  __resetAiGovernorForTests();
  process.env.OPENAI_COMPLIMENTARY_USABLE = "true";
  process.env.OPENAI_COMPLIMENTARY_PROGRAM = "enrolled";
  const d = authorizeAiCall({ requestedModel: "gpt-5-mini" });
  assert.equal(d.allow, false);
  if (!d.allow) assert.equal(d.code, "missing_justification");
});

test("generic purpose string denied as missing_justification", () => {
  __resetAiGovernorForTests();
  process.env.OPENAI_COMPLIMENTARY_USABLE = "true";
  process.env.OPENAI_COMPLIMENTARY_PROGRAM = "enrolled";
  const d = authorizeAiCall({
    justification: {
      // @ts-expect-error intentional invalid purpose
      purpose: "needed",
      reason: "revenueos",
      priority: 4,
    },
    requestedModel: "gpt-5-mini",
  });
  assert.equal(d.allow, false);
  if (!d.allow) assert.equal(d.code, "missing_justification");
});

test("cache reuse avoids model call", () => {
  __resetAiGovernorForTests();
  process.env.OPENAI_COMPLIMENTARY_USABLE = "true";
  process.env.OPENAI_COMPLIMENTARY_PROGRAM = "enrolled";
  const hash = buildCommercialStateHash({
    businessId: "bidforge",
    bottleneck: "NO_IMPRESSIONS",
  });
  storeCachedAiDecision({
    stateHash: hash,
    at: new Date().toISOString(),
    model: "gpt-5-mini",
    businessId: "bidforge",
    reason: "prior",
    data: { decision: "distribute_owned_urls" },
  });
  const d = authorizeAiCall({
    justification: {
      purpose: "acquisition_diagnosis",
      reason: "acquisition strategy",
      priority: 8,
      businessId: "bidforge",
      stateHash: hash,
    },
  });
  assert.equal(d.allow, false);
  if (!d.allow) {
    assert.equal(d.code, "cache_reuse");
    assert.deepEqual(d.cached?.data, { decision: "distribute_owned_urls" });
  }
});

test("complimentary eligible model detection", () => {
  assert.equal(isComplimentaryEligibleModel("gpt-5-mini"), true);
  assert.equal(isComplimentaryEligibleModel("gpt-5-mini-2025-08-07"), true);
  assert.equal(isComplimentaryEligibleModel("gpt-4"), false);
});

test("attested complimentary allows mini model with approved purpose", () => {
  __resetAiGovernorForTests();
  process.env.BOOTSTRAP_AI_MODE = "true";
  process.env.ALLOW_PAID_AI = "false";
  process.env.OPENAI_COMPLIMENTARY_USABLE = "true";
  process.env.OPENAI_COMPLIMENTARY_PROGRAM = "enrolled";
  const d = authorizeAiCall({
    justification: {
      purpose: "acquisition_diagnosis",
      reason: "Titan portfolio allocation with new revenue signal",
      priority: 4,
      businessId: "coldforge",
      stateHash: buildCommercialStateHash({ x: 1, t: Date.now() }),
    },
    requestedModel: "gpt-5-mini",
  });
  assert.equal(d.allow, true);
  if (d.allow) {
    assert.equal(d.billing, "complimentary");
    assert.equal(d.model, "gpt-5-mini");
  }
});
