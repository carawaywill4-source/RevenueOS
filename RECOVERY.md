# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T19:50:00Z  
Mode: **AUTHORITY CORRECTED — Stage 2 dump RETAINED; merge local durable state next; NO Stage 3**

## Ultimate pass condition

```
SUPABASE_DEPENDENCY = 0
VERCEL_DEPENDENCY = 0
```

## Priority

Infrastructure independence #1. No cutover until Mendhaus backup + local durable state are merged into native Postgres.

---

# SECURITY

Stage 2 DB password was exposed in chat → treat as compromised; rotate when convenient.  
Do not print/log/commit credentials.

---

# AUTHORITY CORRECTION (owner dashboard + live evidence)

Owner reports **only one Supabase project in account/org: Mendhaus.**  
There is **no** second visible `buvfl…` project. Prior “`buvfl` is authoritative” conclusion from config alone is **withdrawn**.

## Conclusion (proven)

```
A) fnrwzloovduhryynmgok = Mendhaus (ONLY real Supabase project)
   buvfllemxdvmwzhvfori = stale/legacy config (loads in Core .env; not a usable live authority)
   AUTHORITATIVE MIGRATION SOURCE =
     Mendhaus Stage-2 backup (historical)
     + local operator ledgers / checkpoints (current activity while Supabase path broken)
```

**Do NOT request another Supabase DB URL.**  
**KEEP the existing verified Stage 2 dump (107,976 rows).**  
**NO Stage 3 cutover yet.**

---

# STEP 1 — Mendhaus project ref

| Check | Result |
|-------|--------|
| `apps/mendhaus/.env.local` `SUPABASE_URL` ref | **`fnrwzloovduhryynmgok`** |
| Stage 2 direct DB host | `db.fnrwzloovduhryynmgok.supabase.co` |
| REST against Mendhaus app creds | `revenueos_experiments` **107396** rows; **`mh_orders` exists** |
| Local Stage 2 restore | Same 107396 experiments (checksum-verified earlier) |

**Mendhaus = `fnrwzloovduhryynmgok` = Stage 2 dump source. CONFIRMED.**

---

# STEP 2 — What is `buvfllemxdvmwzhvfori`?

| Check | Result |
|-------|--------|
| Where referenced | **Only** `services/operator/.env` + root `.env.local` (+ outdated docs). **Not** in 62 storefront app envs |
| Storefront envs | **62 apps → `fnrwz…` (Mendhaus)** |
| DNS | Resolves (CDN/edge IP) |
| REST now | **Timeout** (not usable) |
| In owner dashboard | **Not present** (owner confirmation) |
| Appears to be | Stale/deleted/orphan project ref left in Core env; **not** Mendhaus |

### Does Mac Core actually use it successfully?

| Fact | Evidence |
|------|----------|
| Core **loads** `buvfl` URL | `hydrateEnvFromFiles()` prefers `services/operator/.env` |
| Loading ≠ authority | Owner dashboard + REST timeouts |
| Boot probe earlier today | One `ledgerMode: document` / intermittent `degradedLocal:true` / `owner_controls_timeout` / synthetic claims |
| Current durable writes | **Local ledgers + checkpoint updating continuously** |
| Last clear degraded signals | Boot window ~`2026-08-10T18:51Z` (`degradedLocal:true`, synthetic claims) |

**Mac Core has been operating primarily from degraded/local durable storage**, while still *configured* to call a dead/stale `buvfl` URL.

---

# STEP 3 — Reinterpreted live architecture

```
Mendhaus Supabase (fnrwz…)
  = historical / older persisted RevenueOS + Mendhaus app tables
  (reachable via storefront credentials; Stage 2 dump verified)

Local durable state
  = current Mac Core activity while configured Supabase path fails
  .data/operator-local-ledger/<site>/ledger.json   (50 sites)
  .data/operator-engine-checkpoint.json            (scheduler/engine)
```

InvoiceChaser active locally with **0** InvoiceChaser rows in Mendhaus dump ⇒ work happened in **degraded/local mode**, not “wrong Supabase project.”

