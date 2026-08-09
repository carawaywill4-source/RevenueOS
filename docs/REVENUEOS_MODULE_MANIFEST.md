# RevenueOS Module Manifest

Generated: 2026-08-09T22:39:19.326Z

**Rule:** Treat every module as preserved behavior. Do not delete without owner approval. Trace call paths before changing anything.

Total TypeScript files under `packages/revenueos/src`: **110**
- `modules/`: 71
- `intelligence/`: 17
- `memory/`: 5

## Modules (`modules/`)

| File | Purpose | Mutates learning | Assumes Vercel | Persistence | External | Callers (in-pkg) |
| --- | --- | --- | --- | --- | --- | --- |
| `modules/acquisition.ts` | Acquisition engine: get more qualified strangers in front of the offer. Traffic is never the excuse. The audience model  | yes | no | — | — | 1 |
| `modules/action-class.ts` | Action class taxonomy: production ≠ pursuit. RevenueOS is forbidden from confusing content creation with customer pursui | no | no | — | reddit, google, youtube, producthunt, gumroad | 13 |
| `modules/action-registry.ts` | Canonical registry of autonomous actions the brain may execute. | no | no | — | reddit, google, youtube, producthunt, gumroad | 2 |
| `modules/agent-executors.ts` | Agent executors — the "doing" limb. These are the new-generation executors invoked by the pursuit engine when a | yes | no | — | openai | 0 |
| `modules/ambition.ts` | Competitive drive aimed at money made for the customer. Matching the prior record while under $10k/day is still failure. | no | no | — | — | 2 |
| `modules/anomaly-detector.ts` | Stream-anomaly detector. Runs over the durable pursuit-event stream to catch unusual signal that the | no | no | — | — | 0 |
| `modules/attribution-ml.ts` | Attribution-ML: better credit assignment than the current attempt-share. Model: time-decay exponential. A signal receive | yes | no | — | — | 0 |
| `modules/attribution.ts` | An experiment is due for a verdict once its signal window has elapsed. | yes | no | — | — | 2 |
| `modules/audience.ts` | Model who we sell to, where to reach them, and how hard the sale is. Two philosophies are baked in: | yes | no | — | — | 1 |
| `modules/beacon.ts` | First-party analytics beacon. A published page is production, not exposure. RevenueOS was blind to whether | no | no | — | — | 1 |
| `modules/business-suspension.ts` | A business with an owner-side blocker (supplier gate, missing tribute draft, legally-required approval) cannot legally t | no | no | — | — | 1 |
| `modules/buyer-discovery.ts` | Buyer discovery executor. Uses web-search.ts + LLM synthesis to identify SPECIFIC external surfaces | no | no | — | openai, youtube | 3 |
| `modules/capability-gaps.ts` | Strip safeActionType when the adapter cannot execute it so ranking, money plan, and hunting stop treating missing limbs  | yes | no | — | reddit | 2 |
| `modules/channel-catalog.ts` | Channel capability catalog. This is NOT an action loop. It enumerates distribution surfaces RevenueOS | yes | no | — | resend, reddit, google, youtube, producthunt, gumroad | 2 |
| `modules/channel-discovery.ts` | Channel Discovery Engine. Per business: product → buyer → buyer intent → where buyers congregate → | no | no | — | openai, reddit | 2 |
| `modules/channel-registry.ts` | Channel Registry — durable, compounding channel knowledge. Persists per-(business, platform, account) channel records wi | yes | no | — | — | 1 |
| `modules/compliance-guard.ts` | Compliance guard for external HTTP execution. RevenueOS is aggressive but must not violate host policies or crawler rule | no | no | — | — | 4 |
| `modules/concrete-escalations.ts` | Concrete owner-actionable escalations. When all permissionless mechanisms have exhausted their attempt budget with | no | no | — | stripe, openai, resend, reddit, google, youtube, gumroad | 1 |
| `modules/conversion-lab.ts` | Conversion laboratory. Once verified_exposure > 0 but purchases = 0, the problem is no longer | no | no | — | stripe | 1 |
| `modules/conversion.ts` | Model why shoppers hesitate, from funnel evidence + portable psychology. | no | no | — | — | 4 |
| `modules/diagnosis.ts` | Self-evaluation. When the brain is not making financial progress it must diagnose *why* and change approach — never quie | no | no | — | — | 1 |
| `modules/discovery-governor.ts` | Suppress publish opportunities for killed clusters; boost expanding ones. | no | no | — | — | 2 |
| `modules/economics.ts` | Contribution margin per sale from the primary product offer. | no | no | — | stripe | 6 |
| `modules/email-outreach.ts` | Email outreach executor (Resend REST). Sends 1:1 personalized outreach authored by the LLM. Never bulk. Never | no | no | — | openai, resend | 0 |
| `modules/exit-intent.ts` | Exit-intent email capture. Emits a page-level snippet (JS + minimal HTML/CSS) returned to the beacon | yes | yes | filesystem | — | 0 |
| `modules/experimentation.ts` | Create a proposed experiment with an attached measurement plan. A lever without a measurement plan is a guess — so every | yes | no | — | — | 2 |
| `modules/exploration-floor.ts` | Exploration floor invariants — hard rules the planner MUST honor per cycle. The previous planner could return a cycle of | yes | no | — | reddit, youtube | 1 |
| `modules/first-customer-mode.ts` | FIRST_CUSTOMER_MODE priority ladder (purchases = 0): buyer exposure → qualified visits → offer/message testing → checkou | no | no | — | — | 1 |
| `modules/free-listings.ts` | Zero-cost local / visual listing limbs. These are NOT spend-match "free ad credits". They are genuinely free | yes | yes | filesystem | openai, youtube | 0 |
| `modules/google-search-console.ts` | Google Search Console executor — read-only signal ingestion. Auth: a service-account JSON blob in GOOGLE_SERVICE_ACCOUNT | yes | yes | filesystem | openai, google | 0 |
| `modules/gumroad.ts` | Gumroad marketplace limb — sync product listings + import sales. Auth: GUMROAD_ACCESS_TOKEN (personal access token). Nev | no | yes | filesystem | gumroad | 0 |
| `modules/hackernews.ts` | Hacker News executor — Show HN draft + buying-intent discovery. HN has no OAuth; reads use the public Firebase API at | yes | yes | filesystem | openai | 0 |
| `modules/indiehackers.ts` | Indie Hackers executor — product listing drafts + community post drafts. IH has no OAuth/API for third-party writes. Two | no | yes | filesystem | openai | 0 |
| `modules/knowledge-graph.ts` | Persistent portfolio-wide learning memory (Knowledge Graph). A revenue system that operates across 10 businesses cannot  | yes | no | — | — | 0 |
| `modules/llm-strategist.ts` | LLM strategist — the thinking layer. Every plan cycle, this feeds the current commercial state (context, banned | yes | no | — | openai, reddit, google, youtube, producthunt, gumroad | 1 |
| `modules/ltv-cac-model.ts` | LTV / CAC model per mechanism. Ranks mechanisms by (estimated LTV) − (estimated CAC), so downstream planners | yes | no | — | — | 0 |
| `modules/mechanism-bandit.ts` | Thompson-sampling bandit over acquisition mechanism classes. Static ranking sends every business through the same catalo | yes | no | — | — | 1 |
| `modules/mechanism-diversity.ts` | Mechanism diversity enforcement. When we enqueue a wave of pursuits, we cap the number of jobs sharing the | yes | no | — | — | 1 |
| `modules/money.ts` | Money-printing allocator. Funds the highest profit-per-effort levers under an effort budget, heavily preferring executab | no | no | — | — | 1 |
| `modules/northstar.ts` | Absolute money north star. Record-beating stretch is not enough — the machine aims at a $10,000 contribution-profit day. | no | no | — | — | 7 |
| `modules/openai-client.ts` | Zero-dependency OpenAI client (uses global fetch). Kept as a thin, deterministic surface: structured-JSON output only, p | no | no | — | openai | 18 |
| `modules/operator-adapter.ts` | Portable operator adapter. Every app in the portfolio has its own SiteAdapter wired into a Next.js | yes | no | supabase | stripe, reddit | 0 |
| `modules/operator-claims.ts` | Operator claim handoff — Vercel cron must no-op when Mac/Fly Core holds a live lease on this siteId. Prevents dual-execu | no | no | supabase | — | 0 |
| `modules/operator-loop.ts` | Persistent operator loop. The serverless form fragments the brain into 60-second cron bursts and | yes | no | supabase | — | 0 |
| `modules/organic-mastery.ts` | Organic mastery era. RevenueOS is the business manager — solely responsible for making the site | no | no | — | — | 3 |
| `modules/owner-dialog.ts` | Owner Dialog — backend for the operator chat interface. The owner drops a plain-English message. We turn that message +  | no | no | — | openai | 0 |
| `modules/pattern-posterior.ts` | Per-pattern commercial posteriors. Every acquisition mechanism (identified by patternKey) is judged only on | yes | no | — | — | 6 |
| `modules/permissionless.ts` | Permissionless organic doctrine. RevenueOS may autonomously do anything legal/truthful that generates organic | no | no | — | resend, reddit, google, youtube, producthunt, gumroad | 1 |
| `modules/planner.ts` | Turn a ranked opportunity list into a COHERENT, sequenced plan rather than a single greedy pick. Respects funnel depende | no | no | — | — | 1 |
| `modules/portfolio-digest.ts` | One portfolio owner email — never N separate business digests. Email is a receipt of work already performed, not the wor | yes | no | — | — | 0 |
| `modules/portfolio.ts` | Portfolio operator: exploit winners, keep controlled exploration on weak/new. Does not kill businesses — reorders attent | no | no | — | — | 0 |
| `modules/producthunt.ts` | Product Hunt executor — discover product-intent discussions + post genuinely helpful comments on active launches. | no | yes | filesystem | openai, reddit, producthunt | 0 |
| `modules/profit-maximizer.ts` | Profit maximizer — money made for the customer is the only success. Traffic, topics, and research are tools. $0 is faili | no | no | — | — | 3 |
| `modules/public-outreach.ts` | Public outreach executor. Given a DurableBuyerLead + brand context, use the LLM to draft a | no | no | — | openai | 0 |
| `modules/pursuit-engine.ts` | High-frequency organic actions must re-fire often — never sit 7 days idle. | yes | yes | — | — | 2 |
| `modules/pursuit-plan.ts` | Portfolio insight sentence returned by the LLM strategist this cycle. | yes | no | — | reddit | 1 |
| `modules/reddit-executor.ts` | Reddit executor — discover buying-intent threads + helpful replies. Reality as of Nov 2025: Reddit killed self-service ` | yes | yes | filesystem | openai, reddit | 0 |
| `modules/retention.ts` | Retention levers only make sense once real sales exist. Before that, the brain should not waste ranking budget imagining | no | no | — | — | 1 |
| `modules/revenue-hunter.ts` | Revenue hunter — portfolio-level LLM meta-strategist. Given all portfolio sites' snapshots, asks GPT to identify: | no | no | — | openai | 0 |
| `modules/revenue-priority.ts` | Revenue-priority scoring. RevenueOS has one objective: real, collected revenue. Every opportunity is | yes | no | — | — | 5 |
| `modules/schema-enrichment.ts` | Schema.org JSON-LD enrichment. Generates Product / FAQ / HowTo / Offer JSON-LD blocks for a topic slug | no | no | — | openai | 0 |
| `modules/self-improving-strategist.ts` | Self-improving strategist: A/B test prompt variants over time. Maintains a small registry of prompt versions with per-ve | yes | no | — | openai | 0 |
| `modules/signed-utm.ts` | Signed UTM attribution. When RevenueOS emits an outbound URL (in a Reddit reply, an IH product | yes | no | — | reddit | 0 |
| `modules/stagnation.ts` | Execution stagnation: when consecutive cycles observe the same commercial state and repeat the same action types with no | no | no | — | — | 1 |
| `modules/strategy.ts` | Honest incremental-unit estimates. Never invent a traffic windfall — fake "max(40, …)" landing lifts made discovery look | yes | no | — | — | 4 |
| `modules/stripe-order-bumps.ts` | Stripe order-bump upsell composer. Given a Checkout Session's line items and a catalog of related products, | yes | yes | filesystem | stripe | 0 |
| `modules/success.ts` | The only success criterion for RevenueOS. Money made for the customer = success. | no | no | — | — | 4 |
| `modules/target-tracking.ts` | Per-business target tracking. RevenueOS runs against a hard, non-negotiable daily target: | no | no | — | — | 0 |
| `modules/web-intelligence.ts` | Web intelligence — the perception layer. Uses OpenAI's web-search tool to pull real, current information from the | no | no | — | openai, reddit | 1 |
| `modules/web-search.ts` | Web search executor. Thin wrapper over openai-client.ts with `webSearch: true`. The LLM can then | no | no | — | openai | 2 |
| `modules/youtube.ts` | YouTube executor — buying-intent discovery via YouTube Data API v3 + community-reply drafts to discovered intent comment | yes | yes | filesystem | openai, google, youtube | 0 |

## Intelligence

- `intelligence/anomaly.ts` — Vigilance: catch sudden regressions in money precursors before they bleed. Compares the current observation against the recent scorecard his
- `intelligence/bandit.ts` — Explore/exploit intelligence. The brain balances doubling down on levers that have won before against testing under-explored levers that mig
- `intelligence/calibration.ts` — Meta-learning: the brain scores its own past predictions against reality. If a category (say acquisition) systematically over-promises, its 
- `intelligence/credible.ts` — Deterministic "Thompson-like" scoring via the upper credible bound of each arm's win-rate posterior. Explores uncertain high-upside arms wit
- `intelligence/curriculum.ts` — Active learning curriculum under the organic mastery era. RevenueOS is the sole business manager. Until organic leads→sales is mastered,
- `intelligence/decision.ts` — Decision theory: which experiment is worth running is NOT simply the one with the highest expected value. A lever we already understand teac
- `intelligence/forecast.ts` — Ordinary least-squares slope of y over evenly spaced cycles (oldest→newest).
- `intelligence/hour.ts` — Overdrive only when the adapter actually measured a $0 clock hour.
- `intelligence/hunting.ts` — Never wait on a single owner-gated channel. Concurrent bets must keep the machine hunting money on executable / open levers even while owner
- `intelligence/kelly.ts` — Kelly-inspired bet sizing. Maps edge and aggression into how many parallel experiments to run — more when the edge is uncertain and the shor
- `intelligence/meta.ts` — Meta-learner: the policy over policies. Because a $10k day is improbable for most early businesses, the brain must keep learning — explorati
- `intelligence/planner-quota.ts` — Reject planner output that references unknown opportunities or unsafe actions.
- `intelligence/press.ts` — Money press: reverse-engineer the highest-velocity path from current state to a $10k day and mint concrete, ranked "print" moves — compound 
- `intelligence/regime.ts` — Detect the growth regime from scorecard history so the brain adapts its playbook: pre-revenue discovery, stagnation breakout, compounding sc
- `intelligence/shortfall.ts` — Every day under the north star is a lost day = failing software. Money made for the customer is the only success. Learning exists to destroy
- `intelligence/simulator.ts` — Lightweight scenario simulation. A one-time conversion win pays once; an acquisition win compounds as traffic accumulates; retention compoun
- `intelligence/statistics.ts` — Probabilistic reasoning primitives. The brain should be honest about how much it actually knows: small samples produce wide intervals and sh

## Memory

- `memory/global.ts` — Global lessons travel with the product across sites. No PII.
- `memory/industry.ts` — (no docstring) industry.ts
- `memory/portable.ts` — Portable memory — learning survives across businesses. Transferable lessons are stored as industry (or global) scope with stable ids
- `memory/similarity.ts` — Similarity-aware lesson application + negative-transfer guards. Question: under what commercial conditions did this work, and how similar
- `memory/site.ts` — (no docstring) site.ts

## Full machine-readable inventory

See `docs/REVENUEOS_MODULE_MANIFEST.json` for imports, callers, and dependency flags for every file.
