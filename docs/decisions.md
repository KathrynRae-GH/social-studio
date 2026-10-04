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

## Oct 3, 2026 (night): uploaded brand fonts

Katy:
- Shops can upload their own brand fonts (not every brand font is on Google Fonts).

Claude (technical):
- Font files are kept in our database (`brand_fonts`, 5 MB each), not in Boutiqly media storage, which is built for photos and videos. Files are checked by their first bytes (woff2, woff, ttf, otf only).
- Designs load uploaded fonts with `@font-face` from `fonts.render.local/<id>`. The worker answers those requests from the database, only for the job's own shop. The Google Fonts link only asks for families that aren't uploaded.
- The tab's Look sample shows the real font by fetching it with the sign-in pass and embedding it.
- Removing a font the approved look uses puts the look back to draft.
- Owners are reminded that their font license must allow use in social media images; we don't check licenses.

## Oct 3, 2026 (night): fresher designs

Katy:
- The first designs felt basic. She approved four changes, accepting that each design reply costs more (roughly 20–50¢ instead of 10–15¢):
  1. an inspiration board on Brand → Look (3–10 loved posts Claude studies)
  2. much stronger design guidance
  3. a required self-critique round
  4. more thinking time

Claude (technical):
- Inspiration posts are files with `purpose = 'inspiration'` (migration `0006`). They're never usable in designs, never tagged, and hidden from the Assets screen. Up to 10 per shop, managed by owners and Boutiqly's team.
- The board's images go into the first message of each new chat, so they're cached and later turns only append. An existing chat keeps the board it started with.
- The design guidance now covers composition, scale contrast, a graphic language drawn in code (shapes, stickers, squiggles, texture, color blocking, type and photo treatments), carousel rules, and a list of things that make a post look basic.
- After every render, Claude sees the frames. The first draft of each piece must be critiqued against a checklist and redesigned before Claude replies; at most three drafts per piece per reply.
- Ask Claude runs at effort "xhigh" (was "high").

## Oct 4, 2026: fast mode, and fixing "a map of colored squares"

Katy:
- Design replies felt slow; she chose **fast mode** (same model, up to ~2.5x faster writing, **2x the Claude cost**). She didn't pick the free speed-ups or an optional redesign round.

Claude (technical):
- Fast mode is sent on every call (`speed: "fast"`, beta `fast-mode-2026-02-01`) so the prompt cache stays valid. It's on unless `CLAUDE_FAST_MODE=off` is set in Render. If fast mode is busy (429), or doesn't combine with the request (a 400 about speed), the call retries once at normal speed.
- The ledger prices each call by the speed Anthropic reports it ran at (`usage_ledger.speed`, migration `0007`): fast doubles the token cost; web searches aren't doubled.
- Katy's first carousel after the design upgrade was a color-swatch test with no photos and no copy. Fixes:
  - Claude looks at untagged photos itself before listing files (up to 12 at a time). Photos uploaded while Claude was off had never been looked at, so none were usable.
  - The Assets screen offers "Have Claude look at them now" for untagged photos (up to 30).
  - A new piece is refused unless it has captions.
  - Claude's instructions now map every color variable to its color, forbid test, swatch or placeholder pieces, and set a working order: photos first, real copy, then the design.
  - Each tool call writes a one-line trace to the server log, so odd results can be diagnosed from Render's logs.

## Oct 4, 2026: variety, and captions for every network

Katy:
- Designs were on brand but too alike (same layout, graphics in the same places). Posts must vary a lot.
- When she asks for a post, Claude writes copy for **all** the networks that type of post can go to; the owner picks where to post.

Claude (technical):
- 17 layout families in `shared/design.ts` (type poster, full-bleed photo, split screen, collage, product grid, arch window, magazine cover, polaroid, quote card, big number, list, sticker sheet, ticket or tag, pattern, minimal, speech bubble, this-or-that). Every design names its family and its "motifs" (where the main graphics sit); both are stored on the piece.
- Each message to Claude lists the shop's 6 most recent designs (layout and motifs) and shows the first frame of the latest 3.
- A new piece can't reuse the layout family of the last 3 designs, unless Claude says the owner asked for it.
- After each save, Claude is told which channels still lack a caption, and is asked to fill them before it finishes.

## Oct 4, 2026: each post switches kind

Katy:
- A new post shouldn't look like the previous one unless she asks. For example, after a graphics-and-text post comes a full-bleed photo post.

Claude (technical):
- Layouts are grouped into three kinds: mostly graphics and type; one big photo; several photos.
- A new post must be a different kind from the last one, unless the owner asked for the same. If the shop has no usable photos, graphics-led posts are still allowed back to back.
- The existing rule that a post can't reuse the layout family of the last three still applies.

