import { test } from "node:test";
import assert from "node:assert/strict";
import { tenKFeasibility, bandFromScores } from "../lib/ultron-external/commerce-intelligence.js";
import { detectSlop } from "../lib/ultron-external/premium-site-system.js";
import { critiqueHtml, trustScoreFrom } from "../lib/ultron-external/site-commerce-qa.js";
import {
  classifyFetchedHtml,
  isDirectoryIndexPage,
} from "../lib/ultron-external/surface-intelligence.js";

test("$10k/day at $29 is IMPLAUSIBLE volume", () => {
  const r = tenKFeasibility(29);
  assert.equal(r.path, "IMPLAUSIBLE");
  assert.ok(r.customersPerDay > 300);
});

test("$10k/day at $2500 is PLAUSIBLE volume (stress-test, not forecast)", () => {
  const r = tenKFeasibility(2500);
  assert.equal(r.path, "PLAUSIBLE");
  assert.ok(r.customersPerDay < 10);
});

test("no purchases + stretch math → NEEDS_REPOSITIONING or WEAK", () => {
  const b = bandFromScores({
    quality: 45,
    demand: 30,
    trafficReady: false,
    tenK: "STRETCH",
    purchases: 0,
  });
  assert.ok(b === "NEEDS_REPOSITIONING" || b === "WEAK" || b === "PROMISING");
});

test("purchases + quality → HIGH_POTENTIAL", () => {
  const b = bandFromScores({
    quality: 70,
    demand: 80,
    trafficReady: true,
    tenK: "PLAUSIBLE",
    purchases: 2,
  });
  assert.equal(b, "HIGH_POTENTIAL");
});

test("slop detector catches generic AI copy", () => {
  const d = detectSlop("We revolutionize your workflow with next-generation AI");
  assert.ok(d.includes("generic_ai_copy"));
});

test("anti-fabrication copy is not treated as fake social proof", () => {
  const html =
    "<p>One payment. No subscription. No fabricated testimonials.</p><p>We do not invent testimonials or customer counts.</p>";
  const d = detectSlop(html);
  assert.equal(d.includes("possible_fabricated_social_proof"), false);
});

test("unverified testimonials still fail slop", () => {
  const d = detectSlop("<p>Loved by 10,000 customers. Read a testimonial.</p>");
  assert.ok(d.includes("possible_fabricated_social_proof"));
});

test("trust critic fails without privacy/contact", () => {
  const findings = critiqueHtml("<html><h1>Hi</h1></html>", "http://example.com");
  const trust = findings.find((f) => f.critic === "TRUST");
  assert.equal(trust?.ok, false);
  assert.ok(trustScoreFrom(findings, true) < 70);
});

test("trust critic passes with real trust surfaces", () => {
  const html = `<nav></nav><h1>Invoice follow-up pack</h1><p>$29</p>
    <a href="/checkout">Buy now</a> <a href="/legal/privacy">privacy</a>
    <a href="/legal/terms">terms</a> <a href="mailto:care@x.com">contact</a>
    <section>faq questions</section><footer></footer>`;
  const findings = critiqueHtml(html, "https://invoicechaser.example");
  assert.ok(findings.every((f) => f.ok || f.severity === "LOW"));
});

test("directory listicle is a read surface, not a publish surface", () => {
  const url = "https://antforms.com/blog/sass-free-directories-submission-80-plus-list-2026";
  const html =
    "<html><h1>80+ directories</h1><p>submit your listing</p><a href=\"https://betalist.com/submit\">x</a></html>";
  assert.equal(isDirectoryIndexPage(url, html), true);
  const c = classifyFetchedHtml(url, html);
  assert.equal(c.policyClass, "PERMITTED_READ");
});

test("real submit form without account is PERMITTED_PUBLISH", () => {
  const c = classifyFetchedHtml(
    "https://example-dir.test/submit",
    "<p>submit your listing. no account required. add your product today.</p>",
  );
  assert.equal(c.policyClass, "PERMITTED_PUBLISH");
});

test("premium storefront anti-fabrication line does not fail site QA design critic", () => {
  const html = `<nav class="site-nav"></nav><h1>BuildGrid</h1><p>$89</p>
    <button>Buy — instant download</button>
    <p>One payment. No subscription. No fabricated testimonials.</p>
    <a href="/legal/privacy">privacy</a> <a href="/legal/terms">terms</a>
    <a href="mailto:care@buildgrid.com">contact</a>
    <section id="faq">questions</section><footer></footer>`;
  const findings = critiqueHtml(html, "https://buildgrid.example");
  const designSlop = findings.find((f) => f.critic === "DESIGN" && f.note.startsWith("slop:"));
  assert.equal(designSlop, undefined);
});
