# RevenueOS Native Platform — Design + Dependency Map

Last updated: 2026-08-10T19:00:00Z  
Mode: **DESIGN ONLY** (no migration / no business builds / no destructive changes)

## Pass condition (long-term)

If Vercel and Supabase credentials disappeared, **RevenueOS Core would continue functioning**.

## Prior migration phases (still valid)

| Phase | Result |
|-------|--------|
| 1 | Mapped Vercel brain execution |
| 2 | Disabled cloud brain crons + hard-refuse; ~60 storefront redeploys still queued |
| 3 | Mac Core authoritative: LaunchAgent, scheduler, checkpoint, watchdog |

**Frozen:** 50-business portfolio build/deploy.

---

# A. CURRENT VERCEL DEPENDENCY MAP

## A1 — Brain / Execution (class A → must leave Vercel)

| Dependency | Where | Status |
|------------|-------|--------|
| Per-app minute cron → `runPursuitTick` | `apps/*/api/cron/revenueos` | **Code hard-refuses** unless `REVENUEOS_VERCEL_BRAIN=1`; crons emptied in git; **prod cleared:** BidBinder, InvoiceChaser; **~60 apps still need redeploy** so empty crons take effect |
| TributeReady continuous hunt | `/api/cron/daily-growth-review` | **Removed from prod crons** + refuse in route |
| Portfolio digest orchestration | `/api/cron/portfolio-digest` | **Removed from prod crons** + refuse in route |
| Dual-brain claim coordination | `checkOperatorHosting` / claims | Still exists so un-redeployed apps fail closed when Mac holds lease; temporary bridge |

## A2 — Public website hosting (class B → replace with RevenueOS Host later)

| Dependency | Where | Notes |
|------------|-------|-------|
| Next.js storefront hosting | every `apps/*` on `*.vercel.app` / custom domains | Customer sites, checkout UI |
| Serverless API routes | checkout, stripe webhook, beacon, download, owner/execute, owner/pulse | Limbs + commerce — stay until Host owns them |
| Env / secrets per project | Vercel project env | Scattered; must centralize in RevenueOS config |
| Deploy pipeline | `vercel deploy`, hosting-plane Vercel hooks | Business release path still cloud-tied |
| Root cleanup / growth-report crons | TributeReady `vercel.json` | Non-brain; still on Vercel (storefront hygiene / email) |

## A3 — Classification summary

- **A (execution):** autonomous ticks, hunt, portfolio orchestration → **Mac Runtime only** (mostly done in code; redeploy queue remains).
- **B (hosting):** public sites + checkout/webhooks → **RevenueOS Host** (not migrated yet).

---

# B. CURRENT SUPABASE DEPENDENCY MAP

Supabase appears in **~329** source files (mostly duplicated storefront vendors). **No evidence of critical use of Supabase Auth, Realtime, or Storage** in Core/operator or ScopeGuard; usage is **Postgres-via-PostgREST** (and some RPC in TributeReady growth paths).

## B1 — Tables / document collections (operator ExperimentStore)

From `services/operator/src/lib/supabase-store.ts`:

| Table / collection | Role |
|--------------------|------|
| `revenueos_experiments` | Document-mode catch-all (pursuits, events, claims fallback, owner controls, architect state) |
| `revenueos_pursuits` | Native pursuit queue jobs |
| `revenueos_pursuit_events` | Append-only pursuit / beacon events |
| `revenueos_leases` | Pursuit leases |
| `revenueos_attributions` | Attribution records |
| `revenueos_capability_gaps` | Capability gap memory |
| `revenueos_channels` | Channel registry |
| `revenueos_cycle_reports` | Cycle reports |
| `revenueos_discovery_doors` | Discovery doors |
| `revenueos_exposures` | Exposure records |
| `revenueos_lessons` | Learning lessons |
| `revenueos_planner_runs` | Planner runs |
| `revenueos_scorecards` | Scorecards |
| `revenueos_operator_claims` | Native Mac↔Vercel claim leases (preferred; may fall back to experiments docs) |

## B2 — What state lives on Supabase today

