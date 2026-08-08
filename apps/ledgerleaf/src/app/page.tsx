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
          background: "linear-gradient(160deg, var(--brand) 0%, #0a1f18 70%)",
          color: "#f7f4ef",
          padding: "4.5rem 1.25rem 3.5rem",
        }}
      >
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p style={{ opacity: 0.85, margin: 0, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {BRAND.displayName}
          </p>
          <h1 style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", margin: "0.6rem 0 0.8rem", maxWidth: "14ch" }}>
            {BRAND.product.name}
          </h1>
          <p style={{ fontSize: "1.15rem", maxWidth: "36ch", opacity: 0.92 }}>
            {BRAND.product.tagline}
          </p>
          <p style={{ marginTop: "1.5rem", fontSize: "1.5rem", fontWeight: 600 }}>
            ${BRAND.product.priceUsd}
          </p>
          <div style={{ marginTop: "1.25rem" }}>
            <CheckoutButton enabled={live} />
          </div>
          {!live && (
            <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
              Checkout opens when payment + fulfillment are verified
              {blocked.length ? ` — ${blocked.map((b) => b.id).join(", ")}` : ""}.
            </p>
          )}
        </div>
      </header>

      <div className="wrap">
        <h2>What you get</h2>
        <p>{BRAND.product.description}</p>
        <ul>
          {BRAND.product.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <h2>After you pay</h2>
        <p>
          Stripe confirms payment → you receive an instant download link. No
          shipping. 14-day refund if the files are unused — see{" "}
          <a href="/legal/refunds">refunds</a>.
        </p>
        <p>
          <a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a> ·{" "}
          <a href="/owner">Owner</a>
        </p>
      </div>
    </main>
  );
}
