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

## Oct 3, 2026: Milestone 2 (Katy's answers, then Claude's technical calls)

Katy:
- Claude builds a whole milestone in one go, asks the milestone's questions up front, and merges its own pull requests once the checks pass. Still always asks before anything posts, charges, deletes or costs money.
- Until Claude designs posts (M3), posts get into the Library by the owner uploading finished files and writing captions. No import of the Make Space prototype.
- **Approve sends it to Boutiqly right away** (no separate Schedule click).
- Calendar has This week, List (six weeks), Month and the Instagram grid preview now.

Claude (technical):
- **Live posting switch per shop, off by default.** Only Boutiqly's team can turn it on (logged). While off, Approve sends nothing and shows exactly what it would send. This is how "never post without Katy's yes" is enforced in code.
- **Routes** (one table in `shared/channels.ts`): Instagram feed posts and carousels, Facebook, Threads, LinkedIn, Bluesky, communities, Google and YouTube Shorts are published by Boutiqly; Instagram Reels, Stories and Story sets go as app pings (`instagramPostDetails.publishViaPushNotification`, one ping per Story frame a minute apart, note "Frame N of M" plus the caption); the Facebook copy of a Reel is a "share from Instagram" reminder; TikTok, X, Pinterest (until board picking) and any channel not connected in Boutiqly become ready-to-post packs.
- **Packs**: a zip with the files in order and `POSTING SHEET.txt` (channel, local date and time, caption, alt text, link). The owner marks them Posted.
- **Sending once**: each planner post id is saved as it comes back, so retrying a half-sent Story set only sends the missing frames; a database lock stops double clicks.
- **Status sync** from Boutiqly runs when the Calendar opens (at most every 2 minutes per shop): published or ping sent → Posted; failed or deleted → Needs attention.
- **Times**: the shop's IANA time zone comes from its Boutiqly location; times are entered and shown in it and stored and sent in UTC.
- **Uploads** go straight into a "Social Studio" folder in the shop's Boutiqly media storage (100 MB per file); the database keeps only the address.
- **This week** on the Calendar is a rolling seven days from today, so posts coming up always show.


## Oct 3, 2026 (later): drafts and branding

Katy:
- **Test the connection with drafts.** A "Send to Boutiqly as a draft" button on Calendar entries that Boutiqly posts (or pings) creates the post in the shop's Boutiqly social planner as a draft. Drafts never publish, so it works with Live posting off. Katy OK'd drafts in Girl Riot Society when she clicks the button.
- **Each shop keeps its own look** (as in the scope). Style sets come from each shop's approved brand board, with the basic Boutiqly look (no logo) until then. **No port of the Make Space prototype's content engine or brand docs**, so Katy doesn't need to send them. Milestone 3 and 4 plans updated to match.

Claude (technical):
- Draft ids are stored apart from real post ids (`planner_draft_ids`), one per Story frame, saved as they come back so a retry only sends the missing frames. Sending a draft never changes the entry's status or blocks Approve.
- When Boutiqly refuses a post, the server log keeps its reply (trimmed, never our token), so a wrong field can be fixed from Render's logs.

## Oct 3, 2026: Milestone 3 (Katy's answers, then Claude's technical calls)

Katy:
- Start Milestone 3 now; real-post tests can happen alongside.
- **Spend guard until wallet billing (Milestone 6):** each shop has a "Claude on" switch, off by default, that only Boutiqly's team can flip, plus a monthly limit of **$20 of Claude cost** by default (changeable per shop). Every call is metered from day one.
- **A simple Look editor now** (logo, colors, two Google fonts, vibe and dos/don'ts) so test shops get their own look in Milestone 3; brand capture (Milestone 5) will fill the same editor.

Claude (technical):
- **One door to Claude** (`server/src/claude/client.ts`): checks the switch and the limit before each call, uses `CLAUDE_MODEL` (default `claude-opus-5-5`) with adaptive thinking, and writes a `usage_ledger` row per call with input, output, cache-read and cache-write tokens, web searches, cost in cents and credits (2x). Prices live in `server/src/config.ts`; a model missing from the table is priced at the highest rate we know. The month for the limit is the calendar month in UTC.
- **Refusal fallback on:** if a safety check declines a request, Anthropic re-runs it on a fallback model in the same call (`fallbacks: "default"`); that run is metered at its own model's rates.
- **Prompt caching:** the system prompt (rules, design guide, channels, the shop's look) and the conversation so far are cached, so each new message mostly re-reads from cache.
- **Ask Claude runs in the web service** with tools: search the library, read the calendar, list files, look at an image, design a piece, propose a change, and web search (up to 5 per reply). Replies stream to the tab. Conversations are saved whole and only ever appended to, and each person sees only their own chats.
- **What Claude can't do, in code (not only in its instructions):** use a file that's untagged, marked Don't use, possibly showing someone under 18, or flagged with private details (until the owner clears it or makes a blurred copy); use another shop's files or look; use an unapproved look (it gets the basic Boutiqly look instead); change a piece that's already approved or scheduled; mark a caption Final; change the calendar (it proposes; a person taps Apply).
- **Designs are HTML/CSS/SVG per frame** on one shared engine (`shared/design.ts`). The shop's look arrives only as CSS variables, fonts and the logo. Scripts and outside links are stripped.
- **Rendering happens in the worker** with headless Chromium. Page scripts are blocked, every request is refused except the shop's own media addresses and Google Fonts (which the worker fetches itself, with a time limit), and each wait has a time limit. Rendered PNGs go into the shop's Boutiqly media storage and onto the piece.
- **The worker now runs as a Docker image** (Microsoft's Playwright image, `worker/Dockerfile`) so Chromium's system libraries are there. Same service, plan and price; `render.yaml` switches its runtime in place. It only takes job kinds it can handle.
- **Assets:** Claude tags each photo on upload while Claude is on (description, tags, people, possible minor, private details with boxes). A blurred copy is made by the worker (pixelate and blur) as a new file; the original stays as it was.
