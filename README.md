# TributeReady

A guided memorial website that creates editable tributes, accepts one-time
payment, and automatically delivers a private memorial page and print-ready PDF
collection.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

The guided creator works without credentials using a local preview draft.
Checkout remains disabled until every fulfillment dependency is configured, so
a customer can never pay for an order the system cannot deliver.

## Production setup

1. Create a Supabase project and run `supabase-schema.sql` in its SQL editor.
2. Add the variables from `.env.example` to Vercel.
3. Verify a sending domain with Resend and set `RESEND_FROM_EMAIL`.
4. Connect Stripe and add a webhook pointing to
   `https://your-domain.com/api/stripe/webhook` for
   `checkout.session.completed`, `checkout.session.expired`, and
   `charge.refunded`.
5. Set a long random `CRON_SECRET`; Vercel calls the daily deletion task with
   it automatically.
6. Set `NEXT_PUBLIC_APP_URL` to the production origin and deploy.

## Automated flow

- OpenAI creates a constrained structured draft from customer-supplied facts.
- Supabase creates a private pending order before checkout.
- Stripe collects a one-time $34.99 payment.
- The signed webhook generates a three-page PDF and Resend emails it.
- A private, unguessable memorial link is included in the delivery email.
- Expired checkouts remove abandoned photos, and refunded orders automatically
  lose access to their private page.
- Hashed ten-minute generation limits protect OpenAI spending without storing
  raw IP addresses.
- Vercel Cron removes source records and generated files after 30 days.

## Verification

Run `npm run lint` and `npm run build` before deployment. Use Stripe test mode
and the Stripe CLI to verify the webhook and delivery email before enabling live
payments.
