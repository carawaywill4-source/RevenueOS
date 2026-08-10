# RevenueOS Crash Recovery Log

Last updated: 2026-08-10T18:20:00Z

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
- Portfolio-50 spec + soft-retire registries (mostly uncommitted outside recovery steps).
- Fail-closed claim lookup in core + BidBinder vendor (Step 3).
- Mac Activity preserve + owner dashboard Stripe 2s timeout (local, uncommitted — Step 4+).
- `docs/REVENUEOS_VERCEL_DURATION_ROOT_CAUSE.md` (uncommitted).

### Git snapshot (bounded)
- Step 1: `49cd92a` — RECOVERY.md + BidBinder empty crons
- Step 2: `c889702` — RECOVERY.md deploy proof
- Do not load `node_modules`, `.next`, `macos/RevenueOS/.build` into context.

## What is incomplete

1. **61 other apps** still have `* * * * *` crons (only BidBinder cleared in prod).
2. Other apps’ `vendor/revenueos` copies may still be fail-open (only BidBinder synced in Step 3).
3. Mac Core circuit breaker during Supabase outage.
4. Mac Core: prove one successful tick / Activity not empty (Step 4).
5. Per-business LIVE deploy/fulfillment for the 50 (queued).

## Important decisions

- Soft-retire prior portfolio; preserve learning.
- Active mode = `dynamic_only_50`.
- Mac Core = brain; Vercel = storefront/webhooks only.
- Fail closed on claim lookup failure (native error, document error, thrown/timeout).
- Micro-batches only; one business or one subsystem at a time.

## Likely crash cause

Cursor resource death from monolithic portfolio-50/factory work + loading many apps/build artifacts into one agent session.

## Smaller execution plan (queue)

| Step | Scope | Status |
|------|-------|--------|
| 0 | Inventory + create RECOVERY.md | DONE |
| 1 | Disable BidBinder minute cron locally | DONE |
| 2 | Deploy **only** BidBinder so empty crons take effect in prod | DONE |
| 3 | Local verify: BidBinder cron route + fail-closed semantics | DONE |
| 4 | Mac Core: one successful tick / Activity not empty | NEXT |
| 5 | Minimal Supabase-outage circuit breaker on Core | PENDING |
| 6 | Disable crons for next 1–3 **retired** sites only | PENDING |
| 7 | LIVE business queue: BUILD1→TEST→CHECKPOINT→NEXT | PENDING |

## Completed work (this session)

- Step 1–2: BidBinder cron emptied + prod deploy; `vercel cron ls` → none.
- Step 3 verification:
  - **FAIL-CLOSED: PASS** — `checkOperatorHosting` returns `hosted: true` with `owner: lookup_failed_fail_closed` on native 503, thrown timeout, and document 522 after native missing.
  - **CRON-ROUTE PROTECTION: PASS** — BidBinder `vercel.json` crons `[]`; route early-returns when `host.hosted` before `await runPursuitTick`; vendor matches core.
  - Fixed BidBinder vendor (was still fail-open) + document-claim HTTP errors now fail closed.
  - Targeted test: `npx tsx --test tests/operator-claims-fail-closed.test.ts` → 7/7 pass.

## Current step

Step 3 complete. STOP — do not start Step 4 until owner directs.

## Next exact action

Step 4 — Mac Core only: confirm process is up and obtain one successful tick / non-empty Activity. No portfolio deploy. No multi-app cron sweep.

## Do not do

- Rebuild all 50 businesses
- Run portfolio-factory E2E
- Load heavy build dirs into context
- Parallel multi-business work
- Deploy more than one site per step
- Begin Step 4 without owner go-ahead
