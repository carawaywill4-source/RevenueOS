# RevenueOS Recovery + Native Platform

Last updated: 2026-08-10T19:40:00Z  
Mode: **AUTHORITY INVESTIGATION COMPLETE — STAGE 3 BLOCKED**

## Ultimate pass condition

```
SUPABASE_DEPENDENCY = 0
VERCEL_DEPENDENCY = 0
```

## Priority

Infrastructure independence #1. No cutover until authoritative memory is copied.

---

# SECURITY

The Stage 2 direct DB password was exposed in chat/history → **treat as compromised**.  
Rotate the `fnrwz…` database password; update only gitignored local secrets.  
Never print/log/commit/echo the replacement credential.

---

# AUTHORITY INVESTIGATION (2026-08-10)

## Decision

```
AUTHORITATIVE_SUPABASE_PROJECT = buvfllemxdvmwzhvfori
```

**Stage 2 local copy (`fnrwzloovduhryynmgok`) is NOT the authoritative Mac Core memory.**  
**Another verified Stage 2 export is REQUIRED against `buvfl…` once its direct Postgres URL is available.**  
**No Stage 3. No merge. No deletes. No disabling either project.**

### Evidence (decisive)

| Evidence | Detail |
|----------|--------|
| Live LaunchAgent | `com.revenueos.core` WorkingDirectory = `services/operator`; **no** `SUPABASE_*` in plist env |
| Env hydrate order | `hydrateEnvFromFiles()` loads **`services/operator/.env` first** → then repo `.env.local` only if unset (`services/operator/src/env.ts`) |
| Effective Core URL | `services/operator/.env` → **`buvfllemxdvmwzhvfori`** (also root `.env.local`) |
| Live Core activity | `/status` shows 50 businesses ticking now (e.g. `invoicechaser` `lastTickAt=2026-08-10T19:30:53Z`) |
| Stage 2 copy fact check | Local `fnrwz` restore: **`invoicechaser` experiment rows = 0** |
| Stage 2 copy freshness | Newest local experiment timestamp ≈ **2026-08-09** (stale vs live ticks today) |
| Docs | `docs/REVENUEOS_MAC_CUTOVER_STATUS.md` / migration manifest: **`buvfl…` = live memory**; `fnrwz…` = storefront/stale |
| Boot mode | Core logs `ledgerMode: "document"` → native pursuit tables not available on Core’s project; state in `revenueos_experiments` documents |
| Degraded local | `.data/operator-local-ledger/*` **actively written** during REST hangs (50 ledger files; mtimes during this investigation) |

---

## Projects discovered

### PROJECT A — `buvfllemxdvmwzhvfori` (**AUTHORITATIVE for Mac Core**)

| Field | Value |
|-------|-------|
| Role | Mac Core / TributeReady **live memory** |
| Referenced by | `services/operator/.env`, root `.env.local`, docs as live memory |
| Components | Mac LaunchAgent Core (`createSupabaseStore`), operator claims/learning/portfolio docs |
| Direct PG URL | **Not available locally** (blocked Stage 2 against this project) |
| REST during investigation | **Timed out** on `/rest/v1/` and experiments probe (5–10s) — same flaky pattern; Core often falls back to local ledgers |
| Prior documented counts | ~46k–47k experiments (cutover status / migration manifest) — **not re-verified live this pass due to REST timeout** |
| Ledger mode (live boot) | **document** |
| Also | File ledger fallback when REST hangs |

### PROJECT B — `fnrwzloovduhryynmgok` (**Stage 2 dump source; NOT Mac Core authority**)

| Field | Value |
|-------|-------|
| Role | Legacy / storefront app donor project |
| Referenced by | **~62** `apps/*/.env.local`; Stage 2 `SUPABASE_DB_URL` you supplied |
| Components | Storefront apps’ local env (often documented as timeout/stale) |
| Direct PG | Was used for Stage 2 dump (password **compromised — rotate**) |
| Verified dump tables | `revenueos_experiments` 107396; `lessons` 266; `scorecards` 76; `channels` 238; `attributions` 0 |
| REST smoke this pass | **Reachable** — `Content-Range 0-0/107396` on experiments (matches dump) |
| Newest in local copy | experiments ~2026-08-09; lessons ~2026-08-10 13:15 local; channels ~2026-08-09 |
| invoicechaser in copy | **0 rows** |
| Extra non-ROS tables | `mh_*` (MendHaus) — excluded from ROS export |

