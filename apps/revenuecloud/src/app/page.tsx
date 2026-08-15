import { BRAND } from "@/lib/brand";
import { checkoutAllowed, ownerGates } from "@/lib/readiness";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function HomePage() {
  const live = checkoutAllowed();
  const gates = ownerGates();
  const blocked = gates.filter((g) => !g.ok);

  return (
    <main>
      <header
        style={{
          background: `linear-gradient(155deg, var(--brand) 0%, #0c0c0c 78%)`,
          color: "#f4f1ea",
          padding: "5rem 1.25rem 4rem",
        }}
      >
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p style={{ opacity: 0.8, margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.78rem" }}>
            {BRAND.displayName}
          </p>
          <h1 style={{ fontSize: "clamp(2.4rem, 5.5vw, 3.6rem)", margin: "0.75rem 0 0.9rem", maxWidth: "16ch", lineHeight: 1.05 }}>
            {BRAND.product.name}
          </h1>
          <p style={{ fontSize: "1.15rem", maxWidth: "38ch", opacity: 0.92, lineHeight: 1.45 }}>
            {BRAND.product.tagline}
          </p>
          <p style={{ marginTop: "1.6rem", fontSize: "1.65rem", fontWeight: 600 }}>
            ${BRAND.product.priceUsd}
          </p>
          <div style={{ marginTop: "1.35rem" }}>
            <CheckoutButton enabled={live} />
          </div>
          {!live && (
            <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.75 }}>
              Checkout opens when payment + fulfillment are verified
              {blocked.length ? ` — ${blocked.map((b) => b.id).join(", ")}` : ""}.
            </p>
          )}
        </div>
      </header>

      <div className="wrap">
        <h2>Built for {BRAND.product.audience}</h2>
        <p>{BRAND.product.description}</p>
        <h2>What you get</h2>
        <ul>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <h2>After you pay</h2>
        <p>
          Stripe confirms payment → instant download. No shipping. See{" "}
          <a href="/legal/refunds">refunds</a>,{" "}
          <a href="/legal/terms">terms</a>, and{" "}
          <a href="/legal/privacy">privacy</a>.
        </p>
      </div>
    </main>
  );
}
