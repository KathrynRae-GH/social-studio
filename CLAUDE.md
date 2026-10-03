# Social Studio: standing instructions for Claude

Read this at the start of every session. It's the brief for building Social Studio, and it outranks anything in `reference/`.

## What we're building

Social Studio is a social media studio that lives as a tab inside every Boutiqly sub-account. It's a private app installed under the Boutiqly agency and shown in each sub-account's left menu as a custom page. For each shop (one brand per sub-account), Claude captures the brand, designs on-brand posts, carousels, Stories and Reels, writes captions for every channel, plans the calendar, and sends approved posts out through Boutiqly's social planner.

The working prototype is the Make Space Content Library, a single-brand Claude artifact (`reference/`). We're rebuilding it as a real multi-brand app.

| Doc | What's in it |
|---|---|
| `docs/scope.md` | The v1 scope Katy approved on Oct 3, 2026. Source of truth. |
| `docs/platform-notes.md` | What Boutiqly's platform allows, what it doesn't, and what we learned posting for real. Developer doc links. |
| `docs/build-plan.md` | Milestones, what "done" means for each, and the estimate. |
| `docs/decisions.md` | Every decision with its date. Add to it. |
| `docs/progress.md` | Session log. Read the last entry first; add one at the end of every session. |
| `docs/setup-accounts.md` | The accounts Katy sets up, step by step. |
| `brands/` | Seed material for the first brands (Boutiqly now; Make Space to come). |
| `reference/` | The prototype's code, data contract and the two Claude skills it ran on. Read-only reference. |

The live scope doc is https://claude.ai/artifact/2oicwCLTDcf5x4SgQJSwJe (private to Katy's account; `docs/scope.md` is the copy you can read).

## Who you're working with

Katy Schilthuis, Boutiqly's cofounder and CEO. She owns the accounts, keys, hosting and billing, and she does the testing. She is not a developer, and she moves fast.

- Say in plain language what you're about to do and what changed. Skip jargon or explain it in a few words.
- When she has to do something (click through a dashboard, paste a value into Render), give exact, copy-paste-ready steps, one account at a time.
- Give bad news plainly and early. Flag risks before proposing fixes. Put flags after the work, not woven through it.
- Simplicity wins: fewer steps, fewer screens, fewer tools.
- Decisions that change what a shop owner sees, what something costs, or the scope are hers: ask with clear options and your recommendation first. Technical choices that don't change any of that are yours: make the call and log it in `docs/decisions.md`.
- She'll often correct or add context mid-stream. Fold it in and update the docs.

## Naming rule: always "Boutiqly"

Boutiqly is a white-labeled version of a larger platform. In everything people see or read, call the platform **Boutiqly**: app screens, error messages, docs, commit messages, pull requests, and conversation with Katy. Never write the vendor's name or its abbreviation.

- Platform features: "Boutiqly's social planner", "Boutiqly media storage", "the Boutiqly wallet", "the Boutiqly developer account", "the Boutiqly phone app" (today that's the LeadConnector app), and "app ping" for a push-notification post.
- In code, name things neutrally: `boutiqly`, `planner`, `platform` (for example `boutiqlyClient`, `BOUTIQLY_CLIENT_ID`). The vendor's name may appear only where it can't be avoided: API base URLs, SDK package names, and links to its developer docs.
- The platform's API calls a sub-account a "location" (`locationId`) and the agency a "company" (`companyId`). Use those names in code that talks to the API; say "sub-account" and "agency" everywhere else.
- Files in `reference/` were written before this rule and use the old name. Don't carry it into anything new.

## Decisions that shape everything

Full detail in `docs/scope.md` and `docs/decisions.md`.

- **One brand per sub-account** in v1. Key every table by brand so a second brand per sub-account can come later.
- **Channels:** everything Boutiqly's social planner posts to (Instagram, Facebook, Threads, LinkedIn, TikTok, YouTube, Pinterest, Google Business Profile, Bluesky, Boutiqly communities). Channels beyond it (X, Nextdoor, Snapchat, Substack, any the owner adds) get ready-to-post packs.
- **What Claude makes, all in v1:** posts, carousels, Stories, Story sets, Reels (full Reels), text posts, pins, Shorts, video titles and thumbnails, Google updates, captions for every channel, alt text, the posting plan, ideas.
- **On brand, always.** Every piece uses only its own sub-account's style set, photos and logo. Never another brand's look: Make Space's branding appears only on Make Space's posts. Fallback before a brand board is approved (or where a set has a gap): a very basic Boutiqly look, meaning the Boutiqly palette, Montserrat and plain layouts, with **no Boutiqly logo**.
- **Onboarding starts with brand capture:** Claude scans the website, the social accounts the owner links, and the templates, loved posts and brand files they upload, then shows a brand board. Nothing else gets made until the owner approves it.
- **Custom style set for every brand**, stored as data on one shared, unbranded engine. A fix to the engine reaches every brand.
- **Claude in the app runs on Claude Opus 5.5 (`claude-opus-5-5`) or newer** for all work: captions, tagging, design, Ask Claude. The model is a config value, never hard-coded. Ask Claude gets its full capabilities: strong design, and no limit on what kinds of things it can make.
- **Access:** account owners plus team members they designate (both can approve); Boutiqly's agency users see and do everything on every brand for now, with every change logged under their name. Everyone else in the sub-account sees a request-access screen.
- **Pricing:** no monthly fee; Social Studio is part of every Boutiqly plan. Every Claude job is metered and billed to the sub-account's Boutiqly wallet as Studio credits at 2x Claude cost (1 credit = 1 cent of Claude cost). Each brand chooses a monthly limit or unlimited; Claude work pauses at the limit. Boutiqly covers the first testers' credits.
- **Statuses:** Suggested → Approved → Scheduled → Posted ("Locked" in the prototype is now "Approved").
- **Testers:** Katy's brands first (Make Space, then Boutiqly), then Bella and Brawn and Blue Bare. Test as soon as it's ready; roll out as fast as testing allows.

## Architecture (starting point; confirm or change in session 1)

| Part | Job | Runs on |
|---|---|---|
| Tab (web app) | Calendar, Library, Assets, Ideas and Brand screens plus the Ask Claude panel, embedded in Boutiqly as a custom page (iframe) | Render web service |
| API server | Verifies who's looking (Boutiqly's signed user context) on every request; each sub-account's data; Boutiqly API calls (social planner accounts and posts, media upload, wallet charges); Claude calls and metering | Same Render service |
| Database | Brands, users and roles, asset index, pieces, captions, calendar, ideas, style sets, usage ledger, jobs | Render Postgres |
| Files | Uploads and rendered media | Each sub-account's Boutiqly media storage (a Social Studio folder). The worker keeps temp files only. |
| Worker | Renders images (HTML/CSS/SVG through headless Chromium), carousels, Stories and every channel size; Reels with ffmpeg; long Claude jobs | Render background worker (Standard, 2 GB) |
| Claude | Brand capture, style sets, captions, weekly run, Ask Claude, asset tagging | Claude API, Opus 5.5 or newer |

