# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T19:25:00Z  
Mode: **STAGE 2 BLOCKED** — awaiting direct Supabase PostgreSQL credentials

## Ultimate pass condition

```
SUPABASE_DEPENDENCY = 0
VERCEL_DEPENDENCY = 0
```

After Mac reboot with Supabase + Vercel blocked: Postgres starts → Supervisor → queue/scheduler/workers/Browser/Host → real brain cycle → public proof business stays up.  
If RevenueOS contacts Supabase or Vercel during that test → find and remove the dependency.

**Stripe / AI / DNS / search / external sites** may remain as tools. They must not own RevenueOS state or runtime.

## Priority (binding)

**RevenueOS infrastructure independence #1.** No 50-business portfolio work. Microscopic stages only.

---

# FINAL END STATE (HARD CUT — not dual-provider)

```
Internet → DNS → RevenueOS Host → SiteVault businesses
                ↓
         RevenueOS Runtime
         ├── Supervisor
         ├── Scheduler
         ├── Durable Queue
         ├── Brain / Browser / Build Workers
         ├── Business Processes
         ├── Resource Governor
         └── Activity/Monitoring
                ↓
         Native PostgreSQL + Durable Storage

Mac App → control UI only (closing app must NOT stop Core)
```

| System | Final role |
|--------|------------|
| Supabase | **ZERO** — extract data once, then remove URL/keys/adapter/runtime after cutover + independence test |
| Vercel | **ZERO** — extract source/domain config temporarily; then no cron, functions, hosting, deploys, env, API |
| Dual-write | **Forbidden as permanent design.** Allowed only as a short verification tool if absolutely necessary during cutover |

Supabase’s **only** remaining purpose: **safe data extraction.** Do not delete the Supabase project until verified migration + independence. Do not design around keeping it.

---

# Decisions locked

| Topic | Decision |
|-------|----------|
| Postgres | Native Mac (conda-forge PG15 under `~/.revenueos`; not Docker runtime) |
| Host proof | Local hostname first, then public domain |
| Export | Direct PostgreSQL `pg_dump` only — **not** service-role REST as dump substitute |
| Stripe | Test-mode browser OK; no real charges for infra tests |
| Portfolio | Frozen until proof business fully exits Vercel |

---

# Completed so far

| Stage | Result |
|-------|--------|
| Prior Vercel brain disable | Code refuse + emptied crons; ~60 prod redeploys still queued (paused) |
| Mac Core authority | LaunchAgent, scheduler, checkpoint, watchdog |
| **Stage 1** | Native Postgres + `RevenueOS.Data` + temporary Supabase/Postgres adapters — default still Supabase until Stage 3 |
| **Stage 2 start** | **BLOCKED** — no `DATABASE_URL` / direct DB password locally |

**Frozen:** 50-business build/deploy.

---

# Ordered stages (execute; do not redesign)

| Stage | Goal | Dependency flag |
|-------|------|-----------------|
| **2** | Verified Supabase → local Postgres **copy** + verify | — |
| **3** | Controlled Supabase **cutover** → native-only R/W → independence test → remove Supabase config/creds/adapter after rollback window | `SUPABASE_DEPENDENCY = 0` |
| **4** | Cut Vercel **execution** (cron/ticks → Scheduler/Queue/Workers); refuse cloud autonomy | `VERCEL_EXECUTION_DEPENDENCY = 0` |
| **5** | SiteVault (owned source/releases per business) | — |
| **6** | RevenueOS Host (Caddy under Core; routing/TLS/processes) | — |
| **7** | **One** proof business full Vercel exit (ScopeGuard) | — |
| **8** | Portfolio Vercel exit **one business at a time** | — |
| **9** | Remove Vercel tokens/projects/cron/deploy code/fallbacks | `VERCEL_DEPENDENCY = 0` |
| **Decommission** | Report only — do **not** auto-delete Supabase/Vercel accounts until approved | — |

After Stage 2 is **100% PASS**, proceed to Stage 3 cutover without waiting indefinitely on Supabase as production. Still: small operations, checkpoint between stages.

---

# STAGE 1 — DONE (summary)

- CLI: `npm run db -- prepare|start|stop|restart|health|migrate|backup|restore`
- Package: `@revenueos/data` (domain repos + health states + adapters)
- Local cluster: `~/.revenueos/pg/*`, port `55432`
- Supabase adapter is **temporary migration scaffolding**, not the end state

---

# STAGE 2 — VERIFIED COPY (current)

## Status: BLOCKED

Rechecked credentials after architecture correction: **still missing.**  
Stopped before dump/restore. Production unchanged. No cutover.

### Blocker

| Credential | Present? |
|------------|----------|
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | yes (REST only — insufficient) |
| `DATABASE_URL` / `SUPABASE_DB_URL` / `DIRECT_URL` / `PG*` | **no** |

**Need:** direct Postgres connection for project `buvfllemxdvmwzhvfori` in gitignored env as `DATABASE_URL` or `SUPABASE_DB_URL` (prefer `db.<ref>.supabase.co:5432`). Prefer you write the file so the password never enters chat.

### Draft export manifest (code inventory — finalize against live schema once connected)

`revenueos_experiments`, `revenueos_pursuits`, `revenueos_pursuit_events`, `revenueos_lessons`, `revenueos_scorecards`, `revenueos_leases`, `revenueos_attributions`, `revenueos_planner_runs`, `revenueos_cycle_reports`, `revenueos_exposures`, `revenueos_discovery_doors`, `revenueos_capability_gaps`, `revenueos_channels`, `revenueos_operator_claims` (if exists).

Exclude Supabase internals (`auth`, `storage`, `realtime`, …) unless proven required.

### Stage 2 checklist → then Stage 3

- [ ] Direct PG `select 1`
- [ ] Final export manifest vs `information_schema`
- [ ] `pg_dump` + checksum → `~/.revenueos/backups/` (not in git)
- [ ] Restore → native Postgres
- [ ] Schema / counts / constraints / sequences / critical records
- [ ] `RevenueOS.Data` native reads + local txn write/rollback (not to Supabase)
- [ ] Postgres restart persistence
- [ ] Checkpoint
- [ ] **If 100% PASS → Stage 3 controlled cutover** (pause mutations → final delta → switch R/W native → cycle → block Supabase → prove continue)

---

# STAGE 3 — CUT SUPABASE (queued; do not start until Stage 2 PASS)

Pause mutation workers → final delta → verify → native reads/writes only → real cycle writes **only** native → restart PG + Core → **intentionally block Supabase** → Core continues → remove config/creds → deprecate adapter after rollback backup window → `SUPABASE_DEPENDENCY = 0`.

---

# DO NOT DO (now)

- Portfolio / 50-business builds
- Large parallel ops
- REST dump as substitute for `pg_dump`
- Permanent dual-write design
- Delete Supabase/Vercel projects before independence + decommission report
- Begin Stage 3/4+ before Stage 2 PASS
- Redesign architecture again

## Current step

**STAGE 2 BLOCKED on direct DB access.**  
Architecture correction recorded: **hard cut** to zero Supabase and zero Vercel.  
When `DATABASE_URL` / `SUPABASE_DB_URL` is in place, resume **Stage 2 only**, then Stage 3 on 100% verify PASS.
