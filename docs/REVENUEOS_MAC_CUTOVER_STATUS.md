# RevenueOS Mac Cutover — Live Status

Updated: 2026-08-09

## Status answers (exact)

| Question | Answer |
| --- | --- |
| `services/operator` status | **Present and bootable.** Imports `@revenueos/core` (`file:../../packages/revenueos`). Scheduler + claims lib + health server + sidecar executor. Shadow knobs: `SHADOW_MODE`, `CLAIM_ENABLED`, `BUSINESSES`. |
| Operator-claims migration applied? | **NO on active project `buvfllemxdvmwzhvfori`.** `GET /rest/v1/revenueos_operator_claims` → PostgREST **404 / PGRST205**. Migration file ready: `supabase/migrations/20260810_revenueos_operator_claims.sql`. Apply script: `scripts/apply-operator-claims-migration.mjs`. |
| Every storefront checks ownership? | **Yes in source** — all 11 app crons (`raiseready`…`mendhaus`) call `checkOperatorHosting` → `hosted_by_operator`. TributeReady root has digest/growth crons only (no portfolio brain cron). **Until claims table exists, lookup returns `lookup_failed` → cron continues** (safe fail-open). Live deploy of claim-check code may still be mid-redeploy (cron probe timed out). |
| Mac Core load `packages/revenueos`? | **YES** via tsx. Smoke: `services/operator/src/tests/shadow-tick.smoke.ts`. |
| Mac Core read Supabase learning? | **YES.** Live counts: experiments **46,654**, lessons **14,916**, scorecards **7,803**. Ledger mode: **document**. Shadow tick saw FCM `buyer_exposure` + `claimableRemaining: 119` for raiseready. |
| Mac Core execute business action? | **Not yet for real commercial action.** Shadow mode works (observe only). Real execute needs: (1) claims table, (2) `CLAIM_ENABLED=1`, (3) sidecar or storefront-safe executor, (4) `SHADOW_MODE=0`. Operator safe-action surface is narrower than app cron (sidecar-backed external limbs). |
| Before ONE-business cutover | Apply+verify claims DDL; redeploy crons with claim check; shadow on `raiseready`; claim one lease; confirm Vercel `hosted_by_operator`; one real action → telemetry → learning writeback → next decision → restart resume. |

## Preserve brain

- Module manifest: `docs/REVENUEOS_MODULE_MANIFEST.md` (+ `.json`)
- Counts: **71** `modules/`, **17** intelligence, **5** memory, **110** total TS files under `packages/revenueos/src`
- Rule: no module deletion without owner approval

## Blocker (owner action)

Apply DDL to active Supabase. Either:

```bash
# after: supabase login   OR export SUPABASE_ACCESS_TOKEN=...
node scripts/apply-operator-claims-migration.mjs

# or
DATABASE_URL='postgres://...' node scripts/apply-operator-claims-migration.mjs
```

Script writes a probe claim, reads it back, deletes it.

## Safe local Core (already configured)

```bash
node scripts/sync-operator-env.mjs   # SHADOW_MODE=1 CLAIM_ENABLED=0 BUSINESSES=raiseready
cd services/operator && npx tsx src/tests/shadow-tick.smoke.ts
cd services/operator && npm run start   # continuous shadow loop
```

Do **not** set `CLAIM_ENABLED=1` until the claims table R/W probe passes.
Do **not** disable Vercel crons.
