# RevenueOS macOS Migration Manifest

**Status:** Phase 0 inventory complete · Phase 1 scaffolding in progress  
**Rule:** THIS IS A MIGRATION OF THE EXISTING BRAIN. Nothing is deleted until its Mac replacement is verified.  
**Cutover rule:** Exactly one system owns a given action after cutover.

## Explicit architecture map (traced)

| Concern | Where it lives TODAY | Destination |
| --- | --- | --- |
| **Brain / intelligence** | `packages/revenueos` (TypeScript) vendored into each `apps/*/vendor/revenueos` | **RevenueOSCore** (same package, single process on Mac) |
| **WHAT RUNS ON VERCEL** | Per-app `apps/*/src/app/api/cron/revenueos` · pulse · beacon · checkout · storefront pages · portfolio digest on TributeReady | Storefront + thin APIs only after cutover |
| **WHAT RUNS ELSEWHERE** | `services/operator` (Fly/local Node loop) · `services/browser-sidecar` (local Playwright) · `apps/dashboard` (Next owner UI) · Devvit `revenueos/` | Operator → Mac launchd Core; sidecar stays Mac-local; dashboard → SwiftUI |
| **WHERE MEMORY LIVES** | Supabase `revenueos_*` tables (project `fnrwzloovduhryynmgok`) + document jsonb; ephemeral `/tmp/revenueos` fallback on Vercel | **Same Supabase** (do not reset) + Mac local cache for speed |
| **WHERE LEARNING LIVES** | `pattern-posterior`, `mechanism-bandit`, `channel-registry`, `knowledge-graph`, `attribution-ml`, `self-improving-strategist`, lessons/experiments tables | Same modules inside Core |
| **WHERE EXECUTION LIVES** | `permissionless-operator` + limb modules, invoked from cron `runPursuitTick` and/or operator `runOperatorLoop` | Core workers calling same modules |
| **WHERE SCHEDULING LIVES** | Vercel cron (hourly per app + portfolio digest) · operator `scheduler.ts` · Devvit hourly-help | Core continuous scheduler; digest remains receipt-only |
| **WHERE COMMERCIAL ATTRIBUTION LIVES** | `attribution.ts`, `attribution-ml.ts`, `signed-utm.ts`, beacon events → `revenueos_pursuit_events`, Stripe webhooks per app | Core + Stripe as financial truth |
| **WHERE STRIPE INTEGRATION LIVES** | Per-app `api/checkout`, `api/stripe/webhook`, `stripe-order-bumps` module | Stay on storefronts; Core reads Balance/Payments APIs for owner UI |

---

## Component inventory

