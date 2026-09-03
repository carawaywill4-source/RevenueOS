# Batch 1 Mac Cutover Report

Date: 2026-08-09

## Dependency degradation (addressed)

### OpenAI
- Status during cutovers: often **DEGRADED** (`no_credits` / 429)
- `packages/revenueos/src/modules/openai-client.ts` now:
  - classifies `rate_limited` vs `no_credits`
  - bounds retry for transient 429 only
  - exposes `getOpenAICapabilityStatus()` / `isOpenAIActionDegraded()`
  - skips generative limbs while out of credits (deferred, not silent fake OK)
- Pursuit engine defers OpenAI-dependent actions with explicit `DEGRADED openai:…` telemetry
- Operator `/status` reports `capabilities.openai` + `revenueosStatus: needs_attention` when degraded
- **No new provider purchased** — catalog/deterministic/storefront limbs continue

### IndexNow
- `pingIndexNow` now: cooldown on 429 (10m→30m), one bounded retry, never blocks publish
- ResumeForge publish detail explicitly: `IndexNow HTTP 429 — cooling 30m; other channels unaffected`
- Publish still returned `ok: true` with live topic URL

## Batch 1 businesses

| Business | Claim | Vercel blocked | Commercial action | External verify | Learning / next | Restart |
| --- | --- | --- | --- | --- | --- | --- |
| **RaiseReady** (prior) | ✓ | ✓ `hosted_by_operator` | `discovery_attack` | topic URL 200 | ✓ | ✓ |
| **ResumeForge** | ✓ | ✓ | `publish_intent_page` → `/topics/ats-resume-for-job-description` | HTTP 200, keywordHit | pattern gate updated; next enqueue outreach/youtube/gbp | ✓ |
| **DepositProof** | ✓ | ✓ | `publish_programmatic_door` → `/topics/rental-move-in-inspection-checklist` | HTTP 200, keywordHit | pattern gate updated; next enqueue buyer_discovery/bing/directory | ✓ |

Traces:
- `.data/raiseready-cutover-trace-*.json`
- `.data/resumeforge-cutover-trace-2026-08-09T23-32-49-355Z.json`
- `.data/depositproof-cutover-trace-*.json`

## Continuous operation

Operator defaults updated for continuous (not hourly) work:
- `MAX_CONCURRENCY=2` (isolated workers, Mac stays responsive)
- `PER_BUSINESS_MIN_INTERVAL_MS=45000`
- `CLAIM_LEASE_MS=600000` (renewed each tick)
- `BUSINESSES=raiseready,resumeforge,depositproof` after sync

Brain still gates by cooldowns, pattern bans, FCM, and commercial priority — not max API churn.

## Still on Vercel autonomy (not claimed yet)

ledgerleaf, turnoverkit, listinglift, closeshift, bidbinder, waitroom, shopbeacon

**Mendhaus:** not in Mac operator portfolio; remains fulfillment-blocked for paid orders.

## Next

Await approval to start Batch 2 (next two digital businesses).  
SwiftUI owner UI can begin in parallel now that Batch 1 passed.
