# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T19:15:00Z  
Mode: **STAGE 2 BLOCKED** — awaiting direct Supabase PostgreSQL credentials (no cutover)

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

# STAGE 2 — VERIFIED SUPABASE → LOCAL COPY

## Status: BLOCKED (2026-08-10)

Attempted Stage 2. **Stopped before any dump/restore.**  
Production remains on Supabase. Local Stage 1 Postgres untouched by import. No cutover.

### Blocker — direct PostgreSQL credentials missing

What exists locally (REST only):

| Credential | Present? | Notes |
|------------|----------|-------|
| `SUPABASE_URL` | yes | project `buvfllemxdvmwzhvfori` (live memory) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | PostgREST only — **cannot** `pg_dump` |
| `DATABASE_URL` / `SUPABASE_DB_URL` / `DIRECT_URL` / `POSTGRES_URL` | **no** | searched root `.env*`, `services/operator/.env`, `.env.portfolio`, process env, `~/.revenueos` |
| `PGHOST` / `PGUSER` / `PGPASSWORD` | **no** | |
| `SUPABASE_ACCESS_TOKEN` | **no** | not usable as substitute for Stage 2 direct dump policy |

**Need from you (one of):**

1. **Preferred:** Supabase **Database connection string** for project `buvfllemxdvmwzhvfori`  
   - Direct: `db.<ref>.supabase.co:5432` (best for dump), or  
   - Session mode pooler URI that allows `pg_dump`  
   - Put in gitignored env as `DATABASE_URL` or `SUPABASE_DB_URL` (do not paste password into chat if you can write the file yourself)
2. **Or:** Database password + host/port/user/db name for that project so I can assemble the URL locally without logging it

Will **not** improvise REST/PostgREST table dumps for Stage 2.

### Draft export manifest (from code inventory — NOT yet verified against live `information_schema`)

Source: `services/operator` + claims + prior RECOVERY B1. Live schema compare requires direct PG.

| Domain | Candidate table(s) | Notes |
|--------|-------------------|-------|
| experiments / brain / portfolio / claims fallback / owner controls | `revenueos_experiments` | Document catch-all; critical |
| pursuits / job-like queue | `revenueos_pursuits` | |
| events / activity | `revenueos_pursuit_events` | |
| lessons / learning | `revenueos_lessons` | |
| scorecards | `revenueos_scorecards` | |
| leases | `revenueos_leases` | |
| attributions | `revenueos_attributions` | |
| planner / history | `revenueos_planner_runs` | |
| cycle reports | `revenueos_cycle_reports` | |
| exposures | `revenueos_exposures` | |
| discovery | `revenueos_discovery_doors` | |
| capability gaps | `revenueos_capability_gaps` | |
| channels | `revenueos_channels` | |
| claims (native) | `revenueos_operator_claims` | May be **absent** (document-mode today) — confirm live |

**Exclude unless proven required:** `auth.*`, `storage.*`, `realtime.*`, `supabase_functions.*`, `extensions`, vault, etc.

**Final export manifest** = draft above ∩ tables that exist in live `public` after connectivity works. Will record PASS/FAIL verification table then.

### Stage 2 progress checklist

- [ ] Direct Supabase Postgres connect (`select 1`)
- [ ] Live schema ∩ draft → final export manifest
- [ ] `pg_dump` + checksum → `~/.revenueos/backups/`
- [ ] Restore into local RevenueOS Postgres (no overwrite of Stage 1 infra metadata)
- [ ] Row-count / schema / critical-record verification
- [ ] RevenueOS.Data local reads + harmless local txn write/rollback
- [ ] Postgres restart durability
- [x] **No cutover** (still true)

---

# DO NOT DO

- Data cutover / delete Supabase
- Portfolio builds / 50-business loads
- Parallel Vercel redeploys (except sequential emergency cron kill if still firing)
- Queue + scheduler + host + browser in the same batch
- Begin Stage 3
- REST-based “export” as substitute for verified `pg_dump`

## Current step

**STAGE 2 BLOCKED.** Provide direct Postgres credentials for `buvfllemxdvmwzhvfori`, then instruct to resume Stage 2 only.
