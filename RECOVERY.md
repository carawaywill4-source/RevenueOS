# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T20:20:00Z  
Mode: **LIVE SUPABASE CUTOVER COMPLETE — Vercel removal not started**

```
SUPABASE_RUNTIME_DEPENDENCY = 0
SUPABASE_DATA_AUTHORITY = false
REVENUEOS_NATIVE_POSTGRES_AUTHORITY = true
VERCEL_DEPENDENCY = (unchanged — not this step)
```

## Ultimate pass condition

```
SUPABASE_DEPENDENCY = 0   ✅ runtime
VERCEL_DEPENDENCY = 0     ⏳ next
```

RevenueOS must survive even if Mendhaus (or any single business) is deleted.

---

# CORRECT OWNERSHIP MODEL

```
RevenueOS Platform  → native Postgres + scheduler/queue/workers/learning/portfolio/infra
Businesses (tenants) → Mendhaus, InvoiceChaser, … each with isolated business data
```

Mendhaus is a **business/tenant**, not RevenueOS infrastructure.

---

# WHY RevenueOS TABLES ARE INSIDE MENDHAUS SUPABASE

**Answer: accidental/legacy portfolio coupling — not “Mendhaus owns the platform.”**

Evidence (code/history, not guesswork):

1. **Project identity:** Supabase project `fnrwzloovduhryynmgok` is Mendhaus’s project (`apps/mendhaus/.env.local` + `mh_*` tables).
2. **Portfolio env donor:** `scripts/deploy-portfolio-site.mjs` defaults to  
   `--donor apps/mendhaus/.env.local` and copies `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` into each new business.
3. **Shared portfolio sync:** `scripts/sync-portfolio-envs.mjs` treats `SUPABASE_URL` as a **SHARED_KEY** pushed to every portfolio site.
4. **Multi-business records in those tables:** `revenueos_experiments` has **11 distinct `site_id`s** (listinglift, raiseready, closeshift, …) with ~10k rows each; **mendhaus is only 168 / 107,396** rows.
5. **Platform categories:** `__ros_pursuit_event__` (70,540), `__ros_pursuit__` (19,782), `__ros_lease__` (206), `acquisition` — written by RevenueOS document-mode ledger (`services/operator` / `@revenueos/core`), not Mendhaus commerce code.
6. **Mendhaus app’s own data** uses `mh_*` tables (`mh_orders`, `mh_customers`, …) via `apps/mendhaus/src/lib/*`.

**Classification of cause:**  
RevenueOS originally (and via deploy tooling) used the **Mendhaus Supabase project as a shared temporary portfolio database** → **LEGACY_ACCIDENTAL_COUPLING**.  
Tables are **not** Mendhaus-only despite living in Mendhaus’s project.

---

# TABLE / DOMAIN CLASSIFICATION (Mendhaus Supabase `fnrwz…`)

| Table | Count | Newest | Multi-business? | Writers / readers | Class |
|-------|------:|--------|-----------------|-------------------|-------|
| `revenueos_experiments` | 107,396 | 2026-08-09 | **Yes — 11 site_ids** | ROS operator/storefronts (document ledger: pursuits/events/leases/claims) | **A. REVENUEOS_PLATFORM_DATA** (hosted on wrong infra) |
| `revenueos_channels` | 238 | 2026-08-09 | **Yes — 10 site_ids** | ROS channel registry | **A** |
| `revenueos_lessons` | 266 | 2026-08-10 | Mixed: 182 `site_id=mendhaus`, 84 null; scopes site/global/industry | ROS learning; some Mendhaus-scoped lessons | **C. LEGACY_ACCIDENTAL_COUPLING** (mostly platform learning; subset Mendhaus-scoped) |
| `revenueos_scorecards` | 76 | 2026-08-08 | **Only mendhaus** | ROS scorecard path historically for that site | **C** (platform-shaped, Mendhaus-only content today) |
| `revenueos_attributions` | 0 | — | — | ROS attribution module (empty) | **A** schema / **E** empty |
| `revenueos_pursuits` | absent | — | — | Would be native ROS; document-mode used instead | **E/absent** (logic in experiments docs) |
| `revenueos_pursuit_events` | absent | — | — | same | **E/absent** |
| `revenueos_leases` | absent | — | — | same (`__ros_lease__` docs) | **E/absent** |
| `revenueos_operator_claims` | absent | — | — | document claims `ros:opclaim:*` | **E/absent** |
| `mh_customers` | 1 | live | Mendhaus only | `apps/mendhaus` | **B. MENDHAUS_BUSINESS_DATA** |
| `mh_orders` | 1 | live | Mendhaus only | `apps/mendhaus` | **B** |
| `mh_events` | 79 | live | Mendhaus only | `apps/mendhaus` | **B** |
| `mh_journal` | 611 | live | Mendhaus only | `apps/mendhaus` cron/owner | **B** |
| `mh_merch_state` | 1 | live | Mendhaus only | `apps/mendhaus` | **B** |
| `mh_supplier_listings` | 32 | live | Mendhaus only | `apps/mendhaus` | **B** |
| `mh_discovery_state` | (app uses) | — | Mendhaus only | `apps/mendhaus` | **B** |

