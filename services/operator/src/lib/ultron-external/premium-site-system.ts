/**
 * Premium storefront design system + adversarial critics.
 * No fabricated social proof. Trust must be real.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export function premiumCss(input?: { brand?: string; accent?: string }): string {
  const brand = input?.brand ?? "#1a1a1a";
  const accent = input?.accent ?? "#2f6f4e";
  return PREMIUM_CSS_TEMPLATE.replace("__BRAND__", brand).replace("__ACCENT__", accent);
}

const PREMIUM_CSS_TEMPLATE = `@import "tailwindcss";

:root {
  --brand: __BRAND__;
  --accent: __ACCENT__;
  --bg: #f7f4ef;
  --paper: #fffcf7;
  --ink: #141414;
  --muted: #5c5852;
  --line: #e4ddd3;
  --danger: #9b2c2c;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 1.05rem;
  line-height: 1.55;
}

h1, h2, h3 {
  font-family: "Fraunces", Georgia, serif;
  letter-spacing: -0.03em;
  line-height: 1.12;
  margin: 0 0 0.6rem;
}

a { color: var(--ink); }
a:hover { color: var(--accent); }

.wrap {
  max-width: 760px;
  margin: 0 auto;
  padding: 2.25rem 1.35rem;
}

.site-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.35rem;
  border-bottom: 1px solid var(--line);
  background: var(--paper);
}

.site-nav a { text-decoration: none; font-size: 0.92rem; color: var(--muted); }
.brand-mark { font-weight: 700; color: var(--ink); letter-spacing: -0.02em; }

.hero {
  background: var(--paper);
  border-bottom: 1px solid var(--line);
  padding: 3.2rem 1.35rem 2.6rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.lede { font-size: 1.18rem; max-width: 42ch; color: var(--ink); margin: 0.75rem 0 0; }
.price { font-size: 1.7rem; font-weight: 650; margin: 1.4rem 0 0; }

.btn {
  display: inline-block;
  background: var(--brand);
  color: #fff;
  padding: 0.85rem 1.35rem;
  text-decoration: none;
  font-weight: 650;
  border: none;
  cursor: pointer;
  border-radius: 3px;
  font-size: 1rem;
}
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }

.section h2 { font-size: 1.45rem; margin-top: 0; }
.section p, .section li { color: #2a2a2a; }
.section ul { padding-left: 1.15rem; }
.section li { margin: 0.35rem 0; }

.faq details {
  border-top: 1px solid var(--line);
  padding: 0.85rem 0;
}
.faq summary { cursor: pointer; font-weight: 650; }

.site-footer {
  border-top: 1px solid var(--line);
  background: var(--paper);
  color: var(--muted);
  font-size: 0.92rem;
}
.site-footer a { color: var(--muted); margin-right: 0.9rem; }

.note { color: var(--muted); font-size: 0.92rem; }

@media (max-width: 640px) {
  .hero { padding: 2.2rem 1.1rem 1.8rem; }
  h1 { font-size: 2rem; }
  .site-nav { flex-wrap: wrap; }
}
`;

export const PREMIUM_PAGE = `import { BRAND } from "@/lib/brand";
import { checkoutAllowed, ownerGates } from "@/lib/readiness";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function HomePage() {
  const live = checkoutAllowed();
  const gates = ownerGates();
  const blocked = gates.filter((g) => !g.ok);
  const email = BRAND.supportEmail;

  return (
    <main>
      <nav className="site-nav">
        <span className="brand-mark">{BRAND.displayName}</span>
        <span>
          <a href="#offer">Offer</a>
          {" "}
          <a href="#faq">FAQ</a>
          {" "}
          <a href={\`mailto:\${email}\`}>Contact</a>
        </span>
      </nav>

      <header className="hero">
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p className="eyebrow">{BRAND.displayName}</p>
          <h1>{BRAND.product.name}</h1>
          <p className="lede">{BRAND.product.description || BRAND.product.tagline}</p>
          <p className="price">\${BRAND.product.priceUsd} · instant download</p>
          <div style={{ marginTop: "1.25rem" }} id="offer">
            <CheckoutButton enabled={live} />
          </div>
          {!live && (
            <p className="note" style={{ marginTop: "0.9rem" }}>
              Checkout opens when payment and fulfillment are verified
              {blocked.length ? \` — \${blocked.map((b) => b.id).join(", ")}\` : ""}.
            </p>
          )}
        </div>
      </header>

      <section className="wrap section">
        <h2>Who this is for</h2>
        <p>{BRAND.product.audience}</p>
        <h2>What you get</h2>
        <ul>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <h2>How delivery works</h2>
        <p>
          Pay once. Stripe confirms. You download the pack immediately. No account required
          beyond the email used at checkout. See{" "}
          <a href="/legal/refunds">refunds</a>,{" "}
          <a href="/legal/terms">terms</a>, and{" "}
          <a href="/legal/privacy">privacy</a>.
        </p>
      </section>

      <section className="wrap faq" id="faq">
        <h2>Questions</h2>
        <details open>
          <summary>What problem does this solve?</summary>
          <p>{BRAND.product.tagline}</p>
        </details>
        <details>
          <summary>Is this a subscription?</summary>
          <p>No. One payment, immediate download. No recurring charge.</p>
        </details>
        <details>
          <summary>How do I get support?</summary>
          <p>Email <a href={\`mailto:\${email}\`}>{email}</a>. We do not invent testimonials or customer counts.</p>
        </details>
      </section>

      <footer className="site-footer">
        <div className="wrap">
          <p>{BRAND.displayName} · {BRAND.domain}</p>
          <p>
            <a href="/legal/privacy">Privacy</a>
            <a href="/legal/terms">Terms</a>
            <a href="/legal/refunds">Refunds</a>
            <a href={\`mailto:\${email}\`}>{email}</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
`;

const SLOP_RE =
  /revolutionize your|transform your workflow|unlock your potential|next-generation ai|powered by ai(?!\s+that)|cutting-edge solution|seamless experience|all-in-one platform|trusted by \d|join \d+ (customers|companies)|as featured in/i;

export function detectSlop(html: string): string[] {
  const defects: string[] = [];
  if (SLOP_RE.test(html)) defects.push("generic_ai_copy");
  if (/linear-gradient\([^)]{20,}\).*linear-gradient/i.test(html)) defects.push("excessive_gradients");
  const socialHits = html.match(/testimonial|5-star|loved by/gi) ?? [];
  const antiFabrication =
    /no fabricated testimonials|do not invent testimonials|we do not invent testimonials/i.test(
      html,
    );
  if (socialHits.length > 0 && !/ros_customer/i.test(html) && !antiFabrication) {
    defects.push("possible_fabricated_social_proof");
  }
  if (/<h1[^>]*>[\s\S]{0,40}<\/h1>/.test(html) && html.includes("padding: \"5rem")) {
    defects.push("giant_empty_hero");
  }
  return defects;
}

export function applyPremiumStorefront(appDir: string): { ok: boolean; detail: string } {
  const page = path.join(appDir, "src/app/page.tsx");
  const css = path.join(appDir, "src/app/globals.css");
  if (!existsSync(page) || !existsSync(css)) {
    return { ok: false, detail: `missing page or css in ${appDir}` };
  }
  writeFileSync(css, premiumCss());
  writeFileSync(page, PREMIUM_PAGE);
  return { ok: true, detail: `wrote premium page+css in ${appDir}` };
}

export function currentPageLooksPremium(appDir: string): boolean {
  const page = path.join(appDir, "src/app/page.tsx");
  if (!existsSync(page)) return false;
  const src = readFileSync(page, "utf8");
  return src.includes("site-nav") && src.includes("id=\"faq\"") && !src.includes("linear-gradient(155deg");
}
