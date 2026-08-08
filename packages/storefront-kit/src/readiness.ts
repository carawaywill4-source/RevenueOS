/**
 * Day-1 fulfillment gates for digital commerce.
 * Never open checkout without assets + Stripe + delivery path.
 */

export type OwnerGate = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export function digitalOwnerGates(input: {
  stripeSecret: boolean;
  stripeWebhook: boolean;
  assetsExist: boolean;
  resend?: boolean;
  supabase?: boolean;
}): OwnerGate[] {
  return [
    {
      id: "stripe",
      label: "Stripe secret key",
      ok: input.stripeSecret,
      detail: input.stripeSecret ? "Configured" : "Set STRIPE_SECRET_KEY",
    },
    {
      id: "stripe-webhook",
      label: "Stripe webhook secret",
      ok: input.stripeWebhook,
      detail: input.stripeWebhook
        ? "Configured"
        : "Set STRIPE_WEBHOOK_SECRET",
    },
    {
      id: "assets",
      label: "Product assets on disk",
      ok: input.assetsExist,
      detail: input.assetsExist
        ? "Download files present"
        : "Missing content/product assets — OWNER_BLOCKED_FULFILLMENT",
    },
    {
      id: "resend",
      label: "Receipt email (optional for LIVE)",
      ok: input.resend !== false,
      detail: input.resend === false ? "Resend not configured" : "OK or optional",
    },
  ];
}

/** Checkout requires Stripe + real product assets. Supabase optional (file ledger fallback). */
export function digitalCheckoutAllowed(gates: OwnerGate[]): boolean {
  const need = new Set(["stripe", "stripe-webhook", "assets"]);
  return gates.filter((g) => need.has(g.id)).every((g) => g.ok);
}
