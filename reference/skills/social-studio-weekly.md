---
name: "social-studio-weekly"
description: "Weekly run for a brand's Social Studio page: act on review notes, make posts and Threads drafts to hit minimums, tag uploads, refresh events, schedule locked posts."
---

# Social Studio weekly run

Use when the owner asks for "this week's content", "fill the calendar", "make posts for <brand>", "go through my notes", "tag my new photos" or "the pack is uploaded". Do the parts the request covers; a plain "weekly run" means all of sections 2–8.

**Template:** https://claude.ai/artifact/9uP7yjoWshEiDxHrXjyngS

## 1. Get oriented

1. Find the studio: project doc `claude/<slug>-studio.md`, else `Artifact` → `list` for "<Brand> Studio". No studio yet → run `social-studio-setup` first.
2. Read `guide.md` from the template (`Artifact` read, `path: "guide.md"`). Collection shapes and field names come from there.
3. Read the brand docs in the project (`claude/<slug>-social-brand.md`, `…-social-strategy.md`, plus any design, reel-style or voice docs). They decide how things look and sound.
4. Pull the page's state with `ArtifactData` → `list` (use `out_dir` and read the files): `settings/brand`, `pieces`, `items`, `captions`, `cal`, `threads`, `events`, `ideas`, `shots`, `assets`, `lists/reel`.
5. Compare the template's `studio.js` version with the brand page's (first line of each). If the template is newer, offer the upgrade from `social-studio-setup` section 7 in one line.

Then work out, in code, and tell the owner in a short message what you found and what you'll do:
- notes waiting on Claude (`items/*.note`, `threads/*.note`) and pieces marked Draft
- each of the next 4 weeks against `settings.perWeek` and `reels` (count `cal` entries per platform; Threads counts pieces with Threads copy plus text posts)
- events in the next 6 weeks with no post yet, and when each must post by (`leadDays`)
- hosts with a post on hold because they have nothing coming up
- uploads not tagged yet (`assets` with `origin: "upload"` and `people: "Check"` or empty categories)
- approved ideas whose shots are all checked (ready to build) and the Reel shortlist in `lists/reel`

## 2. Act on notes

For every piece with a note or a Draft mark: make the change, then follow guide section 4 "Revising after notes" (new media and/or caption, `items/<id>.status = "review"`, a one-sentence `claude` message). For Threads drafts with a note: update `threads/<id>` `text`, set `status: "review"` and `claude`. If a note asks for something you can't do or don't have the facts for, say so in the `claude` message and in your reply instead of guessing.

## 3. Make new pieces

Fill the gaps found in step 1, the earliest weeks first, upcoming events before evergreen posts. For each piece:
- **Media**: follow the brand's design docs in the project. Use the brand's own assets (respect each asset's `people` rule and notes; crop third-party logos). Feed graphics 1080×1350 (4:5), Reels and Stories 1080×1920 (9:16). Reels: MP4 H.264/AAC under 20 MB, plus a poster frame. If the project has no design guidance yet, make a small first batch in the palette and fonts from `settings/brand` and ask the owner to react before making more.
- **Upload**: `Artifact` with `url` = the brand page, `asset: true`, `file_paths` (25 per call). Keep the returned ids.
- **Doc**: `pieces/<id>` per guide section 4: `kind`, `title`, `sub`, `ctype` (one of `contentTypes`), `theme`, media ids, `events` dates it promotes, `host`, `week` for weekly reminder Stories, `note` for anything the owner must do (a sticker, a crop), `order` after the existing ones, and `captions` for every platform in `settings.platforms` that fits the piece (video-only platforms only for video; Stories need only `alt`).
- Put nothing on the calendar; the owner marks pieces Final and uses **Plan ready posts**.

Captions:
- Voice from `settings.voice` and the brand doc. Facts only from `settings.facts`, the brand docs, `events`, or what the owner told you. Never invent prices, dates, quotes, names or scenes. Missing fact → leave it out and ask.
- Instagram: open on a specific detail, 2–4 short paragraphs, soft call to action, hashtags at the end (the brand's set). Facebook: details first, a direct link, no hashtags. TikTok/YouTube: short and searchable (YouTube's first line is the title, under 100 characters). LinkedIn: the point in the first two lines. Pinterest: a searchable first line. Threads: conversational, no hashtags, ends on an invitation, under 500 characters.
- Alt text: 100–150 characters describing what's visible.
- Check every caption against `settings.flags`, banned words and platform limits before writing it.

## 4. Threads drafts

When `th` is on: count Threads posts already on the calendar per week, then draft `threads/<id>` posts (guide section 6) into open `thSlots` until each week reaches `perWeek.th`. Vary the kinds (`threadKinds`), openings and endings. Use a photo from the Asset Library when it helps and the photo rules allow it. Event posts carry `classDate` and must land at least `leadDays` before it. `status: "review"`, `source: "claude"`, `batch` = the month.

## 5. Tag new uploads

For each untagged upload: download it (`Artifact` read, `url` = brand page, `path` = its `assetId`), look at it, and `update` the `assets/<id>` doc: `title`, `desc` (only what's visible), `categories`, `room`, `subjects`, `colors`, `orientation`, `num` (next in sequence), `notes` (logos to crop, anything risky). Set `people` only when the rules make it clear; otherwise leave Check and ask the owner who's in it. Use names only when the owner told you who someone is.

## 6. Events and ideas

- Refresh `events/*` from the brand's source (site, connector, doc the owner gave). Mark canceled ones. Update `settings/brand.eventsAsOf`.
- Ideas: add 3–5 new ones (`approval: "pending"`) with shot lists grouped by `shotGroups`. Ideas whose shots are all checked: build them in step 3, then set `status: "built"` and `item`.

## 7. Scheduling (only when asked)

When the owner says a week's pack is uploaded or asks you to schedule:
- With a connected scheduler (`settings.scheduler.claude: true`): read the locked `cal` entries for that week, match pack files by name (guide section 10), and list exactly what you'll create (platform, date, time, file, caption). **Ask before each write** and wait for a clear yes. After each one succeeds, set that entry's `status: "scheduled"` and `sched: true`.
- Later, check what went out and set `status: "posted"`.
- Never publish immediately, never change Locked entries' dates or captions on your own, never touch Suggested ones in the scheduler.

## 8. Check, then report

- Re-list what you wrote and confirm it landed; re-count each week against the minimums.
- Scan everything new for banned words, flags, character limits, invented facts and photo-rule problems.
- Report in a few lines: what changed, what's waiting on the owner (review, approve ideas, who's in a photo), weeks still short and why. Don't recap every step.

## Rules

- The owner decides what's Final and what goes on the calendar; Claude drafts and suggests.
- Ask before any write to an outside tool. Reading is fine.
- Don't set up scheduled tasks or anything that lets the page send requests into a Claude session.
- Never show faces of anyone under 18; follow the brand's photo rules for everyone else.
- No urgency or scarcity language unless the owner gives a real deadline.