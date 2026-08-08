import { BRAND } from "@/lib/brand";
import { checkoutAllowed } from "@/lib/readiness";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function HomePage() {
  const live = checkoutAllowed();
  const mode = "subscription";
  return (
    <main>
      <header
        style={{
          background: "var(--brand)",
          color: "#fafafa",
          padding: "4rem 1.25rem 3rem",
        }}
      >
        <div className="wrap" style={{ paddingTop: 0 }}>
          <p style={{ opacity: 0.8, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.8rem" }}>
            {BRAND.displayName}
          </p>
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)" }}>{BRAND.product.name}</h1>
          <p style={{ maxWidth: "38ch", fontSize: "1.1rem" }}>{BRAND.product.tagline}</p>
          <p style={{ fontSize: "1.4rem", fontWeight: 600 }}>
            ${BRAND.product.priceUsd}
            {mode === "subscription" ? "/mo" : " per run"}
          </p>
          <CheckoutButton enabled={live} />
        </div>
      </header>
      <div className="wrap">
        <ul>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p>
          Activation is automatic after Stripe payment
          {mode === "usage"
            ? " — your rewrite credits unlock immediately."
            : " — your workspace unlocks immediately."}
        </p>
        <p>
          <a href="/app">Open app</a> · <a href="/legal/refunds">Refunds</a>
        </p>
      </div>
    </main>
  );
}
