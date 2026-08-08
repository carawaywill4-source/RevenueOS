# GROWTH_PLAN

Living record of what this business is trying to do, what is actually stopping
it, and what we have learned. Updated as evidence arrives, not on a schedule.

**Last updated:** 2026-08-07

---

## Objective

Build a mostly automated memorial-document business with minimal owner
involvement. North star $1M/year as a design constraint, not a forecast.

**Next milestone: one purchase by a stranger.** Everything else is subordinate.

| Milestone | Status |
|---|---|
| Production site live | done |
| Live checkout works | done |
| Automated fulfilment verified | done (except live webhook signature) |
| First organic visitor | **not yet** |
| First checkout started by a stranger | not yet |
| First stranger purchase | not yet |
| First $100 | not yet |
| First recurring B2B customer | not attempted |

---

## Current bottleneck

**Nobody can find the site.** Domain registered 2026-08-07T04:07:34Z (RDAP).
Zero pages indexed on Google, Bing, Brave, Mojeek or DuckDuckGo. Zero inbound
links. Every session recorded so far is our own, all direct, no referrers.

This is not a defect. It is the normal state of a domain that is hours old.
The correct response is patience plus link-earning, not more pages.

Per the decision hierarchy: checkout is not broken (L1), fulfilment works (L2),
there is no traffic to fail to convert (L3), so **we are at Level 4:
acquisition.**

---

## Metrics

Source of truth is Supabase. Revenue = `orders.status = 'fulfilled'`.

> **Trap, already hit once:** `orders.status` has no `'paid'` value. The CHECK
> permits only `awaiting_payment`, `fulfilled`, `refunded`, `abandoned`.
> Querying `status=eq.paid` returns zero forever and looks like a real answer.

| Metric | Value | As of |
|---|---|---|
| Fulfilled orders (revenue) | 0 | 2026-08-07 |
| Gross revenue | $0.00 | 2026-08-07 |
| Growth events (real, non-self) | 0 | 2026-08-07 |
| Referrers seen | none | 2026-08-07 |
| Indexed pages | 0 | 2026-08-07 |
| Outreach sent | 52 (10 funeral homes, 7 churches, press, resource pages) | 2026-08-07 |
| Replies | 0 | 2026-08-07 |
| Complaints | 0 | 2026-08-07 |
| Bounces | 1 (transient, retried) | 2026-08-07 |

### Unit economics

| Item | Value |
|---|---|
| Price | $34.99 |
| Stripe fee | ~$1.32 |
| OpenAI per draft | ~$0.01–0.03 (estimate) |
| Vercel / Supabase / Resend | $0 at current volume |
| **Marginal cost per sale** | **~$1.35** |
| **Gross margin** | **~96%** |
| Fixed monthly cost | ~$1 (domain amortised) |

---

## Completed experiments

| # | Hypothesis | Result | Learning |
|---|---|---|---|
| 1 | Churches will pay for a weekly bulletin tool | **Rejected before building** | LPi and Diocesan supply free ad-funded printed bulletins; Planning Center already exports orders of service; ChurchArt is $5.99/mo. Cannot beat free. 7 emails sent, 7 delivered, 0 replies so far. |
| 2 | Funeral homes feel program creation as a pain worth paying for | **Unresolved** | 10 emails, 10 delivered, 0 bounces, no replies yet. Counter-evidence found: funeral homes sell 100 programs for $95–150 on the family's bill, so referring families costs them money. |
| 3 | A higher-ceiling niche beats fixing this one | **Rejected** | 10 niches scored. All need 1,000–10,000 recurring customers against operators already running the same playbook. Model, not topic, is the constraint. |
| 4 | $20 of ads is a useful diagnostic | **Rejected on arithmetic** | 20 clicks returns zero sales 67% of the time at a true 2% rate. Needs 150–300 clicks to be interpretable. Not spent. |
| 5 | Print-and-ship at $249 fixes the volume problem | **Blocked** | Economically the best lever (286 orders/day → 40) but Lulu needs 3–5 days production; funerals are 3–7 days out. No public API fits the window. |
| 6 | Generated documents survive real-world input | **Failed, now fixed** | See below. The product was shipping broken documents for ordinary names. |

