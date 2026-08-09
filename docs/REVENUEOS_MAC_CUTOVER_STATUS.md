# RevenueOS Mac Cutover — Live Status

Updated: 2026-08-09

## Status answers (exact)

| Question | Answer |
| --- | --- |
| `services/operator` status | **Present and bootable.** Imports `@revenueos/core` (`file:../../packages/revenueos`). Scheduler + claims lib + health server + sidecar executor. Shadow knobs: `SHADOW_MODE`, `CLAIM_ENABLED`, `BUSINESSES`. |
| Operator-claims migration applied? | **Native SQL table still missing** (no local `DATABASE_URL` / `SUPABASE_ACCESS_TOKEN`). **Document-mode claims verified** on active project `buvfllemxdvmwzhvfori` via `revenueos_experiments` (`ros:opclaim:*`). `checkOperatorHosting` reads document claims. SQL file kept for later native apply. |
| Every storefront checks ownership? | **Yes in source** — all 11 app crons (`raiseready`…`mendhaus`) call `checkOperatorHosting` → `hosted_by_operator`. TributeReady root has digest/growth crons only (no portfolio brain cron). **Until claims table exists, lookup returns `lookup_failed` → cron continues** (safe fail-open). Live deploy of claim-check code may still be mid-redeploy (cron probe timed out). |
| Mac Core load `packages/revenueos`? | **YES** via tsx. Smoke: `services/operator/src/tests/shadow-tick.smoke.ts`. |
| Mac Core read Supabase learning? | **YES.** Live counts: experiments **46,654**, lessons **14,916**, scorecards **7,803**. Ledger mode: **document**. Shadow tick saw FCM `buyer_exposure` + `claimableRemaining: 119` for raiseready. |
| Mac Core execute business action? | **Not yet for real commercial action.** Shadow mode works (observe only). Real execute needs: (1) claims table, (2) `CLAIM_ENABLED=1`, (3) sidecar or storefront-safe executor, (4) `SHADOW_MODE=0`. Operator safe-action surface is narrower than app cron (sidecar-backed external limbs). |
| Before ONE-business cutover | Apply+verify claims DDL; redeploy crons with claim check; shadow on `raiseready`; claim one lease; confirm Vercel `hosted_by_operator`; one real action → telemetry → learning writeback → next decision → restart resume. |

## Preserve brain

- Module manifest: `docs/REVENUEOS_MODULE_MANIFEST.md` (+ `.json`)
- Counts: **71** `modules/`, **17** intelligence, **5** memory, **110** total TS files under `packages/revenueos/src`
- Rule: no module deletion without owner approval

## Supabase credential map (no secrets)

| Source | Project ref | SUPABASE_URL+SERVICE_ROLE | DATABASE_URL / ACCESS_TOKEN |
| --- | --- | --- | --- |
| `.env.local` (root) | `buvfllemxdvmwzhvfori` | present — **live memory** | absent |
| `apps/*/.env.local` | `fnrwzloovduhryynmgok` | present — **times out** | absent |
| `.env.portfolio` | — | **missing** Supabase keys | absent |
| `services/operator/.env` | wired to `buvfl…` from `.env.local` | present after sync | absent |
| Vercel production (raiseready) | hidden/redacted on pull | keys exist as Sensitive | not listed |

Vercel apps obtain creds via `scripts/sync-portfolio-envs.mjs` / deploy scripts (`vercel env add`). Local Mac Core reuses `.env.local` via `scripts/sync-operator-env.mjs`.

## Claims status

- Native SQL: not applied (DDL creds never stored locally or in Vercel env list)
- Document-mode R/W probe: **passed**; `checkOperatorHosting` saw `active_claim`
- No owner credential ask needed for Mac Core memory or claim handoff in document mode

## RaiseReady ONE-business cutover (2026-08-09) — PASS pending owner approval

Acceptance trace file: `.data/raiseready-cutover-trace-2026-08-09T23-06-27-145Z.json`

| Step | Evidence |
| --- | --- |
| EXISTING MEMORY LOADED | project `buvfl…`, RaiseReady experiments 3551+, portfolio 46k+ |
| MAC CLAIM ACQUIRED | `ros:opclaim:raiseready`, owner `mac-revenueos-core`, document storage |
| VERCEL DUPLICATE BLOCKED | `https://raiseready-seven.vercel.app/api/cron/revenueos` → `hosted_by_operator` / `skipped:true` |
| BRAIN SELECTED ACTION | `discovery_attack` via existing pursuit engine |
| ACTION QUEUED + EXECUTED | pursuit `pursuit_msmeooxn_ag1anh` → WAITING_FOR_EVIDENCE |
| EXTERNAL VERIFIED | `https://raiseready-seven.vercel.app/topics/negotiate-job-offer-email` HTTP 200, intent copy present |
| RESULT + LEARNING | durable pevt + pursuit in live Supabase |
| NEXT DECISION USED LEARNING | pattern gate banned includes `discovery-attack`; next enqueue `public_form_outreach`, `youtube_intent_discovery` |
| RESTART / RESUME | claim+pursuit+event survived; new tick enqueued without Vercel cron |

**Stop here:** do not claim business #2 until owner approves.

Note: OpenAI org currently returns insufficient_quota (429) — Mac used storefront limb `/api/owner/execute` for publish/discovery actions.

## Safe local Core (already configured)

```bash
node scripts/sync-operator-env.mjs   # SHADOW_MODE=1 CLAIM_ENABLED=0 BUSINESSES=raiseready
cd services/operator && npx tsx src/tests/shadow-tick.smoke.ts
cd services/operator && npm run start   # continuous shadow loop
```

Do **not** set `CLAIM_ENABLED=1` until the claims table R/W probe passes.
Do **not** disable Vercel crons.
