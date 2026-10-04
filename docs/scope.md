# Social Studio app: v1 scope

Approved by Katy, Oct 3, 2026. Copy of the live doc at https://claude.ai/artifact/2oicwCLTDcf5x4SgQJSwJe. When scope changes, Katy agrees first, then this file and the live doc are both updated.

## Decisions

v1 writes and designs for every channel Boutiqly can post to, and hands over ready-to-post packs for the channels beyond it, all in each brand's own styles. Owners, their designated team and Boutiqly's team can all approve. All twelve scope questions are decided.

| # | Question | Answer |
|---|---|---|
| 1 | What Claude makes | Everything the Make Space prototype makes (captions, posting plan, text posts, posts, carousels, Stories, Story sets, Reels), plus the formats other channels need: pins, Shorts, video titles and thumbnails, Google updates |
| 2 | Channels | Every channel Boutiqly posts to: Instagram, Facebook, Threads, LinkedIn, TikTok, YouTube, Pinterest, Google Business Profile and Bluesky (Boutiqly communities removed Oct 4, 2026). Beyond it (X and others), ready-to-post packs |
| 3 | Who uses it and approves | Account owners, the team members they designate, and Boutiqly's team (agency accounts); all can approve |
| 4 | Onboarding | Brand capture first: Claude scans the website, the social accounts the owner links, and the templates, posts and brand files they upload, then shows a brand board to approve before anything else is made |
| 5 | Brand kit and styles | A custom style set for every brand, designed by Claude from the approved brand board. Nothing ever carries another brand's look; the fallback is a basic Boutiqly palette and type, no logo |
| 6 | Claude model and Ask Claude | All Claude work runs on Opus 5.5 or newer. Ask Claude has its full capabilities: strong design and no limit on what it can make |
| 7 | Assets | Uploads in the tab and Boutiqly media storage, with a people rule and a sensitive-details check on every file |
| 8 | Screens | Calendar, Library, Assets, Ideas and Brand, with Ask Claude on every screen; "Locked" becomes "Approved" |
| 9 | Look | Boutiqly look, with colors kept in one theme so a public version can go neutral later |
| 10 | Plans and pricing | No monthly fee: the tab is part of every Boutiqly plan, and usage is billed to the sub-account's wallet as Studio credits at 2x Claude cost. Each brand chooses a monthly limit or unlimited. Done For You setup is part of white glove |
| 11 | Brands per sub-account | One in v1, with each of Katy's brands in its own sub-account; the database allows more later |
| 12 | Name | Social Studio |

## What v1 does

v1 carries over everything the Make Space prototype does and adds what it can't: brand capture for a new brand, every Boutiqly channel and beyond, posting through Boutiqly by itself, rendering on a server, and an Ask Claude that can design anything.

| Area | What it does in v1 | Change from the prototype |
|---|---|---|
| Onboarding | Brand capture from the website, linked social accounts and uploads, then a brand board to approve, then the shop questions, style set and first two weeks of posts | New: the social-studio-setup skill, built into the tab, with brand capture added |
| Brand | Brand board, brand doc, style set with samples, people rules, channels and targets, Team list, all editable | New screen; today these live in project docs |
| Library | Posts, carousels, Reels, Stories, Story sets with highlight covers, text posts, pins, Shorts, video titles and thumbnails, Google updates. Captions per channel marked Final or Draft, plus alt text | Adds the formats for YouTube, Pinterest, Google, Bluesky, X and other channels |
| Calendar | Suggested, Approved, Scheduled, Posted. Six-week plan with per-channel targets, notices (including accounts that need reconnecting), Instagram grid preview, Month and List views | "Locked" becomes "Approved", since approving is now a role |
| Posting | Approving a post uploads its media to Boutiqly media storage and creates the post in Boutiqly's social planner; channels beyond Boutiqly get a ready-to-post pack | New: no weekly packs to drag in |
| Content engine | Renders posts, carousels, Stories, Reels and every channel's sizes, from the brand's style set or from any design Ask Claude makes, on a background worker; preview in the tab; "change this" re-renders | Moves from Claude's workspace to the server, and renders free-form designs, not only templates |
| Assets | Upload, or pick from Boutiqly media storage. Claude tags each file and every file carries a people rule | Adds picking from Boutiqly media storage |
| Ideas | Ideas board with shot lists, seeded by Claude | Same |
| Weekly run | On a set day Claude fills the coming week up to the brand's targets, ready for review | New in the app: the social-studio-weekly skill, built in |
| Ask Claude | Claude Opus 5.5 with its full capabilities, in a panel on every screen. It designs any post, carousel, Story or Reel from scratch in the brand's look, as many versions as asked; writes for any channel; plans campaigns; searches the library and calendar; looks things up on the web; and applies changes with one tap. A design the owner likes can be saved into the brand's style set. It works from the brand's real photos and never invents photos of people | Was a library helper; now a full design partner on Opus 5.5 |