Starting proposal for the stack, to confirm with reasons in session 1: TypeScript for the web app and API; Postgres with a typed ORM and migrations; a jobs table in Postgres instead of a separate queue service; a Python worker so the existing content engine (Python and ffmpeg) can be ported rather than rewritten, plus Playwright for HTML-to-image renders. Infrastructure as code in a `render.yaml` blueprint. Start from the platform's official marketplace app template if it fits (see `docs/platform-notes.md`).

## How every session runs

1. **Start:** read the last entry in `docs/progress.md` and the current milestone in `docs/build-plan.md`. Tell Katy in two or three lines where things stand and what this session will do.
2. **Plan first** for anything bigger than a small fix: the steps, the files, and anything Katy must do. Wait for her OK when it changes what she sees or costs money.
3. **Small working steps:** build, run the tests, run the app and look at it in a browser where you can, then commit with a plain-English message.
4. **Branches:** one branch per milestone, with a pull request into `main` for Katy to merge. `main` is what Render deploys.
5. **End:** add a dated entry to `docs/progress.md` (done, next, waiting on Katy). Log new decisions in `docs/decisions.md`. If scope changed, Katy agreed first, then update `docs/scope.md`. Commit.

## Safety rules (never break these)

- **Real accounts:** never post, schedule, delete or change anything on a real social account or in a real sub-account without Katy's explicit yes for that specific action. Develop against the test sub-account (see `docs/setup-accounts.md`).
- **Secrets** (API keys, client secrets, tokens, the shared secret for user context) never go in chat, code, commits or logs. They live in Render's environment settings. `.env.example` lists names only. If a secret is ever pasted into chat, tell Katy to rotate it.
- **Isolation:** verify Boutiqly's user context server-side on every request and never trust sub-account or user IDs sent by the browser. Scope every query to one sub-account, except agency views. Store Boutiqly OAuth tokens encrypted.
- **Money:** never charge a wallet without a matching usage record. One charge per job, with an idempotent event id. Check funds before a big job. Respect the brand's monthly limit. Billing has an off / test / live switch and starts off.
- **Content:** respect each file's people rule; never show the face of anyone under 18; flagged sensitive details (receipts, emails, phone numbers, addresses, customer names, payment details, screens with customer data, swear words, license plates) are never used unless the owner cleared them; no AI-generated people or faces; no invented facts, prices, dates, quotes or stats; licensed stock is never presented as a customer; Claude never marks anything Approved or Final for the owner.

## The tab's look

The Boutiqly look, with every color in one theme file so a public version can switch to a neutral theme later.

- Page Cream `#fbf8f3`; white cards with `#e8eeeb` borders; text Deep Forest `#1d3c34`; secondary text Muted `#5b6f69`.
- Orange `#de771f` only on main action buttons (Approve, Schedule), with white bold text at 18px or larger; it's too light for small text on white or cream. Secondary buttons: Deep Forest outline; hover fills Green `#276f3d`. Links: Green.
- Status chips: Suggested on Pale Mint `#c4e5e2`, Approved on Sage `#99cc99`, Scheduled on Light Blue `#a1cfd6`, Posted on Deep Forest with white text, Needs attention on Pink `#e9c0d1`.
- Montserrat throughout (Proxima Nova isn't on Google Fonts).
- Works at phone width.
- Copy follows Boutiqly's voice: plain, warm, specific. Never use: empower, thrive, streamline, seamless, elevate, unlock, solution, operating system, flexible plans, unique needs.

## Claude inside the app

- Model id from config (`CLAUDE_MODEL`, default `claude-opus-5-5`). Keep the per-model price table in config too, so credits follow the real cost when the model changes.
- Meter every call: input, output and cache tokens, web searches, the resulting cost and credits, per job, per user and per sub-account.
- Cache each brand's brand doc and style set in prompts; they're re-read on almost every call.
- Ask Claude's tools: search the library, read the calendar, propose changes the owner applies with one tap, design and render any piece, look things up on the web, look at images.
- Designs use the brand's own photos and graphics drawn in code. Claude never generates photos of people.
- Price reference as of Oct 2026, to re-check against Anthropic's pricing page: Opus 5.5 $4 per million input tokens, $20 per million output tokens, $0.20 per million cache-hit tokens; web search $10 per 1,000 searches.
