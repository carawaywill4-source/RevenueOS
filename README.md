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

## Persistent operator mode

The default RevenueOS form runs each business in a Vercel Cron burst (60s /
tick, hourly). A second, longer-form runs the same brain in a persistent
process. Both forms share the Supabase ledger and either can drive a business
at any time — the operator is an accelerator, not a hard dependency.

Layout:

- `services/operator/` — long-lived process. Fly.io deploy in <5 min.
- `services/browser-sidecar/` — local Playwright HTTP service that gives the
  operator access to the owner's real logged-in browser sessions (Reddit,
  Hacker News, Indie Hackers, Substack, Quora).
- `apps/dashboard/` — Next.js owner UI: portfolio overview, pending draft
  queue, channel registry, buyer leads, live operator log stream.
- `supabase/migrations/20260810_revenueos_operator_claims.sql` — the
  cron ⇄ operator handoff table plus the owner draft table.

5-minute setup:

```bash
# 1. Fly the operator (persistent brain)
fly launch --no-deploy --copy-config -c services/operator/fly.toml
fly secrets set SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
  SIDECAR_URL=… SIDECAR_TOKEN=… OPENAI_API_KEY=…
fly deploy -c services/operator/fly.toml

# 2. Sidecar (local, one-time login per platform)
cd services/browser-sidecar
cp .env.example .env && vim .env  # set SIDECAR_TOKEN
npm install
npm run cli -- login hackernews    # repeat for reddit / indiehackers / substack / quora
npm run start                       # keep this running under pm2 or launchd

# 3. Dashboard (local)
cd apps/dashboard
cp .env.example .env.local && vim .env.local  # SUPABASE_* + DASHBOARD_TOKEN
npm run dashboard:dev
```

Top-level scripts:

- `npm run operator:dev` — run the operator locally against Supabase
- `npm run operator:deploy` — fly deploy
- `npm run sidecar:start` — local Playwright sidecar
- `npm run sidecar:cli -- login <platform>` — one-time browser login
- `npm run dashboard:dev` — owner dashboard
- `make test-all` — run operator + sidecar test suites

See `services/operator/README.md`, `services/browser-sidecar/README.md`, and
`apps/dashboard/README.md` for per-service specifics.
