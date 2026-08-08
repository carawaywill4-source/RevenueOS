"use client";

import { useState } from "react";

type TrackRow = {
  id: string;
  status: string;
  created_at: string;
  tracking_number: string | null;
  carrier: string | null;
};

export function TrackForm() {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<TrackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOrders(null);
    try {
      const response = await fetch("/api/order/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { orders?: TrackRow[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Lookup failed");
      setOrders(data.orders ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void lookup(e)} className="mt-8 space-y-4">
      <label className="block text-sm">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-ink px-5 py-2 text-sm text-paper disabled:opacity-40"
      >
        {busy ? "Looking up…" : "Find orders"}
      </button>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      {orders ? (
        orders.length === 0 ? (
          <p className="text-sm text-ink/70">No orders for that email.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-line bg-paper p-4">
                <p className="font-medium capitalize">{order.status.replaceAll("_", " ")}</p>
                <p className="text-xs text-ink/55">
                  {new Date(order.created_at).toLocaleDateString()} · {order.id.slice(0, 8)}
                </p>
                {order.tracking_number ? (
                  <p className="mt-2">
                    {order.carrier}: {order.tracking_number}
                  </p>
                ) : (
                  <p className="mt-2 text-ink/60">Tracking not assigned yet.</p>
                )}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </form>
  );
}