## Oct 4, 2026: love it / not this, and a side-by-side preview

Katy:
- Owners react to each post: 👍 Love it or 👎 Not this, with an optional "why". Claude reads the recent verdicts before every design, the way the prototype's skills learned from her notes.
- The large preview: no black bars. Slides on the left at their own shape, the caption for each channel on the right (stacked on a phone), settings underneath.
- Bringing general design craft over from the Mosaic skill was tried, then **undone** at Katy's request (too much of it is specific to Mosaic).

Claude (technical):
- `piece_feedback` table (migration `0008`). Each message to Claude lists the last 15 verdicts (loved, or not this, with the note, layout and motifs), plus Claude's recently archived pieces as "probably not wanted".

## Oct 4, 2026: Boutiqly communities removed (Katy)

- Katy asked to remove the "Boutiqly community" channel. It's gone from the channel list, the post editor, Claude's channels and the scope (`docs/scope.md`, `CLAUDE.md`). It can come back later as one entry in `shared/channels.ts`.

## Oct 4, 2026: connect the online store (Katy)

Katy:
- Owners connect their online store on Brand → Online store by typing its address. No login. Testers mostly use Shopify and Square.
- Product photos are copied into Assets and Claude can use them, after the usual check for people and private details.
- **Posts never mention prices**, even ones read from the store.
- Built before the rest of the queue (preview and approvals, then plan, lock and send, then comments).

Claude (technical):
- Shopify: the store's public `/products.json`. Square Online and others: the sitemap, then each product page's search-engine details (JSON-LD), or its sharing details (Open Graph). Prices are never stored.
- The server reads only public web addresses: no private or internal addresses (checked at connect time and on every redirect), 15-second time limit, size limits. Owner-typed addresses can't reach the server's own network.
- Tables `stores` and `products` (migration `0009`), plus `assets.product_id`.
- Reads happen on connect, on Refresh, and on their own every day (the hourly check re-reads stores not read for 20 hours). For other stores, only new or changed pages are re-read.
- A product counts as **new** if the store dates it within 14 days. Stores without dates: anything that appears after the first read.
- The main photo of up to 40 products is copied per read, newest first, with a cap of 300 per shop. When someone taps Connect or Refresh with Claude on, Claude looks at the new photos right away (about a cent each). Photos copied by the daily refresh are looked at the next time Claude needs them.
- Claude's new `list_products` tool returns names, links, type, description, new and in-stock flags, and the photo's asset id if it's usable. No prices.
- `design_piece` takes a `link`. It's saved only if it's a product link from the list or a page on the shop's own store.

## Oct 4, 2026: approve in the Library, plan, lock, send (Katy)

Katy:
- The large preview shows the captions once, on the right, where they can be edited. Approval happens right there.
- Owners tick the networks a post goes to when they approve it. Claude never picks networks.
- **Plan my calendar:** one click, and Claude puts every approved post on the calendar in a sensible order. The owner picks how far ahead: 4, 8 or 12 weeks. "Plan 4 more weeks after that" continues from the end of the current plan. Posts already on the calendar stay where they are.
- **Lock:** locked posts can't be moved, by anyone or by Claude's planning. There's a "Lock all planned" button too.
- **Send:** one click sends every locked post to Boutiqly's social planner as scheduled, and marks it Scheduled. Nothing goes twice without a person acting.
- While live posting is off for a shop, Send makes **drafts** in Boutiqly's social planner instead (drafts never post). Each draft goes once. Once live posting is on, the same button schedules for real.
- Build order: store connection, then this, then comments-to-edits.

Claude (technical):
- `pieces` gets `approved_at`, `approved_by`, `approved_by_name` and `approved_channels`. `calendar_entries` gets `locked_at` and `locked_by` (migration `0010`).
- Approving checks every ticked network the way sending will (photo present, caption length, and so on) and marks those captions final. Taking a network off removes its calendar spot unless it's locked or sent. Undo approval works only while nothing is locked or sent.
- Only approved posts go on the calendar, and only to approved networks. New entries start as `approved`, shown as "On calendar". The old per-entry Approve and the separate "Send as a draft" button are gone. Entries left over from before still show as Suggested, with a note to approve the post in the Library.
- Send runs under a per-shop lock. Planner post ids are saved as they come back, so a half-sent Story set only resends the missing frames.
- Plan my calendar is one Claude call (effort medium, structured output), metered as `plan_calendar`. It sees the approved post-and-network pairs not yet on the calendar, the last two weeks and everything ahead, the shop's notes and time zone. Every spot it returns is checked: it must be inside the window, at least 15 minutes from now, and an approved piece and network. Anything it doesn't place is listed with a reason.
- Claude can't change an approved post, and Ask Claude's "add to calendar" proposals only work for approved posts and their networks.
- Known gap: if a post was sent as a draft and is then unlocked and moved, the old draft stays in Boutiqly's social planner (delete it there). Sending a post that already went as a draft, once live posting is on, also leaves the draft there.