**No wholesale “migrate Mendhaus DB → Core.”**

---

# EXTRACT FROM MENDHAUS → RevenueOS Core (platform only)

**YES — extract (platform records):**

- All `revenueos_experiments` rows (all site_ids; document-mode pursuits/events/leases/claims/acquisition/etc.)
- All `revenueos_channels` rows
- `revenueos_lessons` with platform relevance: prefer `scope in (global, industry)` + lessons for **non-mendhaus** sites; treat `site_id=mendhaus` lessons as optional platform learning about that tenant (include as platform-tenant learning, not as Mendhaus commerce)
- `revenueos_scorecards` (platform scorecard docs for site mendhaus — tenant learning, not `mh_*` commerce)
- Empty `revenueos_attributions` schema optional / skip if empty

**NO — must NOT enter RevenueOS Core as platform state:**

- Entire `mh_*` namespace (customers, orders, events, journal, merch, suppliers, discovery)
- Any future Mendhaus Stripe/customer PII tables
- Mendhaus storefront-only config

---

# LOCAL STATE = CLEARLY PLATFORM (RevenueOS Core)

| Artifact | Role | Owner |
|----------|------|-------|
| `.data/operator-local-ledger/<site>/ledger.json` ×50 | Current brain docs: experiments, pursuits, events, leases, channels, … | **PLATFORM** |
| `.data/operator-engine-checkpoint.json` | Scheduler/tick resume, authority=mac, 50 businesses | **PLATFORM** |
| LaunchAgent Core process | Runtime | **PLATFORM** |
| `services/operator` portfolio manifests | Business registry | **PLATFORM** |
| Stage-1 `ros_*` tables (local PG) | Target native schema (mostly empty until import) | **PLATFORM** |

Local ledgers are **newer** and cover the **current 50-business portfolio**; Mendhaus-hosted `revenueos_*` covers an **older 11-site** historical set (zero site overlap with current local experiment sites).

---

# PROPOSED CLEAN NATIVE RevenueOS SCHEMA

Keep / use Stage-1 `ros_*` as the platform schema (already in `services/revenueos-infra/migrations/0001_baseline.sql`):

| Native table | Holds |
|--------------|--------|
| `ros_businesses` | Portfolio registry |
| `ros_pursuits` / `ros_events` / `ros_jobs` | Runtime queue & pursuits (from docs + local) |
| `ros_experiments` / `ros_lessons` / `ros_scorecards` | Learning |
| `ros_claims` / `ros_leases` | Coordination |
| `ros_portfolio_state` / `ros_config_meta` | Portfolio + config |
| `ros_activity` / `ros_health` / `ros_releases` | Ops / SiteVault later |

**Do not** create `mh_*` inside Core.  
Business data later → per-business SiteVault / business storage, not Core platform DB.

Optional staging schema during import: `import_mendhaus_platform.revenueos_*` (read-only staging) then map → `ros_*`, then drop staging.

---

# EXISTING STAGE 2 DUMP — REINTERPRETED

| Fact | Meaning |
|------|---------|
| Dump is from Mendhaus project `fnrwz…` | True |
| Contains multi-business `revenueos_*` | **Platform data misplaced on Mendhaus infra** |
| Also co-located with `mh_*` on same project | Business data — **not in dump** (dump was `revenueos_*` only) ✓ |
| Retain dump? | **YES** as **extracted platform-slice source**, not as “Mendhaus DB wholesale” |
| Re-dump? | Not required for `revenueos_*`; never dump `mh_*` into Core |

---

# STEP 10 — PLATFORM IMPORT DRY-RUN (COMPLETE)

