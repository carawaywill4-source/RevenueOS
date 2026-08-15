/**
 * Lightweight native static site renderer.
 * Avoids Next.js builds on small Azure VMs — emits HTML from brand.ts.
 *
 * This IS the production artifact. Changing a Next page.tsx file does
 * nothing unless this renderer emits the same commercial surfaces.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import { renderPremiumHtml } from "./premium-storefront-html.js";
import {
  guidesFor,
  renderGuideHtml,
  renderGuidesIndexHtml,
  sitemapXml,
} from "./seo-guides.js";

export const STATIC_RENDERER_VERSION = "premium-static-v5";

/** Code-evolution stamps must never appear on the public storefront. */
export function stripInternalEvoMarks(s: string): string {
  return s
    .replace(/\s*\[ros-evo-[^\]]*(?:\]|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type BrandLite = {
  siteId: string;
  displayName: string;
  primaryColor?: string;
  accentColor?: string;
  fontDisplay?: string;
  fontBody?: string;
  supportEmail?: string;
  product: {
    id: string;
    name: string;
    tagline?: string;
    description?: string;
    audience?: string;
    priceUsd: number;
    bullets?: string[];
    intentKeywords?: string[];
  };
  discoveryDoors?: Array<{
    slug: string;
    title: string;
    intentQuery: string;
    body: string;
  }>;
  evolvedCopy?: import("./premium-storefront-html.js").CopyDeck;
};

export function loadBrandLite(
  repoRoot: string,
  siteId: string,
): BrandLite | null {
  const p = path.join(repoRoot, "apps", siteId, "src/lib/brand.ts");
  if (!existsSync(p)) return null;
  const src = readFileSync(p, "utf8");
  const m = src.match(/export const BRAND[^=]*=\s*(\{[\s\S]*\n\});/);
  if (!m?.[1]) return null;
  try {
    // eslint-disable-next-line no-new-func
    return loadEvolvedCopy(repoRoot, siteId, new Function(`return (${m[1]})`)() as BrandLite);
  } catch {
    return null;
  }
}

function loadEvolvedCopy(repoRoot: string, siteId: string, brand: BrandLite): BrandLite {
  const p = path.join(repoRoot, "apps", siteId, "src/lib/evolved-copy.json");
  if (!existsSync(p)) return brand;
  try {
    const copy = JSON.parse(readFileSync(p, "utf8")) as BrandLite["evolvedCopy"] & {
      priceUsd?: number;
    };
    if (!copy?.headline) return brand;
    if (typeof copy.priceUsd === "number" && copy.priceUsd > 0) {
      brand.product.priceUsd = copy.priceUsd;
    }
    brand.evolvedCopy = copy;
  } catch {
    return brand;
  }
  return brand;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function artifactFingerprint(brand: BrandLite): string {
  return createHash("sha1")
    .update(
      `${STATIC_RENDERER_VERSION}|${brand.siteId}|${brand.product.name}|${brand.product.priceUsd}|${brand.supportEmail ?? ""}`,
    )
    .digest("hex")
    .slice(0, 16);
}

export function publicArtifactPasses(html: string): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!/name="ros-artifact"/.test(html)) missing.push("ros-artifact-marker");
  if (!/legal\/privacy/i.test(html)) missing.push("privacy_link");
  if (!/legal\/terms/i.test(html)) missing.push("terms_link");
  if (!/mailto:/i.test(html)) missing.push("contact_mailto");
  if (!/id="faq"|Questions/i.test(html)) missing.push("faq");
  if (!/id="buy"|Buy —|Get the /i.test(html)) missing.push("checkout_cta");
  if (!/Inside the pack/i.test(html)) missing.push("inside_the_pack");
  if (!/product-mock/i.test(html)) missing.push("product_preview");
  if (!/application\/ld\+json/.test(html)) missing.push("json_ld");
  if (!/id="guides"|\/guides\//i.test(html)) missing.push("seo_guides");
  if (/This page targets:/i.test(html)) missing.push("keyword_spam_stub");
  if (html.length < 6000) missing.push("too_thin_to_convert");
  if (/revolutionize your workflow|radial-gradient\(1200px/i.test(html)) {
    missing.push("ai_slop_or_stale_shell");
  }
  return { ok: missing.length === 0, missing };
}

function css(brand: BrandLite): string {
  const primary = brand.primaryColor || "#1a1a1a";
  const accent = brand.accentColor || "#2f6f4e";
  return `:root{--brand:${primary};--accent:${accent};--bg:#f7f4ef;--paper:#fffcf7;--ink:#141414;--muted:#5c5852;--line:#e4ddd3}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:${esc(brand.fontBody || "Source Sans 3")},Segoe UI,sans-serif;font-size:1.05rem;line-height:1.55}
h1,h2,h3{font-family:${esc(brand.fontDisplay || "Fraunces")},Georgia,serif;letter-spacing:-0.03em;line-height:1.12;margin:0 0 .6rem}
a{color:var(--ink)}a:hover{color:var(--accent)}
.wrap{max-width:760px;margin:0 auto;padding:2.25rem 1.35rem}
.site-nav{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.9rem 1.35rem;border-bottom:1px solid var(--line);background:var(--paper)}
.site-nav a{text-decoration:none;font-size:.92rem;color:var(--muted);margin-left:.8rem}
.brand-mark{font-weight:700;letter-spacing:-.02em}
.hero{background:var(--paper);border-bottom:1px solid var(--line);padding:3rem 1.35rem 2.4rem}
.eyebrow{margin:0;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.lede{font-size:1.15rem;max-width:46ch;margin:.75rem 0 0}
.price{font-size:1.65rem;font-weight:650;margin:1.3rem 0 0}
button,.btn{display:inline-block;background:var(--brand);color:#fff;padding:.85rem 1.35rem;border:0;cursor:pointer;border-radius:3px;font-weight:650;font-size:1rem;text-decoration:none}
button:disabled{opacity:.45;cursor:not-allowed}
.section h2{font-size:1.4rem}
.faq details{border-top:1px solid var(--line);padding:.85rem 0}
.faq summary{cursor:pointer;font-weight:650}
.site-footer{border-top:1px solid var(--line);background:var(--paper);color:var(--muted);font-size:.92rem}
.site-footer a{color:var(--muted);margin-right:.9rem}
.err{color:#9b2c2c;margin-top:.75rem}
.note{color:var(--muted);font-size:.92rem}
@media(max-width:640px){.hero{padding:2.1rem 1.1rem 1.7rem}h1{font-size:2rem}.site-nav{flex-wrap:wrap}}`;
}

export function renderBrandHtml(brand: BrandLite, canonicalUrl: string): string {
  const fp = artifactFingerprint(brand);
  const guides = guidesFor(brand);
  return renderPremiumHtml({
    brand,
    canonicalUrl,
    fingerprint: fp,
    rendererVersion: STATIC_RENDERER_VERSION,
    guides: guides.map((g) => ({ href: `/guides/${g.slug}/`, title: g.title })),
  });
}

function legalPage(brand: BrandLite, title: string, body: string): string {
  const email = brand.supportEmail || `care@${brand.siteId}.com`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} — ${esc(brand.displayName)}</title>
<meta name="ros-artifact" content="${artifactFingerprint(brand)}"/>
<style>${css(brand)}</style></head>
<body>
<nav class="site-nav"><a class="brand-mark" href="/">${esc(brand.displayName)}</a><a href="/">Home</a></nav>
<main class="wrap section">
<h1>${esc(title)}</h1>
${body}
<p>Contact: <a href="mailto:${esc(email)}">${esc(email)}</a></p>
<p><a href="/legal/privacy/">Privacy</a> · <a href="/legal/terms/">Terms</a> · <a href="/legal/refunds/">Refunds</a></p>
</main></body></html>`;
}

export function buildStaticFromBrand(input: {
  repoRoot: string;
  siteId: string;
  version: string;
  artifactRoot: string;
  canonicalUrl: string;
}):
  | { ok: true; artifactDir: string; durationMs: number; fingerprint: string }
  | { ok: false; error: string; durationMs: number } {
  const started = Date.now();
  const brand = loadBrandLite(input.repoRoot, input.siteId);
  if (!brand) {
    return { ok: false, error: "brand_missing", durationMs: Date.now() - started };
  }
  const fp = artifactFingerprint(brand);
  const html = renderBrandHtml(brand, input.canonicalUrl);
  const check = publicArtifactPasses(html);
  if (!check.ok) {
    return {
      ok: false,
      error: `renderer_missing:${check.missing.join(",")}`,
      durationMs: Date.now() - started,
    };
  }
  const versionDir = path.join(
    input.artifactRoot,
    input.siteId,
    input.version.replace(/[:.]/g, "-"),
    "out",
  );
  mkdirSync(versionDir, { recursive: true });
  writeFileSync(path.join(versionDir, "index.html"), html);
  writeFileSync(path.join(versionDir, "ros-artifact.json"), JSON.stringify({
    renderer: STATIC_RENDERER_VERSION,
    fingerprint: fp,
    siteId: brand.siteId,
    version: input.version,
    builtAt: new Date().toISOString(),
  }));

  const email = brand.supportEmail || `care@${brand.siteId}.com`;
  mkdirSync(path.join(versionDir, "legal", "privacy"), { recursive: true });
  mkdirSync(path.join(versionDir, "legal", "terms"), { recursive: true });
  mkdirSync(path.join(versionDir, "legal", "refunds"), { recursive: true });
  writeFileSync(
    path.join(versionDir, "legal", "privacy", "index.html"),
    legalPage(
      brand,
      "Privacy",
      `<p>We collect the email used at checkout to deliver the download and respond to support. We do not sell personal data. Payment is processed by Stripe.</p>`,
    ),
  );
  writeFileSync(
    path.join(versionDir, "legal", "terms", "index.html"),
    legalPage(
      brand,
      "Terms",
      `<p>${esc(brand.product.name)} is a digital download sold by ${esc(brand.displayName)}. You receive the files described on the product page. This is not legal, medical, or professional advice.</p>`,
    ),
  );
  writeFileSync(
    path.join(versionDir, "legal", "refunds", "index.html"),
    legalPage(
      brand,
      "Refunds",
      `<p>If the download is defective or you cannot access the files, email ${esc(email)} within 14 days. We do not fabricate reviews or usage counts.</p>`,
    ),
  );

  mkdirSync(path.join(versionDir, "success"), { recursive: true });
  writeFileSync(
    path.join(versionDir, "success", "index.html"),
    `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Success — ${esc(brand.displayName)}</title>
<meta name="ros-artifact" content="${fp}"/>
<style>${css(brand)}</style>
</head><body>
<nav class="site-nav"><a class="brand-mark" href="/">${esc(brand.displayName)}</a></nav>
<main class="wrap section">
<h1>Payment received</h1>
<p>Thanks for buying ${esc(brand.product.name)}.</p>
<p id="status">Confirming fulfillment…</p>
<p id="dl" hidden></p>
<p class="note">Support: <a href="mailto:${esc(email)}">${esc(email)}</a></p>
</main>
<script>
(function(){
  var q=new URLSearchParams(location.search);
  var sid=q.get('session_id');
  var status=document.getElementById('status');
  var dl=document.getElementById('dl');
  if(!sid){status.textContent='If your download is missing, contact ${esc(email)}'; return;}
  fetch('/api/fulfillment?session_id='+encodeURIComponent(sid)).then(function(r){return r.json()}).then(function(d){
    if(d && d.downloadUrl){
      status.textContent='Payment confirmed.';
      dl.hidden=false;
      dl.innerHTML='<a class="btn" href="'+d.downloadUrl+'">Download your files</a>';
    } else {
      status.textContent='Payment received — fulfillment is finalizing. Refresh in a moment.';
    }
  }).catch(function(){ status.textContent='Payment received — refresh shortly for your download link.'; });
})();
</script>
</body></html>`,
  );
  const guides = guidesFor(brand);
  mkdirSync(path.join(versionDir, "guides"), { recursive: true });
  writeFileSync(
    path.join(versionDir, "guides", "index.html"),
    renderGuidesIndexHtml({
      brand,
      guides,
      canonicalUrl: input.canonicalUrl,
      fingerprint: fp,
      rendererVersion: STATIC_RENDERER_VERSION,
    }),
  );
  for (const guide of guides) {
    mkdirSync(path.join(versionDir, "guides", guide.slug), { recursive: true });
    writeFileSync(
      path.join(versionDir, "guides", guide.slug, "index.html"),
      renderGuideHtml({
        brand,
        guide,
        related: guides,
        canonicalUrl: input.canonicalUrl,
        fingerprint: fp,
        rendererVersion: STATIC_RENDERER_VERSION,
      }),
    );
  }

  writeFileSync(
    path.join(versionDir, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${input.canonicalUrl}/sitemap.xml\n`,
  );
  writeFileSync(
    path.join(versionDir, "sitemap.xml"),
    sitemapXml(
      input.canonicalUrl,
      guides,
      new Date().toISOString().slice(0, 10),
    ),
  );

  const current = path.join(input.artifactRoot, input.siteId, "current");
  mkdirSync(path.dirname(current), { recursive: true });
  const tmpLink = path.join(
    input.artifactRoot,
    input.siteId,
    `.current-next-${Date.now().toString(36)}`,
  );
  const link = spawnSync("ln", ["-sfn", versionDir, tmpLink], { encoding: "utf8" });
  if (link.status === 0) {
    const moved = spawnSync("mv", ["-Tf", tmpLink, current], { encoding: "utf8" });
    if (moved.status !== 0) {
      spawnSync("rm", ["-f", tmpLink]);
      mkdirSync(current, { recursive: true });
      cpSync(versionDir, current, { recursive: true });
    }
  } else {
    mkdirSync(current, { recursive: true });
    cpSync(versionDir, current, { recursive: true });
  }

  return {
    ok: true,
    artifactDir: current,
    durationMs: Date.now() - started,
    fingerprint: fp,
  };
}
