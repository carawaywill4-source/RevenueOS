# RevenueOS Vercel duration spike — root cause (2026-08-10)

## Evidence
- Vercel alert: BidBinder function duration **0.09 → 1.13 GB-hours / 15 min** (~12×) during Supabase API failures.
- Mac Core overnight logs: Supabase **522 / timeouts**, then **claim_denied** storm + **tick_watchdog_timeout** (210s). Last successful `operator.tick.done` ~06:42Z; hours of useless churn after.
- Mac Activity UI empty while Core process “up”: `/owner/dashboard` blocked on Stripe money (fixed in tree).

## Exact functions producing duration
Primary: `GET /api/cron/revenueos` in each storefront (`maxDuration = 300`).
- Schedule in `vercel.json`: `* * * * *` (every minute).
- Body calls `runPursuitTick` (full pursuit brain) unless `checkOperatorHosting` returns hosted.

Also heavy: owner execute / pulse routes where present — secondary to minute cron.

## Failure cascade (the storm)
1. Supabase becomes slow/unavailable.
2. `checkOperatorHosting` previously returned **`hosted: false` on `lookup_failed`** (fail-open).
3. Every-minute Vercel cron therefore **did not skip** — ran full `runPursuitTick` (plan + drain + Supabase reads/writes) while persistence failed.
4. Failed writes → no durable completion → next minute **repeats the same work**.
5. Across **~60 apps** with the same cron (active + retired), concurrent GB-hours explode.
6. Mac Core simultaneously: claim upserts fail → `claim_denied`; hung ticks → watchdog; little useful activity recorded.

## BidBinder-specific note
BidBinder is **soft-retired** from the Mac active portfolio, so Core does **not** hold a claim lease on it. Even when Supabase is healthy, BidBinder’s minute cron still runs the full brain. Supabase outage + fail-open made that path burn duration without durable progress.

## Dual-worker collision
Mac `com.revenueos.core` LaunchAgent **and** Vercel crons both try to be the brain. Coordination depends on Supabase claim rows. When Supabase fails, coordination collapses unless claim-check **fails closed**.

## What is NOT the fix
- Raising Vercel duration/concurrency limits (would amplify the storm).
- Rebuilding the portfolio or resetting learning.

## Required direction (already partially in tree)
1. **Fail closed** on claim lookup failure → Vercel cron no-ops (in-tree: `operator-claims.ts`).
2. **Stop treating Vercel as the compute engine** — disable or drastically slow `/api/cron/revenueos` once Mac Core owns the portfolio; keep Vercel for storefront + short webhooks.
3. Mac Core: local queue, leases, circuit breaker, timeouts so Supabase outage = controlled degradation, not hang/retry storm.
4. Preserve Stripe, sites, Supabase learning — infrastructure migration only.

## Status at crash recovery
- Diagnosis: complete.
- Fail-closed + dashboard Activity fix + tick watchdog: in working tree (not yet committed).
- Cron disable / Mac circuit breaker / E2E proof: remaining.