| State class | Location | Criticality |
|-------------|----------|-------------|
| Business pursuit queue / jobs | pursuits (+ document mode) | **Critical** |
| Learning / lessons / scorecards | tables above | **Critical** |
| Portfolio architect / owner controls | `revenueos_experiments` docs | **Critical** |
| Operator claims | claims table / docs | High (coordination) |
| Beacon / analytics events | pursuit_events | High |
| Activity feed for Mac UI | often derived from Core memory + optional Supabase reads | Medium (Core can show in-memory) |
| Storefront orders / growth (TributeReady) | app-specific tables via `src/lib/supabase-admin.ts` | Business-specific |
| Auth / Realtime / Storage / Edge | **Not used as Core dependency** | N/A for Core |

## B3 — Coupling pattern

- Mac Core: `createSupabaseStore` + `claims.ts` + owner-controls/evolution loaders.
- Packages: `operator-claims.ts` (Vercel fail-closed host check).
- Apps: per-site durable store copies (vendor) talking to same project.
- Fallback already exists: **file ExperimentStore** + **engine-checkpoint.json** when Supabase REST hangs.

---

# C. CURRENT REVENUEOS RUNTIME COMPONENTS (reuse)

| Need | Existing asset | Reuse role |
|------|----------------|------------|
| Supervisor (process) | `com.revenueos.core` LaunchAgent KeepAlive | Parent of Core today; extend to multi-child |
| Scheduler | `services/operator/src/lib/scheduler.ts` | Per-business loops, concurrency, watchdog |
| Persistence (runtime) | `engine-checkpoint.ts` | Schedule resume across crash |
| Persistence (ledger) | `packages/revenueos/src/ledger/file-store.ts` + supabase-store | Dual backend → Postgres repository |
| Heartbeats / Activity API | `health-server.ts`, `runtime-heartbeat.ts`, `owner-api.ts` | Mac UI observation |
| Resource governor | `services/hosting-plane/src/resource-governor.ts` (+ test) | **Reuse as Core Resource Governor** |
| Host / process runtime | `hosting-plane` (`process-runtime`, `docker-runtime`, `gateway`, `build-manager`) | Seed of RevenueOS Host + SiteVault releases |
| Browser | `services/browser-sidecar` (Playwright) | Seed of Browser Workers (must become queued jobs) |
| Brain | `@revenueos/core` `runOperatorTick` / pursuits / APEX/TITAN/NEXUS | Keep; change only I/O backends |
| Business lifecycle | `business-launcher.ts`, portfolio manifests | Evolve into SiteVault registry |
| Local degraded mode | file ledger under `.data/operator-local-ledger` | Bridge until Postgres owns writes |

---

# D. MINIMUM NATIVE ARCHITECTURE (owned control plane)

```
RevenueOS Core (LaunchAgent parent)
├── Supervisor          — start/stop/health/restart children; circuit breakers
├── Resource Governor   — caps on builds/browsers/AI/business concurrency; backpressure
├── Scheduler           — enqueues only (no execute)
├── Durable Queue       — Postgres job leases (QUEUED→CLAIMED→RUNNING→…)
├── Workers             — Brain / Browser / Build (isolated, heartbeaten)
├── Data                — self-hosted PostgreSQL + migrations + backup/restore
├── Storage             — local durable blob/fs API (put/get/list)
├── SiteVault           — per-business source/releases/assets/config
├── Host                — Caddy (or equiv) under Core control; domain→release
├── Config/Secrets      — single config plane; secrets never in git
└── Observability       — Activity from Core truth (queue/workers/ticks/revenue)
```

**Principles**
- Postgres = source of truth (not browser, not Vercel, not in-memory).
- Scheduler ≠ workers.
- Queue work when overloaded; never spawn unbounded processes.
- Production source never edited live; release pipeline only.
- Compatibility adapters during migration; zero destructive cuts.

**CLI surface (target)**  
`revenueos infra start|stop|status` · `revenueos db migrate|backup|restore|health`

---

# E. MIGRATION STAGES (ordered, non-destructive)

