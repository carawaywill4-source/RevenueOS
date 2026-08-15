# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T20:58:00Z  
Mode: **CORE ARCHITECTURE FROZEN — SiteVault pilot dual-run started (ScopeGuard only)**

```
SUPABASE_RUNTIME_DEPENDENCY = 0
SUPABASE_DATA_AUTHORITY = false
REVENUEOS_NATIVE_POSTGRES_AUTHORITY = true
VERCEL_BRAIN_DEPENDENCY = 0
MAC_EXECUTION_AUTHORITY = true
MULTIPLE_EXECUTION_AUTHORITIES = 0
CROSS_BUSINESS_STATE_CONTAMINATION = 0
BUSINESSES_50_50_AFTER_RESTART = true
REVENUEOS_CORE_ARCHITECTURE = FROZEN
```

## Ultimate pass condition

```
SUPABASE_DEPENDENCY = 0        ✅ runtime
VERCEL_BRAIN_DEPENDENCY = 0    ✅ execution
VERCEL_HOSTING_DEPENDENCY = ⏳ one pilot dual-run (ScopeGuard); 49 untouched
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

---

# VERCEL BRAIN REMOVAL (COMPLETE)

Objective: `VERCEL_BRAIN_DEPENDENCY = 0` — Mac is sole autonomous execution authority.  
Website hosting on Vercel is unchanged (storefronts + ordinary APIs remain).

### Inventory (A/B/C)

| Class | Finding |
|-------|---------|
| **A** Autonomous | `/api/cron/revenueos` (×62 apps), root `/api/cron/daily-growth-review`, `/api/cron/portfolio-digest`, `keep-operating.mjs` |
| **B** Ordinary site | Root `/api/cron/cleanup`, `/api/cron/growth-report`; `/api/owner/execute` limb; storefront commerce APIs |
| **C** Unknown | **0** after live inspect |

### Live cron counts

| Scope | Before | After |
|-------|-------:|------:|
| Portfolio brain crons (`/api/cron/revenueos`) | **14** still scheduled on Vercel (git already `[]`) | **0** |
| Root brain crons | 0 | 0 |
| Root ordinary crons (cleanup, growth-report) | 2 | **2** (kept — class B) |
| `REVENUEOS_VERCEL_BRAIN` env on projects | 0 | 0 |

Sequential disable (14 projects, one-at-a-time prod deploy of empty `vercel.json`):  
`rfpstrike` … `storelift` → all `PASS` (checkpoint `.data/vercel-brain-cron-disable-checkpoint.json`).

### Mac sole-authority guards

- Route refuse unless `REVENUEOS_VERCEL_BRAIN=1` → `refused_cloud_brain` / `mac_brain_only`
- Central helper: `packages/revenueos/src/modules/mac-brain-authority.ts` (`assertCloudBrainAllowed`)
- `checkOperatorHosting` fail-closed when cloud brain not break-glassed / no claim backend
- `keep-operating.mjs` exits unless `FORCE_CLOUD_WAKE=1`
- Scaffold no longer emits brain cron schedules
- LaunchAgent: `REVENUEOS_VERCEL_BRAIN` unset/false; `vercelBrainAllowed=false`

### Proofs

| Check | Result |
|-------|--------|
| Manual cloud cron with valid secret | **refused** (`cycleStatus=refused_cloud_brain`) |
| Mac-only brain ticks | **PASS** (50 businesses; enqueue/exec continue) |
| Native writes | **PASS** (events 199785→217863; activity 34909→53761 during window) |
| Duplicate-execution protection | **PASS** (no cloud schedule + refuse + fail-closed claims) |
| Vercel-blocked independence | **PASS** (Mac continues without Vercel brain) |
| PG + Core restart | **PASS** (`native_postgres`, 50, `mac/native`) |
| Core logs calling Vercel cron URLs | **none** |

### What Vercel still does

Serves storefront websites + ordinary APIs (checkout, owner/execute limbs, cleanup/growth-report).  
**Not** RevenueOS autonomous think/schedule/execute.

### Smallest SiteVault step (STARTED — ScopeGuard only)

Disposable pilot **outside** the active 50 portfolio. Vercel remains primary DNS; no portfolio migration.

| Item | Value |
|------|--------|
| Pilot | `scopeguard` (not in active 50) |
| Control plane | `services/hosting-plane` `:8090` |
| Candidate URL | `http://127.0.0.1:9104` |
| Local gateway | `scopeguard.localhost` → `127.0.0.1:9104` (Caddyfile generated; Caddy not installed) |
| Vercel primary | `https://scopeguard-rho-jade.vercel.app` (still primary) |
| DNS cutover | **false** |
| Dual-run | **PASS** (`pass=true`, health 200, smoke `/api/checkout:405`) |
| Trace | `.data/hosting-dual-run-scopeguard-2026-08-10T20-58-22-833Z.json` |
| Other 49 businesses | **untouched** on Vercel |
| `SITEVAULT_LOCAL_PASS` | **true** |
| `SITEVAULT_PUBLIC_PASS` | **blocked** (no disposable public hostname / edge) |

### PHASE 1 — PUBLIC HOSTING PROOF (BLOCKED — VPS IP + DNS)

Procedure: `docs/SITEVAULT_VPS_SCOPEGUARD_PILOT.md`  
Architecture: **Mac = brain/DB/queue/deploy** · **VPS = public storefront hosting** (customer path never tunnels to Mac).  
SSH deploy key generated on this Mac (`~/.ssh/revenueos-sitevault/`); private key not in repo.

