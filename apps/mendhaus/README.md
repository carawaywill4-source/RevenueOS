# Mendhaus

Real consumer ecommerce brand for small problem-solving home products.
Customer 2 of RevenueOS (TributeReady remains customer 1). Same portable brain, separate adapter.

Domain: **mendhaus.shop**

## What is live in this repo

- 32-SKU catalog with supplier network, COGS, shipping, fulfillment fee, Stripe fee, margin floor
- Storefront: shop, categories, product pages, cart, policies, confirmation, SEO guides
- Stripe Checkout + webhook → orders, customers, COGS/fees/profit, refunds
- Attribution: `acq:{channel}:{persona}:a{angle}`
- RevenueOS adapter + local/global lessons + hourly cron + owner journal
- Money plan on `/owner?t=TOKEN`

Checkout stays **closed** until you finish the human gates below. That is intentional — we do not fake payments or suppliers.

## Owner launch checklist (you must do these)

1. **Point mendhaus.shop** DNS at the Vercel project for `apps/mendhaus`.
2. **Create a Stripe account**, complete identity + bank payout, add a restricted key and webhook:
   - endpoint: `https://YOUR_DOMAIN/api/stripe/webhook`
   - events: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`
3. **Create a dedicated Supabase project** (do not mix TributeReady memorial PII). Run:
   - `apps/mendhaus/schema.sql`
   - `packages/revenueos/schema.sql`
4. **Open a supplier account**
   - [CJ Dropshipping](https://cjdropshipping.com/register.html) (US warehouse first)
   - and/or [Spocket](https://www.spocket.co/)
   - Map each catalog `skuHint` to a live SKU, unit cost, and stock.
   - Set `MENDHAUS_SUPPLIER_READY=1` only after that map is real.
5. **Resend**: verify sending domain, set `RESEND_FROM_EMAIL`.
6. **Tax**: register Stripe Tax where you have nexus, then `MENDHAUS_STRIPE_TAX=1`. Do not collect tax before that.
7. **IndexNow + Search Console + Bing** on the live domain.
8. Flip `NEXT_PUBLIC_MENDHAUS_CHECKOUT=1` and deploy.

RevenueOS will **never** create those accounts, spend ad budget, or agree to supplier terms for you.

## Local

```bash
cd apps/mendhaus
cp .env.example .env.local
npm install   # from repo root workspaces
npm run dev   # port 3001
```

Owner dashboard: `http://localhost:3001/owner?t=$OWNER_DASHBOARD_TOKEN`

Mark shipped (after supplier hands you tracking):

```bash
curl -X POST http://localhost:3001/api/admin/fulfill \
  -H "Authorization: Bearer $OWNER_DASHBOARD_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"…","trackingNumber":"…","carrier":"USPS"}'
```

## RevenueOS

Hourly cron: `/api/cron/revenueos` (`0 * * * *`). Organic only. Daily autonomous spend cap defaults to `$0`.

Portable interface: `src/revenueos/adapter.ts` implements `SiteAdapter`. Do not import Mendhaus into `packages/revenueos`.
