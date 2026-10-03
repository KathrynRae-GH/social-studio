# Decisions log

Newest at the bottom. Add a line whenever something is decided, with the date and who decided. Scope decisions are Katy's; technical ones can be Claude's (say so).

## Oct 3, 2026: scope session (Katy)

- Build Social Studio as a private Boutiqly marketplace app: a tab in every sub-account, posting through Boutiqly's social planner. A human developer reviews security before paying clients connect.
- Always call the platform "Boutiqly" in the app, docs and conversation; never the vendor's name or abbreviation. Platform features get Boutiqly or plain names ("app ping").
- v1 makes everything the Make Space prototype makes, including full Reels, plus pins, Shorts, video titles and thumbnails, and Google updates.
- Channels: every channel Boutiqly's social planner posts to, plus ready-to-post packs for channels beyond it (X and others).
- Users: account owners, team members they designate, and Boutiqly's agency team; all can approve. Boutiqly's team sees everything on every brand for now (when to narrow it is left open).
- Onboarding starts with brand capture (website, linked socials, uploaded templates, loved posts, brand files) and a brand board the owner approves before anything else is made.
- A custom style set for every brand. All posts and Reels are on brand for their own sub-account; never Make Space branding anywhere else. Fallback: very basic Boutiqly palette and type, no logo.
- All Claude work in the app runs on Claude Opus 5.5 or newer. Ask Claude gets its full capabilities: strong design, no limit on what it can make.
- Assets: a people rule and a sensitive-details check (receipts, emails, phone numbers, addresses, customer names, payment details, customer-data screens, swear words, license plates) on every file.
- Screens: Calendar, Library, Assets, Ideas, Brand, plus Ask Claude on every screen. "Locked" becomes "Approved". Boutiqly look.
- Pricing: no monthly fee; Social Studio is part of every Boutiqly plan. Usage billed to the sub-account's wallet as Studio credits at 2x Claude cost. Each brand picks a monthly limit or unlimited. Done For You setup is part of white glove (always one price, includes everything in the plan).
- One brand per sub-account in v1. Name: Social Studio.
- Testing: Katy's brands first, then Bella and Brawn and Blue Bare, as soon as it's ready; Boutiqly covers the first round's credits.

## Oct 3, 2026: session 1

Katy:
- Stack and repo layout below: proposed by Claude, OK'd by Katy.
- The worker is set up from Milestone 0 (all three Render pieces from day one, about $40/mo), not deferred to M3.
- **Account owner is named by Boutiqly's team.** Nobody becomes owner automatically (replaces "the first admin to open the tab"). Until an owner is named, only Boutiqly's team can use a brand's tab. Owners can then make other owners.

Claude (technical):
- **Tab and API:** TypeScript on Node 22. React + Vite for the tab; Fastify for the API. The API server also serves the tab's built files, so it's one Render web service.
- **Database:** Postgres on Render, Drizzle ORM, plain SQL migration files in `server/migrations/` (the Python worker reads the same tables).
- **Jobs:** a `jobs` table in Postgres, claimed with `FOR UPDATE SKIP LOCKED`. No separate queue service.
- **Worker:** Python 3.11, so Make Space's Python/ffmpeg engine is ported, not rewritten. Playwright for HTML-to-image renders (M3).
- **Sharing code:** web and server share TypeScript in `shared/`; the worker and server share only the database (tables and the jobs contract).
- **Repo layout:** npm workspaces `server/`, `web/`, `shared/`; Python in `worker/`; `render.yaml` blueprint at the root; CI in GitHub Actions (typecheck, tests, build, worker tests).
- **Login inside the tab:** browsers block cookies inside an embedded page, so after the server verifies Boutiqly's user context it hands the page a short-lived signed session token, sent as a header on each request. No cookies.
- **Tests:** Vitest for TypeScript, pytest for the worker.
- **Server runs TypeScript directly** with Node 22's built-in type stripping: no separate build step for the server; only the tab is built (Vite).
- **Only Boutiqly may show the tab** (CSP `frame-ancestors`): the platform's app domains are built in; Boutiqly's white-label domain goes in `BOUTIQLY_APP_DOMAINS` in Render.
- **Getting on the Team list:** anyone without access sees a request-access screen with an "Ask for access" button. Requests show on the Brand screen's Team panel, where Boutiqly's team (or an owner, once there is one) makes them an owner or team member. Only people who have opened the tab can be added, because that's how the app knows them without extra Boutiqly permissions. The last owner can't remove themselves.
- **Install tokens** are encrypted with AES-256-GCM (`TOKEN_ENCRYPTION_KEY`) and refreshed five minutes before they expire.
- **Render region:** Ohio for all three pieces (closest to Dallas and to the platform's US servers).
- **Worker health:** the worker writes a heartbeat every 30 seconds; the health page shows it. A quiet worker doesn't fail the web service's health check, so Render won't restart the tab over a worker problem.
- **Agency admins set up each shop (Katy, Oct 3).** Boutiqly's team (and owners) pick people for the Team list from the sub-account's own Boutiqly users, read live with the install token; the server re-checks with Boutiqly before adding anyone. People no longer have to open the tab first. "Ask for access" stays for staff who open it before being added. Someone who only asked in a different sub-account can't be added here.
- **Set up this shop checklist** on the Calendar for Boutiqly's team and owners: name the owner (live now), capture the brand and connect social accounts (shown as "Coming soon" until built).
- **Shop name** is read from Boutiqly the first time the tab opens in a sub-account and saved.
- Girl Riot Society is Katy's own; fine for the tab to show there during the build.
- **Agency admins can be named on a shop's Team list (Katy, Oct 3)**, including as its owner, for example for Katy's own brands and white-glove clients. "Add someone" lists the sub-account's users plus Boutiqly's agency people who have opened Social Studio. Their access doesn't change: agency people keep full access to every shop for now.

