# Build plan

Milestones in order. Each ends with something Katy can open and try. Dates are the Oct 3 estimate (see `docs/scope.md`); update this file when they move and say why in `docs/progress.md`.

## M0. Accounts and skeleton (Oct 5 – Oct 9)

- Katy: GitHub repo, Boutiqly developer account and private app, Render, Claude API key, test sub-account (`docs/setup-accounts.md`).
- Claude: confirm the stack and repo layout (log it in `docs/decisions.md`), scaffold the web app, API, worker and database, `render.yaml`, a health page, tests running in CI.
- **Done when:** the health page loads on Render from `main`.

## M1. The tab inside Boutiqly (Oct 12 – Oct 16)

- Custom page registered and installed for the test sub-account; loads inside Boutiqly.
- Signed user context verified server-side; roles worked out: Boutiqly team (agency user), account owner, designated team member, no access.
- Database: brands, users, Team list, audit log. One brand per sub-account, keyed by brand.
- The Boutiqly-look shell: Calendar, Library, Assets, Ideas, Brand and the Ask Claude panel (empty states), theme file, phone width.
- Check whether the tab shows in the LeadConnector phone app; write down what happens.
- **Done when:** Katy opens the tab in the test sub-account and sees her name and role, and a non-team user sees the request-access screen.

## M2. Library, Calendar and posting to every channel (Oct 19 – Nov 6)

- Port the prototype's data model (`reference/studio-template/guide.md`): pieces, captions, calendar entries, ideas and shots, events, assets. Threads drafts become a Library type. Statuses: Suggested → Approved → Scheduled → Posted.
- Read the sub-account's connected accounts from Boutiqly's social planner; per-channel caption rules and sizes.
- Approve → upload media to Boutiqly media storage → create the planner post: direct publish, app ping with note (Instagram Reels and Stories, one ping per Story frame), ready-to-post packs for TikTok and channels beyond Boutiqly.
- Status sync back from the planner; reconnect notices.
- **Done when:** a test post, a test Story set (app pings) and a test text post go out from the test sub-account, then Make Space moves in and its upcoming posts run through the app.

## M3. Posts, Stories, Assets and Ask Claude (Oct 26 – Nov 20)

- Worker and jobs table; HTML/CSS/SVG rendering through headless Chromium at every channel's size; carousels and Story sets.
- Style sets as data on the unbranded engine; Make Space's set ported first; the default Boutiqly fallback look (palette and type only, no logo).
- Assets: upload and pick from media storage, Claude tagging, people rules, sensitive-details flags with crop/blur.
- Ask Claude on Opus 5.5: tools for the library, calendar, design and render, web search, images; one-tap apply.
- Usage ledger: every Claude call metered per job, user and sub-account.
- **Done when:** Katy asks Ask Claude for a carousel in Make Space's look, gets it rendered in the tab, edits it in chat, and approves it to the calendar.

## M4. Reels (Nov 9 – Dec 4)

- Video rendering with ffmpeg on the worker; Make Space's 16 Reel styles ported as unbranded structures plus Make Space's set; silent audio track; posters; Shorts.
- Preview player in the tab; "change this" re-renders.
- **Done when:** server renders of Make Space's Reels match or beat today's, side by side.

## M5. Brand capture, onboarding and Team (Nov 23 – Dec 11)

- Owner drops in website and social links and uploads; Claude scans them; brand board to approve; short questions; brand doc; style set with sample renders; content pillars and a six-week plan with two weeks filled.
- Weekly run on a set day (a button first), filling the coming week up to targets.
- Team list management for owners.
- Boutiqly onboarded as the second brand (`brands/boutiqly/`).
- **Done when:** Katy approves Boutiqly's brand board and style set, and its first two weeks are ready for review.

## M6. Wallet billing and usage limits (Dec 7 – Dec 11)

- Studio credit meter; charge per job with an idempotent event id; funds check before big jobs; monthly limit or unlimited per brand; usage view in the tab; off / test / live switch.
- **Done when:** a test charge lands in the test sub-account's wallet at 2x, and a brand at its limit sees Claude work pause with a clear message.

## M7. Security review, then client testing (Dec 14 – Dec 21)

- A human developer reviews auth, user-context checks, data isolation, token storage and billing.
- Fix what they find; error pages and logs.
- **Done when:** Bella and Brawn and Blue Bare are invited (around Dec 21), with Boutiqly covering their first round of credits.
