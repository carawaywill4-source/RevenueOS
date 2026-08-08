"use client";

/**
 * Client-safe checkout gate. Server still enforces ownerGates() in /api/checkout.
 * NEXT_PUBLIC_MENDHAUS_CHECKOUT=1 is flipped only after Stripe + supplier + DB
 * are actually connected — never to fake a live store.
 */
export function checkoutAllowed() {
  return process.env.NEXT_PUBLIC_MENDHAUS_CHECKOUT === "1";
}
