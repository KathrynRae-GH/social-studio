# Social Studio: reference for Claude

Social Studio is one page per brand: **Ask Claude · Content Library · Calendar · Asset Library · Ideas**. The code is shared; everything about the brand lives in the page's own database. This guide is the contract between the page and Claude. Read it before setting up a studio or doing a weekly run.

Template version: 1.0.0. The template artifact publishes `index.html` (a demo shell), `studio.js`, `studio.css` and this `guide.md`.

---

## 1. Make a brand's page

Publish a new artifact whose page is this shell (swap in the brand name), with the shared code copied from the template server-side:

```html
<title>BRAND NAME Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="studio.css">
<div id="app"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="studio.js"></script>
```

Artifact publish call:
- `file_path`: the shell above, saved locally as e.g. `brand-studio.html`
- `files`: `{"studio.js": {"artifact": TEMPLATE_URL, "path": "studio.js"}, "studio.css": {"artifact": TEMPLATE_URL, "path": "studio.css"}}`
- `capabilities`: `{"db": {}, "user": {}, "sample": {}, "assets": {}, "downloads": true}`
- `icon`: `calendar`; `description`: one sentence.

Then write `settings/brand` (section 3) with ArtifactData. Until that document exists the page shows "This studio isn't set up yet."

**Upgrading** an existing brand page to a newer template: `Artifact read` the brand page first (a publish to a page this conversation hasn't read is refused), then publish to its `url` with the same shell as `file_path` and the same two `files` entries. The db, assets and settings are untouched. Omit `capabilities` so the stored ones carry forward.

These pages use AI features, so they're private to the owner's organization and can't be shared publicly; viewers need a Claude account. Each viewer who uses Ask Claude or Plan ready posts pays for those calls from their own usage.

---

## 2. Collections

Claude writes the ones marked **C**; the page writes the ones marked **P**. Never overwrite a field the page owns unless the owner asked.

| Collection | Writer | What it is |
|---|---|---|
| `settings/brand` | C | One document: the whole brand setup (section 3). Live: edits show on the page right away. |
| `pieces/<id>` | C | Each graphic, carousel, Reel or Story to review, with Claude's captions (section 4). |
| `events/<id>` | C | Dated things posts point to: classes, launches, shows, drops, sales (section 5). |
| `threads/<id>` | C, P | Threads drafts in the Content Library (section 6). Claude creates; the page writes status, note, text edits. |
| `ideas/<id>`, `shots/<id>` | C, P | Ideas page and shot list (section 7). |
| `assets/<id>`, `lists/reel` | C, P | Asset Library tags; the Reel shortlist (section 8). |
| `items/<id>` | P (+C note) | Review state per piece: `status` (review, draft, final), `note` (owner's note to Claude), `archived`, `updatedAt`. Claude may set `claude` (a short message shown on the card) and `claudeAt` (when Claude last answered). |
| `captions/<id>` | P | Edited captions: `{ig, fb, li, pi, tt, yt, th, alt, st: {ig: "final", …}, claude: {…originals}, editedAt}`. Exists only after an edit or a caption status change. |
| `cal/<key>` | P (+C) | Calendar entries (section 9). |
| `data/users/<uid>/chat` | P | Each person's Ask Claude history. Private; Claude can't read it. |

**A note is waiting on Claude** when `note` isn't empty and there's no `claudeAt`, or `updatedAt` is later than `claudeAt` (the owner changed something after Claude's last pass). Same rule for `threads/<id>`. Don't rework notes you've already answered.

ArtifactData tips: `list` with `out_dir` for big collections; `batch` for more than a couple of writes (max 50 per batch, each with `if_version` when updating); `update` merges fields; `{"__delete__": true}` removes a field.

---

## 3. `settings/brand`

Every field is optional. The JSON below is an example, not the defaults; left-out fields use the built-in defaults: `platforms` ig, fb, tt, th, st · `perWeek` ig 3, fb 3, li 2, pi 3, tt 2, yt 1, th 7, st 2 (merged per platform: a platform you leave out keeps its default, so set 0 to drop a minimum) · `reels` 1 · `leadDays` 10 · `shortLead` 2 · `extraDays` none · `contentTypes` Promotion, Behind the scenes, Community, How-to · `events`, `hosts`, `scheduler` off. Write the whole document with `set` on setup, then `update` single fields later.

```json
{
  "name": "Brand Name",
  "owner": "Katy",
  "slug": "brand-name",
  "tz": "Central",
  "about": "One or two sentences Claude reads before planning or chatting: what the brand is, where, for whom.",
  "platforms": ["ig", "fb", "tt", "th", "st"],
  "optionalPlatforms": ["th"],
  "postStart": "2026-10-04",
  "best": {
    "ig": { "time": "09:00", "days": [0, 1, 2, 4, 5], "dayText": "Sun · Mon · Tue · Thu · Fri", "why": "What the numbers showed, in a sentence or two.", "src": "Your posts · Jun–Sep" }
  },
  "perWeek": { "ig": 5, "fb": 5, "tt": 2, "th": 18, "st": 2 },
  "reels": 2,
  "leadDays": 10,
  "shortLead": 2,
  "extraDays": [3, 6],
  "thSlots": [["10:00","12:30"],["09:00","12:30"],["08:00","10:30","12:30","15:30"],["08:00","10:30","12:30","15:30"],["09:00","11:00","13:00","15:30"],["09:00","12:30"],["10:00"]],
  "ruleText": [["Rule headline", "One-line explanation"]],
  "bestNote": "Where the best-time numbers came from and how to sharpen them.",
  "contentTypes": ["Workshop", "Instructor", "Rental", "Community"],
  "themes": [{ "id": "about", "name": "About us", "desc": "Who we are" }],
  "events": { "word": "workshop", "plural": "workshops", "reminderStories": true },
  "hosts": { "word": "instructor", "plural": "instructors", "hold": true },
  "eventsAsOf": "Oct 1",
  "scheduler": { "name": "GHL", "platforms": ["ig", "fb", "th"], "videoByPhone": true, "claude": true, "steps": [] },
  "storyLink": "example.com/events",
  "flags": [{ "pattern": "podcast studio", "why": "mentions the podcast studio, which is a mobile kit now" }],
  "voice": ["Warm, direct and plain. Say \"we\".", "At most one exclamation point per post.", "Never use: curated, elevate, hub."],
  "facts": ["Address, hours, prices or anything Claude may state as fact."],
  "photoRules": ["Instructors' faces are fine. No faces of anyone under 18."],
  "threadKinds": { "question": "Question", "invite": "Workshop", "inside": "Behind the scenes", "take": "Hot take or poll" },
  "shotGroups": [{ "name": "During a workshop", "note": "Hands and objects only." }, { "name": "On site, any day", "note": "Vertical video, daylight." }],
  "captionTips": { "ig": "Tip shown above the Instagram caption box." },
  "assets": {
    "categories": ["Workshops", "Rooms", "Community"],
    "places": ["Studio A", "Lobby", "Outside"],
    "placeWord": "Room",
    "people": [{ "label": "No people", "level": "ok", "text": "No people in it." }, { "label": "Under 18", "level": "stop", "text": "Never show faces." }]
  },
  "palette": { "colors": ["#EBBA5C", "#DD583F", "#4768AC", "#507C57"], "accent": "#DD583F", "light": "#F6F3EB", "dark": "#2D2926", "assign": "auto" },
  "fonts": { "display": "Fraunces", "body": "Inter", "google": "family=Fraunces:wght@400;700&family=Inter:wght@400;600;800", "displayWeight": 400, "displayAsset": "" },
  "style": { "checker": true, "shapes": true },
  "chatStarts": ["What should I post this week?"]
}
```

Field notes:
- **tz**: a display label ("Central", "Eastern", "Pacific"), not an IANA zone. Times are stored and shown as written; nothing is converted.
- **postStart**: the six-week plan, the planner's default date and Plan ready posts start no earlier than this.
- **platforms**: any of `ig` Instagram, `fb` Facebook, `li` LinkedIn, `pi` Pinterest, `tt` TikTok, `yt` YouTube Shorts, `th` Threads, `st` Stories. The lead feed is the first of ig, fb, li, pi that's on; the calendar's one-piece-per-day rule and the open "+" slots follow it. `tt` and `yt` take video only and move to their own posting days. The Instagram grid preview shows only when `ig` is on.
- **optionalPlatforms**: captions that may be left empty without blocking "Ready to post" (default `["th"]`). Put `li` or `pi` here when only some pieces go there.
- **best**: per platform. `time` zero-padded "HH:MM" 24-hour, `days` 0=Sun…6=Sat. Missing platforms use general starting points labeled "Starting point". If you override a platform, set all five fields (`time`, `days`, `dayText`, `why`, `src`); otherwise the card keeps the starting-point wording.
- **perWeek**: weekly minimums per platform (`th` counts every Threads post, pieces and text posts; `st` counts reminder Stories when `events.reminderStories` is on, otherwise all Stories). A 0 hides that platform from the week check.
- **reels**: minimum Reels per week on the lead feed. **leadDays / shortLead**: event posts go up at least `leadDays` ahead; short notice allowed down to `shortLead` days only when the full window has passed.
- **extraDays**: weekdays that take extra feed posts when there's more to share (not counted as main days).
- **thSlots**: Threads times for Sun..Sat: exactly 7 lists, or it's ignored. Defaults spread `perWeek.th` evenly.
- **ruleText**: the "Posting rules" cards. Leave it out and the page writes them from the numbers above. Write it yourself when the brand has rules the numbers don't capture.
- **contentTypes**: each piece's `ctype` is one of these. The calendar flags two of the same type on back-to-back feed days.
- **themes**: optional filter in the Content Library; a piece's `theme` is a theme `id`.
- **events**: leave out (or null) for brands without dated things. `word` replaces "workshop" everywhere ("show", "drop", "class"). `reminderStories`: weekly reminder Stories (pieces with `week`) own the Story days in `best.st.days`.
- **hosts**: leave out for brands without featured people. `hold` defaults to true: a piece with `host` only posts while that host has an upcoming event; otherwise it waits in Held. The piece's `host` must match an event's `host` or `cohost` string exactly.
- **scheduler**: leave out if everything is posted by hand; every post then goes in the Phone pack. `name` is required (without it the scheduler is ignored). `platforms` = what the scheduler posts to (default: every caption platform). `videoByPhone` (default true): Reels go out from the phone so trending audio can be added. `claude: true` when Claude can schedule through a connector (it still asks before every write). `steps`: optional custom upload steps for the pack's READ ME.
- **flags**: regex `pattern` (case-insensitive) + `why` (finishes a sentence: "The Instagram caption **mentions …**"). Flagged captions and Threads posts show notices.
- **voice / facts / photoRules**: Ask Claude on the page reads these (Plan ready posts reads only `about`). Keep each line short. Facts are the only things the in-page Claude may state as fact besides the library itself.
- **storyLink**: printed as the link sticker in the Phone pack for weekly reminder Stories.
- **chatStarts**: up to 6 starter questions on Ask Claude.
- **palette**: hex colors. `light` is the page background, `dark` the text. `colors` (1–10) fill the colored blocks; with `assign: "auto"` (default) deeper colors go to the big blocks and brighter ones to highlights, and the page picks readable text on each. `assign: "order"` uses the order given (slots 1–10: 1 Ideas banner + plan bar, 2 accents, 3 soft, 4 Ask Claude banner + chat bubbles, 5 cards, 6, 7, 8 Calendar banner, 9, 10). `accent` is buttons and links (default: the most saturated color).
- **fonts**: Google Fonts families. `google` is the part after `css2?` in a Google Fonts URL. For a licensed display font, upload the .woff2/.ttf as an asset and put its id in `displayAsset`. `displayWeight` sets headline weight.
- **style**: `checker: false` removes the checkerboard strips; `shapes: false` removes the burst and flower shapes.

---

## 4. `pieces/<id>`

Use short readable ids (`p-fall-sale`, `p-intro-reel`). Media fields take an **asset id** from the page's asset store (upload with the Artifact tool: `url` = the brand page, `asset: true`, `file_paths` up to 25 per call; the result lists each id).

```json
{
  "title": "Fall print sale",
  "sub": "Static post · Saturday sale",
  "kind": "post",
  "ctype": "Promotion",
  "theme": "shop",
  "file": "<asset id>",
  "preview": "<asset id, optional smaller image>",
  "order": 10,
  "note": "Shown on the card in a yellow box (a caution, a sticker to add, a weekday it suits).",
  "events": ["2026-10-20"],
  "host": "Ana Ruiz",
  "week": ["2026-10-04", "2026-10-10"],
  "soldout": "Sold out on Oct 2",
  "captions": { "ig": "…", "fb": "…", "tt": "…", "th": "…", "li": "…", "alt": "…" },
  "createdAt": "2026-10-01T15:00:00Z"
}
```

- **kind**: `post` (4:5 image: `file`), `carousel` (`slides`: list of asset ids, or `{file, preview}`), `story` (9:16 frames in `slides`), `reel` (9:16 video: `file`, `poster` image id, `dur` seconds), `wide` (16:9 video, same fields).
- Always upload a poster frame for videos (ffmpeg `-ss 1 -frames:v 1`). Video must be MP4 (H.264/AAC) or WebM under 20 MB; images PNG, JPEG, WebP or GIF under 20 MB.
- **captions** are Claude's versions. The page shows them until the owner edits one; then `captions/<id>` holds the live text.
- **events**: the dates this piece promotes (drives the lead-time check). **week**: only on `kind: "story"`; makes it a weekly reminder Story for that Sun–Sat range. **host**: the featured person (hosts rule). **soldout**: keeps the piece out of Plan ready posts and flags any calendar entries.
- Stories need only `alt`. TikTok/YouTube captions only matter for video.

**Revising after notes** (read `items/<id>.note` and `captions/<id>`):
1. New media: upload, update `pieces/<id>` media fields.
2. New caption text: update `pieces/<id>.captions.<k>`. If `captions/<id>` exists, read it and write it back with `<k>` set to the new text, `claude.<k>` set to the new text too (so it isn't shown as an edit and "Restore Claude's version" restores the new one), and `st.<k>` set to `"review"`. Write the complete `claude` and `st` maps; the page always writes the whole document.
3. Set `items/<id>`: `status: "review"`, `claude: "What changed, in one sentence."`, `claudeAt: now`. Keep the owner's `note` unless they asked you to clear it.
Never mark anything Final for the owner.

---

## 5. `events/<id>`

```json
{ "date": "2026-10-20", "time": "18:00", "title": "Intro to Riso", "host": "Ana Ruiz", "cohost": "", "canceled": false, "link": "https://…" }
```
Keep it to the next 2–3 months. Set `settings/brand.eventsAsOf` to the date the list was last checked. Canceled events: set `canceled: true` (or delete). `time` only orders same-day events and `link` is for your reference; the page doesn't show either.

---

## 6. `threads/<id>`

Id pattern `th-MMDD-HHMM` (add a suffix if two share a slot). Only when `th` is on.

```json
{
  "date": "2026-10-06", "time": "09:00", "kind": "question",
  "text": "lowercase is fine. one real detail, then an invitation.",
  "status": "review", "source": "claude", "batch": "2026-10", "order": 1,
  "claude": "Why this post, in a sentence (shown on the card).",
  "classDate": "2026-10-20",
  "photo": { "id": "<assets doc id>", "blob": "<asset id>", "title": "Photo title", "num": 57, "w": 1080, "h": 1350 }
}
```
- `kind` is a key of `settings.threadKinds` (or the defaults: question, invite, inside, take, tip, community, news, post).
- Pick times from `thSlots` that are still open after counting what's on the calendar (`cal` entries with `plat: "th"`). Aim for `perWeek.th`.
- `photo` is optional; only use assets the photo rules allow.
- The owner marks drafts Final and adds them to the calendar; don't add them yourself unless asked.
- Once a draft is on the calendar, the page shows and posts the calendar entry's text. When revising such a draft, also update `cal/text__th__<id>` (`text`, and `textSt: "review"`) if it's still Suggested or Locked.
- Over 500 characters can't be added to the calendar.
- When counting toward `perWeek.th`, include drafts that aren't on the calendar yet, as the page's weekly goal does.

---

## 7. `ideas/<id>` and `shots/<id>`

```json
{ "title": "Studio tour Reel", "pitch": "One or two sentences.", "needs": "What it takes", "format": "Reel", "status": "later", "approval": "pending", "num": "A1", "order": 1, "source": "claude", "item": "<piece id once built>" }
```
`status`: `now` (Claude can make it from assets on hand), `later` (needs shots; waits for approval), `built` (made; set `item`), `done` (shows as Posted). `approval` (pending, approved, declined) and shot lists only matter for `later` ideas. `num` prefix letter A–H colors the category.

Shots: `{ "idea": "<idea id>", "text": "Slow pan across the print room", "tip": "optional", "kind": "shot" | "input", "when": "<a shotGroups name>", "done": false, "order": 0 }`. Id pattern `<idea id>__s1`.

---

## 8. Asset Library: `assets/<id>`

```json
{
  "type": "photo", "title": "Mo by the hello mat", "desc": "One plain sentence of what's visible.",
  "categories": ["Community"], "room": "Lobby", "subjects": ["cat", "mat"], "people": "No people",
  "colors": ["orange", "cream"], "num": 57, "assetId": "<asset id>", "thumbId": "<asset id of a 360px square>",
  "w": 1080, "h": 1350, "orientation": "vertical", "duration": 12.5,
  "source": "Photo shoot", "origin": "library", "notes": "Crop the coffee-shop logo.", "added": "2026-10-01T15:00:00Z"
}
```
- Always upload a 360 px square `thumbId`: video tiles are blank without one. `room` should be one of `settings.assets.places`.
- `people` must be one of the labels in `settings.assets.people` (or the defaults: No people, the host word, Photo shoot (released), Cleared by OWNER, Staff, Customers or guests, Under 18, Check). Use Check when unsure.
- `colors` from: pink, magenta, red, orange, yellow, green, teal, blue, lilac, purple, tan, brown, cream, white, gray, black.
- The owner can upload from the page (it converts iPhone MOV/HEIC). Those docs have `origin: "upload"` and need tags: describe what's visible, never guess names unless the owner told you who it is.
- `lists/reel` is `{ids: [...], updatedAt}`: the owner's shortlist for the next Reel.

---

## 9. `cal/<key>`

Feed entry: `{ "item": "<piece id>", "plat": "ig", "date": "2026-10-06", "time": "09:00", "status": "suggested", "source": "claude", "createdAt": …, "updatedAt": … }`, key `<piece id>__<plat>__<random>`.
Threads text post: `{ "kind": "text", "plat": "th", "text": "…", "textSt": "final", "date", "time", "status", "source", "draft": "<threads id>", "photo": {…}, "classDate" }`, key `text__th__<id>`.

An entry is ignored if its `plat` isn't in `settings.platforms`, its piece doesn't exist, or its date, time or status is invalid.

Statuses: `suggested` (Claude placed it; only these move) → `locked` (owner approved) → `scheduled` (in the scheduler or ready on the phone) → `posted`.
- Claude may add `suggested` entries when asked, but the page's **Plan ready posts** button usually does it.
- After scheduling posts in the scheduler (with the owner's OK for each write), set `status: "scheduled"` and `sched: true` on those entries. When they've gone out, `posted`.
- Never move or change Locked, Scheduled or Posted entries unless the owner asks.

---

## 10. Packs

Each week on the calendar has a scheduler pack (when `settings.scheduler` is set) and a Phone pack, zipped downloads of the Locked posts.
- The scheduler pack holds only Locked entries routed to the scheduler: not Stories, on a platform in `scheduler.platforms`, and not video when `videoByPhone` is on (Threads copy of a Reel still goes). Everything else is in the Phone pack.
- Scheduler pack files: `<prefix>-MMDD-<piece id>.jpg` (carousels add `-01`, `-02`…; videos keep their type: `.mp4`, `.webm`) and `<prefix>-MMDD-threads-HHMM.jpg`, plus `READ ME FIRST.txt` listing every post and time. The prefix is up to four initials of `slug` (or of `name` when there's no slug), e.g. "make-space" → "ms".
- Phone pack: files named by day and time, plus `00-posting-sheet.txt` with captions, alt text and stickers.
When the owner says a pack is uploaded, match files to posts by those names.