1. **Design freeze** ← *this document*  
2. **Infra skeleton** — Supervisor can start/stop/health local Postgres (Docker/Podman or managed local), config/secrets layout, empty migrations runner.  
3. **Data repository interface** — app code depends on `RevenueOS.Data`, not `@supabase/*`; Supabase adapter implements interface.  
4. **Export/backup Supabase** — full dump + row counts/hashes for critical tables; store under RevenueOS backups.  
5. **Schema migrate + import** — Postgres native schema; verify counts/hashes/sample records.  
6. **Dual-read / dual-write bridge** — read Postgres preferred, write both; then switch writes; then disable Supabase adapter.  
7. **Durable queue tables** — atomic claim leases; migrate pursuits into jobs where appropriate.  
8. **Scheduler split** — scheduler only enqueues; workers claim jobs (evolve today’s in-process loops).  
9. **Finish Vercel class-A kill** — redeploy remaining storefronts (empty crons) OR leave refuse-only until Host migration.  
10. **SiteVault + Host proof (ONE business)** — own source, build, release, serve via Caddy, health, rollback.  
11. **Browser workers on queue** — Playwright pool with caps; jobs durable.  
12. **Independence test** — Core up with Supabase+Vercel brain unreachable.  
13. **Portfolio migration** — only after proof passes; one business at a time.

**Never:** delete Supabase data; cut over without verified backup; migrate all 50 at once.

---

# F. SITEVAULT + HOST + BROWSER (design)

## SiteVault
`RevenueOS/data/businesses/<id>/{source,releases,assets,config,logs}`  
Registry fields: domain, runtime, current/previous/last-known-good release, build/process/health, webhook/Stripe refs, history.  
Ops: create/read/modify/build/test/release/rollback/start/stop/restart/archive.  
Pipeline: SOURCE → PATCH → BUILD → TEST → CANDIDATE → HEALTH → ACTIVATE (else reject/rollback).

## Host
Programmatic **Caddy** (proven TLS/reverse proxy).  
Static releases preferred; dynamic apps as isolated processes.  
Domain routing, webhooks, health, graceful restart, per-business resource accounting.

## Browser
Playwright pool; every action = durable queued job; crash → lease expire → retry; never primary truth; no secrets in git/logs/prompts.

---

# G. SELECTED PROOF BUSINESS

**ScopeGuard** (`apps/scopeguard`)

| Why | Detail |
|-----|--------|
| Mature storefront | Existing FORGE/APEX laboratory |
| Not in active `dynamic_only_50` | Experiments won’t disturb cashflow portfolio ticks |
| Supabase surface small | DB `.from` usage; no Auth/Realtime/Storage in app tree |
| Clear product path | Landing → checkout limb → health checks |

**Not chosen now:** InvoiceChaser (in active Mac portfolio — higher blast radius); BidBinder (retired, good secondary).

---

# H. SMALLEST SAFE FIRST IMPLEMENTATION STEP

**After you approve implementation:**  

> Scaffold `services/revenueos-infra` (name TBD) that:  
> (1) starts/stops/health-checks a **local PostgreSQL** via Docker/Podman,  
> (2) adds `revenueos db migrate` with an empty/baseline migration runner,  
> (3) introduces `RevenueOS.Data` repository interface + **Supabase adapter** wrapping today’s `createSupabaseStore`,  
> (4) targeted tests: infra status + migrate no-op + adapter still reads/writes through interface.  

No data cutover. No SiteVault. No Host. No portfolio moves. No Supabase delete.

---

# I. TRUE BLOCKERS NEEDING YOU

1. **Postgres runtime preference:** Docker Desktop vs Postgres.app vs remote self-hosted box?  
2. **Domain/TLS for Host proof:** Can ScopeGuard use a local hostname / nip.io first, or must proof use a real domain you control?  
3. **Supabase access for export:** Confirm service-role backup is allowed from this machine (project not paused; REST currently intermittent).  
4. **Stripe test mode:** Approval to run pre-payment checkout verification in Browser proof (no live charges).  
5. **Redeploy queue:** Should Phase-2 leftover Vercel cron empties continue in parallel (one-by-one), or pause until Host owns sites?

---

# J. DO NOT DO (until instructed)

- Migrate/delete Supabase  
- Migrate businesses to Host  
- Build/deploy portfolio  
- Begin one-business proof implementation  
- Begin major implementation beyond the approved first step  

## Current step

**DESIGN + DEPENDENCY MAPPING COMPLETE.** Stopped. Await next instruction.
