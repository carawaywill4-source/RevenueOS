import { test } from "node:test";
import assert from "node:assert/strict";
import {
  publicArtifactPasses,
  renderBrandHtml,
  STATIC_RENDERER_VERSION,
  stripInternalEvoMarks,
} from "./static-brand-build.js";
import { guidesFor, renderGuideHtml, sitemapXml } from "./seo-guides.js";

const brand = {
  siteId: "buildgrid",
  displayName: "BuildGrid",
  supportEmail: "care@buildgrid.com",
  product: {
    id: "pack",
    name: "Coordination Wedge",
    tagline: "RFIs live in email chaos.",
    description: "RFI log and look-ahead starters.",
    audience: "project managers",
    priceUsd: 89,
    bullets: ["RFI log", "Look-ahead"],
  },
};

test("premium static renderer is not the stale dark shell", () => {
  const html = renderBrandHtml(brand, "https://buildgrid.example");
  assert.equal(html.includes("radial-gradient(1200px"), false);
  assert.ok(html.includes(`ros-renderer`));
  assert.ok(html.includes(STATIC_RENDERER_VERSION));
  const pass = publicArtifactPasses(html);
  assert.equal(pass.ok, true, pass.missing.join(","));
});

test("buildgrid page is a conversion site, not a 100-word stub", () => {
  const html = renderBrandHtml(brand, "https://buildgrid.example");
  assert.ok(html.includes("Inside the pack"));
  assert.ok(html.includes("product-mock"));
  assert.ok(html.includes("RFI log"));
  assert.ok(html.includes("Get the BuildGrid pack"));
  assert.ok(!/Buy — instant download/i.test(html));
  assert.ok(html.length > 8000);
});

test("buildgrid ships indexable guide URLs instead of a 100-word stub", () => {
  const html = renderBrandHtml(brand, "https://buildgrid.example");
  assert.ok(html.includes("application/ld+json"));
  assert.ok(html.includes("/guides/construction-rfi-log-template/"));
  assert.ok(!/This page targets:/i.test(html));
  const guides = guidesFor(brand);
  assert.ok(guides.length >= 5);
  const rfi = guides.find((g) => g.slug === "construction-rfi-log-template");
  assert.ok(rfi);
  const words = rfi.paragraphs.join(" ").split(/\s+/).length;
  assert.ok(words > 250, `guide too thin: ${words} words`);
  const page = renderGuideHtml({
    brand,
    guide: rfi,
    related: guides,
    canonicalUrl: "https://buildgrid.example",
    fingerprint: "test",
    rendererVersion: STATIC_RENDERER_VERSION,
  });
  assert.ok(page.includes("application/ld+json"));
  assert.ok(!/This page targets:/i.test(page));
  const sm = sitemapXml("https://buildgrid.example", guides, "2026-08-13");
  assert.ok(sm.includes("/guides/construction-rfi-log-template/"));
  assert.ok(sm.includes("https://buildgrid.example/guides/"));
});

test("internal ros-evo stamps are stripped from public HTML", () => {
  const dirty = {
    ...brand,
    siteId: "otherkit",
    displayName: "OtherKit",
    product: {
      ...brand.product,
      name: "OtherKit Pack",
      tagline:
        "RFIs live in email chaos. [ros-evo-pricing_emphasis: one-time price · keep forever]",
      description:
        "RFI log. [ros-evo-trust_preview_section: free preview before buy]",
      bullets: ["RFI log [ros-evo-cta_structure] Checkout takes under a minute"],
    },
  };
  const html = renderBrandHtml(dirty, "https://otherkit.example");
  assert.equal(html.includes("ros-evo-"), false);
  assert.ok(html.includes("RFIs live in email chaos."));
  assert.equal(stripInternalEvoMarks("[ros-evo-x: y] keep"), "keep");
  assert.equal(
    stripInternalEvoMarks("chaos. [ros-evo-trust_preview_section: free preview before"),
    "chaos.",
  );
});
