import { test } from "node:test";
import assert from "node:assert/strict";
import { auditStorefront } from "./auditor";
import { evaluatePremiumBar } from "./premium-bar";
import { DEFAULT_FORGE_CONSTITUTION } from "./constitution";
import { scopeGuardGenome } from "./genome";
import {
  apexMayExecuteAction,
  scopeGuardCapabilityManifest,
} from "./capability-manifest";

test("constitution: 50 is a cap not a quota", () => {
  assert.equal(DEFAULT_FORGE_CONSTITUTION.maxActiveBusinesses, 50);
  assert.equal(DEFAULT_FORGE_CONSTITUTION.fiftyIsCapNotQuota, true);
  assert.equal(DEFAULT_FORGE_CONSTITUTION.stopNewBusinessesUntilReferenceProof, true);
  assert.equal(DEFAULT_FORGE_CONSTITUTION.noFakeSocialProof, true);
  assert.equal(DEFAULT_FORGE_CONSTITUTION.forbidBusinessTypeTemplateFactory, true);
  assert.equal(DEFAULT_FORGE_CONSTITUTION.requireCorporateRealityStandard, true);
});

test("genome encodes ScopeGuard job-to-be-done", () => {
  const g = scopeGuardGenome();
  assert.match(g.job_to_be_done, /boundaries|get paid/i);
  assert.equal(g.maturity, "PRODUCT");
});

test("auditor flags thin SEO door sludge", () => {
  const result = auditStorefront({
    businessId: "scopeguard",
    brand: {
      displayName: "ScopeGuard",
      primaryColor: "#111",
      accentColor: "#222",
      fontDisplay: "IBM Plex Serif",
      fontBody: "IBM Plex Sans",
      supportEmail: "care@example.com",
      domain: "scopeguard.vercel.app",
      product: {
        name: "Pack",
        tagline: "Get paid when scope expands",
        description: "Useful pack",
        priceUsd: 45,
        bullets: ["A"],
        audience: "freelancers",
      },
      discoveryDoors: [
        {
          slug: "x",
          title: "x",
          body: "Short body.\n\nThis page targets: keyword",
        },
      ],
    },
    sourceTexts: [{ path: "page", text: "What you get" }],
    fontsLoadedInLayout: ["IBM Plex Serif", "IBM Plex Sans"],
    checkoutRouteExists: true,
    legalPages: ["privacy", "terms", "refunds"],
    purchases: 0,
  });
  assert.ok(result.gaps.some((g) => g.id.includes("thin_door") || g.id.includes("slop")));
  assert.equal(result.summary.ready_for_public_launch, false);
});

test("premium bar fails on critical fake proof", () => {
  const bar = evaluatePremiumBar({
    businessId: "scopeguard",
    gaps: [
      {
        id: "slop_fake_proof",
        category: "trust",
        severity: "CRITICAL",
        title: "Fake proof",
        detail: "x",
        evidence: [],
        recommended_fix: "remove",
        blocks_premium_bar: true,
      },
    ],
  });
  assert.equal(bar.passed, false);
});

test("ScopeGuard capability manifest gates APEX vs FORGE", () => {
  const m = scopeGuardCapabilityManifest();
  assert.equal(m.product.status, "READY");
  assert.equal(m.forge_confidence, 0.91);
  assert.equal(m.current_business_stage, "FIRST_CUSTOMER");
  assert.equal(m.primary_objective, "FIRST ATTRIBUTED STRANGER PURCHASE");
  assert.ok(m.known_product_uncertainties.some((u) => /willingness to pay/i.test(u)));

  const channel = apexMayExecuteAction(m, "distribute_owned_urls");
  assert.equal(channel.allowed, true);

  const redesign = apexMayExecuteAction(m, "offer_clarity_update");
  assert.equal(redesign.allowed, false);
  assert.match(redesign.detail, /forge_approval_required:product_redesign/);

  const price = apexMayExecuteAction(m, "major_pricing_change");
  assert.equal(price.allowed, false);
});
