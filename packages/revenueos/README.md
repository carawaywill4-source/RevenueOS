# @tributeready/revenueos

A portable, autonomous **Revenue Brain**. Not an SEO bot, not a dashboard.

RevenueOS observes a business and its market, models the world, finds
opportunities, predicts their dollar ROI, prioritizes competitively, takes
permitted actions, measures financial outcomes, attributes wins and losses, and
changes its future behavior based on results. Its objective is sustainable
contribution profit with an absolute **$10,000 profit-day north star** — never
traffic, impressions, or content volume. Every day under that bar is a lost day
and a learning event; because the bar is improbable early, the brain stays in
continuous learn-and-adjust mode.

The core brain is **tenant-agnostic**. It must never import a product's routes,
database, payment, page, or domain code. Every business plugs in through one
interface: `SiteAdapter`. TributeReady is customer zero and uses that exact
interface with no special-casing in the brain.

```
RevenueOS (this package)
  └── SiteAdapter (implemented by each business, outside the brain)
          ├── TributeReady (customer zero)
          ├── Example Static (portability rehearsal, no product code)
          └── Riley / any future customer (implement the adapter — do not fork)
```

## The loop

```
Observe → Model → Find Opportunity → Predict ROI → Prioritize →
Act (policy-gated) → Measure → Attribute → Learn → Repeat
```

- **Observe** — `adapter.observe()` returns money, funnel, bottleneck, errors.
- **Model** — `buildWorldModel` composes a `BusinessModel` (unit economics,
  stage, fulfillment health), `MarketModel` (demand, discovery coverage,
  competition, channel readiness), and `ShopperModel` (friction, intent).
- **Find + Predict** — specialist modules propose acquisition, conversion,
  pricing, retention, and operations levers; each is scored with a
  `PredictedImpact` in **dollars** via a precursor→money value chain.
- **Prioritize** — ranked by expected profit, bent by past lessons: wins boost a
  pattern, losses downrank it and place it on cooldown.
- **Act** — only actions the policy allows autonomously. Owner-gated levers are
  logged as blocked experiments with an explicit ask, not silently dropped.
- **Measure + Attribute** — every experiment carries a measurement plan; once its
  signal window elapses the brain compares baseline vs. current precursor and
  issues a `won`/`lost`/`inconclusive` verdict.
- **Learn** — verdicts become lessons that change the next cycle's ranking.

## Personality as an objective, not aggression

Relentless, competitive, opportunistic search of the **allowed** action space. A
mediocre scorecard triggers diagnosis (`modules/diagnosis.ts`) and another
informed attempt — never a stop. Hard boundaries are never crossed for any
expected value: legal only, truthful marketing, no spam, no deception, no
unauthorized accounts, no unauthorized spend, no destructive production actions.

## Onboarding a new customer (e.g. Riley) — implement `SiteAdapter`

You never fork or modify the brain. Implement this interface app-side:

Required:
- `id: string`
- `getContext(): Promise<BusinessContext>` — products, prices, margins, funnel
  step names, allowed channels, autonomous spend cap, constraints.
- `observe(): Promise<Observation>` — map your metrics into the generic
  observation (use `buildFunnel`, `moneyFromCounts`, `detectBottleneck`).
- `listSafeActions(): SafeAction[]` — declare only actions you can perform
  autonomously and safely; the brain chooses among them.
- `execute(action): Promise<ActionResult>` — you own what each action means.
- `getExperimentStore(): ExperimentStore` — `createFileExperimentStore(dir)`
  works out of the box; swap for a SQL store when DDL is available.

Optional (recommended):
- `listSiteOpportunities({ observation })` — levers only you know about.
- `getMarketSignals()` — competitors, index coverage, channel status.
- `getMeasurement(metric)` — precise precursor reads for attribution.
- `getSeedLessons()` — inject site/industry lessons (kept app-side, never in the
  brain's global seed pack).

The `example-static` adapter is a complete, product-free reference. If it
compiles and `runCycle` learns against it, a new customer only needs their own
adapter.

## Safe autonomous actions (MVP)

- scorecard snapshot, IndexNow submit, record experiment / lesson, email review.

Page rewrites, price changes, commercial outreach, account creation, and ad
spend are **owner-gated** or **forbidden**.

## Usage

```ts
import { runCycle } from "@tributeready/revenueos";
import { createTributeReadyAdapter } from "@/revenueos/adapter";

const result = await runCycle(createTributeReadyAdapter());
```

## Persistence

File-backed ledger by default (`ledger.json`) for experiments, lessons,
scorecards, and attributions. Product-owned SQL DDL lives in `schema.sql` for
when a durable store is available.