| Component | Current location | Dependencies | State/storage | Businesses | Destination | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `@revenueos/core` package | `packages/revenueos` | OpenAI, fetch, fs | Supabase via adapters | All | RevenueOSCore | PRESERVE |
| Storefront kit / permissionless operator | `packages/storefront-kit` | core | publish doors under app | Portfolio apps | Core + thin site APIs | PRESERVE |
| Pursuit engine / tick | `modules/pursuit-engine.ts`, `pursuit-plan.ts` | ledger, planner | pursuits + events | All | Core | PRESERVE |
| First-customer mode | `modules/first-customer-mode.ts` | — | in plan document | All | Core | PRESERVE |
| Stagnation / strategy mutation | `modules/stagnation.ts` | pattern gate | cycle reports | All | Core | PRESERVE |
| Exploration floor | `modules/exploration-floor.ts` | mechanisms | — | All | Core | PRESERVE |
| Planner / executive / scorecard | `planner.ts`, `executive.ts`, `scorecard.ts` | policy | planner_runs | All | Core | PRESERVE |
| Objective / money / economics | `objective.ts`, `money.ts`, `economics.ts`, `profit-maximizer.ts` | — | scorecards | All | Core | PRESERVE |
| Ambition / northstar / target tracking | `ambition.ts`, `northstar.ts`, `target-tracking.ts` | — | documents | All | Core | PRESERVE |
| Acquisition / conversion / retention | `acquisition.ts`, `conversion.ts`, `retention.ts` | — | experiments | All | Core | PRESERVE |
| Strategy / diagnosis / experimentation | `strategy.ts`, `diagnosis.ts`, `experimentation.ts` | — | experiments/lessons | All | Core | PRESERVE |
| Audience / market model | `audience.ts`, `market/model.ts` | — | — | All | Core | PRESERVE |
| Channel catalog / discovery / registry | `channel-*.ts` | OpenAI, web search | `revenueos_channels` | All | Core | PRESERVE |
| Mechanism bandit / diversity / revenue priority | `mechanism-bandit.ts`, `mechanism-diversity.ts`, `revenue-priority.ts` | — | channel α/β + posteriors | All | Core | PRESERVE |
| Pattern posteriors / business suspension | `pattern-posterior.ts`, `business-suspension.ts` | — | lessons/bans | All | Core | PRESERVE |
| LLM strategist / self-improving prompts | `llm-strategist.ts`, `self-improving-strategist.ts` | OpenAI | prompt variants | All | Core | PRESERVE |
| Buyer discovery / public outreach / email | `buyer-discovery.ts`, `public-outreach.ts`, `email-outreach.ts` | OpenAI, Resend | leads files + events | All | Core | PRESERVE |
| Reddit / PH / IH / HN / YT / GSC / Gumroad | `reddit-executor.ts`, `producthunt.ts`, `indiehackers.ts`, `hackernews.ts`, `youtube.ts`, `google-search-console.ts`, `gumroad.ts` | platform APIs | drafts + events | All | Core | PRESERVE |
| Free listings (GBP/Bing/Apple/Nextdoor/Yelp/Shorts) | `free-listings.ts` | OpenAI, optional sidecar | draft JSON | All | Core | PRESERVE |
| Exit intent / order bumps / signed UTM | `exit-intent.ts`, `stripe-order-bumps.ts`, `signed-utm.ts` | Stripe | captured_emails | All | Core + site | PRESERVE |
| Beacon / attribution ML / anomaly | `beacon.ts`, `attribution*.ts`, `anomaly-detector.ts` | — | pursuit_events | All | Core + site beacon | PRESERVE |
| Knowledge graph / LTV-CAC / conversion lab | `knowledge-graph.ts`, `ltv-cac-model.ts`, `conversion-lab.ts` | — | jsonb docs | All | Core | PRESERVE |
| Compliance / concrete escalations / capability gaps | `compliance-guard.ts`, `concrete-escalations.ts`, `capability-gaps.ts` | robots.txt | gaps table | All | Core | PRESERVE |
| Intelligence suite (bandit/UCB/forecast/…) | `intelligence/*` | — | various docs | All | Core | PRESERVE |
| Memory layers | `memory/{global,industry,site,portable,similarity}.ts` | — | lessons | All | Core | PRESERVE |
| Knowledge packs | `knowledge/*` | — | — | All | Core | PRESERVE |
| Ledger / file-store / durable-store adapters | `ledger/*`, `apps/*/src/revenueos/durable-store.ts` | Supabase | all `revenueos_*` | All | Core (single adapter) | PRESERVE |
| Operator loop / adapter | `operator-loop.ts`, `operator-adapter.ts` | store | claims | Portfolio | RevenueOSCore | PRESERVE |
| Persistent operator service | `services/operator` | Supabase, OpenAI | claims leases | Portfolio | **Mac launchd Core** | MIGRATE-HOST |
| Browser sidecar | `services/browser-sidecar` | Playwright | profile dir | External posts | Stay Mac-local | PRESERVE |
| Owner dashboard (Next) | `apps/dashboard` | Supabase | reads DB | Owner | Bridge → SwiftUI | BRIDGE |
| Portfolio digest cron | `src/app/api/cron/portfolio-digest` | Resend, pulse, beacon rollup | email lock | Root TR | Core generates; email receipt | MOVE-SCHEDULE |
| Per-app RevenueOS cron | `apps/*/src/app/api/cron/revenueos` | CRON_SECRET | pursuits | Each app | Disable after Mac verified | CUTOVER |
| Pulse / owner APIs | `apps/*/src/app/api/owner/pulse` | PORTFOLIO_PULSE_TOKEN | ledger read | Each app | Thin health stays | KEEP-VERCEL |
| Beacon ingest | `apps/*/src/app/api/beacon` | — | pursuit_events | Each app | KEEP-VERCEL | KEEP |
| Checkout / Stripe webhook / fulfillment | per-app `api/checkout`, `api/stripe/webhook`, TR memorial flows | Stripe, Resend, Supabase | orders | Each app | KEEP-VERCEL | KEEP |
| Env sync / deploy scripts | `scripts/sync-portfolio-envs.mjs`, `deploy-portfolio-site.mjs` | Vercel CLI | — | All | Keep for storefronts | KEEP |
| Devvit Reddit app | `revenueos/` (Devvit) | Reddit | Redis | Community | Keep separate | KEEP |
| Hourly email lock | `src/revenueos/hourly-email-lock.ts` | Supabase/local | slot claim | Digest | Core or TR | PRESERVE |
| Owner dialog | `modules/owner-dialog.ts` | token | — | Owner | Swift command UI | PRESERVE |

---

## Durable memory tables (MUST migrate/read — never reset)

From `packages/revenueos/schema.sql` + migrations:

- `revenueos_experiments`
- `revenueos_lessons`
- `revenueos_scorecards`
- `revenueos_attributions`
- `revenueos_planner_runs`
- `revenueos_cycle_reports`
- `revenueos_exposures`
- `revenueos_discovery_doors`
- `revenueos_capability_gaps`
- `revenueos_pursuits`
- `revenueos_pursuit_events` (includes beacon visitors)
- `revenueos_leases`
- `revenueos_captured_emails`
- `revenueos_channels`
- `revenueos_operator_claims` (migration `20260810`)
- `revenueos_owner_drafts` (if present in operator claims migration)

**Pre-cutover verification:** row counts + sample hashes per table. Post-cutover: same counts (or ≥).