**Waiting on:** VPS provider/IP + disposable DNS `A` record. Then bootstrap user `sitevault` with the published public key.  
Do **not** point any active portfolio domain here. Do **not** migrate the active 50.

---

# FINAL SOVEREIGNTY TEST (COMPLETE — CORE FROZEN)

Harness (test-only, no architecture redesign): `scripts/sovereignty-final-test.mjs`  
Report: `.data/sovereignty-final-report.json` (`OVERALL_PASS=true`, `architectureModified=false`)

### Pass flags

| Flag | Value |
|------|------:|
| `SUPABASE_RUNTIME_DEPENDENCY` | **0** |
| `VERCEL_BRAIN_DEPENDENCY` | **0** |
| `MULTIPLE_EXECUTION_AUTHORITIES` | **0** |
| `CROSS_BUSINESS_STATE_CONTAMINATION` | **0** |
| `MAC_EXECUTION_AUTHORITY` | **true** |
| `NATIVE_POSTGRES_AUTHORITY` | **true** |
| `BUSINESSES_50_50_AFTER_RESTART` | **true** |

### Proofs 1–10

| # | Proof | Result |
|---|--------|--------|
| 1 | Autonomous cycle all 50 (Mac/native only) | **PASS** (50/50 tick; state grew) |
| 2 | Native Postgres sole durable authority | **PASS** (`ros_*`, `mh_*=0`) |
| 3 | No brain path ↔ Supabase | **PASS** (no URL/key/DB; log hits 0) |
| 4 | No brain path → Vercel cron/serverless/deploy APIs | **PASS** |
| 5 | Kill/restart Core — queue/state survives, no dup authority | **PASS** (50/50 resume) |
| 6 | Restart native Postgres + recovery | **PASS** |
| 7 | Deprecated cloud-brain endpoints refuse execution | **PASS** (`executedBrainCount=0` / 52) |
| 8 | Exactly one execution authority | **PASS** (`mac/native`) |
| 9 | 50-business isolation (A≠B; no storefront owns Core) | **PASS** |
| 10 | Authority map produced | **PASS** (below) |

### Authority map

```
RevenueOS Core          → LOCAL / NATIVE   (LaunchAgent com.revenueos.core → :8080)
→ Execution Authority   → NATIVE           (Mac only; Vercel brain DISABLED)
→ Database Authority    → NATIVE           (Postgres 127.0.0.1:55432, ros_*)
→ Queue Authority       → NATIVE           (operator checkpoint + ros_*)
→ Business Workers      → NATIVE           (in-process portfolio workers)
→ Storefronts           → VERCEL           (HTTP only; ScopeGuard dual-run LOCAL candidate)
Supabase                → EXTERNAL_ARCHIVED_NOT_RUNTIME
```

### FREEZE

**RevenueOS core architecture is FROZEN** after this sovereignty PASS.

Do **not**:
- redesign RevenueOS core
- migrate all businesses off Vercel
- add reporting features
- add another scheduler
- create another database abstraction

Proceed **only** with SiteVault infrastructure independence for disposable pilots, one at a time, with Vercel remaining primary until explicit DNS cutover gates pass.

---

# PRIOR FOUNDATION (still valid)

| Item | Status |
|------|--------|
| Stage 1 native PG + RevenueOS.Data | Done |
| Stage 2 dump archive | Done |
| Live Supabase cutover | **PASS** |
| Vercel brain removal | **PASS** |
| Final sovereignty test | **PASS** |
| Core architecture | **FROZEN** |
| Mac Core writes | **`ros_*` native Postgres** |
| SiteVault pilot (ScopeGuard dual-run) | **PASS** (DNS not cut) |

## Current step

**AZURE CONTROL PLANE AUTHORITATIVE + 50-BUSINESS ADMIT ROLLOUT RUNNING**  
Admission owned by Azure `revenueos-operator` (`ADMIT_ROLLOUT=1`). Cursor not required. No storefront DNS cutover.

---

# AZURE PRODUCTION HOST (FREE-TIER)

Last updated: 2026-08-11T00:04:00Z

| Item | Value |
|------|--------|
| Subscription | Azure subscription 1 (`29abf779-4703-47f0-bdda-c92b8d838ab7`) |
| Plan / free | Azure Plan — free services through **2027-09-10** |
| Resource group | `revenueos-prod` |
| VM name | `revenueos-core` |
| Region | `northcentralus` (B1s capacity blocked in westus2/eastus/eastus2) |
| Size | `Standard_B2ats_v2` (free meter: 750 hrs/mo; B1s unavailable) |
| Public IP | `130.131.15.68` |
| Private IP | `10.0.0.4` |
| OS | Ubuntu 22.04.5 LTS |
| Disk | Standard_LRS ~30 GB |
| Auth | SSH key only (`RevenueOS_key` / `~/.ssh/revenueos-sitevault/RevenueOS_key.pem`) |
| User | `azureuser` |
| SSH alias | `ssh revenueos-core` |
| Inbound | NSG + UFW: **22/tcp only** |
| Deploy dir | `/opt/revenueos` |
| Logs | `/var/log/revenueos` (+ logrotate daily/14d) |
| Secrets dir | `/etc/revenueos` (mode 750) |
| Swap | 2G `/swapfile` (RAM ~896 MiB) |
| Docker | Engine + Compose plugin installed |
| Budget alert | `revenueos-free-guard` — **$1/month**, email at 80% actual |
| Expected cost | **$0** while within free B2ats_v2 / disk / public-IP meters |
| Also exists | RG `RevenueOS_group` (`westus2`) with SSH key resource `RevenueOS_key` only |

