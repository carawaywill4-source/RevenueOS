# SEO_MASTER_PLAN

**Updated:** 2026-08-07  
**North star for SEO:** strangers find a useful page → start the builder → pay.  
Traffic without purchases is not success.

---

## Snapshot

| Item | Value |
|---|---|
| Keyword universe size | 6 clusters, 24 intents, ~110 phrase concepts |
| Indexable commercial/resource pages today | ~50+ (hubs + relationship/tradition spokes + downloads) |
| Search Console | **Not connected** — all demand scores are provisional |
| Indexing | Domain hours old; 0 confirmed indexed pages on major engines |
| Current bottleneck | Level 4 — almost no qualified traffic |

---

## Clusters

1. **Funeral programs** — hub `/funeral-program-maker`
2. **Celebration of life** — hub `/celebration-of-life-program`
3. **Obituaries** — hub `/obituary-writer`
4. **Order of service** — hub `/order-of-service-templates`
5. **Wording & readings** — hub `/resources` + `/funeral-readings`
6. **Memorial program** — currently aliased to funeral-program hub pending GSC proof of distinct intent

Full phrase lists and coverage status: `seo/keyword-universe.json`  
Page mapping: `SEO_CONTENT_MAP.md`

---

## Current page coverage

**Strong:** maker / writer hubs, free Word templates, print guide, relationship
obituary templates, tradition order-of-service templates, readings library,
copyright study (linkable asset).

**Partial:** funeral program “examples” SERP; situational obituary wording;
memorial-vs-funeral naming.

**Missing (high value only):**

1. Funeral program cost guide  
2. Obituary family-listing order guide  
3. Annotated funeral program examples (only if cost + family-order ship first)

---

## Pages to consolidate / not create

- No separate mom/dad/grandma/grandpa URLs.
- No city landing pages.
- No “AI obituary writer” doorway distinct from `/obituary-writer`.
- No second how-to-write-an-obituary under another slug.
- Do not expand tradition spokes beyond ones we can describe accurately.

---

## Pages / tools to create (implementation order)

| Order | Asset | Metric it should improve | Gate |
|---|---|---|---|
| 1 | `/funeral-program-cost` | Organic clicks on cost queries → builder starts | **Shipped 2026-08-07** |
| 2 | Family-order obituary guide | Long-tail how-to → `/obituary-writer` starts | **Shipped 2026-08-07** as `/resources/obituary-family-order` |
| 3 | Strengthen internal links from free templates → hubs | Builder start rate from template landings | No layout redesign required |
| 4 | Annotated `/funeral-program-examples` | Examples-query CTR and starts | Only after 1–2; must use labeled fictional samples |
| 5 | `/memorial-program` hub | Only if GSC shows distinct memorial-program demand | Defer until GSC data |

**Tools already shipped (protect, don’t rebuild):** free Word bifold, single-sheet
order of service, tradition DOCX downloads, printable worksheets, sample PDF.

---

## Internal linking plan

1. From every free template page, one clear CTA to the matching commercial hub.
2. From every resource guide, related links include the hub + one sibling guide.
3. Homepage resources grid already lists major assets — keep it current when gaps ship.
4. Avoid orphan downloads: every `/api/word/*` and `/api/printable/*` URL should
   be linked from a human page (already true for current set).

---

## Search Console status

| Item | Status |
|---|---|
| Property verified | **Owner action required** |
| API service account | **Owner action required** |
| Opportunity engine | Stubbed via GrowthOS; will consume GSC when credentials exist |

Until GSC exists, do not mass-produce pages from guessed volume.

---

## Technical SEO issues

| Issue | Status |
|---|---|
| robots.txt / sitemap / canonicals | Working |
| Free download paths crawlable | Working |
| `/owner` noindex + robots disallow | Working |
| Live structured data on commercial hubs | Product + FAQ + Breadcrumb on IntentLanding |
| Domain age / zero index | Expected; earn links, do not force Indexing API abuse |
| `growth_events` landing metadata vs DB CHECK | Prod CHECK missing; app zod allows attribution fields — document before tightening DDL |

---

## Money-weighted priorities

Highest commercial intent first:

1. funeral program maker / template / print / cost  
2. obituary writer / template / relationship templates  
3. celebration of life program  
4. order of service templates  
5. wording libraries and poems (supporting, lower conversion)

---

## Implementation order (next 14 days)

1. Ship `/funeral-program-cost` (honest cost drivers, DIY path, CTA to maker).  
2. Ship family-order obituary guide (or substantial section if a full page fails the distinct-intent test).  
3. Audit internal links on the three commercial hubs after those ship.  
4. Owner: connect Search Console.  
5. Re-rank the universe from real impressions; kill or merge anything with no demand and no standalone user value.

---

## Rules in force

- Maximum legitimate coverage, not maximum pages.  
- Better pages that cover more real searches beat more pages.  
- When GSC data arrives, observed queries outrank this speculative map.  
- Never ship a page that would not be worth publishing if Google did not exist.