### Memory snapshot (2026-08-09 Phase 0)

Ran `node scripts/snapshot-revenueos-memory.mjs` → `.data/memory-snapshot-*.json`

| Table | Count / note |
| --- | --- |
| `revenueos_experiments` | **46,588** |
| `revenueos_lessons` | **14,916** |
| `revenueos_scorecards` | **7,803** |
| `revenueos_attributions` | 0 |
| Other `revenueos_*` listed in schema | PostgREST 404 on this project — may live as **document mode** inside experiments / need schema apply on the active Supabase project. **Do not wipe experiments/lessons/scorecards.** |

Fingerprint recorded in snapshot file. Re-run after cutover and compare.

---

## Cron / scheduling entrypoints (Vercel today)

| Path | Role |
| --- | --- |
| `apps/{site}/src/app/api/cron/revenueos/route.ts` | Brain tick (`runPursuitTick`, ~55–300s) — **timeout failure mode** |
| `src/app/api/cron/portfolio-digest/route.ts` | Hourly receipt email; pulses all sites (45s abort → current FAIL email) |
| `src/app/api/cron/growth-report/route.ts` | Legacy growth report |
| `src/app/api/cron/daily-growth-review/route.ts` | Daily review |
| `src/app/api/cron/cleanup/route.ts` | Cleanup |
| Devvit scheduler `hourly-help` | Reddit in-community help |

---

## Portfolio businesses (registry)

| siteId | Production URL (canonical) | Brain today | Notes |
| --- | --- | --- | --- |
| tributeready | tributeready.vercel.app | Partial / legacy | Digest host |
| mendhaus | mendhaus.vercel.app | Suspended/supplier gate | Owner blocker |
| raiseready | raiseready-seven.vercel.app | Full cron+vendor | Control-adjacent |
| ledgerleaf | ledgerleaf-ashen.vercel.app | Full | |
| depositproof | depositproof-omega.vercel.app | Full | |
| turnoverkit | turnoverkit.vercel.app | Full | Had HTTP 500 |
| listinglift | listinglift-eight.vercel.app | Full | |
| closeshift | closeshift.vercel.app | Full | |
| bidbinder | bidbinder.vercel.app | Full | |
| resumeforge | resumeforge-liard.vercel.app | Full | |
| waitroom | waitroom-sepia.vercel.app | Full | |
| shopbeacon | shopbeacon.vercel.app | Full | |

---

## Root cause of latest FAILED cycle (not a product failure)

Window `2026-08-09T21:05→22:05Z`: digest pulse timeouts + one 500. **The brain did not get a chance to execute** — serverless request lifetimes + cold starts + heavy planner work. Fix is relocation of orchestration to persistent Core, **not** raising timeouts.

---

## Target macOS architecture (preserve TS brain)

```
RevenueOS.app (SwiftUI)          ← owner UI: money, portfolio, activity, commands
        | localhost authenticated API
RevenueOSCore (launchd)          ← Node process: services/operator + @revenueos/core
        |                          continuous Observe→Act→Measure→Learn
        +-- browser-sidecar (local Playwright)
        +-- Supabase (durable memory — unchanged)
        +-- Stripe API (balance/payments truth for UI)
        +-- Vercel storefronts (thin adapters: health, publish, checkout, beacon)
```

**Critical design choice:** Do **not** rewrite `packages/revenueos` in Swift. Swift owns presentation + Sign in with Apple + Keychain. The TypeScript brain continues as the Core process.

---

## Staged cutover sequence

1. ✅ Inventory (this document)
2. Snapshot Supabase row counts
3. Run `services/operator` under launchd on Mac (RevenueOSCore)
4. Shadow mode: Core plans/logs; Vercel cron still executes OR Core claims via `revenueos_operator_claims`
5. Enable Core execution for 1 business → verify commercial action + learning writeback
6. Expand to all businesses
7. Disable per-app Vercel `cron/revenueos` only when Core verified
8. Keep digest as receipt (can move schedule to Core)
9. Ship SwiftUI dashboard reading Stripe + Core status API

---

## Acceptance tests (migration complete only when)

- [ ] Mac Core launches via launchd with UI closed
- [ ] Sign in with Apple works on app
- [ ] All businesses in portfolio registry
- [ ] Historical Supabase memory accessible (no reset)
- [ ] Bandits/channels/posteriors/FCM/money logic still from `@revenueos/core`
- [ ] Stripe Available / Pending / Payouts shown from Stripe APIs (not invented)
- [ ] Isolated business jobs (one timeout ≠ portfolio starve)
- [ ] Real commercial action from Mac path recorded + learned
- [ ] Continuous loop without hourly wake dependency
- [ ] Storefronts + checkout + fulfillment still work on Vercel
- [ ] Trace: action→exposure→visit→checkout→pay→fulfill→profit

---

## Explicit non-goals

- No rewrite / simplification / feature culling
- No fake revenue or fake activity
- No labeling Stripe balance as bank balance
- No deleting Vercel brain until Mac verified
- No RAM-only memory (Supabase remains durable source of truth)
