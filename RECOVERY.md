# RevenueOS Crash Recovery + Mac Migration Log

Last updated: 2026-08-10T18:25:00Z

## Original objective (UPDATED — PRIORITY CHANGE)

**STOP business building.** Get RevenueOS **out of Vercel** as the autonomous brain.

Target architecture:
- **Vercel:** customer websites, checkout/webhooks, lightweight stateless APIs only. **No** autonomous RevenueOS loops.
- **Mac:** home of RevenueOS — brain, FORGE, portfolio orchestration, workers, queues, scheduler, learning, acquisition, experimentation, business lifecycle, continuous autonomy.

Do **not** build/deploy/configure the 50 businesses except where required to stop cloud brain execution.

## Prior recovery (still valid)

| Step | Scope | Status |
|------|-------|--------|
| 0–1 | Inventory + disable BidBinder cron locally | DONE |
| 2 | Deploy BidBinder only — prod crons empty (`vercel cron ls` none) | DONE |
| 3 | Fail-closed claim lookup + BidBinder vendor sync + targeted tests | DONE (`b7ecf73`) |
| 4 | Mac Core tick proof (partially in tree; superseded by migration phases) | PAUSED → fold into Phase 3–4 |
| 50-business build | Soft-retire + scaffolds exist | **FROZEN** |

---

# PHASE 1 — EXECUTION MAP (DONE)

Inspected with bounded inventory only (no portfolio build, no mass deploy).

## A. Per-storefront Vercel brain (PRIMARY STORM SOURCE)

| Item | Finding |
|------|---------|
| Schedule | `apps/*/vercel.json` → `"schedule": "* * * * *"` path `/api/cron/revenueos` |
| Count | **61 apps still minute-cron**; **1 cleared** (`bidbinder` → `"crons": []`, deployed) |
| Route | `apps/*/src/app/api/cron/revenueos/route.ts` — **62 copies** |
| Behavior | All call `runPursuitTick` (`maxDuration = 300`) after `checkOperatorHosting` |
| Guard | All 62 have hosted early-return (`hosted_by_operator` / `skipped: true`) |
| Fail-closed | Core `operator-claims.ts` returns hosted on Supabase lookup failure; **BidBinder vendor synced**. Other apps’ `vendor/revenueos` may still be stale fail-open until Phase 2 |
| Dual-run risk | When Mac claim missing/expired **and** cron still scheduled → Vercel becomes brain |

**Classification:** AUTONOMOUS BRAIN ON VERCEL — must disable in Phase 2.

## B. Root TributeReady project crons (`vercel.json` at repo root)

| Path | Schedule | Role | Brain? |
|------|----------|------|--------|
| `/api/cron/daily-growth-review` | `* * * * *` (every minute) | `runContinuousHunt` → **`runPursuitTick`**, `maxDuration=300`, self-chains hunts | **YES — AUTONOMOUS** |
| `/api/cron/portfolio-digest` | `5 * * * *` (hourly) | Portfolio digest email / pulse aggregation via `@revenueos/core` helpers | **ORCHESTRATION / REPORTING** (move or thin) |
| `/api/cron/growth-report` | weekly | Aggregate growth email | Lightweight reporting (keep or Mac) |
| `/api/cron/cleanup` | daily | Order/PDF storage cleanup | **Storefront maintenance — OK on Vercel** |

Source: `src/app/api/cron/*/route.ts`, hunt impl `src/revenueos/continuous-hunt.ts`.

**Classification:** `daily-growth-review` is a second cloud brain (TributeReady). Disable/move in Phase 2.

## C. Storefront “limb” APIs (NOT the brain — keep on Vercel if short)

| Route | Count | Role | Keep on Vercel? |
|-------|-------|------|-----------------|
| `/api/owner/execute` | ~61 | Mac Core calls storefront to run **one** selected safe action | **YES** — limb only; must stay short; must not call `runPursuitTick` |
| `/api/owner/pulse` | ~61 | Readiness / purchases / recent events for digest | **YES** — read-only observation |
| `/api/owner/dialog` | ~61 | Owner dialog (auth’d) | Likely OK if non-looping |
| Checkout / Stripe webhooks / beacon | per app | Commerce + attribution ingest | **YES** — customer-facing |
| `/api/admin/fulfill` | rare | Fulfillment admin | Storefront |

