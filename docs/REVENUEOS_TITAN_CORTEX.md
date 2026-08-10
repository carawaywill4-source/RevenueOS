# TITAN CORTEX

Executive intelligence fabric for TITAN — not another agent, not a system prompt, not a vector dump.

```
Human knowledge → priors
Historical flight school → (later)
Live RevenueOS evidence → proprietary intelligence
Reality (Stripe / experiments) → final authority
```

## Phase status

| Phase | Status |
| --- | --- |
| 0 Integration map | [`TITAN_CORTEX_INTEGRATION_MAP.md`](TITAN_CORTEX_INTEGRATION_MAP.md) |
| 1 Epistemic core | **Implemented** — `packages/revenueos/src/titan/cortex/` |
| 2+ Research factory, flight school, gym | Not stubbed as empty classes |

## Epistemic constitution

FACT ≠ OBSERVATION ≠ INFERENCE ≠ HYPOTHESIS ≠ FORECAST ≠ SIMULATION ≠ UNKNOWN.

Evidence uses a multidimensional `EvidenceVector` (authority, directness, sample, recency, bias, manipulation, …) — not a fixed rank table and not fake 6-decimal confidence.

## Modules (vertical, minimal)

| Module | Role |
| --- | --- |
| `source-registry.ts` | Provenance; control_plane_effect always NONE for externals |
| `knowledge-claim.ts` | Canonical claims + temporal `beliefAtTime` |
| `evidence-vector.ts` | Multidimensional scoring + coarse confidence |
| `contradiction-graph.ts` | SUPPORTS / CONTRADICTS / QUALIFIES |
| `knowledge-gap.ts` | “I don’t know enough yet” + domain refusal |
| `context-compiler.ts` | Smallest high-value context |
| `advisor.ts` | ScopeGuard executive Q&A + poison/authority conflict |

## First tests (implemented)

1. ScopeGuard weak signal → favor APEX, constrain redesign, no new business  
2. 500 qualified + checkouts + $0 → change mind toward FORGE conversion investigation  
3. Unknown domain → KNOWLEDGE_GAP_DETECTED  
5. Poison blob → EXTERNAL_UNTRUSTED_INSTRUCTION, zero control  
6/7. Guru / corrupted tracking lose to Stripe truth  

```bash
cd packages/revenueos && npx tsx --test src/titan/cortex/cortex.test.ts
```

## Contracts

- CORTEX informs; TITAN decides; governors authorize money.  
- APEX/FORGE remain specialists.  
- Current high-integrity RevenueOS evidence can update priors; one weird result must not rewrite centuries of knowledge (transfer proportional to evidence).
