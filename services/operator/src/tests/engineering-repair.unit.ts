/**
 * Unit coverage for autonomous engineering repair classification + hierarchy.
 * Run: npx tsx --test src/tests/engineering-repair.unit.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFailure } from "../lib/engineering-repair.js";

test("Level A — transient upstream", () => {
  const c = classifyFailure("openai rate limit 429 timeout");
  assert.equal(c.level, "A");
  assert.equal(c.engineeringCause, false);
});

test("Level B — runtime stale tick", () => {
  const c = classifyFailure("stale_tick");
  assert.equal(c.level, "B");
  assert.equal(c.engineeringCause, false);
});

test("Level C — missing storefront executor", () => {
  const c = classifyFailure("No Mac/storefront executor for indexnow_submit");
  assert.equal(c.level, "C");
  assert.equal(c.engineeringCause, true);
});

test("Level C — Adapter missing conversion limbs", () => {
  for (const a of ["publish_bundle", "rewrite_page_copy", "change_default_cta"]) {
    const c = classifyFailure(`Adapter missing ${a}`);
    assert.equal(c.level, "C");
    assert.equal(c.engineeringCause, true);
  }
});

test("Level D — syntax / module missing", () => {
  const c = classifyFailure("Cannot find module ./foo SyntaxError");
  assert.equal(c.level, "D");
  assert.equal(c.engineeringCause, true);
});

test("Level E — ScopeGuard / secrets", () => {
  const scope = classifyFailure("ScopeGuard cross_business contamination");
  assert.equal(scope.level, "E");
  const secret = classifyFailure("exposed secret credential leak");
  assert.equal(secret.level, "E");
  const pay = classifyFailure("payment stripe_corrupt customer_corrupt");
  assert.equal(pay.level, "E");
});
