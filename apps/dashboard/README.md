# Owner dashboard

Next.js 15 app that pairs with the persistent operator + browser
sidecar. Solo owner UI — passkey/token cookie auth, no user management.

## Pages

| Route                     | What                                     |
| ------------------------- | ---------------------------------------- |
| `/`                       | Portfolio overview                       |
| `/queue`                  | Pending drafts (approve → publish)       |
| `/channels/[business]`    | Durable channel registry viewer          |
| `/leads/[business]`       | Buyer leads with reach method            |
| `/logs`                   | Live SSE stream of operator pursuit events |

## Local dev

```bash
cd apps/dashboard
cp .env.example .env.local
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_TOKEN
npm install
npm run dev
```

Then visit `http://localhost:3030` and log in with the token from
`.env.local`.

## Auth

Single-owner: set `DASHBOARD_TOKEN=…` in `.env.local`. Visit
`/login`, paste the token, and every subsequent request is
authenticated via a signed cookie. Leave `DASHBOARD_TOKEN` unset in
development to skip auth entirely.

## Data

Everything the dashboard reads comes from the same Supabase tables the
operator writes to. If Supabase isn't configured pages render empty
states rather than crashing — the dashboard degrades gracefully.