## Oct 4, 2026: Library tab first; Calendar opens on Month (Katy)

- Tabs go Library, Calendar, Assets, Ideas, Brand, and Social Studio opens on the Library. The Calendar opens on its Month view.

## Oct 4, 2026: comments on a post become Claude's edits (Katy)

Katy:
- Anyone on the team leaves comments on a post. "Send N comments to Claude" sends them all at once (one revision per batch).
- The edited post comes back as **Suggested**: its approval is cleared and its calendar spots are removed, even if they were locked. It needs approving again.
- The earlier version is kept. **Go back** restores it, and the current one is kept too.

Claude (technical):
- Tables `piece_comments` and `piece_versions`, plus `pieces.editing_started_at`, `edit_reply` and `edit_error` (migration `0011`).
- The edit runs in the background as an Ask Claude conversation (so it shows in the person's Ask Claude history). Claude is told to change only what the comments ask for, keep the layout unless told otherwise, and say in a sentence what it changed. The tab checks every 4 seconds and shows the new version when it's done.
- A post already scheduled or posted in Boutiqly's social planner can't be edited here: delete it there first. If Claude fails, the comments stay open to send again.
- One edit per post at a time. An edit that never finished (a server restart) stops blocking after 20 minutes.

## Oct 4, 2026: every color for everything, with up to 3 primary (Katy)

Katy:
- Colors no longer have jobs (background, text, accent, highlight). Claude uses every color in all kinds of mixes, always with good contrast. Owners tick up to 3 **primary** colors, the ones that lead most posts.
- The Calendar views go Month (opens first), List, Instagram grid, then **Schedule it** (what used to be "This week").

Claude (technical):
- `StyleColor` loses `role` (old saved sets keep it, but it's ignored) and gains `primary`. The server refuses more than 3 primaries.
- The engine still sets a page color and a text color (the lightest color, and the most readable color on it, or near-black/white if none reads well). `--brand-accent` and `--brand-highlight` now come from the primaries first, so older designs keep rendering. New variables `--brand-primary-1..3`.
- Claude's instructions list every color (with PRIMARY marked) and a readable-pairs table worked out with WCAG contrast: 4.5:1 for body text, 3:1 for big headings, with white and black included. Claude is told every color can be used anywhere, to vary which color leads, to give a primary a prominent place in every post, and to put text only on readable pairs.
- Ticking primaries changes the look, so it needs approving again, like any other change to the look.

## Oct 4, 2026: Library and Assets tiles are no longer buttons (technical)

- The first fix for the white bar above some Library pictures (flex layout on the button) didn't hold in Katy's browser. Buttons center their content, and some browsers (Safari especially) ignore layout styles on buttons. Tiles are now plain blocks with `role="button"`. They still open on click, Enter or Space, and show a green focus ring.

## Oct 4, 2026: Ask Claude never goes silent, finishes big requests, runs faster

Katy asked for several Story posts and got no answer at all. Three things could do that, and all three are fixed.

Claude (technical):
- **Step limit:** one reply can now take 40 Claude steps (was 14; about 3 per piece). If it still runs out, or an error stops it, the chat gets a closing note ("I ran out of steps… say 'keep going'"), saved in the conversation. Spend is still capped by the shop's monthly limit.
- **Cut off by an update:**
  - When a chat's last saved message still waits for Claude (the app restarted mid-reply), it reports `interrupted`. The panel then shows "Claude was interrupted… Continue".
  - On the next message, unanswered tool calls get an "interrupted" result and a short note closes Claude's turn, so the conversation stays valid.
- **Updates wait for replies:** on SIGTERM the server waits up to 4.5 minutes for Ask replies in progress before shutting down. `render.yaml` sets `maxShutdownDelaySeconds: 300`.
- **Panel:**
  - Follows a reply in progress for up to 30 minutes (was 8), and shows the step and the minutes so far.
  - Says so if it's still going after that, instead of stopping quietly.
- **Faster:**
  - At most 2 drafts per piece (draft 1 always gets one critique and redraw, then it's final). The third optional round is gone.
  - After each draft Claude sees the first 3 frames as pictures; the rest are listed by id, which it can open if needed.
  - Several pieces are made one at a time, with a one-line progress note after each.
- Reopened chats no longer show Claude's hidden notes (the owner's verdicts and the recent designs) as if the owner had typed them.
