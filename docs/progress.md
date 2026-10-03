# Progress log

Newest entry at the top. Every session ends by adding one: what got done, what's next, and anything waiting on Katy.

## Oct 3, 2026 (late night): uploaded brand fonts

- Katy tested Milestone 3 and found her brand fonts didn't show (they aren't Google Fonts).
- Done: Brand → Look → "Upload a font" (.woff2, .woff, .ttf, .otf), with a name, weight and italic for each file. Uploaded fonts appear in the font pickers, the Look sample, Claude's instructions and the rendered posts. 113 automated tests (99 server, 2 web, 12 worker), and a click-through where Claude's carousel rendered in an uploaded font.
- Next: Katy uploads Girl Riot's fonts (each weight as its own file, same name), picks them as heading/body, re-approves the look, and asks Claude for a post.

## Oct 3, 2026 (night): Milestone 3 built (Claude designs posts)

- Done:
  - Katy's **draft test in Girl Riot Society worked**: upload to Boutiqly media storage and a draft in the social planner. Milestone 2's plumbing is real.
  - **Claude switch and monthly limit** on the Brand screen (Boutiqly team only; off by default; $20 limit). Every Claude call is metered: tokens, web searches, cost and credits, per shop, person and purpose. Claude pauses at the limit with a plain message.
  - **Look editor** on the Brand screen: colors with their use, two Google fonts, logo, vibe, dos and don'ts, and a live sample tile. The owner approves it; until then Claude uses the basic Boutiqly look with no logo.
  - **Assets screen**: upload, filters (Claude can use, Needs a look, Not tagged, Finished designs), Claude's description and tags, people rule (use freely, no faces, don't use), flagged private details shown as boxes, "make a blurred copy", and clearing flags.
  - **Ask Claude panel**: a real chat that streams. Claude reads the library, calendar and files, looks at images, searches the web, designs and renders posts, carousels and Stories in the shop's look (they land in the Library as Suggested with draft captions), and proposes calendar or caption changes the owner applies with one tap. Shows what each reply cost.
  - **Rendering**: the worker turns designs into exact-size PNGs with headless Chromium, locked down (no scripts, no outside requests), and saves them in the shop's media storage. The worker moves to a Docker image to have Chromium.
  - 108 automated tests (96 server, 2 web, 10 worker). The whole flow was clicked through in a browser with the real renderer and a scripted stand-in for Claude. The real Claude API was **not** called from here (the key lives only in Render).
- Next: merge, then Katy checks the worker redeployed as Docker and the health page, turns Claude on for Girl Riot, sets and approves its look, uploads a few photos, and asks for a carousel. Then: change it in chat, Apply the calendar proposal, send it as a draft.
- Waiting on Katy: the Girl Riot Claude test; the test Instagram for real posts; the two Milestone 1 checks; the live scope doc owner rule.
- Risks: first real Claude calls happen in Katy's test (prompts and caching will need tuning); the worker's switch to Docker happens on this deploy (watch the Render dashboard); Ask Claude waits for renders inside the reply (up to 2 minutes per design).

## Oct 3, 2026 (evening): "Send to Boutiqly as a draft"

- Done:
  - Calendar entries that Boutiqly posts or pings now have a **Send to Boutiqly as a draft** button. It makes the post in the shop's Boutiqly social planner as a draft (one per Story frame). Drafts never post, the entry's status doesn't change, and it works with Live posting off. A second click sends nothing.
  - If Boutiqly refuses, the tab shows Boutiqly's own message and the server log keeps the details for fixing.
  - Branding decided: each shop keeps its own look; no port of the Make Space prototype's engine or brand docs. Build plan updated.
  - 88 automated tests (83 server, 2 web, 5 worker); the button clicked through in a browser against the stand-in.
- Next: Katy tests a draft in Girl Riot Society (steps in chat). That's the first real call to Boutiqly's planner and media upload, so it confirms the post format and upload fields. Then the real test posts with Live posting on, then Milestone 3.
- Waiting on Katy: the Girl Riot draft test; the test Instagram for real posts; the two Milestone 1 checks; the live scope doc owner rule.

## Oct 3, 2026 (later): Milestone 2 built