Command: `REVENUEOS_PG_VERSION=17 npm run db -- platform-import-dry-run`  
Tooling: `services/revenueos-infra/src/platform-import-dryrun.ts`  
Report: `~/.revenueos/backups/platform-import-dryrun-2026-08-10T19-55-58-304Z.json`  
Checkpoint: `platformImportDryRun=PASS` in `~/.revenueos/backups/stage2-checkpoint.json`

| Rule | Applied |
|------|---------|
| Destructive writes | **false** |
| Live Core cutover | **false** |
| Supabase shutdown | **not done** |
| `mh_*` denylist | Never scanned / never imported |
| Newer local wins | Yes (4 replacements) |
| Provenance | Every candidate tagged `supabase_platform_slice` / `local_ledger` / `engine_checkpoint` |

### Discovered by source

| Source | Records |
|--------|--------:|
| Supabase platform slice (`revenueos_*` in local PG) | 107,976 |
| Local ledgers (50 sites) | 111,924 |
| Engine checkpoint (+ business registry) | 51 |

### Classification

| Class | Count |
|-------|------:|
| platform | 219,241 |
| platform_tenant | 244 |
| mixed → platform extracted | 449 |
| mixed → excluded (Mendhaus-site lessons) | 17 |
| Mendhaus-only (`mh_*`) excluded | 0 (denylist; never ingested) |
| unknown / unclassifiable | **0** |
| duplicates (same stable ID) | 200 |
| content conflicts (same ID, different hash, no newer winner) | 0 |
| newer-local replacements | 4 |

### Projected `ros_*` counts (after dedupe / newer-wins)

| Table | Projected |
|-------|----------:|
| `ros_businesses` | 50 |
| `ros_leases` | 810 |
| `ros_experiments` | 19,152 |
| `ros_events` | 170,540 |
| `ros_pursuits` | 23,484 |
| `ros_lessons` | 249 |
| `ros_scorecards` | 76 |
| `ros_channels` | 1,488 |
| `ros_activity` | 3,884 |
| `ros_portfolio_state` | 1 |

### Business coverage

- Expected portfolio: **50** — all represented (`missing: []`)
- Extra historical site_ids from Supabase slice only: 11 (`resumeforge`, `mendhaus`, `depositproof`, `bidbinder`, `closeshift`, `waitroom`, `raiseready`, `shopbeacon`, `turnoverkit`, `ledgerleaf`, `listinglift`) — classified as platform history, not current portfolio gaps

### Gate

```
gate.pass = true
unknownCount = 0
allExpectedBusinessesRepresented = true
blockers = []
```

### Pre-import requirements

1. ~~Add migration `0002_ros_channels.sql`~~ **DONE** (applied + `migration-0002.test.ts` PASS)
2. ~~Human approval~~ **DONE** (real import approved 2026-08-10)

---

# STEP 11 — REAL IMPORT TOOLING CHECKPOINT

Committed before write:

| Artifact | Role |
|----------|------|
| `migrations/0002_ros_channels.sql` | `ros_channels` + `provenance` columns |
| `src/platform-import-core.ts` | Shared allowlisted collector (denies `mh_*`) |
| `src/platform-import-dryrun.ts` | Dry-run reporter |
| `src/platform-import-real.ts` | Real import writer (no LaunchAgent cutover) |
| `src/native-core-test.ts` | Native-only TEST Core (Supabase disabled) |
| CLI | `platform-import` / `native-core-test` |

Provenance tags on import: `SUPABASE_LEGACY` | `LOCAL_LEDGER` | `ENGINE_CHECKPOINT` | `SCHEDULER_CHECKPOINT`.

**Live LaunchAgent unchanged. Supabase not shut down. Vercel not started.**

---

# STEP 11 — REAL ALLOWLISTED IMPORT (COMPLETE)

Command: `REVENUEOS_PG_VERSION=17 npm run db -- platform-import`  
Report: `~/.revenueos/backups/platform-import-real-2026-08-10T20-03-41-867Z.json`  
Checkpoint: `platformImportReal=PASS`

### Actual imported counts (= collect projections; delta 0)

| Table | Actual |
|-------|-------:|
| `ros_businesses` | 50 |
| `ros_experiments` | 19,224 |
| `ros_events` | 170,540 |
| `ros_pursuits` | 23,729 |
| `ros_leases` | 812 |
| `ros_lessons` | 249 |
| `ros_scorecards` | 76 |
| `ros_channels` | 1,488 |
| `ros_activity` | 4,108 |
| `ros_portfolio_state` | 1 |
| `ros_config_meta` (scheduler) | 1 |
| `ros_claims` | 0 |