### Installed on VM so far

- apt updates, git, curl, ufw, fail2ban, unattended-upgrades
- Docker CE + compose plugin
- Password SSH disabled; root login disabled
- Swap + deploy directories
- Azure $1 budget alert (`revenueos-free-guard`)
- Node.js v20.20.2
- Postgres 16 Docker (`revenueos-postgres`): `127.0.0.1:5432` only, mem_limit 384m, data `/opt/revenueos/postgres/data`, creds `/etc/revenueos/postgres.env` (not in git)
- App env `/etc/revenueos/runtime.env` (DATABASE_URL → local Postgres; no secrets in git)
- App tree synced → `/opt/revenueos/app` (**~245M**; `package.json` + `services/operator` + `services/revenueos-infra` present)
  - Excluded: `node_modules`, `.git`, `.data`, `.next`, `*.dump`, `.env.local`, `apps/*/.env*`
  - Runtime secrets authority remains `/etc/revenueos/*` (not app-tree env files)
- Dependencies installed via `npm ci` in `/opt/revenueos/app` (**PASS**)
  - 767 packages; `node_modules` ~759M; exit 0; fatal log errors: **none**
  - `@revenueos/{core,data,infra,operator-service,hosting-plane,…}` present
  - `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; no deploy / no service start
- Azure Postgres schema migrations (**PASS**); platform state **imported** (see cutover tracker)
  - Mechanism: `npm run db -- migrate` → `services/revenueos-infra/src/migrate.ts` (`dbMigrate`)
    - Applies `services/revenueos-infra/migrations/*.sql` under `pg_advisory_lock`
    - Records in `ros_schema_migrations`
    - Connection: `REVENUEOS_DATABASE_URL` (from `/etc/revenueos/runtime.env`)
  - Target confirmed preflight: `127.0.0.1:5432/revenueos` (Docker `revenueos-postgres`); `SUPABASE_DISABLED=1`; no Supabase URL
  - Applied: `0001_baseline.sql`, `0002_ros_channels.sql` (`databaseUrlHost=127.0.0.1:5432`)
  - Schema verify: 16 `ros_*` tables present; connectivity `select 1` OK; row counts all 0
  - Warnings: none fatal (verify heredoc quoting failed once after migrate; re-checked via `docker exec … psql`)
  - Not done at migrate time: operator start, systemd, authority cutover, data import, portfolio rollout
- Systemd unit `revenueos-operator.service` created (**validated; disabled; not started**)
  - Path: `/etc/systemd/system/revenueos-operator.service`
  - Entrypoint: package script `start` → `tsx src/index.ts`  
    `ExecStart=/opt/revenueos/app/node_modules/.bin/tsx …/services/operator/src/index.ts`
  - `User=azureuser`, `WorkingDirectory=/opt/revenueos/app`
  - `EnvironmentFile=/etc/revenueos/revenueos.env` (mode 640); `OPERATOR_NAME=azure-revenueos-core`; `PORT=8080`
  - `Restart=always`, `RestartSec=5`, `StartLimitIntervalSec=120`, `StartLimitBurst=10`
  - `After=`/`Wants=` network-online + docker; logs → journal (`SyslogIdentifier=revenueos-operator`)
  - Validation: `systemd-analyze verify` clean for this unit; paths/entrypoint/env keys OK; `is-enabled=disabled`; `is-active=inactive`
  - Unit validated; Mac LaunchAgent quiesced; Azure start pending (shadow)

### AZURE CONTROL-PLANE CUTOVER TRACKER

```
CURRENT STAGE: 50-BUSINESS ADMIT ROLLOUT — LIVE + AUTONOMOUS ENGINEERING REPAIR
LAST COMPLETED STAGE: engineering repair wired into admit controller (no rollout reset)
AZURE STATUS: UP
DATABASE STATUS: LIVE (Postgres 17)
OPERATOR STATUS: ACTIVE + ENABLED
AUTHORITY: AZURE (azure-revenueos-core)
ADMIT_ROLLOUT: 1
TARGET PORTFOLIO: 50
CURRENT CANDIDATE: bidforge
CURRENT PHASE: LIVE_PROBATION
HEALTHY_MS_AT_REPAIR_DEPLOY: 600000 / 900000 (preserved; not reset)
ACTIVE ACCEPTED / TITAN_MANAGED: 0
REAL MONEY MODE: ACTIVE (probation commercially live)
SELF-HEALING: ACTIVE (systemd Restart=always + engineering repair Levels A–E)
CURSOR REQUIRED: NO
MAC REQUIRED: NO
LAST TEST: control-plane deploy of engineering-repair; admit resumed bidforge @ 600000ms
TEST RESULT: PASS (checkpoint preserved; unit classify A–E pass)
NEXT STAGE: Autonomous — Azure admits one-by-one to 50; repairs harden as failures appear
```

#### Stages 1–3 — Source identify / snapshot / import (PASS)
- Authoritative source: Mac native Postgres `127.0.0.1:55432` (`ros_*`, not Supabase; `mh_*=0`)
- Final export: `~/.revenueos/backups/revenueos-azure-final-sync-2026-08-10T23-25-49Z.sql.gz`
- SHA-256: `2ac146a94e727f1ad176a7419b91ad6b31eb8e9c1159f3d983d88f6d75f69830` (also `/opt/revenueos/backups/`)
- Azure Postgres upgraded 16→17; restore counts matched source (50 businesses; experiments/events/pursuits/activity/etc.)

#### Stage 4–5 — Env + pre-start (PASS)
- `/etc/revenueos/revenueos.env` → Azure `127.0.0.1:5432/revenueos`, `REVENUEOS_MAC_BRAIN=0`, secrets present (not logged)

#### Stage 6 — Controlled start (PASS)
- Started with `SHADOW_MODE=1` first; later live

#### Stage 7 — Full-brain wiring (PASS with fixes)
- Live ticks show APEX + TITAN + NEXUS + FORGE signals influencing decisions
- Fixed dead storefront execute path: Core agent executors now own `indexnow_submit` / `distribute_owned_urls` / `sitemap_ping` / `ping_search_engines`; agent limbs preferred before storefront
- Files: `packages/revenueos/src/modules/agent-executors.ts`, `services/operator/src/lib/agent-executor.ts`

#### Stage 8 — One safe real loop (PASS)
- Business: `invoicechaser`
- Observed → bottleneck NO_IMPRESSIONS → APEX `distribute_owned_urls` / IndexNow → **IndexNow HTTP 202** → pursuit `WAITING_FOR_EVIDENCE` (`Executed indexnow_submit`) → durable `executed`/`learned` events in `ros_events`
- Operator tick: `executed:1`

#### Stage 9 — Authority cutover (PASS)
- Mac `com.revenueos.core` LaunchAgent **unloaded**; plist renamed to `com.revenueos.core.plist.disabled-azure-cutover`
- Azure: `SHADOW_MODE=0`, `CLAIM_ENABLED=1`, full 50-business portfolio, `OPERATOR_NAME=azure-revenueos-core`
- `systemctl enable --now` equivalent: **enabled + active**
- No dual writers (Mac down)

#### Stage 10 — Persistence (PASS)
- `enabled=enabled`, `active=active` after restart; survives SSH/Cursor disconnect by design (systemd)
- Process kill → `NRestarts` 0→1 → active again; healthz OK

#### Stage 11 — Self-healing baseline (PASS)
- `Restart=always`, `RestartSec=5`, start limits set; dead operator auto-recovered; Postgres healthcheck present

#### Stage 12 — Rollout controller ready (PASS / NOT STARTED)
- Portfolio controls code present; `BUSINESSES=` env can limit admit set
- Operator supervising **50** businesses on Azure
- **Do not begin sequential 15-minute admit test until instructed**

#### Admit controller (RUNNING)

- Module: `services/operator/src/lib/portfolio-admit-controller.ts`
- Env: `ADMIT_ROLLOUT=1`, `ADMIT_PROBATION_MINUTES=15`, `ADMIT_TARGET_PORTFOLIO=50`
- Checkpoint: `ros_config_meta.admit_rollout_checkpoint` + `ros_portfolio_state.portfolio:admit-rollout`
- Serial probation; non-active candidates commercially paused; accepted → `TITAN_MANAGED` in `ros_businesses.metadata`
- Continues after operator/SSH/Cursor restart from checkpoint

# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T20:58:00Z  
Mode: **CORE ARCHITECTURE FROZEN — SiteVault pilot dual-run started (ScopeGuard only)**

```
SUPABASE_RUNTIME_DEPENDENCY = 0
SUPABASE_DATA_AUTHORITY = false
REVENUEOS_NATIVE_POSTGRES_AUTHORITY = true
VERCEL_BRAIN_DEPENDENCY = 0
MAC_EXECUTION_AUTHORITY = true
MULTIPLE_EXECUTION_AUTHORITIES = 0
CROSS_BUSINESS_STATE_CONTAMINATION = 0
BUSINESSES_50_50_AFTER_RESTART = true
REVENUEOS_CORE_ARCHITECTURE = FROZEN
```

## Ultimate pass condition

```
SUPABASE_DEPENDENCY = 0        ✅ runtime
VERCEL_BRAIN_DEPENDENCY = 0    ✅ execution
VERCEL_HOSTING_DEPENDENCY = ⏳ one pilot dual-run (ScopeGuard); 49 untouched
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

---

# VERCEL BRAIN REMOVAL (COMPLETE)

Objective: `VERCEL_BRAIN_DEPENDENCY = 0` — Mac is sole autonomous execution authority.  
Website hosting on Vercel is unchanged (storefronts + ordinary APIs remain).

### Inventory (A/B/C)

| Class | Finding |
|-------|---------|
| **A** Autonomous | `/api/cron/revenueos` (×62 apps), root `/api/cron/daily-growth-review`, `/api/cron/portfolio-digest`, `keep-operating.mjs` |
| **B** Ordinary site | Root `/api/cron/cleanup`, `/api/cron/growth-report`; `/api/owner/execute` limb; storefront commerce APIs |
| **C** Unknown | **0** after live inspect |

### Live cron counts

| Scope | Before | After |
|-------|-------:|------:|
| Portfolio brain crons (`/api/cron/revenueos`) | **14** still scheduled on Vercel (git already `[]`) | **0** |
| Root brain crons | 0 | 0 |
| Root ordinary crons (cleanup, growth-report) | 2 | **2** (kept — class B) |
| `REVENUEOS_VERCEL_BRAIN` env on projects | 0 | 0 |

Sequential disable (14 projects, one-at-a-time prod deploy of empty `vercel.json`):  
`rfpstrike` … `storelift` → all `PASS` (checkpoint `.data/vercel-brain-cron-disable-checkpoint.json`).

### Mac sole-authority guards

- Route refuse unless `REVENUEOS_VERCEL_BRAIN=1` → `refused_cloud_brain` / `mac_brain_only`
- Central helper: `packages/revenueos/src/modules/mac-brain-authority.ts` (`assertCloudBrainAllowed`)
- `checkOperatorHosting` fail-closed when cloud brain not break-glassed / no claim backend
- `keep-operating.mjs` exits unless `FORCE_CLOUD_WAKE=1`
- Scaffold no longer emits brain cron schedules
- LaunchAgent: `REVENUEOS_VERCEL_BRAIN` unset/false; `vercelBrainAllowed=false`

### Proofs

| Check | Result |
|-------|--------|
| Manual cloud cron with valid secret | **refused** (`cycleStatus=refused_cloud_brain`) |
| Mac-only brain ticks | **PASS** (50 businesses; enqueue/exec continue) |
| Native writes | **PASS** (events 199785→217863; activity 34909→53761 during window) |
| Duplicate-execution protection | **PASS** (no cloud schedule + refuse + fail-closed claims) |
| Vercel-blocked independence | **PASS** (Mac continues without Vercel brain) |
| PG + Core restart | **PASS** (`native_postgres`, 50, `mac/native`) |
| Core logs calling Vercel cron URLs | **none** |

### What Vercel still does

Serves storefront websites + ordinary APIs (checkout, owner/execute limbs, cleanup/growth-report).  
**Not** RevenueOS autonomous think/schedule/execute.

### Smallest SiteVault step (STARTED — ScopeGuard only)

Disposable pilot **outside** the active 50 portfolio. Vercel remains primary DNS; no portfolio migration.

| Item | Value |
|------|--------|
| Pilot | `scopeguard` (not in active 50) |
| Control plane | `services/hosting-plane` `:8090` |
| Candidate URL | `http://127.0.0.1:9104` |
| Local gateway | `scopeguard.localhost` → `127.0.0.1:9104` (Caddyfile generated; Caddy not installed) |
| Vercel primary | `https://scopeguard-rho-jade.vercel.app` (still primary) |
| DNS cutover | **false** |
| Dual-run | **PASS** (`pass=true`, health 200, smoke `/api/checkout:405`) |
| Trace | `.data/hosting-dual-run-scopeguard-2026-08-10T20-58-22-833Z.json` |
| Other 49 businesses | **untouched** on Vercel |
| `SITEVAULT_LOCAL_PASS` | **true** |
| `SITEVAULT_PUBLIC_PASS` | **blocked** (no disposable public hostname / edge) |

### PHASE 1 — PUBLIC HOSTING PROOF (BLOCKED — VPS IP + DNS)

Procedure: `docs/SITEVAULT_VPS_SCOPEGUARD_PILOT.md`  
Architecture: **Mac = brain/DB/queue/deploy** · **VPS = public storefront hosting** (customer path never tunnels to Mac).  
SSH deploy key generated on this Mac (`~/.ssh/revenueos-sitevault/`); private key not in repo.

**Waiting on:** VPS provider/IP + disposable DNS `A` record. Then bootstrap user `sitevault` with the published public key.  
Do **not** point any active portfolio domain here. Do **not** migrate the active 50.

---

# FINAL SOVEREIGNTY TEST (COMPLETE — CORE FROZEN)

Harness (test-only, no architecture redesign): `scripts/sovereignty-final-test.mjs`  
Report: `.data/sovereignty-final-report.json` (`OVERALL_PASS=true`, `architectureModified=false`)

### Pass flags

| Flag | Value |
|------|------:|
| `SUPABASE_RUNTIME_DEPENDENCY` | **0** |
| `VERCEL_BRAIN_DEPENDENCY` | **0** |
| `MULTIPLE_EXECUTION_AUTHORITIES` | **0** |
| `CROSS_BUSINESS_STATE_CONTAMINATION` | **0** |
| `MAC_EXECUTION_AUTHORITY` | **true** |
| `NATIVE_POSTGRES_AUTHORITY` | **true** |
| `BUSINESSES_50_50_AFTER_RESTART` | **true** |

### Proofs 1–10

| # | Proof | Result |
|---|--------|--------|
| 1 | Autonomous cycle all 50 (Mac/native only) | **PASS** (50/50 tick; state grew) |
| 2 | Native Postgres sole durable authority | **PASS** (`ros_*`, `mh_*=0`) |
| 3 | No brain path ↔ Supabase | **PASS** (no URL/key/DB; log hits 0) |
| 4 | No brain path → Vercel cron/serverless/deploy APIs | **PASS** |
| 5 | Kill/restart Core — queue/state survives, no dup authority | **PASS** (50/50 resume) |
| 6 | Restart native Postgres + recovery | **PASS** |
| 7 | Deprecated cloud-brain endpoints refuse execution | **PASS** (`executedBrainCount=0` / 52) |
| 8 | Exactly one execution authority | **PASS** (`mac/native`) |
| 9 | 50-business isolation (A≠B; no storefront owns Core) | **PASS** |
| 10 | Authority map produced | **PASS** (below) |

### Authority map

```
RevenueOS Core          → LOCAL / NATIVE   (LaunchAgent com.revenueos.core → :8080)
→ Execution Authority   → NATIVE           (Mac only; Vercel brain DISABLED)
→ Database Authority    → NATIVE           (Postgres 127.0.0.1:55432, ros_*)
→ Queue Authority       → NATIVE           (operator checkpoint + ros_*)
→ Business Workers      → NATIVE           (in-process portfolio workers)
→ Storefronts           → VERCEL           (HTTP only; ScopeGuard dual-run LOCAL candidate)
Supabase                → EXTERNAL_ARCHIVED_NOT_RUNTIME
```

### FREEZE

**RevenueOS core architecture is FROZEN** after this sovereignty PASS.

Do **not**:
- redesign RevenueOS core
- migrate all businesses off Vercel
- add reporting features
- add another scheduler
- create another database abstraction

Proceed **only** with SiteVault infrastructure independence for disposable pilots, one at a time, with Vercel remaining primary until explicit DNS cutover gates pass.

---

# PRIOR FOUNDATION (still valid)

| Item | Status |
|------|--------|
| Stage 1 native PG + RevenueOS.Data | Done |
| Stage 2 dump archive | Done |
| Live Supabase cutover | **PASS** |
| Vercel brain removal | **PASS** |
| Final sovereignty test | **PASS** |
| Core architecture | **FROZEN** |
| Mac Core writes | **`ros_*` native Postgres** |
| SiteVault pilot (ScopeGuard dual-run) | **PASS** (DNS not cut) |

## Current step

**AZURE CONTROL PLANE AUTHORITATIVE + 50-BUSINESS ADMIT ROLLOUT RUNNING**  
Admission owned by Azure `revenueos-operator` (`ADMIT_ROLLOUT=1`). Cursor not required. No storefront DNS cutover.

---

# AZURE PRODUCTION HOST (FREE-TIER)

Last updated: 2026-08-11T00:04:00Z

| Item | Value |
|------|--------|
| Subscription | Azure subscription 1 (`29abf779-4703-47f0-bdda-c92b8d838ab7`) |
| Plan / free | Azure Plan — free services through **2027-09-10** |
| Resource group | `revenueos-prod` |
| VM name | `revenueos-core` |
| Region | `northcentralus` (B1s capacity blocked in westus2/eastus/eastus2) |
| Size | `Standard_B2ats_v2` (free meter: 750 hrs/mo; B1s unavailable) |
| Public IP | `130.131.15.68` |
| Private IP | `10.0.0.4` |
| OS | Ubuntu 22.04.5 LTS |
| Disk | Standard_LRS ~30 GB |
| Auth | SSH key only (`RevenueOS_key` / `~/.ssh/revenueos-sitevault/RevenueOS_key.pem`) |
| User | `azureuser` |
| SSH alias | `ssh revenueos-core` |
| Inbound | NSG + UFW: **22/tcp only** |
| Deploy dir | `/opt/revenueos` |
| Logs | `/var/log/revenueos` (+ logrotate daily/14d) |
| Secrets dir | `/etc/revenueos` (mode 750) |
| Swap | 2G `/swapfile` (RAM ~896 MiB) |
| Docker | Engine + Compose plugin installed |
| Budget alert | `revenueos-free-guard` — **$1/month**, email at 80% actual |
| Expected cost | **$0** while within free B2ats_v2 / disk / public-IP meters |
| Also exists | RG `RevenueOS_group` (`westus2`) with SSH key resource `RevenueOS_key` only |

### Installed on VM so far

- apt updates, git, curl, ufw, fail2ban, unattended-upgrades
- Docker CE + compose plugin
- Password SSH disabled; root login disabled
- Swap + deploy directories
- Azure $1 budget alert (`revenueos-free-guard`)
- Node.js v20.20.2
- Postgres 16 Docker (`revenueos-postgres`): `127.0.0.1:5432` only, mem_limit 384m, data `/opt/revenueos/postgres/data`, creds `/etc/revenueos/postgres.env` (not in git)
- App env `/etc/revenueos/runtime.env` (DATABASE_URL → local Postgres; no secrets in git)
- App tree synced → `/opt/revenueos/app` (**~245M**; `package.json` + `services/operator` + `services/revenueos-infra` present)
  - Excluded: `node_modules`, `.git`, `.data`, `.next`, `*.dump`, `.env.local`, `apps/*/.env*`
  - Runtime secrets authority remains `/etc/revenueos/*` (not app-tree env files)
- Dependencies installed via `npm ci` in `/opt/revenueos/app` (**PASS**)
  - 767 packages; `node_modules` ~759M; exit 0; fatal log errors: **none**
  - `@revenueos/{core,data,infra,operator-service,hosting-plane,…}` present
  - `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; no deploy / no service start
- Azure Postgres schema migrations (**PASS**); platform state **imported** (see cutover tracker)
  - Mechanism: `npm run db -- migrate` → `services/revenueos-infra/src/migrate.ts` (`dbMigrate`)
    - Applies `services/revenueos-infra/migrations/*.sql` under `pg_advisory_lock`
    - Records in `ros_schema_migrations`
    - Connection: `REVENUEOS_DATABASE_URL` (from `/etc/revenueos/runtime.env`)
  - Target confirmed preflight: `127.0.0.1:5432/revenueos` (Docker `revenueos-postgres`); `SUPABASE_DISABLED=1`; no Supabase URL
  - Applied: `0001_baseline.sql`, `0002_ros_channels.sql` (`databaseUrlHost=127.0.0.1:5432`)
  - Schema verify: 16 `ros_*` tables present; connectivity `select 1` OK; row counts all 0
  - Warnings: none fatal (verify heredoc quoting failed once after migrate; re-checked via `docker exec … psql`)
  - Not done at migrate time: operator start, systemd, authority cutover, data import, portfolio rollout
- Systemd unit `revenueos-operator.service` created (**validated; disabled; not started**)
  - Path: `/etc/systemd/system/revenueos-operator.service`
  - Entrypoint: package script `start` → `tsx src/index.ts`  
    `ExecStart=/opt/revenueos/app/node_modules/.bin/tsx …/services/operator/src/index.ts`
  - `User=azureuser`, `WorkingDirectory=/opt/revenueos/app`
  - `EnvironmentFile=/etc/revenueos/revenueos.env` (mode 640); `OPERATOR_NAME=azure-revenueos-core`; `PORT=8080`
  - `Restart=always`, `RestartSec=5`, `StartLimitIntervalSec=120`, `StartLimitBurst=10`
  - `After=`/`Wants=` network-online + docker; logs → journal (`SyslogIdentifier=revenueos-operator`)
  - Validation: `systemd-analyze verify` clean for this unit; paths/entrypoint/env keys OK; `is-enabled=disabled`; `is-active=inactive`
  - Unit validated; Mac LaunchAgent quiesced; Azure start pending (shadow)

### AZURE CONTROL-PLANE CUTOVER TRACKER

```
CURRENT STAGE: 50-BUSINESS ADMIT ROLLOUT — LIVE + AUTONOMOUS ENGINEERING REPAIR
LAST COMPLETED STAGE: engineering repair wired into admit controller (no rollout reset)
AZURE STATUS: UP
DATABASE STATUS: LIVE (Postgres 17)
OPERATOR STATUS: ACTIVE + ENABLED
AUTHORITY: AZURE (azure-revenueos-core)
ADMIT_ROLLOUT: 1
TARGET PORTFOLIO: 50
CURRENT CANDIDATE: bidforge
CURRENT PHASE: LIVE_PROBATION
HEALTHY_MS_AT_REPAIR_DEPLOY: 600000 / 900000 (preserved; not reset)
ACTIVE ACCEPTED / TITAN_MANAGED: 0
REAL MONEY MODE: ACTIVE (probation commercially live)
SELF-HEALING: ACTIVE (systemd Restart=always + engineering repair Levels A–E)
CURSOR REQUIRED: NO
MAC REQUIRED: NO
LAST TEST: control-plane deploy of engineering-repair; admit resumed bidforge @ 600000ms
TEST RESULT: PASS (checkpoint preserved; unit classify A–E pass)
NEXT STAGE: Autonomous — Azure admits one-by-one to 50; repairs harden as failures appear
```

#### Stages 1–3 — Source identify / snapshot / import (PASS)
- Authoritative source: Mac native Postgres `127.0.0.1:55432` (`ros_*`, not Supabase; `mh_*=0`)
- Final export: `~/.revenueos/backups/revenueos-azure-final-sync-2026-08-10T23-25-49Z.sql.gz`
- SHA-256: `2ac146a94e727f1ad176a7419b91ad6b31eb8e9c1159f3d983d88f6d75f69830` (also `/opt/revenueos/backups/`)
- Azure Postgres upgraded 16→17; restore counts matched source (50 businesses; experiments/events/pursuits/activity/etc.)

#### Stage 4–5 — Env + pre-start (PASS)
- `/etc/revenueos/revenueos.env` → Azure `127.0.0.1:5432/revenueos`, `REVENUEOS_MAC_BRAIN=0`, secrets present (not logged)

#### Stage 6 — Controlled start (PASS)
- Started with `SHADOW_MODE=1` first; later live

#### Stage 7 — Full-brain wiring (PASS with fixes)
- Live ticks show APEX + TITAN + NEXUS + FORGE signals influencing decisions
- Fixed dead storefront execute path: Core agent executors now own `indexnow_submit` / `distribute_owned_urls` / `sitemap_ping` / `ping_search_engines`; agent limbs preferred before storefront
- Files: `packages/revenueos/src/modules/agent-executors.ts`, `services/operator/src/lib/agent-executor.ts`

#### Stage 8 — One safe real loop (PASS)
- Business: `invoicechaser`
- Observed → bottleneck NO_IMPRESSIONS → APEX `distribute_owned_urls` / IndexNow → **IndexNow HTTP 202** → pursuit `WAITING_FOR_EVIDENCE` (`Executed indexnow_submit`) → durable `executed`/`learned` events in `ros_events`
- Operator tick: `executed:1`

#### Stage 9 — Authority cutover (PASS)
- Mac `com.revenueos.core` LaunchAgent **unloaded**; plist renamed to `com.revenueos.core.plist.disabled-azure-cutover`
- Azure: `SHADOW_MODE=0`, `CLAIM_ENABLED=1`, full 50-business portfolio, `OPERATOR_NAME=azure-revenueos-core`
- `systemctl enable --now` equivalent: **enabled + active**
- No dual writers (Mac down)

#### Stage 10 — Persistence (PASS)
- `enabled=enabled`, `active=active` after restart; survives SSH/Cursor disconnect by design (systemd)
- Process kill → `NRestarts` 0→1 → active again; healthz OK

#### Stage 11 — Self-healing baseline (PASS)
- `Restart=always`, `RestartSec=5`, start limits set; dead operator auto-recovered; Postgres healthcheck present

#### Stage 12 — Rollout controller ready (PASS / NOT STARTED)
- Portfolio controls code present; `BUSINESSES=` env can limit admit set
- Operator supervising **50** businesses on Azure
- **Do not begin sequential 15-minute admit test until instructed**

#### Admit controller (RUNNING)

- Module: `services/operator/src/lib/portfolio-admit-controller.ts`
- Env: `ADMIT_ROLLOUT=1`, `ADMIT_PROBATION_MINUTES=15`, `ADMIT_TARGET_PORTFOLIO=50`
- Checkpoint: `ros_config_meta.admit_rollout_checkpoint` + `ros_portfolio_state.portfolio:admit-rollout`
- Serial probation; non-active candidates commercially paused; accepted → `TITAN_MANAGED` in `ros_businesses.metadata`
- Continues after operator/SSH/Cursor restart from checkpoint

#### Autonomous engineering repair (ACTIVE — Azure-owned)

- Module: `services/operator/src/lib/engineering-repair.ts`
- **Conversion executor gap CLOSED (2026-08-11):** Core limbs `change_default_cta` / `rewrite_page_copy` / `publish_bundle` (`site-mutations.ts`, versioned + ScopeGuard + rollback)
- Planner re-demotes after late LLM/conversion/floor inject (no Adapter-missing enqueue)
- `distribute_owned_urls` multi-limb: IndexNow + sitemap + syndicate + schema
- Adapter-missing → Level C repair incidents; on-disk verification promotes lessons
- Commercial proof: `syndicate_content` real HTTP 200; `change_default_cta` durable mutation on Azure
- Wired from admit unhealthy path (`ENGINEERING_REPAIR` phase) without resetting `healthyMsAccumulated`
- Hierarchy: A transient → B runtime → C business isolate/patch/canary → D platform (pause NEW admissions only) → E CRITICAL_HOLD (human)
- Isolated repair workspace under `/opt/revenueos/repair/`; known-good snapshots under `/opt/revenueos/known-good/`; canary → promote → auto-rollback
- Lessons/metrics/incidents in `ros_config_meta`: `engineering_repair_lessons`, `engineering_reliability_metrics`, `engineering_repair_incidents`
- Titan commercial hold: `metadata.admit.engineeringBlocked` / `titanCommercialHold` — do not commercially kill for eng defects
- PortfolioArchitect: `engineeringBlocked` telemetry treated as locked (no soft-retire while repairing)
- No identical unsuccessful fix loops (`MAX_ATTEMPTS_PER_FINGERPRINT=3` + attemptedFixes guard)
- Control-plane deploy 2026-08-11: paused NEW admissions only → rsync → restart → resumed bidforge probation at **600000ms** (not reset to Business 1)

### Not yet done

- Admit rollout **RUNNING** — Azure autonomous through 50 with compounding repair (Cursor babysitting stopped)
- Any storefront DNS / SiteVault public cutover
- Optional: restore OpenAI org credits if generative limbs must not degrade
- Optional: deploy `/api/owner/execute` on Vercel apps for storefront-only limbs
- Optional: expand repair playbooks as new fingerprints appear in production

### Recovery commands

```bash
ssh revenueos-core
systemctl status revenueos-operator --no-pager
journalctl -u revenueos-operator -n 100 --no-pager
az vm get-instance-view -g revenueos-prod -n revenueos-core -o table
# Mac authority is retired:
# ~/Library/LaunchAgents/com.revenueos.core.plist.disabled-azure-cutover
```

### Migration status

| Plane | Status |
|-------|--------|
| Azure VM host | **UP** |
| Azure `revenueos-operator` | **ACTIVE + ENABLED** |
| Mac `com.revenueos.core` | **RETIRED** (plist disabled) |
| Vercel storefronts | HTTP only (unchanged DNS) |
| Supabase | archived / not runtime for Core |
| 50-BUSINESS ADMIT ROLLOUT | **RUNNING** |



- Module: `services/operator/src/lib/engineering-repair.ts`
- Wired from admit unhealthy path (`ENGINEERING_REPAIR` phase) without resetting `healthyMsAccumulated`
- Hierarchy: A transient → B runtime → C business isolate/patch/canary → D platform (pause NEW admissions only) → E CRITICAL_HOLD (human)
- Isolated repair workspace under `/opt/revenueos/repair/`; known-good snapshots under `/opt/revenueos/known-good/`; canary → promote → auto-rollback
- Lessons/metrics/incidents in `ros_config_meta`: `engineering_repair_lessons`, `engineering_reliability_metrics`, `engineering_repair_incidents`
- Titan commercial hold: `metadata.admit.engineeringBlocked` / `titanCommercialHold` — do not commercially kill for eng defects
- PortfolioArchitect: `engineeringBlocked` telemetry treated as locked (no soft-retire while repairing)
- No identical unsuccessful fix loops (`MAX_ATTEMPTS_PER_FINGERPRINT=3` + attemptedFixes guard)
- Control-plane deploy 2026-08-11: paused NEW admissions only → rsync → restart → resumed bidforge probation at **600000ms** (not reset to Business 1)

### Not yet done

- Admit rollout **RUNNING** — Azure autonomous through 50 with compounding repair (Cursor babysitting stopped)
- Any storefront DNS / SiteVault public cutover
- Optional: restore OpenAI org credits if generative limbs must not degrade
- Optional: deploy `/api/owner/execute` on Vercel apps for storefront-only limbs
- Optional: expand repair playbooks as new fingerprints appear in production

### Recovery commands

```bash
ssh revenueos-core
systemctl status revenueos-operator --no-pager
journalctl -u revenueos-operator -n 100 --no-pager
az vm get-instance-view -g revenueos-prod -n revenueos-core -o table
# Mac authority is retired:
# ~/Library/LaunchAgents/com.revenueos.core.plist.disabled-azure-cutover
```

### Migration status

| Plane | Status |
|-------|--------|
| Azure VM host | **UP** |
| Azure `revenueos-operator` | **ACTIVE + ENABLED** |
| Mac `com.revenueos.core` | **RETIRED** (plist disabled) |
| Vercel storefronts | HTTP only (unchanged DNS) |
| Supabase | archived / not runtime for Core |
| 50-BUSINESS ADMIT ROLLOUT | **RUNNING** |