### Additional refs

No third Supabase project ref found in Core/operator/docs path beyond A/B.  
Vercel prod env not re-pulled this pass (paused nonessential Vercel work).

---

## Live Mac Core configuration (not inferred from stale files alone)

```
launchd com.revenueos.core
  WorkingDirectory = …/services/operator
  Program = tsx services/operator/src/index.ts
  Env from plist = REVENUEOS_MAC_BRAIN=1, REVENUEOS_VERCEL_BRAIN=0 (no Supabase URL)
  hydrateEnvFromFiles → services/operator/.env  ⇒  buvfl…
  createSupabaseStore(url=env.SUPABASE_URL)
```

Observed live: `engine.authority=mac`, 50 businesses, recent ticks, checkpoint `savedAt` refreshing, local ledgers updating.

---

## Missing tables (code inventory vs reality)

| Table | On fnrwz (Stage 2 dump) | On buvfl (Core project) | Verdict |
|-------|-------------------------|-------------------------|---------|
| `revenueos_experiments` | present (107396) | present (document ledger; REST flaky) | **Active primary document store** |
| `revenueos_lessons` | present (266) | expected present | Active |
| `revenueos_scorecards` | present (76) | expected present | Active |
| `revenueos_channels` | present (238) | expected present | Active |
| `revenueos_attributions` | present (0) | unknown live | Empty/optional |
| `revenueos_pursuits` | **absent** | **absent/errors → document mode** | **B: never migrated to native on Core project; pursuits stored as experiment documents** (`ledgerMode=document`) |
| `revenueos_pursuit_events` | **absent** | **absent/errors → document mode** | Same as pursuits — document path |
| `revenueos_leases` | **absent** | likely absent / document leases | Document-mode leases in experiments |
| `revenueos_planner_runs` | **absent** | likely document | Document category in experiments |
| `revenueos_cycle_reports` | **absent** | likely document | Document |
| `revenueos_exposures` | **absent** | likely document | Document |
| `revenueos_discovery_doors` | **absent** | likely document | Document |
| `revenueos_capability_gaps` | **absent** | likely document | Document |
| `revenueos_operator_claims` | **absent** | **documented missing**; claims use `ros:opclaim:*` experiment docs | **A/B: never applied native DDL; document claims** |
| Scheduler / tick state | n/a | **local file** `.data/operator-engine-checkpoint.json` | **D: local** |
| Degraded learning writes | n/a | **local files** `.data/operator-local-ledger/<site>/` | **D: local when Supabase degraded** |

No fake empty tables created.

---

## Stage 2 copy status

| Question | Answer |
|----------|--------|
| Is Stage 2 copy the correct cutover source? | **NO** |
| Why project-ID discrepancy? | You supplied `fnrwz` DB URL; Mac Core uses `buvfl` REST URL |
| Another export required? | **YES — Stage 2 redo against `buvfllemxdvmwzhvfori` direct Postgres** |
| Also capture? | Local file ledgers + engine checkpoint (unique recent state when REST degraded) |

---

# Completed stages (unchanged)

| Stage | Result |
|-------|--------|
| Stage 1 | Native Postgres + RevenueOS.Data |
| Stage 2 tooling | Proven on `fnrwz` dump (wrong authority for cutover) |
| Authority investigation | **`buvfl` is Mac Core authority** |

---

# NO STAGE 3 YET

Do not switch RevenueOS.Data production path to native Postgres.  
Do not disable/delete either Supabase project.

## Smallest next step

1. Rotate compromised `fnrwz` DB password.  
2. Provide **direct Postgres URL for `buvfllemxdvmwzhvfori`** in gitignored secrets (no chat paste if avoidable).  
3. Re-run **Stage 2 only** against `buvfl` (+ inventory local ledgers/checkpoint for merge into native later).  
4. Only after that verify PASS → consider Stage 3.

## Current step

**STOPPED.** Awaiting `buvfl` direct DB credentials after password hygiene.
