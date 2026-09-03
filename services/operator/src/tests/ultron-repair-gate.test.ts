import { test } from "node:test";
import assert from "node:assert/strict";
import { verifySvixSignature, makeSvixHeaders } from "../lib/ultron-external/svix-verify.js";
import { classifyTraffic } from "../lib/traffic-classify.js";
import { decideCognitiveEscalation } from "../lib/ultron-external/cognitive-escalation.js";
import { capProofForEvidence, evidenceClassForAction } from "../lib/ultron-external/proof-evidence.js";

const SECRET = "whsec_" + Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");

test("svix accepts a correctly signed payload within tolerance", () => {
  const body = JSON.stringify({ type: "email.received", data: { from: "a@b.c" } });
  const ts = Math.floor(Date.now() / 1000);
  const headers = makeSvixHeaders(body, SECRET, "msg_test_1", ts);
  const r = verifySvixSignature(body, headers, SECRET, ts);
  assert.equal(r.ok, true);
});

test("svix rejects a tampered payload", () => {
  const body = JSON.stringify({ type: "email.received" });
  const ts = Math.floor(Date.now() / 1000);
  const headers = makeSvixHeaders(body, SECRET, "msg_test_2", ts);
  const r = verifySvixSignature(body + "x", headers, SECRET, ts);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "svix_signature_mismatch");
});

test("svix rejects expired timestamps (replay window)", () => {
  const body = "{}";
  const ts = Math.floor(Date.now() / 1000) - 301;
  const headers = makeSvixHeaders(body, SECRET, "msg_test_3", ts);
  const r = verifySvixSignature(body, headers, SECRET);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "svix_timestamp_outside_tolerance");
});

test("owned-domain mozilla pageview is INTERNAL not LIKELY_HUMAN", () => {
  const r = classifyTraffic({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    path: "/",
    referer: "https://invoicechaser.130.131.15.68.sslip.io/",
    remoteIp: "23.27.145.89",
    host: "invoicechaser.130.131.15.68.sslip.io",
  });
  assert.equal(r.class, "INTERNAL");
});

test("acquisitionos utm is SYNTHETIC_TEST", () => {
  const r = classifyTraffic({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    path: "/?utm_source=acquisitionos",
    referer: "https://invoicechaser.130.131.15.68.sslip.io/?utm_source=acquisitionos",
    remoteIp: "51.54.38.123",
    url: "https://invoicechaser.130.131.15.68.sslip.io/?utm_source=acquisitionos",
  });
  assert.equal(r.class, "SYNTHETIC_TEST");
});

test("third-party referer + browser UA is LIKELY_HUMAN", () => {
  const r = classifyTraffic({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    path: "/",
    referer: "https://news.ycombinator.com/item?id=1",
    remoteIp: "8.8.8.8",
    host: "invoicechaser.130.131.15.68.sslip.io",
  });
  assert.equal(r.class, "LIKELY_HUMAN");
});

test("owned publish cannot grade C4", () => {
  const cls = evidenceClassForAction({ externalAction: "publish_owned_intent_page" });
  assert.equal(cls, "OWNED_SURFACE");
  assert.equal(capProofForEvidence(cls, 504, 1), "C3_PRODUCTION_AVAILABLE");
});

test("cognitive escalation records capability limit when budget exhausted", () => {
  const d = decideCognitiveEscalation({
    taskKind: "architecture",
    taskValueUsd: 0,
    novelty: 0.9,
    failureCount: 0,
    uncertainty: 0.5,
    architectureScope: true,
    risk: "HIGH",
    economicMilestone: "E5",
    modelCostUsd: 20,
    availableBudgetUsd: 1,
  });
  assert.equal(d.tier, "CAPABILITY_LIMIT");
  assert.equal(d.required, "STRONG");
});
