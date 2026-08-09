# RevenueOS (Devvit)

In-Reddit app for the RevenueOS portfolio. Built on Reddit’s Developer Platform (Devvit) using the React template.

**What this is:** an immersive post experience + moderator tools that run *inside* subreddits that install the app.

**What this is not:** a cross-subreddit OAuth bot. Devvit only runs where the app is installed. Portfolio acquisition across third-party subs still uses Resend email outreach and (if Reddit ever grants Data API write access) the external Reddit executor.

## Requirements

- Node.js **22.2+** (this machine: use `nvm use 22`)
- Reddit account connected via `npx create-devvit` / `npm run login`
- Auth token at `~/.devvit/token`

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Playtest on your auto-created `_dev` community |
| `npm run build` | Build client + server |
| `npm run deploy` | Upload a new version (`devvit upload`) |
| `npm run launch` | Upload + submit for Reddit review (`devvit publish`) |
| `npm run login` | Re-auth CLI |

## Playtest

```bash
nvm use 22
cd revenueos
npm run dev
```

Open the printed URL (refresh after code changes). Click **Launch App** on the post.

To pin playtest to a specific subreddit you moderate:

```json
"dev": "devvit playtest r/YOUR_SUBREDDIT"
```

## Launch / review

When ready for public install (subs > 200 members require review):

```bash
npm run launch
```

Optionally bump version:

```bash
npx devvit publish --bump patch
```

Reddit emails when approved. Apps start **unlisted** until you choose otherwise.

## App review notes (for Reddit reviewers)

- **Purpose:** Help portfolio product communities surface buying-intent questions and draft genuinely useful replies (9:1 rule — help first, soft product mention only when the product *is* the answer).
- **Permissions:** Standard Devvit post + menu + install trigger. No ads. No scraping outside installed communities.
- **Example post:** Playtest post created by `npm run dev`.
- **Contact:** Portfolio owner via Reddit Modmail / app listing email.

## Monorepo note

This folder lives inside the TributeReady / RevenueOS monorepo. External acquisition logic remains in `packages/revenueos` (email outreach, strategist, etc.). This Devvit app is the Reddit-native surface.
