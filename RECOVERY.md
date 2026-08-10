# RevenueOS Crash Recovery + Mac Migration Log

Last updated: 2026-08-10T18:35:00Z

## Original objective (PRIORITY)

**STOP business building.** Get RevenueOS **out of Vercel** as the autonomous brain.

- **Vercel:** websites, checkout/webhooks, lightweight APIs, limbs only.
- **Mac:** home of RevenueOS brain + continuous autonomy.

---

# PHASE STATUS

| Phase | Goal | Status |
|-------|------|--------|
| **1** | Map cloud autonomous execution | **DONE** (`5d6a06c`) |
| **2** | Disable cloud brain (crons + hard refuse); keep storefronts | **DONE (local + critical prod)** — remaining storefront redeploys queued |
| **3** | Mac engine authoritative | NEXT |
| **4** | E2E proof (tick, durable state, kill/restart, Vercel not brain) | PENDING |
| **5** | STOP — no 50-business build | PENDING |

---

# PHASE 2 — DISABLE CLOUD BRAIN (checkpoint)

## What changed

### Root TributeReady (PROD LIVE)
- `vercel.json`: removed `/api/cron/daily-growth-review` (minute hunt) and `/api/cron/portfolio-digest` (hourly orchestration).
- Kept only: `/api/cron/cleanup` (daily) + `/api/cron/growth-report` (weekly).
- Routes hard-refuse autonomy unless `REVENUEOS_VERCEL_BRAIN=1` (never set in prod):
  - `src/app/api/cron/daily-growth-review/route.ts` → `refused_cloud_brain`
  - `src/app/api/cron/portfolio-digest/route.ts` → `refused_cloud_orchestration`
- `tsconfig.json`: exclude `tests`/`services`/… so root deploy typecheck doesn’t pull operator tests.
- **Deployed:** `dpl_AQwa8NyNTN5DZewSFxNyiLQfd7ct` → https://tributeready.org
- **Proof:** `vercel cron ls` on tributeready → **only cleanup + growth-report** (no minute brain).

### All storefront apps (LOCAL + partial PROD)
- **62/62** `apps/*/vercel.json` → `"crons": []`
- **62/62** `/api/cron/revenueos` routes: hard-refuse before `runPursuitTick` unless `REVENUEOS_VERCEL_BRAIN=1`
- **PROD already cleared:** BidBinder (Phase 1), InvoiceChaser (Phase 2 deploy `dpl_HS4VZmaxE5t3hj5zNCLKVr5j8h4M`, cron ls empty)
- **Still need one-at-a-time redeploy** for remaining ~60 projects so empty crons + refuse code take effect in production.

## Targeted validation
- Local: root cron list, refuse-before-hunt ordering, 62 empty crons, 62 refuse guards — PASS
- `npx tsx --test tests/operator-claims-fail-closed.test.ts` — 7/7 PASS
- Prod tributeready cron ls — PASS (2 non-brain jobs only)
- Prod invoicechaser cron ls — empty (expected)

## Fail-closed rule (now)
Any accidental invoke of autonomous Vercel routes without `REVENUEOS_VERCEL_BRAIN=1` returns skip / refuse — does **not** call `runPursuitTick` / `runContinuousHunt`.

## Remaining Phase 2 queue (do NOT batch)
Redeploy remaining storefronts **one project at a time** (empty crons already in git). No business rebuilds — deploy only.

## Next exact action (Phase 3)
Make Mac Core the authoritative engine: durable queue, worker supervision, crash recovery, controlled concurrency. No portfolio build.

## Do not do
- Build the 50 businesses
- Parallel multi-app deploys
- Re-enable `REVENUEOS_VERCEL_BRAIN`
- Load heavy build trees into agent context