Vs Step-10 dry-run snapshot: higher by local ledger growth between runs (e.g. experiments 19,152→19,224; pursuits 23,484→23,729; activity 3,884→4,108). Real-import collect vs write: **exact match**.

| Metric | Value |
|--------|------:|
| duplicates resolved | 200 |
| conflicts | **0** |
| newer-local replacements | 4 |
| unknown ownership | **0** |

### Mendhaus isolation proof

- `mh_*` tables in Core: **none**
- `mh_customers` / `mh_orders` / commerce tables: **absent**
- 11 historical Supabase-only site_ids: present as platform learning rows, **not** as active `ros_businesses`
- InvoiceChaser: biz=1, exp=51, pursuits=83, events=2000, activity=84

### Native-only TEST Core

Command: `npm run db -- native-core-test`  
Report: `~/.revenueos/backups/native-core-test-2026-08-10T20-03-50-582Z.json`

| Check | Result |
|-------|--------|
| Native-only Core | **PASS** |
| Brain cycle (test write/read) | **PASS** |
| Postgres restart + restore | **PASS** (`DB_HEALTHY`, 50 businesses, checkpoint+scheduler restored) |
| Supabase network calls observed | **NO** |
| Live LaunchAgent changed | **NO** |

---

# LIVE SUPABASE CUTOVER (COMPLETE)

Pre-cutover backup: `~/.revenueos/backups/revenueos-pre-cutover-2026-08-10T20-09-21-418Z.dump`  
SHA-256: `8502e9cfcb70861a1deff543ebb320e36b9bf03b021403b27ca253584a53fb14`  
Delta re-import after ledger advance: `platformImportReal=PASS` (50 businesses, conflicts=0, unknown=0, mh_*=absent)

### Native soak (PORT 18080) then LIVE LaunchAgent (`com.revenueos.core` :8080)

| Check | Result |
|-------|--------|
| Live cutover | **PASS** |
| Native authority (`engine.authority=mac/native`, `dataProvider=postgres`) | **PASS** |
| 50-business restore | **PASS** |
| Real brain ticks (observe/decide/enqueue/learn; exec>0) | **PASS** |
| Native write proof | events/activity/pursuits advanced in `ros_*` during live window |
| PG + Core restart recovery | **PASS** (`DB_HEALTHY`, ticks resume) |
| Supabase credentials in runtime | **NO** (`SUPABASE_URL` / `SERVICE_ROLE_KEY` / `DB_URL` absent from `.env`, plist, process) |
| Supabase network calls (post-cutover logs) | **0** |
| Stale Mendhaus→platform env coupling removed | **YES** |
| Supabase unavailable failure test | Core remains healthy on native Postgres |

### Coupling cleanup applied

- Operator boots via `REVENUEOS_DATA_PROVIDER=postgres` + `createPostgresExperimentStore` → `ros_*`
- `hydrateEnvFromFiles` no longer reads `apps/*/.env.local` or Mendhaus donor
- Platform config: `.env.revenueos-platform` (+ example) / `services/operator/.env`
- `scripts/sync-portfolio-envs.mjs`: `SUPABASE_*` removed from `SHARED_KEYS`
- `scripts/deploy-portfolio-site.mjs`: default donor → `.env.revenueos-platform` (not Mendhaus)
- LaunchAgent plist embeds native provider; Supabase keys removed
- Historical Supabase dump retained offline under `~/.revenueos/backups/` (not required at runtime)

### Supabase project/account

**May be cancelled without stopping RevenueOS.** Do not delete until you explicitly choose to; dump remains as offline archive.

### Smallest first step for Vercel removal (NOT STARTED)

Inventory LaunchAgent/`REVENUEOS_VERCEL_BRAIN` + per-app Vercel crons that still assume cloud brain; hard-disable cloud ticks while Mac remains sole authority — then retire hosting plane separately.

---

# PRIOR FOUNDATION (still valid)

| Item | Status |
|------|--------|
| Stage 1 native PG + RevenueOS.Data | Done |
| Stage 2 `revenueos_*` dump/restore/checksum | Done — offline archive |
| Ownership forensics | Done |
| Step 10–11 import + native test | **PASS** |
| Live Supabase cutover | **PASS** |
| Mac Core writes | **`ros_*` native Postgres** |

## Current step

**STOPPED after live Supabase cutover.**  
`SUPABASE_RUNTIME_DEPENDENCY = 0`. Do not start Vercel removal until approved.
