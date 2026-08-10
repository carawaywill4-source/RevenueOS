# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T19:30:00Z  
Mode: **STAGE 2 COPY VERIFIED** — production still Supabase; **Stage 3 cutover NOT started**

## Ultimate pass condition

```
SUPABASE_DEPENDENCY = 0
VERCEL_DEPENDENCY = 0
```

Mac reboot with Supabase + Vercel blocked → Postgres → Supervisor → workers/Host → real brain cycle → proof business up.

## Priority

**Infrastructure independence #1.** No 50-business portfolio work.

---

# FINAL END STATE (HARD CUT)

Internet → DNS → RevenueOS Host → SiteVault → Runtime (Supervisor/Scheduler/Queue/Workers/Governor/Activity) → Native PostgreSQL + Durable Storage.  
Mac app = control UI only.

Supabase / Vercel = **temporary extract-only**, then removed completely. No permanent dual-write.

---

# Completed

| Stage | Result |
|-------|--------|
| Prior Vercel brain disable | Code refuse + emptied crons; ~60 prod redeploys paused |
| Mac Core authority | LaunchAgent, scheduler, checkpoint |
| **Stage 1** | Native Postgres + `RevenueOS.Data` adapters |
| **Stage 2** | **Verified copy PASS** (see below) |

**Frozen:** 50-business build/deploy.

---

# STAGE 2 — VERIFIED COPY (PASS)

## Source connection

| Field | Value |
|-------|-------|
| Project ref (dump) | `fnrwzloovduhryynmgok` |
| Host | `db.fnrwzloovduhryynmgok.supabase.co:5432` |
| Server version | **17.6** |
| Method | Direct `pg_dump` (not REST / not service-role) |
| Secrets location | `~/.revenueos/secrets/supabase-db.env` (mode 600, not in git) |

**Important mismatch:** Mac Core / `.env.local` `SUPABASE_URL` still points at **`buvfllemxdvmwzhvfori`**. Stage 2 dump used the credentials you supplied for **`fnrwz…`**. Do **not** cut over until you confirm which project is the authoritative RevenueOS memory, or supply `buvfl…` DB URL for a second verified dump.

## Final export manifest

| Table | Source rows | Local rows | Schema | PK/hash/spot | Result |
|-------|------------:|-----------:|:------:|:-------------|:------:|
| `revenueos_experiments` | 107396 | 107396 | match | match + 3/3 spots | **PASS** |
| `revenueos_lessons` | 266 | 266 | match | match | **PASS** |
| `revenueos_scorecards` | 76 | 76 | match | match | **PASS** |
| `revenueos_attributions` | 0 | 0 | match | match | **PASS** |
| `revenueos_channels` | 238 | 238 | match | match | **PASS** |

**Total records migrated:** **107,976**  
**Tables migrated:** **5**

### Absent on this source (documented exceptions — not failures)

`revenueos_pursuits`, `revenueos_pursuit_events`, `revenueos_leases`, `revenueos_planner_runs`, `revenueos_cycle_reports`, `revenueos_exposures`, `revenueos_discovery_doors`, `revenueos_capability_gaps`, `revenueos_operator_claims`

### Excluded (non-RevenueOS app tables on same DB)

`mh_customers`, `mh_events`, `mh_journal`, `mh_merch_state`, `mh_orders`, `mh_supplier_listings`

## Backup artifact (outside git)

| Item | Location |
|------|----------|
| Dump | `~/.revenueos/backups/stage2-revenueos-fnrwz-20260810T192422Z.dump` |
| SHA-256 | `73f6e687a27f0cb0fdf493603f10080d2b3f834094f75cdd2f0bec46f6cbb2c9` |
| Manifest | `~/.revenueos/backups/stage2-export-manifest-20260810T192422Z.json` |
| Verify report | `~/.revenueos/backups/stage2-verify-20260810T192533Z.json` |
| Checkpoint | `~/.revenueos/backups/stage2-checkpoint.json` |

Checksum verified before restore. Source Supabase **not modified**.

## Local Postgres

- Binaries upgraded to **PostgreSQL 17.10** (match source major)
- Stage 1 PG15 data preserved at `~/.revenueos/pg/data-pg15-stage1`
- Active data dir: `~/.revenueos/pg/data` (PG17)
- `ros_*` Stage 1 infra tables **preserved** alongside restored `revenueos_*`
- Default `REVENUEOS_PG_VERSION=17`

## RevenueOS.Data tests

- Legacy copy reader (`createLegacyCopyData`) reads migrated `revenueos_*` (portfolio/business, pursuit/experiment, event-like, lesson, scorecard, activity, claim lookup)
- Native adapter transactional write/read/cleanup on `ros_*` only — **not written to Supabase**
- Postgres restart → reconnect → `DB_HEALTHY` → migrated counts/marker unchanged

## Production status

```
PRODUCTION DEFAULT = SUPABASE (unchanged)
LOCAL VERIFIED COPY = REVENUEOS POSTGRES
CUTOVER = NOT PERFORMED
SUPABASE_DEPENDENCY = still > 0
```

---

# STAGE 3 — CUT SUPABASE (queued — confirm source project first)

Before cutover:

1. Confirm authoritative project (`fnrwz…` vs `buvfl…`)
2. If `buvfl…` is truth → obtain its `SUPABASE_DB_URL` and re-run Stage 2 against it
3. Then: pause mutations → final delta → switch Core R/W to native only → independence test → remove Supabase config

Tooling: `npm run db -- stage2-export|stage2-probe|stage2-restart-proof`

---

# Later stages (unchanged order)

4 Vercel execution cut → 5 SiteVault → 6 Host → 7 one-business exit → 8 portfolio one-by-one → 9 remove Vercel config → Decommission report (no auto-delete)

## Current step

**STAGE 2 CHECKPOINT COMPLETE.**  
**Stopped before Stage 3.** Confirm which Supabase project is authoritative memory, then instruct Stage 3 (or a second Stage 2 dump of `buvfl…`).
