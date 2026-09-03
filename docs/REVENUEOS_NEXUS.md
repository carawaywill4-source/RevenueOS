# REVENUEOS NEXUS

NEXUS is the coordination / execution governor that makes TITAN, CORTEX, APEX, and FORGE function as one organism.

It is **not** another CEO, marketing brain, or company builder.

## Central rule

**Intelligence proposes → Policy authorizes → NEXUS executes → Reality verifies → Memory learns.**

## Ownership

| Domain | Owner |
|---|---|
| Strategy / allocation | TITAN |
| Knowledge / evidence | CORTEX |
| Acquisition | APEX |
| Company / product | FORGE |
| Coordination / locks / pipeline | **NEXUS** |
| Money authorization | CapitalGovernor (deterministic) |

## What lives here

`packages/revenueos/src/nexus/`

- `RevenueEvent` / append-only event ledger
- `RevenueCommand` (intent ≠ reality)
- Action pipeline (propose → … → release)
- Policy gate + owner kill switches
- Domain locks / work claims
- Conflict matrix + experiment collision detector
- Business lifecycle state machine
- Organism cycle (`runNexusCycle`) wired after APEX + TITAN in `operator-loop`
- Hourly check: **revenue + visitors only**

## Hourly owner check

```
scopeguard: $0.00 · 12 visitors
```

No engineering diary. Sales, critical incidents, and owner-required actions use separate channels. Morning brief remains the executive summary.

## Mode

`REVENUEOS_MODE` = `SHADOW` | `STAGING` | `LIVE`

NEXUS coordinates in all modes. Live commercial autonomy still requires critical gauntlet gates and owner constitution.

## Checkpoint

Git tag: `revenueos-nexus-prelaunch-base`  
Stash: `revenueos-nexus-prelaunch-wip-*` (pre-integration WIP)