## How posts reach each channel

Approving a post sets it up in Boutiqly's social planner for every channel Boutiqly can reach; for channels beyond it, the app hands over a ready-to-post pack. The Instagram and TikTok routes are the ones proven with Make Space's Oct 2–10 posts.

| Channel | What Claude makes | How it goes out |
|---|---|---|
| Instagram | Feed posts, carousels | Boutiqly publishes |
| Instagram | Reels, Stories, Story sets | App ping to the phone: the owner adds trending audio or stickers and posts. One ping per Story frame, a minute apart, with a "frame N of M" note |
| Facebook | Posts, carousels, the Facebook copy of a Reel | Boutiqly publishes; the Reel copy is shared from Instagram |
| Threads, LinkedIn, Bluesky | Text and image posts | Boutiqly publishes (text-only Threads posts send an empty media list, or Boutiqly rejects them) |
| TikTok | Videos | Ready-to-post pack, posted from the phone with a sound (Boutiqly can only post TikToks without sound) |
| YouTube | Shorts from Reels; titles, descriptions, tags and thumbnails for longer videos the owner uploads | Boutiqly publishes |
| Pinterest | Pins: a vertical image with a title, description and link | Boutiqly publishes |
| Google Business Profile | Updates, offers and events | Boutiqly publishes |
| X, and channels Boutiqly can't reach (Nextdoor, Snapchat, Substack, or any the owner adds) | Media sized for the channel, plus the caption | Ready-to-post pack: download or copy from the tab and post by hand |

X isn't in Boutiqly's channel list as of Aug 2026, though some guides still show it; check the connect screen on day one, and if X is there it moves to "Boutiqly publishes". Each channel carries its own caption rules and image sizes, and a new channel can be added any time as a ready-to-post channel. Times are stored in the sub-account's time zone and sent to Boutiqly in UTC. Boutiqly only returns a post's first image, so the app keeps its own record of every Story frame it sent.

## Who can do what

Account owners, the team members they designate and Boutiqly's team can use the tab, and all three can approve. Boutiqly's team sees every brand for now, so problems are caught early. Boutiqly tells the app who is looking each time the tab opens, so nobody signs in twice.

| Who | How the app knows | Can |
|---|---|---|
| Boutiqly team | Agency accounts, from Boutiqly's user context | Everything, on every brand, for now: see, create, edit, approve, schedule, change brands and styles. Each change is logged under their name |
| Account owner | Named by Boutiqly's team for each brand (changed Oct 3, 2026: nobody becomes owner automatically), plus anyone an owner makes an owner | Everything for their brand: onboarding, brand and styles, approve, schedule, manage the Team list |
| Designated team member | Added by an owner to the tab's Team list (any user of that sub-account) | Create, edit, approve and schedule posts; work in Assets and Ideas. Not brand, styles or Team |
| Other users in the sub-account | Not on the Team list | See a screen asking them to request access from the owner |

Designated team members are the shop's own staff. Boutiqly's full access can be narrowed later, once the app is running smoothly for every brand (left open on purpose).

## Onboarding a brand

