# TITAN Integration Map

Phase 0 map of existing RevenueOS surfaces. **Do not rewrite APEX, FORGE, the planner, or Stripe/beacon ingest.**

Canonical package: `@revenueos/core` → `packages/revenueos`  
Public barrel: `packages/revenueos/src/index.ts`

---

## Architecture (existing → TITAN)

```
OWNER
  └── OWNER CONSTITUTION (policy + northstar + portfolio policy)
        └── TITAN (new: packages/revenueos/src/titan/)
              ├── consumes APEX truth + FORGE capability
              ├── recommends / later delegates
              └── does NOT replace planner execution
        ├── APEX (packages/revenueos/src/apex/)
        └── FORGE (packages/revenueos/src/forge/)
              └── COMMERCIAL REALITY (Stripe, beacon, ExperimentStore)
```

---

## Tick path (control plane)

```
runOperatorTick / runOperatorLoop     modules/operator-loop.ts
  └─ runPursuitTick                   modules/pursuit-plan.ts
       ├─ planAndEnqueuePursuits
       └─ drainPursuits               modules/pursuit-engine.ts
  └─ runApexCycle                     apex/cycle.ts
       └─ loadCapabilityManifest      forge/capability-manifest.ts
  └─ runTitanCycle (Phase 1)          titan/executive-loop.ts   ← observe / recommend only
```

| Entrypoint | Role for TITAN |
| --- | --- |
| `runOperatorTick` | Primary hook after APEX |
| `runApexCycle` | Acquisition diagnosis TITAN consumes |
| `runPursuitTick` | Execution plane — TITAN does not rewrite |
| `runCycle` (`executive.ts`) | Older parallel executive — leave alone |
| ScopeGuard cron | Currently `runPursuitTick` only — Core is APEX/TITAN home |

---

## Consume (read)

| Source | What |
| --- | --- |
| `ApexCycleResult` | bottleneck, evidence_level, learning_clock, decision, product_mutation_blocked, acquisition_urgency |
| `BusinessCapabilityManifest` | stage, objective, forge_confidence, allowed tests, approval areas |
| `Observation.money` / Stripe via adapter | purchases, revenue (FACT tier) |
| Pursuit events | `apex_state`, `apex_decision`, `apex_commercial`, `apex_evidence` |
| `ExperimentStore` | lessons, pursuits, scorecards |
| Owner suspension / first-customer | from plan result |

## Call (thin)

| Call | When |
| --- | --- |
| `runApexCycle` / `runOperatorTick({ skipEnqueue })` | Observe-only truth snapshots |
| `loadApexState` / `listEvidence` / `listPursuitEvents` | Memory reads |
| `loadCapabilityManifest` / `scopeGuardCapabilityManifest` | FORGE contract |
| `auditStorefront` | Optional offline quality (not every tick) |

## Do NOT rewrite

- Planner / pursuit-engine / action registry / channel executors
- APEX evidence gate, clocks, experiment guard, governor
- FORGE constitution, genome, capability semantics (`forge_confidence ≠ WTP`)
- Beacon / Stripe ingest (`ingestApexBeacon`, `ingestApexPurchase`)
- `SiteAdapter` / durable store schema
- PortfolioArchitect lifecycle

---

## Durable memory keys (TITAN Phase 1)

Written via `ExperimentStore.appendPursuitEvent` (same pattern as APEX):

| pursuitId | detail |
| --- | --- |
| `titan_truth` | TruthLedger claims |
| `titan_decision` | DecisionJournal entries |
| `titan_forecast` | ForecastLedger entries |
| `titan_cycle` | Full `TitanCycleResult` snapshot |

TITAN **never** overwrites APEX commercial events or Stripe facts.

---

## ScopeGuard laboratory

| Path | Role |
| --- | --- |
| `apps/scopeguard/src/revenueos/adapter.ts` | `SiteAdapter` |
| `apps/scopeguard/src/revenueos/durable-store.ts` | Durable ExperimentStore |
| `.../api/beacon/route.ts` | → `ingestApexBeacon` |
| `.../api/stripe/webhook/route.ts` | → `ingestApexPurchase` |
| `.../api/cron/revenueos/route.ts` | Pursuit only today |

Canonical TITAN code lives in `packages/revenueos` (not vendored app copies).

---

## Phase gates

| Phase | Autonomy |
| --- | --- |
| 1 — Executive truth | Observe + diagnose + recommend. No high-impact execution. |
| 2 — Decision | Option EV / pre-mortem; compare to live behavior |
| 3 — Delegation | Bounded APEX/FORGE objectives (R0–R2) |
| 4+ | Capital allocation, shadow CEO, meta-learning |

Autonomy is earned after measured evidence.

FORGE Universal Enterprise Engine (`forge/universal-engine.ts` et al.) publishes opportunity evaluations and reference-proof gates; TITAN consumes lifecycle/operational-fit outcomes without rewriting FORGE.

---

## Overlapping modules (reuse, do not fork)

| Concept | Existing |
| --- | --- |
| $10k/day ladder math | `modules/northstar.ts` |
| Ambition pressure | `modules/ambition.ts` |
| Unit economics | `modules/economics.ts` |
| First customer | `modules/first-customer-mode.ts` |
| Portfolio attention | `modules/portfolio.ts` |
| Site WorldModel (funnel) | `types.ts` `WorldModel` — distinct from TITAN `ExecutiveWorldModel` |
