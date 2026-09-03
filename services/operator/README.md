# RevenueOS operator service

A persistent, always-on process that runs the RevenueOS pursuit brain
against N businesses in the portfolio. Replaces per-app Vercel cron
bursts with a real event loop.

## Why this exists

The serverless form has hard limits:

- 60-second wallclock per tick (Vercel Hobby)
- One tick per hour minimum latency
- Community sites (Reddit/HN/IH) block Vercel egress IPs
- Owner controls limited to the hourly digest

This service fixes all four by running the same brain in a long-lived
Node process on Fly.io. It calls the exported `runOperatorLoop` from
`@revenueos/core` — the brain stays in one place.

## Deploy to Fly.io

```bash
cd services/operator

# One-time setup (creates the fly app + attaches secrets)
fly launch --no-deploy --copy-config

# Push your Supabase credentials + sidecar link as secrets
fly secrets set \
  SUPABASE_URL="https://<project>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
  SIDECAR_URL="https://<your-sidecar-tunnel>" \
  SIDECAR_TOKEN="<shared-secret>" \
  OPENAI_API_KEY="<openai-key>" \
  RESEND_API_KEY="<resend-key>"

# Deploy
fly deploy
```

Fly's smallest paid tier (shared-cpu-1x @ 512MB) costs ~$3/mo and keeps
`min_machines_running = 1` so the loop never pauses. The service will
survive on the free allowance for small portfolios; adjust
`min_machines_running` if you need to cut costs further.

## Run locally

```bash
cd services/operator
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY at minimum
npm install
npm run dev
```

The health server binds to `:8080`. Visit `http://localhost:8080/status`
for a JSON snapshot of every business the scheduler is running.

## Env

| Name                          | Required | Description                                             |
| ----------------------------- | -------- | ------------------------------------------------------- |
| `SUPABASE_URL`                | yes      | Portfolio Supabase project URL                          |
| `SUPABASE_SERVICE_ROLE_KEY`   | yes      | Service role key (writes pursuits/events)               |
| `SIDECAR_URL`                 | no       | Base URL of the browser sidecar                         |
| `SIDECAR_TOKEN`               | no       | Shared secret sent as `X-Sidecar-Token`                 |
| `SIDECAR_DRY_RUN`             | no       | `1` = draft-and-preview only, never publishes           |
| `OPERATOR_NAME`               | no       | Identifier written into `revenueos_operator_claims`     |
| `MAX_CONCURRENCY`             | no       | Max simultaneous business ticks (default 3)             |
| `PER_BUSINESS_MIN_INTERVAL_MS`| no       | Min ms between ticks per business (default 30000)       |
| `TICK_BUDGET_MS`              | no       | ms budget inside one pursuit tick (default 180000)      |
| `MAX_JOBS_PER_TICK`           | no       | drain cap per tick (default 24)                         |
| `CLAIM_LEASE_MS`              | no       | Lease TTL before cron takes over (default 300000)       |
| `BUSINESSES`                  | no       | Comma-separated siteId filter                           |
| `OPENAI_API_KEY`              | no       | Enables LLM strategist / research paths                 |
| `RESEND_API_KEY`              | no       | Enables cold-email limb                                 |

## Switch a business from cron to operator mode

The persistent operator and the per-app Vercel cron coordinate via
`revenueos_operator_claims` (see the migration in
`supabase/migrations/20260810_revenueos_operator_claims.sql`). The
operator writes an auto-expiring lease every time it starts a business
tick. Two ways to make the cron defer:

1. **Claim-based (recommended).** Update the app cron route to check
   `revenueos_operator_claims` and no-op when a live claim exists.
   This is idempotent and self-healing: when the operator dies the
   claim expires and the cron picks up automatically.
2. **Config-flag override.** Set `REVENUEOS_OPERATOR_HOSTED=1` on the
   app's Vercel env for a hard override that bypasses the DB check.
   Useful during migration windows.

To move one business:

1. Confirm the operator service is running: `curl fly-app/status`
2. `fly secrets set BUSINESSES="raiseready"` (or add to the list)
3. `fly deploy`
4. Watch the app's Vercel logs — you should see
   `cycleStatus=hosted_by_operator` on subsequent hourly ticks.

To roll back, remove the siteId from `BUSINESSES` and let the claim
lease expire (default 5 minutes) — cron resumes on its own.

## What breaks if the operator dies?

Nothing catastrophic:

- The `revenueos_operator_claims` lease expires within `CLAIM_LEASE_MS`
  (default 5 minutes).
- Once the lease is stale, the per-app Vercel cron on the next hourly
  tick observes no active claim and runs the pursuit tick itself.
- Pursuit state is fully durable in Supabase, so nothing is lost.

This is intentional: the operator is an *accelerator*, not a hard
dependency.

## Development notes

- The service imports `@revenueos/core` via workspace symlink. It never
  duplicates planner or selection code.
- Logs are structured JSON on stdout — pipe into `fly logs` or `jq`.
- The Playwright-based sidecar is a separate service under
  `services/browser-sidecar/`. Both share the `X-Sidecar-Token` secret.
