# RevenueOS Crash Recovery Log

Last updated: 2026-08-10T18:15:00Z

## Original objective

Keep RevenueOS **live and trustworthy** under Mac Core ownership while preserving the owner-authorized **50-business portfolio reset** (25 cashflow + 25 empire).

Immediate pre-crash objective (narrowed by user):
1. Stop overnight failure / Vercel duration storm (BidBinder alert during Supabase outage).
2. Make Mac Core “actually live” (Activity not empty; ticks durable).
3. Do **not** rebuild the portfolio monolithically.

Longer objective (paused, not cancelled):
- 50 ACTIVE businesses materialized + deployed safely, one-at-a-time.

## What survived (repo truth)

Branch: `cursor/persistent-pursuit-engine`  
Repo: `/Users/willsmacbook/Developer/tributeready`  

### Completed / present in working tree
- `packages/revenueos/src/forge/portfolio-50-spec.ts` — full 50-spec catalog.
- Soft-retire + `dynamic_only_50` mode (`portfolio-active-mode.json`, `portfolio-retired.json`, `portfolio-dynamic.json`).
- Operator wiring (uncommitted): `portfolio.ts`, `portfolio-reset.ts`, launcher/evolution/scheduler/owner-api/health-server.
- ~50 untracked scaffolded apps under `apps/*` (spot-check: pkg + page + checkout).
- Incomplete `services/portfolio-factory/` (aborted earlier).
- `docs/REVENUEOS_VERCEL_DURATION_ROOT_CAUSE.md`
- Fail-closed claim lookup in `operator-claims.ts` (local, uncommitted).
- Mac Activity preserve + owner dashboard Stripe 2s timeout (local, uncommitted).

### Git snapshot (bounded)
- Recovery Step 1 committed as `49cd92a` (RECOVERY.md + BidBinder vercel.json).
- Do not load `node_modules`, `.next`, `macos/RevenueOS/.build` into context.

## What is incomplete

1. **61 other apps** still have `* * * * *` crons (BidBinder prod cron cleared).
2. Fail-closed not proven on Vercel runtime for remaining live projects.
3. Mac Core circuit breaker during Supabase outage.
4. E2E proof: Mac tick + Vercel no-op when Core owns claim.
5. Per-business LIVE deploy/fulfillment for the 50 (queued, not started here).

## Important decisions

- Soft-retire prior portfolio; preserve learning.
- Active mode = `dynamic_only_50`.
- Mac Core = brain; Vercel = storefront/webhooks only.
- Fail closed on claim lookup failure.
- Micro-batches only; one business or one subsystem at a time.

## Likely crash cause

Cursor resource death from monolithic portfolio-50/factory work + loading many apps/build artifacts into one agent session.

## Smaller execution plan (queue)

| Step | Scope | Status |
|------|-------|--------|
| 0 | Inventory + create RECOVERY.md | DONE |
| 1 | Disable BidBinder minute cron locally | DONE |
| 2 | Deploy **only** BidBinder so empty crons take effect in prod | DONE |
| 3 | Local verify: BidBinder cron route + fail-closed semantics (no full suite) | NEXT |
| 4 | Mac Core: one successful tick / Activity not empty | PENDING |
| 5 | Minimal Supabase-outage circuit breaker on Core | PENDING |
| 6 | Disable crons for next 1–3 **retired** sites only | PENDING |
| 7 | LIVE business queue: BUILD1→TEST→CHECKPOINT→NEXT | PENDING |

## Completed work (this session)

- Recovered state; created RECOVERY.md.
- Step 1: `apps/bidbinder/vercel.json` → `"crons": []` (committed `49cd92a`).
- Step 2: `vercel deploy --prod --yes` from `apps/bidbinder` only.
  - Deployment: `dpl_GaUCM68QxCJ8VXhxJYyHYf7oSD6j` READY
  - Alias: https://bidbinder.vercel.app (HTTP 200)
  - Proof: `vercel cron ls` → **No cron jobs found** for bidbinder

## Current step

Step 2 complete.

## Next exact action

Step 3 — Local verify only: read BidBinder `/api/cron/revenueos` route + `checkOperatorHosting` fail-closed path; confirm retired/unhosted behavior without deploying other apps or running full test suites.

## Do not do

- Rebuild all 50 businesses
- Run portfolio-factory E2E
- Load heavy build dirs into context
- Parallel multi-business work
- Deploy more than one site per step
