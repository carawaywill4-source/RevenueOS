# RevenueOS FORGE

**Foundational Organization, Revenue & Growth Engine**

FORGE is RevenueOS’s **company-creation and operating intelligence** — not an ecommerce generator, template picker, or AI website factory.

APEX finds customers. TITAN arbitrates portfolio strategy. FORGE discovers economic opportunities, derives operating models from economics + capabilities, builds/certifies companies, and keeps operating them after launch.

## Operating constraint

> Can RevenueOS legally, ethically, reliably, and substantially operate the business end-to-end with the capabilities it actually has?

If not → **DO NOT BUILD**. Do not crush the opportunity into a downloadable PDF store.

## Universal Enterprise Engine

| Capability | Module |
| --- | --- |
| Capability inventory + operational fit | `forge/operational-capabilities.ts` |
| Derive economic shape (not a type enum) | `forge/derive-economics.ts` |
| Market Graph | `forge/market-graph.ts` |
| Opportunity evaluation | `forge/universal-engine.ts` |
| **Autonomous Business Admission (10 gates)** | `forge/admission.ts` |
| Competitive intelligence | `forge/competitive-intelligence.ts` |
| Deserve-to-exist gate | `forge/deserve-to-exist.ts` |
| Corporate Reality Standard (category-aware) | `forge/corporate-reality.ts` |
| Lifecycle + kill discipline | `forge/lifecycle.ts` |
| Market memory | `forge/market-memory.ts` |
| APEX/FORGE/TITAN evidence contracts | `forge/evidence-contracts.ts` |
| Reference-proof (no Business #12) | `forge/reference-proof.ts` |
| Hypothetical multi-model proof | `forge/hypotheticals.ts` |

### Autonomous Business Admission

Every candidate faces ten evidence gates before BUILD:

1. **DEMAND** — credible problem/desire evidence  
2. **WILLINGNESS TO PAY** — money already moves in category  
3. **ECONOMIC QUALITY** — margin, recurring potential, CAC tolerance, fulfillment, support, refunds, scale  
4. **AUTONOMY FIT** — acquire → sell → pay → fulfill → support → measure → improve → operate without routine owner labor  
5. **COMPETITIVE RIGHT-TO-WIN** — why exist; cheaper/faster/easier/trust/useful/specialized/convenient/intelligent  
6. **DISTRIBUTION ACCESS** — can APEX reach buyers (zero paid spend)  
7. **$10K/DAY ARCHITECTURE** — customers/day, AOV/ARPU, conversion, qualified exposure, retention, capacity, share (**stretch math, not fact**)  
8. **DEFENSIBILITY** — how easily neutralized  
9. **FAILURE SURFACE** — what blocks autonomous operation  
10. **PORTFOLIO OPPORTUNITY COST** — better than scaling an existing winner?

Decisions: `ADMIT_BUILD` | `ADMIT_OPERATE` | `HOLD_INVESTIGATE` | `REJECT`.

Phase 1 quality stack still applies: constitution, genome, anti-slop, premium bar, auditor, capability manifest.

## Lifecycle

```
DISCOVER → INVESTIGATE → CHALLENGE → MODEL → BUILD → CERTIFY
→ LAUNCH → OPERATE → LEARN → IMPROVE → EXPAND / PIVOT / RETIRE
```

FORGE may recommend **LIQUIDATE / ARCHIVE / PIVOT** after substantial evidence — never from two visitors. Failures become institutional memory.

## Evidence contracts

- Weak APEX evidence **must not** cause destructive product mutation.
- `forge_confidence` **never** overrides strong market evidence.
- APEX owns acquisition execution/learning.
- FORGE owns company/product/operations evolution.
- TITAN owns resource arbitration and portfolio decisions.

## ScopeGuard laboratory

ScopeGuard remains the reference business. No Business #12 until reference proof:

1. Corporate Reality / premium quality
2. First attributed stranger purchase

```bash
cd packages/revenueos && npx tsx --test src/forge/enterprise.test.ts src/forge/forge.test.ts
```

`evaluateHypotheticalPortfolio()` proves the architecture can represent recurring SaaS, usage/API, physical (blocked), and branding-only me-too (rejected) **without launching**.

## Corporate Reality Standard

Launch authorization is earned. The test:

> If the customer did not know RevenueOS existed, would they reasonably believe this was a professionally funded, professionally designed, professionally operated company capable of competing with established businesses?

Design is **category-aware** (document product ≠ B2B SaaS ≠ $19 consumer utility ≠ developer API).

## Non-goals

- Business-type enum factories (`saas | ecommerce | …` as the architecture)
- Maximizing number of businesses
- Template sameness / SEO shells
- Empty CEO class hierarchies
- Treating `$10k/day` as a fact (that stretch target lives in TITAN with extreme skepticism)
