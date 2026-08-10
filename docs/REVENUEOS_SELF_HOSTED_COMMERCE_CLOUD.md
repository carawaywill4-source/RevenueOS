# RevenueOS Self-Hosted Commerce Cloud

## Architecture

| Plane | Role | Process |
| --- | --- | --- |
| **Control** | Brain / PortfolioArchitect / deploy decisions | Mac `RevenueOSCore` (`services/operator`) |
| **Hosting** | Build, container/process runtime, gateway config, health, rollback | `services/hosting-plane` (VPS or dedicated machine) |
| **Durable** | Memory + money | Supabase + Stripe |

RevenueOS **controls** web servers. It is **not** the permanent public web server for 50 businesses.

Failure domains:

- Core / Cursor / OpenAI / Mac offline → last known-good storefronts keep serving on the hosting plane.
- One site crash → isolated; Resource Governor + restart/heal; never takes Core down.
- Failed deploy → `DEPLOYMENT_FAILED`; production stays on previous known-good.

Vercel remains **emergency fallback** until a dual-run migration is proven.

## Local / Mac development mode

```bash
# Terminal A — hosting plane (independent of Core)
HOSTING_RUNTIME=process npm --workspace @revenueos/hosting-plane run start

# Terminal B — Core (unchanged)
npm run operator:start

# Dual-run candidate (ScopeGuard); Vercel stays live
HOSTING_RUNTIME=process npm --workspace @revenueos/operator-service exec \
  tsx src/tests/hosting-plane-dual-run.live.ts
```

Core proxies:

- `GET /infra/host` — hosting status
- `POST /infra/host/deploy`
- `POST /infra/host/action` `{ action: rollback|pause|resume|restart|retire, siteId }`

## VPS production mode

1. Provision Linux VPS with Docker + Caddy.
2. Run hosting-plane with `HOSTING_RUNTIME=docker` (see `templates/docker-compose.hosting.yml`).
3. Point `HOSTING_PLANE_URL` on Mac Core at the VPS control API (tokenized).
4. Deploy sites; Caddyfile is regenerated under `HOSTING_DATA_DIR/gateway`.
5. Attach domains programmatically; Caddy handles HTTPS.

Do **not** expose the Mac as the permanent public edge.

## Migration policy

1. Build hosting plane first (this package).
2. Dual-run **one** low-risk business (default: ScopeGuard).
3. Verify: routing, HTTPS (on VPS), checkout, Stripe webhooks, fulfillment, analytics, attribution, restart recovery, deploy, rollback, 24h stability.
4. Only then migrate incrementally. Keep Vercel until proven.

## Definition of success

A RevenueOS business can be deployed without Vercel, remain publicly reachable with HTTPS, accept a real Stripe payment, survive Core/Cursor stop, restart after failure, roll back from a bad deployment, and continue reporting commercial events to RevenueOS.

## What this intentionally does not do yet

- Fancy owner dashboards beyond `/infra/host` status.
- Mass DNS cutover of the existing ten Vercel sites.
- Serving 50 production sites from a laptop on residential ISP.
