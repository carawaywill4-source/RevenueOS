# Batch 2 Mac Cutover Report

Date: 2026-08-10

**Status: STOP before Batch 3 — awaiting approval.**

## Passed (all three)

| Business | Claim | Vercel blocked | Commercial action | External verify | Learning / next | Restart |
| --- | --- | --- | --- | --- | --- | --- |
| **LedgerLeaf** | ✓ | ✓ `hosted_by_operator` | `discovery_attack` → re-featured `freelancer-invoice-template` | topic URL HTTP 200 + brand hit | pursuit WAITING_FOR_EVIDENCE; next youtube/buyer_discovery/gbp | ✓ |
| **ListingLift** | ✓ | ✓ | `publish_comparison_page` → `/topics/etsy-shopify-seo-templates-vs-doing-it-yourself` | HTTP 200, keywordHit | ✓ | ✓ |
| **CloseShift** | ✓ | ✓ | `publish_programmatic_door` → `/topics/store-closing-sop` | HTTP 200, keywordHit | ✓ | ✓ |

Traces:
- `.data/ledgerleaf-cutover-trace-2026-08-10T00-18-59-843Z.json`
- `.data/listinglift-cutover-trace-2026-08-10T00-23-14-448Z.json`
- `.data/closeshift-cutover-trace-2026-08-10T00-27-16-346Z.json`

## Failed then repaired

**LedgerLeaf first attempt** failed: first drain only deferred OpenAI-dependent jobs (`no_credits` / 429), so no strong commercial execution that window.

Repair (independent; Batch 1 kept running):
1. Synced `services/operator/.env` `CRON_SECRET` to match portfolio/Vercel (Core had been unable to execute storefront limbs).
2. Cutover harness retries commercial drains when OpenAI is degraded (brain still selects; no `packages/revenueos` changes).
3. Re-ran LedgerLeaf acceptance → **PASS**.

## Batch 1 continued operating during Batch 2

RaiseReady, ResumeForge, DepositProof remained claimed and ticking while Batch 2 apps were prepared/deployed and cut over. Hot-add via `/control/add-business` joined each passing business without stopping the portfolio.

Vercel ownership probe after Batch 2 (all six): `mode=hosted_by_operator`, `skipped=true`.

## Continuous Core

- Operator portfolio env: `BUSINESSES=raiseready,resumeforge,depositproof,ledgerleaf,listinglift,closeshift`
- Claims renewed per tick; storefronts remain hosted on Vercel
- OpenAI: often **degraded** (`no_credits`); non-LLM commercial limbs continue
- Stripe: Core `/money` wired to live Stripe secret on Core only — Available/Pending shown as Stripe balances (not bank balance); Swift never receives the key

## SwiftUI owner app (parallel)

- Package: `macos/RevenueOS` — Login → Dashboard shell
- Nav: Dashboard, Businesses, Revenue, Activity, RevenueOS (chat), Settings
- Portfolio/activity/Needs You/capabilities from Core `/owner/dashboard`
- Chat via Core `/owner/chat` → `handleOwnerMessage` + Core state (honest degraded banner)
- Business detail via `/owner/business/:id`
- UI process independent of Core (quit UI ≠ stop engine)

## Not migrated (Batch 3+)

turnoverkit, bidbinder, waitroom, shopbeacon — **do not start until approved**.

**Mendhaus:** still fulfillment-blocked; Needs You surface.

## Next

Await approval for Batch 3. Keep all six operating businesses running while waiting.
