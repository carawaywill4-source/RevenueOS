/**
 * Until a stranger pays, concentrate fire on one live product.
 * Spreading ticks across InvoiceChaser × dead forums is not evolution.
 */

import type pg from "pg";
import { GUMROAD_LIVE } from "./offer.js";

export const FIRST_CUSTOMER_BUSINESS = "buildgrid";
export const FIRST_CUSTOMER_PRICE_USD = 29;

export async function countRealPurchases(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `select count(*)::int as n from ros_purchases
      where stripe_session_id not like 'cs_test_%'
        and coalesce(meta->>'payment_status','paid') <> 'unpaid'`,
  ).catch(() => ({ rows: [{ n: 0 }] }));
  return Number(r.rows[0]?.n ?? 0);
}

export function firstCustomerFrontier(purchases: number): {
  businessId: string;
  host: null;
  reason: string;
} | null {
  if (purchases > 0) return null;
  if (!GUMROAD_LIVE[FIRST_CUSTOMER_BUSINESS]) return null;
  return {
    businessId: FIRST_CUSTOMER_BUSINESS,
    host: null,
    reason: "first_customer_lock",
  };
}

export const JUNK_PLACEMENT_HOST =
  /comodo\.com|recaptcha|hcaptcha|cloudflarechallenge|godaddy\.com|namecheap\.com|whois\.|w3\.org|schema\.org|stackoverflow\.com|github\.com\/login/i;

export function isJunkPlacementHost(host: string): boolean {
  return JUNK_PLACEMENT_HOST.test(host);
}
