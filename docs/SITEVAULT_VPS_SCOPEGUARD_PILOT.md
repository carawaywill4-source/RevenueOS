# SiteVault VPS — ScopeGuard public pilot (procedure only)

**Status:** ACCESS PATH PREPARED — waiting for VPS IP + disposable DNS  
**Scope:** `scopeguard` only · active 50 untouched · portfolio DNS untouched  
**RevenueOS core:** FROZEN — do not change brain / Postgres / scheduler / queue / workers

## Traffic split (critical)

```
CUSTOMER (must NOT touch Mac):
  Internet → DNS → VPS:443 (Caddy) → ScopeGuard container on VPS → storefront/API/Stripe webhook

CONTROL (Mac optional; deploy/manage only):
  Mac RevenueOS → SSH (or tunnel to 127.0.0.1:8090) → hosting-plane on VPS
  → deploy / restart / rollback / attach domain
```

| Path | Depends on Mac? | If Mac disconnects |
| --- | ---: | --- |
| Public storefront + APIs + Stripe ingress | **No** | **Keeps serving** on VPS |
| Autonomous RevenueOS ticks / deploy commands | Yes | Execution may pause; already-deployed site stays up |
| SSH tunnel to `:8090` | Control only | **Irrelevant to customers** — never in the page-request path |

**Forbidden architecture:** `Internet → VPS → SSH tunnel → Mac → storefront`.  
Storefront workload lives entirely on the VPS/SiteVault hosting layer.

## Authority (non-negotiable)

| Plane | Role | Must never |
| --- | --- | --- |
| **Mac** | Execution, native Postgres, queue/workers, deploy/manage | Serve public storefront edge |
| **VPS** | PUBLIC HOSTING ONLY: SiteVault, hosting-plane, TLS, storefront process, ordinary APIs, Stripe ingress | Become RevenueOS execution authority, hold `ros_*`, run brain ticks |

- No Vercel on the ScopeGuard disposable public host.
- No Supabase on this path.
- Do not expose Mac Postgres (`:55432`), operator (`:8080`), or queue interfaces on the VPS or internet.

---

## SSH keys (this Mac)

| Role | Path | Use |
| --- | --- | --- |
| **Provider bootstrap** (RSA PEM you supplied) | `~/.ssh/revenueos-sitevault/RevenueOS_key.pem` | First login as `root`/`ubuntu` only |
| Provider public (derived) | `~/.ssh/revenueos-sitevault/RevenueOS_key.pem.pub` | Already authorized on VPS if provider injected it |
| **Ongoing SiteVault deploy** (ed25519) | `~/.ssh/revenueos-sitevault/id_ed25519_sitevault` | Day-to-day as user `sitevault` |
| SSH aliases | `revenueos-sitevault` (bootstrap) · `revenueos-sitevault-sitevault` (ongoing) | Set `HostName` to VPS IP |

Private keys: **never print / commit / paste into chat.**  
The Messages attachment copy should be treated as exposed-in-transit; prefer using only the secured `~/.ssh/revenueos-sitevault/` copies (mode `600`).

Public key to install on the VPS for user `sitevault` (ongoing):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGhGgfANHy6hKlfwIfXl2ABRIfwA0bE7+x1wOcweU2X/ revenueos-sitevault-deploy@Williams-MacBook-Air
```

### First-login bootstrap (one-time, as provider root/ubuntu)

```bash
# Create dedicated user (not permanent root ops)
sudo adduser --disabled-password --gecos 'SiteVault' sitevault
sudo usermod -aG sudo,docker sitevault   # docker group after docker install
sudo mkdir -p /home/sitevault/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGhGgfANHy6hKlfwIfXl2ABRIfwA0bE7+x1wOcweU2X/ revenueos-sitevault-deploy@Williams-MacBook-Air' \
  | sudo tee /home/sitevault/.ssh/authorized_keys
sudo chown -R sitevault:sitevault /home/sitevault/.ssh
sudo chmod 700 /home/sitevault/.ssh
sudo chmod 600 /home/sitevault/.ssh/authorized_keys

# Firewall: only 22/80/443
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

Then from Mac: set `HostName` in `~/.ssh/config` under `revenueos-sitevault` and `ssh revenueos-sitevault`.

---

## Access still required (STOP until provided)

### A) VPS account / provider
- Provider login (DigitalOcean / Hetzner / Linode / Vultr / AWS Lightsail / etc.) **or** an already-running VM with SSH.
- Initial login: root or `ubuntu` once, to create `sitevault` and install the public key above.
- After bootstrap: day-to-day SSH as `sitevault` only.

### B) VPS specs (ScopeGuard-only pilot)
| Spec | Minimum | Recommended |
| --- | --- | --- |
| OS | Ubuntu 22.04 or 24.04 LTS x86_64 | 24.04 LTS |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 2 GB | 4 GB (Next build + Caddy headroom) |
| Disk | 40 GB SSD | 80 GB |
| Network | Public IPv4 | + optional IPv6 |

