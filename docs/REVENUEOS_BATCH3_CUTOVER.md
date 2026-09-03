# Batch 3 Mac Cutover Report

Date: 2026-08-10

**Migration of all eligible digital businesses complete.** Mendhaus remains owner-blocked (fulfillment).

## Passed (all four)

| Business | Claim | Vercel blocked | Commercial action | External | Learning |
| --- | --- | --- | --- | --- | --- |
| **TurnoverKit** | ✓ | ✓ | `gumroad_product_sync` (STR pack listing) | durable marketplace match | ✓ |
| **BidBinder** | ✓ | ✓ | `gumroad_product_sync` (contractor pack) | durable marketplace match | ✓ |
| **WaitRoom** | ✓ | ✓ | `publish_comparison_page` → `/topics/waitlist-vs-doing-it-yourself` | HTTP 200 + keywordHit | ✓ |
| **ShopBeacon** | ✓ | ✓ | `gumroad_product_sync` (QR+UTM pages) | durable marketplace match | ✓ |

Traces under `.data/*-cutover-trace-2026-08-10*.json`.

Acceptance included `ACTION_PERSISTED_BEFORE_EXECUTION` (pursuit row / lifecycle events before executed result).

## Existing six during Batch 3

RaiseReady, ResumeForge, DepositProof, LedgerLeaf, ListingLift, CloseShift continued claimed ticks while Batch 3 deployed and cut over. Failures were repaired independently (none required stopping the portfolio).

## Post-migration operating mode

- `BUSINESSES` = all 10 digital portfolio sites
- LaunchAgent `com.revenueos.core` installed (`docs/REVENUEOS_MAC_PERSISTENCE.md`)
- Owner controls: pause/resume/prioritize via `/owner/control` (persisted + audited)
- OpenAI remains honestly degraded when 429/no credits
- Primary commercial objective after migration: **first attributed stranger sale**

## Not migrated

**Mendhaus** — fulfillment unavailable; Needs You only.