Comments in execute routes already state: *“Does not host the brain — only performs selected commercial work.”*

## D. Mac (intended home — already partially live)

| Component | Path / mechanism | Role |
|-----------|------------------|------|
| LaunchAgent | `com.revenueos.core` → `services/operator/src/index.ts` via `tsx` | Persistent process, KeepAlive |
| Scheduler | `services/operator/src/lib/scheduler.ts` | Per-business loops, concurrency, tick watchdog |
| Brain tick | `runOperatorTick` / `runPursuitTick` in `@revenueos/core` | Observe→plan→drain |
| Claims | `services/operator/src/lib/claims.ts` + Supabase | Coordinate so Vercel no-ops when leased |
| Health / Activity | `:8080` `/heartbeat`, `/status`, `/owner/dashboard` | Mac UI (`macos/RevenueOS`) |
| Local degraded ledger | `.data/operator-local-ledger/*` (in working tree) | File ledger when Supabase REST hangs |
| Hosting plane | `services/hosting-plane` | Deploy manager (not minute brain) |
| Portfolio factory | `services/portfolio-factory` | **FROZEN** — do not run |

## E. What still makes Vercel the brain today

1. **61 storefront minute crons** still armed in prod (except BidBinder).
2. **TributeReady `daily-growth-review` minute cron** still armed → `runContinuousHunt`/`runPursuitTick`.
3. Fail-closed / claim guards are incomplete across vendors; unclaimed sites still allow Vercel `runPursuitTick` when cron fires.
4. Supabase outages previously fail-opened Vercel into full ticks (partially fixed in core + BidBinder only).

## F. Migration map (execution ownership)

```
BEFORE (broken split):
  Vercel cron (* * * * *) ──► runPursuitTick  (brain)
  Mac LaunchAgent        ──► runOperatorTick (brain)  + claims race
  Vercel execute/pulse   ──► limbs / reads

AFTER (target):
  Mac LaunchAgent        ──► ONLY brain (scheduler, queue, FORGE, portfolio, learning)
  Vercel                 ──► websites, checkout, webhooks, beacon, owner/execute limb, pulse
  Vercel cron/revenueos  ──► REMOVED or hard no-op (refuse brain)
  Vercel daily-growth-review ──► REMOVED / Mac-owned hunt
```

---

# PHASE PLAN (checkpointed; do not skip ahead)

| Phase | Goal | Status |
|-------|------|--------|
| **1** | Map all cloud autonomous execution → this file | **DONE** |
| **2** | Disable cloud brain (crons + hard refuse on autonomous routes); keep storefronts | NEXT |
| **3** | Mac engine authoritative (scheduler, queue, supervision, limits, resume) | PENDING |
| **4** | E2E proof: tick + durable state + kill/restart + Vercel not brain + Activity truth | PENDING |
| **5** | STOP — no 50-business build | PENDING |

## Phase 2 next exact action (do not start until continuing)

1. Empty/`[]` crons for **one** additional high-risk retired/live site OR create a shared script that only edits `vercel.json` (no business rebuild).
2. Disable root `daily-growth-review` minute schedule (or replace route with hard refuse).
3. Harden `/api/cron/revenueos` to **always refuse brain** when `REVENUEOS_MAC_BRAIN=1` / operator-hosted / fail-closed (deploy pattern TBD — one site at a time).

## Do not do

- Build/deploy the 50 businesses
- Portfolio-factory E2E
- Load `node_modules` / `.next` / `.build` into agent context
- Parallel multi-app deploys
- Treat “server started” as Phase 4 proof

## Important decisions

- Soft-retire learning preserved; business build frozen.
- Mac is home of RevenueOS; Vercel is storefront + limbs only.
- Fail closed: accidental Vercel autonomous invoke must not run the brain.
- Micro-batches only: INSPECT → CHANGE → TARGETED TEST → CHECKPOINT → UPDATE THIS FILE → NEXT.
