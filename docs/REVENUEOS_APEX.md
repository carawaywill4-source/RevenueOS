# RevenueOS APEX

**Autonomous Prospecting & Exchange Intelligence**

APEX is RevenueOS’s customer-acquisition intelligence — not a marketing bot, SEO farm, or prompt pack. It lives inside `@revenueos/core` (`packages/revenueos/src/apex/`) and wraps the existing pursuit tick.

## Principle

```
CONTEXT → BELIEF → ACTIONS → SELECTED → EXPECTED → OBSERVED → ATTRIBUTION → UPDATE
```

Decisions are the unit of intelligence. LLMs may propose hypotheses; **reality** sets confidence.

## Architecture

| Plane | Role |
| --- | --- |
| Control (Mac Core) | `runOperatorTick` → `runPursuitTick` → `runApexCycle` |
| Storefront (ScopeGuard) | `ingestApexBeacon` / `ingestApexPurchase` |
| Durable memory | `ExperimentStore` pursuit-events (`apex_state`, `apex_decision`, `apex_evidence`, `apex_commercial`) |

APEX does **not** rewrite the planner. It records beliefs, bottlenecks, governed priorities, commercial events, and attribution bridges.

## Phase map

| Phase | Status in this pass |
| --- | --- |
| A — Truth (events, trace, bots, data quality, Stripe, evidence) | **Implemented** |
| B — Perception (beliefs, lean DemandRadar, bottleneck) | Thin ScopeGuard loop |
| C — Decision (priority + governor) | Thin ScopeGuard loop |
| D–G — Execution science / compounding / self-improvement | Interfaces only — do not build until Phase A is trustworthy in production |

## Constitution

- NO PAID ADS
- NO AUTONOMOUS SPEND
- MAX ACTIVE BUSINESSES = 50
- R4 actions → Needs You

## ScopeGuard laboratory

1. Beacon route uses `ingestApexBeacon` (traffic quality + signed UTM + commercial event).
2. Stripe webhook uses `ingestApexPurchase` (Success DNA stub + belief update).
3. Core ticks call `runApexCycle` after each pursuit tick.

### Live proof harness

```bash
npm --workspace @revenueos/operator-service exec \
  tsx src/tests/apex-scopeguard.live.ts
```

Writes `.data/apex-scopeguard-*.json` with demand, bottleneck, decision, attribution confidence, and purchase (or honest UNKNOWN / $0).

## Evidence sufficiency (anti self-deception)

APEX must not confuse insufficient traffic with conversion evidence.

| Level | Meaning |
| --- | --- |
| `NO_EVIDENCE` | Almost no qualified exposure |
| `WEAK_SIGNAL` | Tiny sample — “no engagement observed yet”, **not** “offer is bad” |
| `EMERGING_SIGNAL` | Provisional only |
| `ACTIONABLE_SIGNAL` | Product/conversion changes may be justified under isolation |
| `STRONG_EVIDENCE` | Repeated commercial outcomes |

**Critical rule:** Lack of conversion from tiny traffic must **not** cause endless site mutation. Primary objective becomes **acquire more qualified evidence** (FAST acquisition clock). Zero-traffic hours increase acquisition activity — they do not pause the operator.

Modules: `evidence-sufficiency`, `learning-clocks`, `experiment-guard`, `qualified-exposure`, `learning-value`.

## Definition of success

Long-term: first attributed stranger sale with a complete APEX trace, then easier sale #2.

Phase A: trustworthy truth path. Evidence gate: protect the brain from small-sample redesign loops while ScopeGuard hunts qualified demand.
