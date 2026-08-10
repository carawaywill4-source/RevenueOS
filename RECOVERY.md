# RevenueOS Crash Recovery + Mac Migration Log

Last updated: 2026-08-10T18:52:00Z

## Original objective (PRIORITY)

**STOP business building.** Get RevenueOS **out of Vercel** as the autonomous brain.

- **Vercel:** websites, checkout/webhooks, lightweight APIs, limbs only.
- **Mac:** home of RevenueOS brain + continuous autonomy.

---

# PHASE STATUS

| Phase | Goal | Status |
|-------|------|--------|
| **1** | Map cloud autonomous execution | **DONE** |
| **2** | Disable cloud brain (crons + hard refuse) | **DONE** (remaining storefront redeploys queued) |
| **3** | Mac engine authoritative | **DONE** (checkpoint + supervision + authority) |
| **4** | E2E proof (tick, durable state, kill/restart, Vercel not brain) | NEXT |
| **5** | STOP — no 50-business build | PENDING |

---

# PHASE 3 — MAC ENGINE AUTHORITATIVE (checkpoint)

## Already present (reused)
- LaunchAgent `com.revenueos.core` with **KeepAlive** (auto-restart)
- Portfolio scheduler + semaphore concurrency + per-business isolation (`try/catch` per tick)
- Tick watchdog (hung tick cannot hold slot forever)
- Heartbeats on `:8080`
- Local file ledger when Supabase REST hangs (Phase 2-era degraded path)

## What Phase 3 added
1. **`engine-checkpoint.ts`** — durable `.data/operator-engine-checkpoint.json` (authority=mac); throttled persist; restore `nextEligibleAt` / last tick stats on boot (leases re-acquired).
2. **Scheduler** — `setStatusPersist` / `hydrateFromStatuses`; watchdog retained; removed per-tick AbortSignal listener leak.
3. **`index.ts`** — declares `REVENUEOS_MAC_BRAIN=1`, process-level uncaught/rejection logging (no process death from one failure), `/status.engine` block:
   - `authority: "mac"`, `macBrain`, `vercelBrainAllowed`, checkpoint path/time, concurrency limits, `supervision: launchd_keepalive`
4. **LaunchAgent plist** (+ template) — env `REVENUEOS_MAC_BRAIN=1`, `REVENUEOS_MODE=LIVE`, `REVENUEOS_VERCEL_BRAIN=0`

## Live verification (this machine)
- `/status` → `engine.authority=mac`, `macBrain=true`, `vercelBrainAllowed=false`
- Checkpoint file written: `.data/operator-engine-checkpoint.json` (50 businesses)
- `last_core_tick` advancing; businesses completing ticks under concurrency=3
- Targeted test: `npx tsx --test tests/engine-checkpoint.test.ts` — PASS

## Engine capability matrix

| Requirement | Status |
|-------------|--------|
| Persistent scheduler | YES |
| Durable job queue | YES (pursuit ledger file/Supabase) + runtime checkpoint |
| Worker supervision | YES (launchd KeepAlive) |
| Heartbeats | YES |
| Crash recovery / auto restart | YES (KeepAlive) |
| Persisted checkpoints | YES (engine-checkpoint.json) |
| Controlled concurrency | YES (MAX_CONCURRENCY) |
| Resource limits | YES (tick budget + watchdog) |
| Resumable unfinished work | YES (ledger + schedule hydrate) |
| One business fail ≠ engine crash | YES (per-tick catch + process handlers) |

## Next exact action (Phase 4)
E2E proof only: intentional kill → LaunchAgent restart → checkpoint restore → tick resumes; confirm Vercel not brain; Activity reflects real ticks. **No business building.**

## Do not do
- Build the 50 businesses
- Parallel multi-app deploys
- Re-enable `REVENUEOS_VERCEL_BRAIN`