### C) Public SSH key
Install the ed25519 public key shown above into `/home/sitevault/.ssh/authorized_keys`.

### D) Disposable hostname
Example: `scopeguard-pilot.<your-domain>`  
Must **not** be any active portfolio production hostname.

### E) Exact DNS record
| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| `A` | `scopeguard-pilot` (or FQDN per DNS UI) | `<VPS_PUBLIC_IPV4>` | **DNS only** (orange-cloud OFF if Cloudflare) |

Optional later: `AAAA` → VPS IPv6.  
Do **not** CNAME this name to Vercel. Do **not** change active portfolio DNS.

### Stripe (after HTTPS only)
Add endpoint `https://<disposable-host>/api/stripe/webhook` (keep existing Vercel webhook until pilot PASS).

---

## Minimum VPS software

1. `docker` + `docker compose` plugin  
2. `ufw`  
3. `logrotate` (usually present)  
4. Git (sync hosting-plane + ScopeGuard build context)

**Do not install on VPS:** PostgreSQL for RevenueOS, Supabase, operator/brain, second schedulers.

---

## Network map

| Port | Bind | Public? | Role |
| --- | --- | ---: | --- |
| `22` | all | Yes | SSH as `sitevault` |
| `80` | all | Yes | ACME + redirect |
| `443` | all | Yes | **Customer** HTTPS → Caddy → ScopeGuard on VPS |
| `8090` hosting-plane | `127.0.0.1` only | **No** | Deploy/manage API; Mac may SSH-tunnel for control |
| Storefront container port | `127.0.0.1` only | **No** | Proxied by Caddy on same VPS |
| Postgres / Mac brain | — | **No** | Not on VPS |

Optional Mac control tunnel (management only — **not** customer path):

```bash
ssh -N -L 18090:127.0.0.1:8090 revenueos-sitevault
export HOSTING_PLANE_URL=http://127.0.0.1:18090
export HOSTING_PLANE_TOKEN=<token>
```

Independence proof: stop the tunnel / disconnect Mac → `https://<disposable-host>/` must still return 200 from the VPS.

---

## Compose / process design (hosting only)

Overrides vs template (apply when SSH exists; **do not change RevenueOS core**):

| Setting | Value |
| --- | --- |
| `HOSTING_RUNTIME` | `docker` |
| `HOSTING_PLANE_BIND` | `127.0.0.1` |
| `HOSTING_PLANE_TOKEN` | long random (Mac + VPS) |
| `SUPABASE_*` | **omit** |
| Caddy | public `:80`/`:443`; reverse_proxy to **local** ScopeGuard port on the **same VPS** |
| Containers | `restart: unless-stopped` so reboot restores storefront without Mac |

Customer requests never leave the VPS after TLS termination.

---

## Deploy sequence (after A–E exist)

1. Bootstrap `sitevault` user + UFW + Docker.  
2. Sync code; start hosting-plane + Caddy on VPS.  
3. From Mac (optional tunnel): deploy **ScopeGuard only** with public `NEXT_PUBLIC_APP_URL=https://<host>`.  
4. `POST /domains/attach` for disposable host; confirm Caddy serves on VPS.  
5. Prove HTTPS, static, routes, refresh, APIs.  
6. Disconnect Mac / drop tunnel → site still up.  
7. Stripe webhook on disposable HTTPS URL.  
8. Restart hosting-plane, ScopeGuard, VPS; restart Mac Core → no duplicate execution; VPS not execution authority.  
9. **STOP** — do not migrate the active 50.

---

## Pass checklist (post-execution)

`SITEVAULT_LOCAL_PASS`, `SITEVAULT_PUBLIC_PASS`, `HTTPS_PASS`, `STATIC_ASSETS_PASS`, `ROUTES_PASS`, `DIRECT_REFRESH_PASS`, `API_PASS`, `STRIPE_WEBHOOK_PASS`, `HOSTING_RESTART_PASS`, `SCOPEGUARD_RESTART_PASS`, `REVENUEOS_RECONNECT_PASS`, `DUPLICATE_EXECUTION=0`, `PUBLIC_POSTGRES_EXPOSURE=false`, `PUBLIC_REVENUEOS_CONTROL_EXPOSURE=false`, `SUPABASE_RUNTIME_DEPENDENCY=0`, `VERCEL_HOSTING_DEPENDENCY_FOR_SCOPEGUARD=0`, `VERCEL_BRAIN_DEPENDENCY=0`, `CROSS_BUSINESS_STATE_CONTAMINATION=0`, `REVENUEOS_CORE_CHANGED=false`, plus **MAC_DISCONNECT_STOREFRONT_STILL_UP=true**.

## Hosting authority map (target)

```
RevenueOS Core (Mac)     → NATIVE     execute / ros_* / queue / deploy commands
Hosting control API      → VPS loopback :8090 (SSH for manage only)
Public edge + TLS        → VPS Caddy :443
ScopeGuard storefront    → VPS container (survives Mac disconnect)
Stripe webhooks          → VPS HTTPS
Active 50                → VERCEL (untouched)
```
