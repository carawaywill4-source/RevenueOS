# RevenueOSCore macOS persistence

## LaunchAgent

RevenueOSCore runs as `com.revenueos.core` under the logged-in user.

```bash
bash services/operator/macos/install-launchd.sh
```

Verify:
- `launchctl print gui/$(id -u)/com.revenueos.core`
- `curl http://127.0.0.1:8080/healthz`
- Logs: `~/Library/Logs/RevenueOS/`

Unload:
```bash
launchctl bootout gui/$(id -u)/com.revenueos.core
```

## Independence checks

| Action | Expected |
| --- | --- |
| Quit RevenueOS.app | Core keeps operating on :8080 |
| Quit Cursor | Core keeps operating |
| Close Terminal | Core keeps operating (LaunchAgent, not a shell job) |
| Intentional Core restart | Claims/queues/memory survive in Supabase; claim leases renew |
| Mac reboot + login | LaunchAgent `RunAtLoad` starts Core; app reconnects to :8080 |
| Restart recovery | Document claims prevent Vercel dual-execution while lease valid |

## Power / sleep (required owner config)

macOS sleep can silently pause Node for hours. For a Mac that must operate RevenueOS:

1. **System Settings → Energy / Battery → Options**
   - Prefer **Prevent automatic sleeping when display is off** when on power adapter
   - Disable aggressive Power Nap restrictions that suspend background agents if present
2. Keep the Mac **plugged in** for continuous portfolio operation
3. Avoid logging out of the GUI session if using a LaunchAgent (user agents stop at logout)
   - For headless always-on without login, migrate later to a LaunchDaemon — not configured by default
4. Optional: `caffeinate -s` only as a temporary bridge; prefer Energy settings

If the Mac sleeps, claims eventually expire and Vercel crons may resume — that is split-brain risk. Keep the Mac awake while RevenueOS is the operator of record.

## Architecture

```
RevenueOS.app (optional UI)
        │
        ▼
RevenueOSCore LaunchAgent :8080
        │
   packages/revenueos
        │
   Supabase / Stripe / Vercel storefronts
```
