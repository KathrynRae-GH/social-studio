# Social Studio

A social media studio that lives as a tab inside every Boutiqly sub-account. For each shop, Claude captures the brand, designs on-brand posts, carousels, Stories and Reels, writes captions for every channel, plans the calendar, and sends approved posts out through Boutiqly's social planner.

Built by Claude in sessions with Katy. Private repository.

## Where to start

- **Katy:** `docs/setup-accounts.md`, then open this repo in Claude Code and paste the prompt from `FIRST-SESSION-PROMPT.md`.
- **Claude:** `CLAUDE.md`, then `docs/progress.md`.

## Map

| Path | What's there |
|---|---|
| `CLAUDE.md` | Standing instructions for every Claude session |
| `FIRST-SESSION-PROMPT.md` | The prompt for session 1, and a short one for later sessions |
| `docs/` | Scope, platform notes, build plan, decisions log, progress log, account setup |
| `brands/` | Seed material for Katy's brands (Boutiqly now, Make Space to come) |
| `reference/` | The prototype's code, data contract and Claude skills, read-only |
| `.env.example` | Names of the settings the app needs. Real values live in Render, never here |
| `server/` | The API and the server that hosts the tab (TypeScript, Fastify, Postgres migrations in `server/migrations`) |
| `web/` | The tab's screens (React). Every color is in `web/src/theme.ts` |
| `shared/` | Role rules used by both |
| `worker/` | The background worker (Python) |
| `render.yaml` | Render blueprint: web app, worker and database |

## Running it locally (for Claude or a developer)

```
npm install
DATABASE_URL=postgres://localhost/social_studio BOUTIQLY_SHARED_SECRET=dev-secret BOUTIQLY_APP_DOMAINS=http://localhost:5174 npm start
BOUTIQLY_SHARED_SECRET=dev-secret npm run dev-parent -w server   # a stand-in for Boutiqly on http://localhost:5174?as=agency|owner|staff|other
TEST_DATABASE_URL=postgres://localhost/social_studio_test npm test
```