### Experiment 6 in detail — the first customer would likely have received a broken document

Fixture testing across the full range the schema permits found the renderer
added an extra page on very common input:

- **Bifold**, sold as a four-panel fold, became **5 pages** whenever the name
  wrapped to a second line on the 360pt keepsake card, where it renders at
  42pt. "Christopher Alexander Wainwright" was enough. A 5-page bifold cannot
  be folded at all.
- **Keepsake**, sold as a single sheet, became **2 sheets** with a name of 30+
  characters *or* a heading of 50+ characters. Our own generator permits
  headings up to 90.

Two failed hypotheses before the real cause: the cover panel was innocent
(scaling it changed nothing and the code was removed), and body text length was
not the trigger either. Per-field thresholds also failed, because a long name
and a long heading interact.

The fix renders, counts pages, and retries with tighter type until the count is
right, so it self-corrects for content we have not thought of. Ordinary orders
still render once at full size. Locked in by a regression test asserting page
counts at every schema maximum, across all three themes, both formats, with and
without a photograph.

**Learning:** this shipped weeks of "verified working" fulfilment checks ago.
Every earlier check confirmed a PDF was *produced*, never that it was
*correct*. Verifying the artefact exists is not verifying the artefact is
usable.

---

## Current experiment

**Ever Loved marketplace listing.** The only free, self-serve channel with real
US bereaved traffic. No listing fee, 10% of sale, verification under 48h.
Setup pack written in `EVERLOVED-SETUP.md`. Blocked on owner signup.

**Hypothesis:** a marketplace that already owns the audience produces the first
sale faster than organic search, which is a Q4 asset at best.
**Measured by:** first fulfilled order attributed to Ever Loved.

Secondary experiment in flight: copyright-study editorial pitches (non-commercial).
Five individually written pitches delivered 2026-08-07 to Aaron Moss, Glyn Moody,
Andrew Albanese, Andy Baio, and Cory Doctorow. Zero product mentions. Honest
assessment from the pitch agent: the study is careful but thin as news; best
realistic outcome is a roundup link, not an article. Rights-holder on the record
would upgrade it.

---

## Next action

1. Owner: Ever Loved signup (highest expected impact toward first sale).
2. RevenueOS is live as `@revenueos/core` — TributeReady is customer zero.
3. Keep GrowthOS/RevenueOS daily review green; act on Level-4 acquisition only.
4. Do not invent more pages until Search Console shows demand.

---

## Spend

| Item | Amount |
|---|---|
| Ad spend to date | $0 |
| Paid tools/services | $0 |
| New recurring cost added | $0 |
| Autonomous daily cap | $3 (not approached) |

---

## Owner-blocked

| Item | Why it matters | Blocked on |
|---|---|---|
| Ever Loved signup | Only channel with real bereaved traffic | ~15 min + Stripe Express (checking account, not savings) |
| Postal address | CAN-SPAM requires it; sender refuses to send without it. **All commercial outreach is stopped.** | Owner declined |
| Search Console | No query data means SEO is guesswork | Property verification + service account |
| Supabase DDL | `growth_events_metadata_safe` constraint missing in prod | No DB password; app-level zod still enforces it |
| Live webhook signature | Only unproven link in the revenue path | A real live payment |
| Git history | Zero commits; no revert path after many deploys | Owner decision |

---

## Decisions on record

- **Keep $34.99.** Owner chose to hold pending real conversion data.
- **Keep current refund wording.** Owner chose to hold, knowing a direct
  competitor at the same price offers 30-day money back with 1,000+ reviews.
- **No print-and-ship yet.** Correct call; fulfilment window does not fit.
- **No niche switch.** Fix the model, not the topic.
