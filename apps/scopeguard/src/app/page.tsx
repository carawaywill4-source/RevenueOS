import { BRAND } from "@/lib/brand";
import { checkoutAllowed, ownerGates } from "@/lib/readiness";
import { CheckoutButton } from "@/components/CheckoutButton";

export default function HomePage() {
  const live = checkoutAllowed();
  const gates = ownerGates();
  const blocked = gates.filter((g) => !g.ok);

  return (
    <>
      <header className="site-header">
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <p
            style={{
              opacity: 0.85,
              margin: 0,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontSize: "0.78rem",
            }}
          >
            {BRAND.displayName}
          </p>
          <h1
            style={{
              fontSize: "clamp(2.1rem, 5vw, 3.1rem)",
              margin: "0.75rem 0 0.85rem",
              maxWidth: "18ch",
            }}
          >
            {BRAND.product.name}
          </h1>
          <p
            style={{
              fontSize: "1.12rem",
              maxWidth: "36ch",
              opacity: 0.94,
              lineHeight: 1.45,
            }}
          >
            {BRAND.product.tagline}
          </p>
          <p style={{ marginTop: "1.5rem", fontSize: "1.55rem", fontWeight: 600 }}>
            ${BRAND.product.priceUsd}
          </p>
          <div style={{ marginTop: "1.25rem" }}>
            <CheckoutButton enabled={live} />
          </div>
          {!live && (
            <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
              Checkout opens when payment and fulfillment are verified
              {blocked.length ? ` — ${blocked.map((b) => b.id).join(", ")}` : ""}.
            </p>
          )}
        </div>
      </header>

      <main id="main">
        <div className="wrap">
          <h2>Who it is for</h2>
          <p>
            {BRAND.product.audience}. If clients keep adding “one small thing”
            after the quote, you need a boundary you can send in writing — not
            another vague reminder email.
          </p>

          <h2>The job this pack does</h2>
          <p>
            Help you establish professional boundaries and get paid when project
            scope expands. The files are tools for that job — not a substitute
            for attorney advice on high-stakes contracts.
          </p>

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>What is inside</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Instant download after Stripe confirms payment. Four Markdown
              guides you can copy into your docs or convert to PDF/DOCX.
            </p>
            <ul className="pack-list">
              <li>
                <strong>readme.md</strong> — how to use the pack on a live project
              </li>
              <li>
                <strong>guide-01.md</strong> — statement of work language for
                design, writing, and development
              </li>
              <li>
                <strong>guide-02.md</strong> — change-order form (scope, fee,
                approval)
              </li>
              <li>
                <strong>guide-03.md</strong> — kickoff questionnaire + late-payment
                reminder scripts
              </li>
            </ul>
          </div>

          <h2>What you get</h2>
          <ul className="pack-list">
            {BRAND.product.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          <h2>How it works</h2>
          <ol className="pack-list">
            <li>Pay once via Stripe Checkout.</li>
            <li>Open the success page and download your files.</li>
            <li>Fill the SOW before work starts; use the change order when scope moves.</li>
          </ol>

          <h2>After you pay</h2>
          <p>
            Stripe confirms payment → instant download. No shipping. Full refund
            within 14 days if unused — see{" "}
            <a href="/legal/refunds">refunds</a>,{" "}
            <a href="/legal/terms">terms</a>, and{" "}
            <a href="/legal/privacy">privacy</a>.
          </p>

          <p className="muted">
            Questions:{" "}
            <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>
          </p>
        </div>
      </main>

      <footer className="site-footer">
        <div className="wrap">
          <p style={{ margin: 0 }}>
            {BRAND.displayName} · ${BRAND.product.priceUsd} · Not legal advice
          </p>
        </div>
      </footer>
    </>
  );
}
