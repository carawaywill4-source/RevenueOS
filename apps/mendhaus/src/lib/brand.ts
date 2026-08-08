export const BRAND = {
  name: "Mendhaus",
  tagline: "Fix the room. Keep the lease.",
  domainHint: "mendhaus.shop",
  supportEmail: "care@mendhaus.shop",
  timezone: "America/Denver",
  industry: "home-goods",
  siteId: "mendhaus",
  voice:
    "Precise, adult, unhurried. Name the annoyance, the install constraint, and the ship time. No fake scarcity, no fake reviews, no miracle claims.",
  dailyRevenueTargetUsd: 10_000,
} as const;

/** Push kit AOV; flat rate still covers light single-SKU orders. */
export const SHIPPING_FLAT_USD = 6.95;
export const FREE_SHIPPING_AT_USD = 79;
export const STRIPE_PERCENT = 0.029;
export const STRIPE_FIXED_USD = 0.3;