Onboarding starts with brand capture, so the branding is right from the first post: Claude studies everything the brand already has, shows it back as a brand board, and nothing else is made until the owner approves it. Onboarding runs on Claude Opus 5.5; for white-glove clients the same flow runs with them on a call.

**1. The owner drops in links and files**

- A link to their website
- Links to their social accounts, on any channel
- Uploads: templates they use (Canva exports, PDFs, images), posts they love (their own or anyone's), a brand guide, logo files, font files they're licensed to use, and photos

**2. Claude scans everything**

- Website: logo, colors, fonts, photo style, copy and voice, about page, products. A site that can't be read this way (boutiqly.io is a Manus app) falls back to screenshots or a pasted page
- Social accounts: recent posts, the grid, captions, and what gets the most response. Accounts connected in Boutiqly are read directly; for other links Claude reads what's public, and where a channel needs a sign-in to view (Instagram and TikTok often do), it asks for screenshots of the grid and favorite posts
- Uploads: from each template and loved post, Claude pulls the layout, type, colors, shapes and photo treatment, and asks what the owner likes about it when that isn't clear

**3. The owner approves a brand board**

One page showing what Claude found: logo versions, the palette with each color's role (backgrounds, text, accents, which colors can carry small text), fonts, photo style, shapes and decorations, a voice summary with sample captions, and do's and don'ts. The owner corrects anything in chat or right on the board, and Claude updates it until it's approved. Fonts are the brand's own when the owner uploads files they're licensed to use, otherwise the closest free match, named on the board.

**4. Then the rest**

Short questions, trimmed by whatever the scan already answered: what the shop sells and who shops there, what social should do for it (foot traffic, events, online sales, wholesale), channels and weekly targets, people rules (who may appear, minors, releases, photos that never post), and dated things (events, sales, launches, closures).

**What comes out**

- The approved brand board, and a brand doc: voice, facts Claude may state, channel notes, hashtags, people rules
- The brand's style set, built from the board, with sample renders (next section)
- Content pillars and a six-week posting plan, with the first two weeks filled for review

## Custom styles for every brand

Every post, carousel, Story and Reel is on brand for its own sub-account, and never carries another brand's look. Each brand gets its own style set, designed by Claude from its approved brand board, on one shared engine that has no branding of its own.

- **On brand, always:** every piece, including anything Ask Claude designs, uses only its own sub-account's style set, photos and logo. Make Space's branding appears only on Make Space's posts.
- **Default look:** before a brand's board is approved, or where its set has a gap, Claude falls back to a very basic, simple Boutiqly look (the Boutiqly palette, Montserrat, plain layouts, no Boutiqly logo), never another brand's.
- **Shared engine, unbranded:** layouts for posts, carousels and Stories; Reel structures and motion; sticker-safe zones; caption boxes; end cards. It starts from the structures of Make Space's 16 Reel styles and 8 post styles, stripped of Make Space's colors, fonts, logo, photos and words.
- **Per brand (the style set):** which colors play which role, fonts, shapes and decorations, photo treatment, logo placement, Reel caption style and pacing, which layouts and Reel styles the brand uses, and its own rules (Boutiqly's "Orange only for big bold text" is one).
- **How a set is made:** Claude drafts it from the approved brand board and renders samples (3 posts, 2 Stories and 1 Reel). The owner asks for changes in chat, Claude re-renders, the owner approves.
- **Anything new:** Ask Claude can design any layout from scratch for one post and save it to the brand's set if the owner likes it. Only a new kind of Reel motion the engine can't do yet needs engine code, and once built it's available to every brand.
- **First two sets:** Make Space's own look, then Boutiqly's (from its studio, brand doc and 163 tagged assets).

## Assets and people rules

Photos and videos come in through the tab or Boutiqly media storage, and no file can go into a post until it carries a people rule and has been checked for sensitive details.

- **Where files come from:** uploads in the tab (many at once), the sub-account's Boutiqly media storage, and the phone if the tab works there (see Flags).
- **Where they live:** in the sub-account's Boutiqly media storage, in a Social Studio folder. The app's database holds only the tags and rules.
- **What Claude tags on upload:** subject and products, room or setting, colors, how many people, orientation, size (flags files too small to use full-screen in a Reel), and for video its length and whether it has sound.
- **Sensitive details, flagged on every photo and video frame:** receipts and order slips, email addresses, phone numbers, street addresses, customer names, card or payment details, screens showing customer data, swear words or rude words on signs, products or clothing, and license plates. A flagged file is held as Check first; Claude says where the detail is, offers a crop or blur, and never uses that part in a post. An owner can clear a flag for their brand (a shop that sells cheeky products may be fine showing them).
- **People rule on every file:** Face OK (the owner, or someone who said yes) · Check first (the default for anyone not yet marked) · Under 18, never show a face · Never post. Licensed stock carries a Stock tag and is never presented as a customer.
- **Defaults** come from the brand's onboarding answers. Claude never picks a Check first or Never post file for a post.

## Screens and look

Five screens plus an Ask Claude panel, in the Boutiqly look. Threads folds into the Library and settings fold into Brand, so the menu stays short.

| Screen | What's on it |
|---|---|
| Calendar (opens first) | This week up top: what needs approval, what's scheduled, notices. Month, List and Instagram grid views; the six-week plan |
| Library | Every piece with its preview, per-channel captions and status; filters by type (post, carousel, Reel, Story, Story set, Threads) |
| Assets | Tagged photos and videos, people rules, uploads |
| Ideas | The ideas board with shot lists |
| Brand | Brand doc, style set and samples, people rules, channels and targets, Team list |
| Ask Claude | A panel that opens from any screen |

**The look**

- Cream #fbf8f3 page, white cards with #e8eeeb borders, Deep Forest #1d3c34 text, Muted #5b6f69 for secondary text
- Orange #de771f only on the main action buttons (Approve, Schedule) with white bold text at 18px or larger; secondary buttons in a Deep Forest outline; links in Green #276f3d
- Status chips: Suggested on Pale Mint, Approved on Sage, Scheduled on Light Blue, Posted on Deep Forest with white text, Needs attention on Pink
- Montserrat throughout (Proxima Nova isn't on Google Fonts, the same problem boutiqly.io has)
- All colors live in one theme file, so a public version can switch to a neutral theme later
- Works at phone width

## Running costs and pricing

Hosting runs about $40 a month in total. Claude use, all on Opus 5.5 or newer, is estimated at $20–40 per brand per month and is billed to each sub-account's wallet as Studio credits at 2x, so it pays for itself. Both figures are estimates to check against real metering in the first weeks of testing.

| Item | Cost | Notes |
|---|---|---|
| Web app and API server | $7/mo | Render Starter (512 MB); shared by all brands |
| Render worker for posts and Reels | $25/mo | Render Standard (2 GB, 1 CPU); Reels need the bigger instance. Shared |
| Database | about $7/mo to start | Smallest paid Render Postgres plus storage. Shared |
| Claude API, ongoing | about $20–40 per brand/mo (estimate) | Everything on Opus 5.5 ($4 in / $20 out per million tokens), or newer models as they come. Billed back to the wallet at 2x |
| Claude API, onboarding | about $20–50 per brand, once (estimate) | Opus 5.5 scanning the website, socials and uploads, then designing the brand board and style set |
| Render workspace | $0, or $25/mo | Free for one login; $25 once a second person (the reviewing developer) needs the hosting dashboard |

Boutiqly adds nothing: private apps are free and files sit in each sub-account's media storage.

**Pricing**

- **No monthly fee:** Social Studio is part of the value of every Boutiqly plan. Owners pay only for what they use.
- **Usage, billed as Studio credits:** every Claude job is charged to the sub-account's wallet at 2x its Claude cost. One credit is one cent of Claude cost.
- **The owner's choice of limit:** each brand sets a monthly limit or chooses unlimited. The tab shows usage against the limit, and Claude work pauses at the limit until the next month or until the owner raises it.
- **Done For You setup:** part of white glove, which is always one price and includes everything in the client's plan.
- **First testers:** Katy's own brands first, then Bella and Brawn and Blue Bare. Boutiqly covers the first round's Studio credits.
- **Rollout:** clients start testing as soon as the app is ready, and it rolls out as fast as testing allows.

**How wallet billing works**

Boutiqly lets an app charge per use straight to a sub-account's wallet, the same wallet that pays for texts and email, with Boutiqly's agency markup on top.

1. The app records the real Claude cost of every job (a caption batch, a design, a Reel, an Ask Claude chat) per sub-account and per user, and the tab shows owners their usage.
2. In the app's pricing settings, Boutiqly sets up a usage meter: a Studio credit worth one cent of Claude cost.
3. After each job, the app charges the sub-account's wallet for the credits used, stopping at the owner's monthly limit if they set one. Before a big job it checks the wallet has enough funds.
4. With usage reselling turned on, the sub-account's wallet pays the base price plus Boutiqly's markup, set so the total is 2x Claude cost; with it off, Boutiqly's agency wallet pays. Daily usage limits can also pause billable use per sub-account until the next day.
5. The base price is paid out monthly to the app's developer account (Katy's); the markup stays with Boutiqly's agency.

To confirm in the developer portal on day one: that a private app can take paid usage charges and payouts, and the platform's cut (its help center says none, updated Jun 2026; its marketplace page says 15%). One developer reported a private app's usage charges failing in July 2026, so test billing before the pilot.

## Build order and timeline

Building starts the week after the accounts exist, and clients can start testing around Dec 21, after about ten weeks of build in sessions with Katy. Rollout follows as fast as testing allows. Estimate, paced mostly by testing and decisions.

| Workstream | Estimated dates |
|---|---|
| Accounts and private app (Katy) | Oct 5 – Oct 9 |
| Tab, Boutiqly login, database | Oct 12 – Oct 16 |
| Library, Calendar, all-channel posting | Oct 19 – Nov 6 |
| Posts, Stories, Assets, Ask Claude | Oct 26 – Nov 20 |
| Reels renderer and preview | Nov 9 – Dec 4 |
| Brand capture, style sets, Team | Nov 23 – Dec 11 |
| Wallet billing and usage limits | Dec 7 – Dec 11 |
| Security review (human developer) | Dec 14 – Dec 18 |
| **Client testing starts** | **Dec 21** |

Make Space moves into the tab once posting through Boutiqly works (early November). Boutiqly is onboarded as the second brand in early December, so onboarding and style sets are tested on Katy's own brands before any client sees them.

## Flags

Full Reels plus custom styles for every brand roughly doubles the build before a pilot. The rest are risks to test early rather than reasons to change course.

1. **Time to testing.** The original brief's 3–6 weeks assumed no Reels. With Reels, per-brand style sets, brand capture, every channel and wallet billing it's about 10 weeks of build, so client testing starts around Dec 21 (estimate).
2. **Holiday timing.** Testing lands in the busiest weeks for shops (Small Business Saturday is Nov 28). Katy's own brands test first; check that Bella and Brawn and Blue Bare can give quick feedback in December.
3. **Reels on a server** is where surprises are most likely: fonts, video codecs, render time. Build the Reel styles fresh on the server (Katy decided Oct 3 not to port the Make Space prototype's engine) and check early renders for fonts, codecs and render time.
4. **The phone app is unconfirmed.** Boutiqly users are on the LeadConnector app today, so whether the tab shows on phones depends on what that app allows, and nothing public confirms it shows custom tabs. Reels and Stories already go out from the phone through app pings, but approving and uploading on the phone depend on it. Test it on day one in Make Space's sub-account; the fallback, a phone-friendly link with its own sign-in, is extra work.
5. **Claude costs grow with use.** Meter every brand from day one and test wallet billing before any client connects.
6. **Custom styles cost people time** only when a brand wants something the engine can't do. Building each brand's styles as its own code would make every brand a separate thing to maintain; the shared engine avoids that.

## Still open

- When to narrow Boutiqly's full access to every brand (left open on purpose).
