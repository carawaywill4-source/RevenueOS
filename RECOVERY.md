# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T19:20:00Z  
Mode: **STAGE 1 COMPLETE** — Local Postgres + RevenueOS.Data foundation (no cutover)

## Pass condition (long-term)

If Vercel and Supabase credentials disappeared, **RevenueOS Core would continue functioning**.

## Priority (binding)

**RevenueOS native infrastructure first.** Businesses wait. Vercel/Supabase migration before the 50-business portfolio.

---

# Decisions locked (2026-08-10)

| Topic | Decision |
|-------|----------|
| Postgres runtime | **Native** on Mac. Docker is **not** permanent always-on runtime. Docker only if a trusted migration utility absolutely requires it temporarily. |
| Postgres major | **15** (conda-forge `postgresql=15.18` installed under `~/.revenueos/pg-prefix`; Supabase-compatible class — no blind major upgrade) |
| Install path | Prefer system Homebrew `/opt/homebrew` when present; else **user-local micromamba/conda-forge** (no sudo). Not Docker. |
| Host proof | **Local hostname only** first |
| Supabase backup | Direct verified DB export later; never delete/modify source |
| Stripe | Test-mode browser OK; no real charges |
| Vercel | Pause nonessential; only sequential emergency cron shutdown |

---

# Prior migration phases

| Phase | Result |
|-------|--------|
| 1 | Mapped Vercel brain execution |
| 2 | Disabled cloud brain crons + hard-refuse; ~60 storefront redeploys still queued (paused) |
| 3 | Mac Core authoritative: LaunchAgent, scheduler, checkpoint, watchdog |
| Design | Native platform architecture documented |
| **Stage 1** | **Local Postgres + RevenueOS.Data + dual adapters** ← *this checkpoint* |

**Frozen:** 50-business portfolio build/deploy.

---

# STAGE 1 — DONE (2026-08-10)

## What shipped

```
RevenueOS Core (unchanged production path)
        ↓
RevenueOS.Data   (@revenueos/data)
     ↙        ↘
Supabase      Native Postgres
(adapter)     (adapter)     ← new dedicated cluster
```

| Piece | Location |
|-------|----------|
| Domain interface | `packages/revenueos-data/src/interface.ts` |
| Types (businesses, pursuits, events, lessons, experiments, claims, leases, scorecards, portfolio, jobs, activity, releases, health, config) | `packages/revenueos-data/src/types.ts` |
| Health states + bounded retry | `packages/revenueos-data/src/health.ts` → `DB_HEALTHY` / `DB_DEGRADED` / `DB_UNAVAILABLE` / `DB_RECOVERING` |
| Native Postgres adapter | `packages/revenueos-data/src/adapters/postgres.ts` |
| Supabase adapter | `packages/revenueos-data/src/adapters/supabase.ts` |
| Factory (`REVENUEOS_DATA_PROVIDER`) | `packages/revenueos-data/src/create.ts` — **default remains supabase** |
| Infra CLI | `services/revenueos-infra` → `npm run db -- …` |
| Baseline schema | `services/revenueos-infra/migrations/0001_baseline.sql` (`ros_*` tables) |

## CLI surface (owned)

```bash
npm run db -- prepare    # install/prepare native PG 15
npm run db -- start
npm run db -- stop
npm run db -- restart
npm run db -- health
npm run db -- migrate    # advisory-locked
npm run db -- backup [label]
npm run db -- restore <file>
npm run db -- info
```

## Dedicated layout (not system Postgres)

| Path | Role |
|------|------|
| `~/.revenueos/pg-prefix` | PostgreSQL 15 binaries (conda-forge) |
| `~/.revenueos/pg/data` | Dedicated data directory |
| `~/.revenueos/pg/runtime` | Unix sockets |
| `~/.revenueos/config/database.json` | Managed config metadata |
| `~/.revenueos/backups` | `pg_dump` output |
| Port **55432** | Local-only listen (`127.0.0.1`) |
| DB/user `revenueos` | Dedicated role/database |

## Proofs completed

- [x] Native PostgreSQL starts (`pg_ctl`)
- [x] Health check accepts connections
- [x] Migrations execute (`0001_baseline.sql`)
- [x] Test data write/read inside transaction via `RevenueOS.Data`
- [x] PostgreSQL restart → adapter reconnects → state remains
- [x] Supabase adapter still implements interface (health + experiments read)
- [x] **No production data cutover**
- [x] **No Supabase source delete/modify**
- [x] Default provider remains Supabase (production path intact)

## Resilience (Stage 1)

- Bounded exponential backoff (`withRetry`, max 5, capped delay)
- Health states for Supervisor
- Migration advisory lock (`pg_advisory_lock`)
- Transaction boundaries on Postgres adapter (`BEGIN`/`COMMIT`/`ROLLBACK`)
- Temporary DB unavailability must not kill Core (health returns degraded/unavailable; no tight infinite loop)

## Mac restart (target — not fully wired in Stage 1)

Eventually: LaunchAgent → Postgres available → Supervisor → scheduler/queue/workers/SiteVault.  
Stage 1 provides `db start/health` primitives the Supervisor will call later. **UI does not own lifecycle.**

---

# A–G (dependency maps + architecture)

Prior maps remain valid: Vercel class-A mostly refused; Supabase still production truth; Mac Core authoritative; proof business = **ScopeGuard**; Host = local hostname first.

Architecture target unchanged:

```
Supervisor → Resource Governor → Scheduler → Durable Queue → Workers
Data (Postgres) · Storage · SiteVault · Host · Config · Observability
```

---

# STAGE 2 — SMALLEST NEXT OPERATION (do not start until instructed)

**Verified Supabase export → restore into RevenueOS Postgres → verify (no cutover).**

Exact first operation:

1. Using existing RevenueOS credentials, open a **direct PostgreSQL connection** to the Supabase project (session/pooler URL already in env if present — prefer `DATABASE_URL` / `SUPABASE_DB_URL` / service connection string; **not** flaky REST dump APIs).
2. If direct PG credentials are missing/insufficient → **stop and ask** (only blocker).
3. `pg_dump` **only RevenueOS-owned schemas/tables** (the `revenueos_*` set + any confirmed app tables Core needs) — exclude Supabase-internal (`auth`, `storage`, `realtime`, `supabase_*`).
4. Store dump under `~/.revenueos/backups/` with checksum.
5. Validate dump (list tables / restore dry-check).
6. Restore into dedicated RevenueOS Postgres (separate schema or import DB — **not** overwriting production Supabase).
7. Verify: schema, row counts, important-record spot checks.
8. **Still no cutover** — Core keeps writing to Supabase until a later dual-write stage.

Do **not** begin Stage 2 until explicitly told.

---

# DO NOT DO

- Data cutover / delete Supabase
- Portfolio builds / 50-business loads
- Parallel Vercel redeploys (except sequential emergency cron kill if still firing)
- Queue + scheduler + host + browser in the same batch
- Begin Stage 2 without instruction

## Current step

**STAGE 1 COMPLETE. STOPPED.** Await instruction to begin Stage 2 (verified export/import only).
