# Browser sidecar

A tiny Playwright HTTP service that runs LOCALLY on the owner's macOS
machine (or a small always-on Mac Mini / VPS). It exposes a small set
of endpoints the persistent operator calls to publish to community
sites the operator can't reach from a datacenter — Reddit, Hacker
News, Indie Hackers, Substack, Quora.

## Why local?

Two reasons:

1. **IP reputation.** Community sites throttle or block Vercel / Fly
   / most cloud egress ranges. Owner's residential IP is fine.
2. **Session reuse.** The sidecar uses `chromium.launchPersistentContext`
   pointed at a real user profile directory. The owner logs in once
   per platform via `sidecar login <platform>`; every future call
   reuses those cookies.

The sidecar acts AS the owner — it does not impersonate anyone else,
and every action gets a screenshot before submit so the owner can
audit what shipped.

## macOS setup (2-3 lines)

```bash
cd services/browser-sidecar
cp .env.example .env && vim .env  # set SIDECAR_TOKEN
npm install && npm run cli login hackernews   # opens a browser
```

Repeat `npm run cli login <platform>` for `reddit`, `indiehackers`,
`substack`, and `quora`. Sessions persist to `~/.revenueos-sidecar/chromium`.

Then run the service:

```bash
npm run dev
```

The health server binds to `:7071`. Confirm with:

```bash
curl -H "x-sidecar-token: $SIDECAR_TOKEN" http://localhost:7071/status
```

## Keep it running (macOS)

Two clean options:

### Option A — `pm2`

```bash
npm i -g pm2
pm2 start "npm run start" --name revenueos-sidecar --cwd services/browser-sidecar
pm2 save && pm2 startup
```

### Option B — `launchd`

Create `~/Library/LaunchAgents/dev.revenueos.sidecar.plist` with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>dev.revenueos.sidecar</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/local/bin/node</string>
      <string>/Users/YOU/Developer/tributeready/services/browser-sidecar/node_modules/tsx/dist/cli.mjs</string>
      <string>/Users/YOU/Developer/tributeready/services/browser-sidecar/src/index.ts</string>
    </array>
    <key>WorkingDirectory</key><string>/Users/YOU/Developer/tributeready/services/browser-sidecar</string>
    <key>EnvironmentVariables</key>
    <dict><key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string></dict>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/revenueos-sidecar.log</string>
    <key>StandardErrorPath</key><string>/tmp/revenueos-sidecar.err</string>
  </dict>
</plist>
```

Then `launchctl load ~/Library/LaunchAgents/dev.revenueos.sidecar.plist`.

## Expose to the operator

The sidecar must NEVER be exposed to the raw internet. Use one of:

1. **Tailscale** (preferred). Enable the funnel:
   ```bash
   tailscale funnel --https=443 --set-path=/sidecar 7071
   ```
   Set `SIDECAR_URL` on the Fly operator to your tailnet HTTPS URL.

2. **ngrok reserved domain**:
   ```bash
   ngrok http --domain=sidecar.example.com 7071
   ```

Whichever you pick, keep `SIDECAR_TOKEN` a real secret — anyone who
knows it can drive posts through your logged-in browser sessions.

## Endpoints

| POST                  | Body                                             |
| --------------------- | ------------------------------------------------ |
| `/post/hackernews`    | `{ title, url }`                                 |
| `/post/indiehackers`  | `{ productSlug, body }`                          |
| `/post/substack`      | `{ publicationId, html, subject }`               |
| `/post/quora`         | `{ questionId, body }`                           |
| `/reddit/post`        | `{ subreddit, title, body }`                     |
| `/reddit/reply`       | `{ threadUrl, body }`                            |

Each endpoint accepts an optional `dryRun: true` override in the body.
Every response is:

```json
{
  "ok": true,
  "detail": "hn_submitted",
  "url": "https://news.ycombinator.com/item?id=…",
  "screenshotPath": "/Users/.../hackernews-after-2026-…png"
}
```

## Rate limits (defaults)

| Platform     | Daily cap | Min interval |
| ------------ | --------- | ------------ |
| reddit       | 8         | 90s          |
| hackernews   | 4         | 120s         |
| indiehackers | 6         | 60s          |
| substack     | 4         | 60s          |
| quora        | 6         | 60s          |

Override in code via constructor args to `PlatformRateLimiter`.

## Tests

```bash
npm test
```

Runs 12 unit tests against a fake PageLike — no real browser is
launched, no network is used. Run these before shipping any handler
change.
