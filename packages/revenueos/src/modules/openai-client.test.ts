import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyOpenAIFailure } from "./openai-client.js";

test("429 credit_balance_exhausted → insufficient quota, not generic rate limit", () => {
  const body = JSON.stringify({
    error: {
      message: "You have no credits remaining.",
      type: "insufficient_quota",
      code: "credit_balance_exhausted",
    },
  });
  const c = classifyOpenAIFailure(429, body);
  assert.equal(c.code, "no_credits");
  assert.equal(c.publicCode, "OPENAI_INSUFFICIENT_QUOTA");
  assert.equal(c.providerCode, "credit_balance_exhausted");
});

test("429 rate_limit_exceeded → OPENAI_RATE_LIMIT", () => {
  const body = JSON.stringify({
    error: {
      message: "Rate limit reached",
      type: "tokens",
      code: "rate_limit_exceeded",
    },
  });
  const c = classifyOpenAIFailure(429, body);
  assert.equal(c.code, "rate_limited");
  assert.equal(c.publicCode, "OPENAI_RATE_LIMIT");
});

test("401 invalid key", () => {
  const body = JSON.stringify({
    error: { message: "Incorrect API key provided", type: "invalid_request_error", code: "invalid_api_key" },
  });
  const c = classifyOpenAIFailure(401, body);
  assert.equal(c.code, "invalid_key");
  assert.equal(c.publicCode, "OPENAI_INVALID_KEY");
});

test("400 unsupported temperature → model_unavailable", () => {
  const body = JSON.stringify({
    error: {
      message: "Unsupported parameter: 'temperature' is not supported with this model.",
      type: "invalid_request_error",
    },
  });
  const c = classifyOpenAIFailure(400, body);
  assert.equal(c.code, "model_unavailable");
  assert.equal(c.publicCode, "OPENAI_MODEL_UNAVAILABLE");
});