---

# STEP 4 — Timeline / coverage compare

### Mendhaus (Stage 2 local restore = live REST count)

| Domain | Rows | Newest timestamp |
|--------|-----:|------------------|
| experiments | 107,396 | **2026-08-09** ~15:51 |
| lessons | 266 | 2026-08-10 ~13:15 |
| scorecards | 76 | 2026-08-08 |
| channels | 238 | 2026-08-09 ~18:41 |
| attributions | 0 | — |
| Distinct experiment `site_id`s | **11** | older set (e.g. mendhaus, bidbinder, raiseready, …) |
| invoicechaser experiments | **0** | — |

### Local ledgers (`.data/operator-local-ledger`)

| Domain | Approx rows (sum) | Sites with data | Newest (content) |
|--------|------------------:|----------------:|------------------|
| experiments | 2,194 | 50 | **2026-08-10T19:48Z** |
| lessons | 200 | 50 | 2026-08-10T18:21Z |
| pursuits | 3,455 | 50 | 2026-08-10T19:48Z |
| pursuitEvents | 99,532 | 50 | 2026-08-10T19:48Z |
| exposures | 3,664 | 50 | (varies) |
| channels | 1,250 | 50 | 2026-08-10T19:48Z |
| leases | 603 | 50 | 2026-08-10T19:44Z |
| Checkpoint `lastTickAt` | 50 businesses | — | **2026-08-10T19:47Z** |

### Overlap

| | |
|--|--|
| Experiment site overlap (local ∩ Mendhaus) | **0 sites** |
| Local-only experiment sites | **50** (current portfolio, includes invoicechaser) |
| Mendhaus-only experiment sites | **11** (historical set) |

**InvoiceChaser:** local ledger has experiments/pursuits/events/leases **today**; Mendhaus DB has **zero** IC experiment rows.

---

# STEP 5 — True native state plan (no cutover yet)

```
MENDHAUS SUPABASE BACKUP (existing Stage 2 dump)   ← historical memory
+ LOCAL LEDGERS (.data/operator-local-ledger)      ← current portfolio brain state
+ ENGINE CHECKPOINT                                ← scheduler/tick resume
(+ any other verified local durable files)
        ↓  import/merge (dedupe by stable IDs; prefer newer timestamps)
REVENUEOS NATIVE POSTGRES
```

Rules:
- Never overwrite newer local records with older Mendhaus rows
- Map document-mode collections → native `ros_*` / imported `revenueos_*` deliberately
- Keep Mendhaus dump as read-only historical source until merge verified

---

# STEP 6 — Existing Stage 2 dump validity

| Item | Status |
|------|--------|
| Dump file | `~/.revenueos/backups/stage2-revenueos-fnrwz-20260810T192422Z.dump` |
| SHA-256 | `73f6e687a27f0cb0fdf493603f10080d2b3f834094f75cdd2f0bec46f6cbb2c9` |
| Rows | **107,976** across 5 tables |
| Restore + restart proofs | PASS (prior) |
| Is Mendhaus? | **YES** |
| Re-`pg_dump` needed? | **NO** — retain |
| Remaining Stage-2-class work | **Import/merge local ledgers + checkpoint into native Postgres** |

---

# Completed foundation

| Stage | Result |
|-------|--------|
| Stage 1 | Native PG + RevenueOS.Data |
| Stage 2 dump/restore | Valid **Mendhaus** historical copy |
| Authority correction | `buvfl` stale; live gap filled by **local durable state** |

---

# DO NOT

- Stage 3 cutover
- Ask for another Supabase DB password (no evidence of a second active project)
- Delete Mendhaus / disable projects
- Blindly trust `services/operator/.env` `SUPABASE_URL`

## Exact smallest next step

**Design + implement a read-only inventory + merge importer:**  
local ledger JSON + engine checkpoint → native Postgres tables, with ID/timestamp dedupe against the existing Mendhaus restore — **no production cutover**.

## Current step

**STOPPED** after authority correction. Awaiting instruction to begin local→native merge work.
