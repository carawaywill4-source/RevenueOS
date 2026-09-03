"use client";
import { useState } from "react";

export function CheckoutButton({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const beaconBody = {
        url: window.location.href,
        path: window.location.pathname,
        referrer: document.referrer || undefined,
      };
      fetch("/api/beacon", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...beaconBody, kind: "cta_click" }),
      }).catch(() => {});
      fetch("/api/beacon", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...beaconBody, kind: "checkout_start" }),
      }).catch(() => {});
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" type="button" disabled={!enabled || busy} onClick={buy}>
        {busy ? "Redirecting…" : "Buy — instant download"}
      </button>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
    </div>
  );
}
