# TITAN CORTEX Integration Map

Phase 0. CORTEX is the intellectual substrate for TITAN — not another executive agent, not a system prompt, not a vector dump.

```
OWNER CONSTITUTION
        │
        ▼
   ┌─────────┐
   │  TITAN  │  ← decides / allocates / commands
   └────┬────┘
        │ informed by
        ▼
   ┌─────────┐
   │ CORTEX  │  ← knowledge, research, memory, evals
   └────┬────┘
        │
   ┌────┴────┐
   ▼         ▼
 APEX      FORGE
   │         │
   └────┬────┘
        ▼
 COMMERCIAL REALITY (Stripe, beacon, ExperimentStore)
```

## Consume (do not rewrite)

| Surface | Path | CORTEX use |
| --- | --- | --- |
| TITAN TruthLedger | `titan/truth-ledger.ts` | Seed FACT/OBSERVATION claims |
| TITAN EpistemicKind | `titan/types.ts` | Extended by CORTEX classification |
| Injection defense | `titan/injection-defense.ts` | Control-plane poison filter |
| ForecastLedger | `titan/forecast-ledger.ts` | Forecast ≠ outcome scoring later |
| DecisionJournal | `titan/decision-journal.ts` | Decision → prediction → residual |
| APEX cycle | `apex/cycle.ts` | Live acquisition evidence |
| FORGE capability / admission | `forge/*` | Product readiness ≠ market proof |
| Paid capital governor | `titan/paid-capital/*` | Capital readiness gated later |
| Stripe / beacon | ScopeGuard routes | Verified commercial outcomes |
| ExperimentStore | `ledger/store.ts` | Persist claims / research packets |
| Operator loop | `modules/operator-loop.ts` | Optional cortex advise after TITAN |

## Call

| Call | Role |
| --- | --- |
| `compileExecutiveContext` | Smallest high-value context for a decision |
| `detectKnowledgeGaps` | “I don’t know enough yet” |
| `adviseExecutiveQuestion` | Phase-1 advisor (ScopeGuard lab) |
| `registerSource` / `assertKnowledgeClaim` | Epistemic core writes |

## Do not rewrite

APEX, FORGE, planner, pursuit engine, Stripe ingest, CapitalGovernor, owner constitution.

## Phase status

| Phase | Status |
| --- | --- |
| 0 Map | This doc |
| 1 Epistemic core | Implemented under `titan/cortex/` |
| 2 Knowledge fabric | Thin compiler only — not full hybrid retrieval yet |
| 3–12 | Not stubbed as empty classes |

## Durable keys

| pursuitId | detail |
| --- | --- |
| `titan_cortex_claim` | KnowledgeClaim |
| `titan_cortex_source` | SourceRegistry entry |
| `titan_cortex_advise` | Advisor packet |

## Contracts

- APEX/FORGE request knowledge; CORTEX supplies priors/evidence — does not micromanage tactics/code.
- TITAN decides; governors authorize money/execution.
- Reality hierarchy is multidimensional (`EvidenceVector`), not a fixed rank table.
- External content = DATA plane; never CONTROL plane.
