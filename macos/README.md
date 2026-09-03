# RevenueOS macOS headquarters

**This is not a rewrite of the brain.** The intelligence stays in
`packages/revenueos` (`@revenueos/core`) and runs as **RevenueOSCore** — a
launchd-managed Node process wrapping `services/operator`.

| Piece | Role |
| --- | --- |
| `RevenueOS.app` (SwiftUI) | Owner control surface — money, portfolio, activity, commands |
| RevenueOSCore (`launchd`) | Persistent operator — continuous pursuit loop |
| `services/browser-sidecar` | Local browser hands for API-less platforms |
| Vercel apps | Storefronts / checkout / beacon — not the brain |
| Supabase | Durable memory (never reset) |
| Stripe APIs | Financial truth for Available / Pending / Payouts |

## Migration status

See [`docs/REVENUEOS_MACOS_MIGRATION_MANIFEST.md`](../docs/REVENUEOS_MACOS_MIGRATION_MANIFEST.md).

## Quick start (Phase 1 — Core alive on Mac)

```bash
# 1) Snapshot durable memory counts (before any cutover)
node scripts/snapshot-revenueos-memory.mjs

# 2) Run Core locally (same brain as Fly operator)
cd services/operator
cp .env.example .env   # fill Supabase + OpenAI + Stripe keys
npm install
npm run dev

# 3) Install launchd so Core survives window close / reboot (user session)
cd ../../macos
./install-core-launchd.sh

# 4) Open SwiftUI shell (Xcode)
open RevenueOS/RevenueOS.xcodeproj
```

## Cutover rule

Do **not** disable `apps/*/api/cron/revenueos` until Core has executed a
verified commercial action and learning writeback is confirmed. Coordination
uses `revenueos_operator_claims` (already implemented).
