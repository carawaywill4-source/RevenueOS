# TITAN Paid Capital Engine — Self-Funded Growth

Controlled paid customer acquisition. **Live execution is OFF.**

Build order: capability → safety → accounting → learning → adapters → (later) credentials.

Paid acquisition becomes eligible only after:

1. Real **settled**, attributable revenue exists  
2. Owner enables **PAID_CAPITAL_ENABLED**  
3. Deterministic Capital Governor authorizes  
4. Owner separately enables **live_paid_execution_enabled** (still refused by adapters until wired)

## Hierarchy

```
FORGE creates/operates value
  → APEX creates demand (organic priors → paid proposals)
    → TITAN allocates capital (portfolio market)
      → Stripe provides commercial truth (treasury evidence, not ad wallet)
```

## Prime Capital Law

```
daily_paid_capital_ceiling = min(eligible_capital * ≤5%, owner_absolute_daily_cap)
```

- **Portfolio-wide** (not 5% per business)  
- Ceiling ≠ spending target  
- May spend **0%**  
- No LLM / retry / scaling path may override  

## Modules

`packages/revenueos/src/titan/paid-capital/`

| Module | Role |
| --- | --- |
| `eligible-capital.ts` | Settled − reserves − floors − obligations |
| `treasury-ledger.ts` | Double-entry states + atomic reservations |
| `governor.ts` | Deterministic authorization (LLM cannot authorize) |
| `circuit-breakers.ts` | Freeze on drift, pause, attribution failure, … |
| `experiment-ladder.ts` | Smallest useful → scale; diminishing returns |
| `portfolio-market.ts` | Uneven allocation by marginal return |
| `apex-proposals.ts` | APEX proposes; TITAN decides |
| `attribution.ts` | Platform ≠ Stripe truth |
| `owner-view.ts` | UI control + scoreboard shape |
| `adapters.ts` | Refuse live spend until explicitly connected |
| `simulate.ts` | Non-negotiable fail-safe scenarios |

## Eligible capital (conservative)

Do **not** use Stripe gross or pending balances.

Deduct: refunds, disputes, fees, taxes, operating liabilities, infra obligations, protected cash floor, committed ad spend.

## Owner controls

- PAID CAPITAL OFF/ON  
- MAX DAILY % (hard max 5%)  
- ABSOLUTE DAILY CAP  
- PROTECTED CASH FLOOR  
- PAUSE ALL PAID ACQUISITION  
- PLATFORM ENABLE/DISABLE  
- LIVE EXECUTION OFF/ON (separate)

## Tests

```bash
cd packages/revenueos && npx tsx --test src/titan/paid-capital/paid-capital.test.ts
```

Safety sims cover concurrent spend, reconciliation drift, refund spikes, >5% requests, duplicates, bad attribution, budget seizure, owner pause, day-boundary, and adapter refusal.

## Non-goals (this phase)

- Connecting Meta/Google credentials  
- Turning `no_paid_ads` off in APEX governor  
- Auto-spending because more cash exists  

Earn the privilege of paid acquisition — do not use ads to hide organic failure.
