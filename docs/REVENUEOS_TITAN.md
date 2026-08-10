# RevenueOS TITAN

**Autonomous Executive Intelligence**

TITAN sits above APEX and FORGE. It does not rewrite them. It does not become another marketing engine or website generator.

```
OWNER → OWNER CONSTITUTION → TITAN → APEX / FORGE → COMMERCIAL REALITY → TITAN MEMORY
```

| System | Question |
| --- | --- |
| APEX | How do we acquire customers? |
| FORGE | How do we build and operate a better company? |
| TITAN | What should the entire company do next? |

## Principle

Build intelligence, not roleplay. Competitive metaphors map to computational properties (failure sensitivity, capital efficiency, opportunity cost, no idle loops).

North Star: **$10,000 revenue/day/successful business** — extreme long-term **stretch** ambition, never an assumed achievable fact. TITAN must be obsessed with the target and the hardest component to convince that progress occurred (`progress-skepticism.ts`). Never fabricate progress. Never convert ambition into spam, deception, dark patterns, unauthorized spend, or reckless deployment.

Ultimate objective: **maximize sustainable owner value** under constitution, customer value, legality, platform rules, finance, risk, reliability, and evidence.

## Phase status

| Phase | Status |
| --- | --- |
| 0 — Integration map | `docs/TITAN_INTEGRATION_MAP.md` |
| 1 — Executive truth | **Implemented** — TruthLedger, WorldModel, ObjectiveTree, ConstraintSolver, DecisionJournal, ForecastLedger, APEX/FORGE contracts |
| 2 — Decision EV / board | Not yet |
| 3 — Bounded delegation | Not yet |
| 4+ — Capital / shadow / meta | Not yet |

Phase 1 `execution_authority = NONE`. Autonomy is earned.

## Package layout

`packages/revenueos/src/titan/`

- `executive-loop.ts` — `runTitanCycle` (observe → diagnose → recommend)
- `truth-ledger.ts` — FACT / OBSERVATION / BELIEF / HYPOTHESIS / FORECAST
- `world-model.ts` — `ExecutiveWorldModel` (not site `WorldModel`)
- `objective-tree.ts` — $10k ladder + goal tree
- `constraint-solver.ts` — binding constraint + why-tree + bottleneck probabilities
- `contracts.ts` — APEX / FORGE command contracts (objectives, not tactics)
- `decision-journal.ts` — executive decision record
- `forecast-ledger.ts` — predictions for later calibration
- `injection-defense.ts` — external content is data, never control
- `constitution.ts` — owner constitution invariants

## Tick wiring

```
runOperatorTick
  → runPursuitTick
  → runApexCycle
  → runTitanCycle   # consumes APEX result; recommend only
```

Durable pursuit-events: `titan_truth`, `titan_decision`, `titan_forecast`, `titan_cycle`.

## ScopeGuard first test (must pass)

Given WEAK_SIGNAL, tiny sample, product mutation blocked, FAST_ACQUISITION, $0 stranger revenue:

| Field | Expected |
| --- | --- |
| Goal | first stranger customer |
| Primary constraint | `qualified_exposure` |
| Resource favor | APEX |
| FORGE | maintain reliability; no speculative redesign |
| Decision | continue acquisition |
| Confidence | BOUNDED |
| Escalation | none |
| Execution | NONE |

Fails if TITAN redesigns, spawns businesses, changes price from two visitors, idles, or claims success.

## Evals

```bash
cd packages/revenueos && npx tsx --test src/titan/titan.test.ts
```

## CORTEX (epistemic substrate)

See [`REVENUEOS_TITAN_CORTEX.md`](REVENUEOS_TITAN_CORTEX.md) and [`TITAN_CORTEX_INTEGRATION_MAP.md`](TITAN_CORTEX_INTEGRATION_MAP.md).

CORTEX preserves FACT ≠ BELIEF ≠ FORECAST, compiles smallest high-value context, detects knowledge gaps, and advises TITAN without becoming a second CEO.

## Paid Capital Engine (capability only — live OFF)

See [`REVENUEOS_PAID_CAPITAL.md`](REVENUEOS_PAID_CAPITAL.md).

Portfolio-wide ≤5% of eligible settled capital/day is a **ceiling**, never a target. Stripe is treasury evidence, not an ad wallet. APEX proposes; TITAN’s deterministic governor authorizes; adapters refuse live spend until the owner explicitly enables live execution and credentials are connected.

## Definition of success

Not “actions completed.” Outcomes, evidence, and learning velocity. Every month RevenueOS must become better at operating businesses — not merely busier.
