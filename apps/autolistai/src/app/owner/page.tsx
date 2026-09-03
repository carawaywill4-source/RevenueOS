import { BRAND } from "@/lib/brand";
import { ownerGates, checkoutAllowed } from "@/lib/readiness";
import { purchaseStats } from "@/lib/purchases";

export default async function OwnerPage() {
  const gates = ownerGates();
  const stats = await purchaseStats();
  return (
    <main className="wrap">
      <h1>{BRAND.displayName} owner</h1>
      <p>Sequence #{BRAND.sequenceIndex} · {BRAND.industry}</p>
      <p>
        Checkout {checkoutAllowed() ? "LIVE" : "BLOCKED"} · Purchases {stats.purchases} ·
        Revenue ${stats.revenueUsd.toFixed(2)}
      </p>
      <h2>Gates</h2>
      <ul>
        {gates.map((g) => (
          <li key={g.id}>
            {g.ok ? "OK" : "BLOCKED"} — {g.label}: {g.detail}
          </li>
        ))}
      </ul>
    </main>
  );
}