- Done (all in one go, merged by Claude once checks passed, as Katy asked):
  - **Library**: upload photos and videos into the shop's Boutiqly media storage, pick the type (post, carousel, Story, Story set, Reel, text post, Short, pin, Google update), write captions per channel with character counts, Final/Draft and alt text, add to the calendar for chosen channels at a local time.
  - **Calendar**: This week (rolling 7 days, "Needs your OK" first), List (six weeks), Month, Instagram grid. Approve (orange) sends to Boutiqly's social planner, makes app pings (one per Story frame, a minute apart) or readies a pack; Download pack, Mark posted, Move, Remove. Status syncs back; reconnect notices for expired accounts.
  - **Live posting switch** on the Brand screen (Boutiqly team only, off by default): while off, Approve shows what would be sent and sends nothing.
  - **Brand**: connected accounts and the shop's time zone. **Ideas**: a simple board. Setup checklist: "Connect social accounts" is live.
  - 85 automated tests (78 server, 2 web, 5 worker); whole flow clicked through in a browser against a stand-in for Boutiqly.
- Not done yet in Milestone 2: the real test posts (they need a test Instagram connected to Test Boutique and Katy's yes), then Make Space moving in.
- Next: Katy connects a throwaway Instagram to Test Boutique → says yes → turns on Live posting there → we send one feed post, one Story set and one text post and check them. Then install in Make Space's sub-account. Then Milestone 3.
- Waiting on Katy: the test Instagram; the two Milestone 1 checks (request-access screen, phone app); live scope doc owner rule; Make Space's engine and brand docs before Milestone 3.
- Risks: the media upload field names and the exact planner responses are from the API descriptions, not yet a live call; the first real upload and post in Test Boutique will confirm them. Uploads are held in memory (100 MB cap) on a 512 MB server: fine for testing, revisit before clients upload lots of video.

## Oct 3, 2026: session 1 (stack, skeleton, the tab live inside Boutiqly)

- Done:
  - Starter kit unpacked into the repo. Stack and layout agreed and logged (`docs/decisions.md`). Katy's decisions: worker set up now (~$39/mo hosting), and **Boutiqly's team names each brand's owner** (scope updated).
  - Milestone 0 and 1 code merged (PR #1): web app + API, Python worker, database, health page, `render.yaml`, CI; sign-in from Boutiqly, roles, Team panel, audit log, encrypted install tokens, the five screens and the Ask Claude panel.
  - Fix merged (PR #2): Render's first deploy didn't see the app's port; it now starts `node` directly and logs crashes and shutdowns.
  - Accounts: Boutiqly developer account and private app (Paid, usage only, no plans), Claude API key ($50/mo limit), Render (live at https://social-studio-ohoa.onrender.com), app installed in sub-account **Test Boutique**.
  - **The tab loads inside Boutiqly and shows Katy's name and "Boutiqly team".** Boutiqly's address is `app.boutiqly.io` (needed in `BOUTIQLY_APP_DOMAINS`).
  - Learned: client keys and the Shared Secret live under Manage → Secrets; the Auth page won't save without a Redirect URL.
- Added after Katy's first look: a "Set up this shop" checklist, the shop's real name at the top, and an "Add someone" picker on Brand → Team that lists the sub-account's Boutiqly users, so agency admins can name owners and staff without them opening the tab first.
- Then (PR #4): agency admins can be named on a shop's Team list, including as owner, and can name themselves. **Katy confirmed it works live.**
- Still to check for Milestone 1: a sub-account user who isn't on the Team list sees the request-access screen; whether the tab shows in the LeadConnector phone app.
- Next: those two checks, then Milestone 2 (Library, Calendar, posting through Boutiqly's social planner).
- Waiting on Katy: the two checks; update the live scope doc with the new owner rule; Make Space's content engine and brand docs before late October.
- Risks still open: private-app wallet billing and the platform's cut (0% vs 15%; the Pricing page shows no fee); whether the phone app shows custom tabs; whether the app needs publishing before installing in other sub-accounts.

## Oct 3, 2026: scope finished, starter kit added

- Done: v1 scope approved (`docs/scope.md`); this starter kit created in the Boutiqly project chat.
- Next: session 1, using `FIRST-SESSION-PROMPT.md`: confirm the stack, set up the accounts together, start M1 (the tab loading inside Boutiqly).
- Waiting on Katy: create the private `social-studio` repo and upload this kit (`docs/setup-accounts.md`, step 1).
