# SEO Content Map

Maps every intent cluster in `seo/keyword-universe.json` to a living page
or an explicit gap. One page may cover many phrases. Updated 2026-08-07.

## Hubs

| Hub | Path | Role |
|---|---|---|
| Funeral programs | `/funeral-program-maker` | Commercial conversion |
| Obituaries | `/obituary-writer` | Commercial conversion |
| Celebration of life | `/celebration-of-life-program` | Commercial conversion |
| Order of service | `/order-of-service-templates` | Template hub → product |
| Resources | `/resources` | Educational spokes |

## Covered well

| Intent | Primary page | Supporting |
|---|---|---|
| Funeral program maker | `/funeral-program-maker` | sample PDF, builder |
| Funeral program Word/PDF templates | `/funeral-program-template-word` | `/funeral-program-google-docs`, `/funeral-pamphlet-template`, `/api/word/*` |
| Where to print | `/where-to-print-funeral-programs` | `/resources/how-to-print-a-funeral-program` |
| What goes in a program | `/resources/what-to-include-in-a-funeral-program` | |
| Celebration of life program | `/celebration-of-life-program` | `/resources/celebration-of-life-program-examples` |
| Obituary writer | `/obituary-writer` | builder |
| How to write an obituary | `/resources/how-to-write-an-obituary` | |
| Obituary templates / examples | `/obituary-templates`, `/resources/obituary-examples` | 10 relationship spokes |
| Order of service | `/order-of-service-templates` + tradition spokes | Word downloads |
| Readings / poems | `/funeral-readings` | `/funeral-poem-copyright` |
| Thank-you / memorial card wording | resource guides | |
| Eulogy examples | `/eulogy-examples` | 6 relationship spokes |

## Partial coverage

| Intent | Current | Gap |
|---|---|---|
| Funeral program examples | `/funeral-program-examples` + `/api/sample` | **Shipped 2026-08-07** |
| Situational obituaries (no funeral, short, donations wording) | Folded into guides | Only split out if examples differ enough to stand alone |
| Memorial program (vs funeral program) | Served by program maker + memorial-service order | Watch GSC; add `/memorial-program` only if queries diverge |

## Explicit gaps (create only if quality gate passes)

| Intent | Why it matters | Suggested page | Priority |
|---|---|---|---|
| Funeral program cost / printing cost | High commercial adjacency; common urgent query | `/funeral-program-cost` — **shipped 2026-08-07** | Done |
| Obituary family-listing order | Precise how-to near purchase intent | `/resources/obituary-family-order` — **shipped 2026-08-07** | Done |
| Annotated funeral program examples | “examples” SERP often wants visuals | `/funeral-program-examples` — **shipped 2026-08-07** | Done |

## Consolidation rules

- `mom` / `dad` / `grandma` / `grandpa` → mother / father / grandmother / grandfather pages.
- Pamphlet / bulletin / booklet → `/funeral-pamphlet-template` + internal links from maker.
- Do not create a second “how to write an obituary” under a different slug.

## Internal linking pattern

Every spoke links up to its hub. Every hub links to its strongest free tool and
its strongest guide. Commercial hubs link to each other only when the visitor’s
next job clearly changes (program ↔ obituary ↔ celebration).

```
/funeral-program-maker
  ← template pages, print guide, cost guide (future), order-of-service hub
/obituary-writer
  ← how-to, templates, examples, family-order (future)
/celebration-of-life-program
  ← celebration examples, celebration order-of-service
/order-of-service-templates
  ← tradition spokes, Word downloads, program maker
```
