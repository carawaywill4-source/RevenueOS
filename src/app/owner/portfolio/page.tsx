import { ALL_PORTFOLIO_BRANDS } from "@revenueos/storefront-kit";
import { buildPortfolioAllocation } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export default function PortfolioOwnerPage() {
  const allocation = buildPortfolioAllocation();
  const byId = new Map(allocation.businesses.map((b) => [b.siteId, b]));

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
      <h1 style={{ fontFamily: "Georgia, serif" }}>RevenueOS portfolio</h1>
      <p>
        12 businesses: TributeReady + Mendhaus (kept) and 10 day-one digital/SaaS
        companies. Effort order is marginal expected value of the next pursuit —
        not vanity activity.
      </p>

      <h2>Effort order (next unit of work)</h2>
      <ol>
        {allocation.effortOrder.map((id) => {
          const b = byId.get(id);
          return (
            <li key={id}>
              <strong>{b?.displayName ?? id}</strong>
              {b?.firstCustomerMode ? " · FIRST_CUSTOMER_MODE" : ""}
              {" · "}
              EV proxy {b?.marginalEvProxy ?? "—"}
            </li>
          );
        })}
      </ol>

      {allocation.notes.length > 0 && (
        <>
          <h2>Notes</h2>
          <ul>
            {allocation.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Sequence experiment (new ten)</h2>
      <p>
        Hypothesis: business #10 begins with better priors than #1 via portable
        memory. Track time-to-first-sale per sequence index after deploy.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <th align="left">#</th>
            <th align="left">Brand</th>
            <th align="left">Model</th>
            <th align="left">Price</th>
            <th align="left">Industry</th>
            <th align="left">App</th>
          </tr>
        </thead>
        <tbody>
          {ALL_PORTFOLIO_BRANDS.map((brand) => (
            <tr key={brand.siteId} style={{ borderTop: "1px solid #ddd" }}>
              <td>{brand.sequenceIndex}</td>
              <td>{brand.displayName}</td>
              <td>{brand.businessModel}</td>
              <td>
                ${brand.product.priceUsd}
                {brand.businessModel.includes("subscription") ? "/mo" : ""}
              </td>
              <td>{brand.industry}</td>
              <td>
                <code>apps/{brand.siteId}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: "2rem" }}>
        <a href="/owner">← TributeReady owner</a>
      </p>
    </main>
  );
}
