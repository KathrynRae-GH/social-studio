---
name: "social-studio-setup"
description: "Set up a Social Studio page for a brand (library, calendar, asset library, ideas, Ask Claude): interview, research, brand docs, settings. Also upgrades an existing studio."
---

# Social Studio setup

Social Studio is one page per brand, built from a shared template. The code is the same for every brand; the brand lives in the page's own database (`settings/brand`, `pieces`, `events`, `assets`, …). This skill makes a new brand's page and fills in its settings. The `social-studio-weekly` skill fills it with content afterwards.

**Template:** https://claude.ai/artifact/9uP7yjoWshEiDxHrXjyngS

## 0. Read the guide first

`Artifact` read with `url` = the template and `path` = `guide.md`. It's the contract between the page and Claude: the publish call, every collection, every `settings/brand` field. Follow it exactly; this skill only covers the process around it.

## 1. See what already exists

Before asking anything:
- `Projects` → `project_info`, then read the brand docs that are there (voice guide, brand guide, strategy, past posts). Most answers are usually in them.
- `Artifact` → `list` and look for a page named "<Brand> Studio". If one exists, ask whether to **upgrade** it (section 7) or start over. Never make a second page for the same brand without asking.
- Check memory for the brand's handles, colors or preferences.
- Check connected tools (`ListConnectors` / tool list) for the brand's scheduler (GHL, Meta, Buffer, Later…), Google Drive, Dropbox, Canva.

## 2. Interview (only what's missing)

Say in one sentence what you're about to do, then ask with `AskUserQuestion` (up to 4 questions per round, 2–3 rounds at most). Offer your best guess from step 1 as the first option. Cover:

1. **Basics**: brand name as it should appear, what it is in one or two sentences, location, who it's for, the owner's first name (the page greets them), time zone.
2. **Platforms + handles**: which of Instagram, Facebook, Threads, TikTok, LinkedIn, Pinterest, YouTube Shorts, Stories; the handle and link-in-bio for each; the website.
3. **How posts go out**: a scheduler (which one, which platforms it posts to, and whether it's connected here), or everything by hand from the phone. Whether Reels go from the phone to add trending audio.
4. **Voice**: a voice guide or sample posts they love; banned words; phrases they use; exclamation points; emoji; hashtags. If they have a site, read it.
5. **Look**: brand colors (hex if they have them; otherwise pull from the site or logo), fonts (Google Fonts name, or a font file to upload), logo. Ask whether they want the checkerboard strips and burst shapes or a plainer look.
6. **Dated things**: do posts point to classes, launches, shows, drops, sales? What are they called? Where's the schedule (site, connector, a doc)? Featured people (instructors, artists, guests) whose posts should only run while they have something coming up?
7. **Photo rules**: whose faces are OK, releases, anyone under 18 (never show their faces), logos to crop, places not to show.
8. **Goals + cadence**: what a good month looks like, how many posts a week they can actually approve, content pillars (these become `contentTypes`), seasonal moments.
9. **Assets**: where their photos and video live (Drive, Dropbox, attachments) and roughly how many.

## 3. Research

- Read their website and public profiles with WebSearch/WebFetch for voice samples, visual style, what they post and how often. Quote nothing you can't link to.
- **Best times**: if a connected scheduler or analytics tool has their post history, pull it and compute engagement by hour and weekday (save the data to files and run the numbers in code). Otherwise look up current platform-wide studies with WebSearch and label them "Starting point" with the source in `src`. Never make up numbers.
- **Cadence**: set `perWeek` to what the owner said they can approve, not an ideal. Minimums, not targets.

## 4. Write the brand docs, then confirm

Write two docs to the project with `Projects` → `project_write`:
- `claude/<slug>-social-brand.md`: voice rules, banned words, sample phrases, per-platform caption norms, hashtag sets, photo rules, facts Claude may state (address, hours, prices), colors, fonts.
- `claude/<slug>-social-strategy.md`: platforms + handles, cadence and best times with sources, content pillars, posting rules, how posts go out, events source.

Then send the owner a short summary (platforms, weekly minimums, best times, posting route, colors) and ask "Build it?" This is the one checkpoint: a page is easy to change later, but get the platforms and the posting route right first.

## 5. Build the page

1. Save the shell from guide section 1 with the brand name in `<title>` (e.g. `Girl Riot Society Studio`) to a local file and publish it exactly as the guide says: `files` copying `studio.js` and `studio.css` from the template, `capabilities` `{"db": {}, "user": {}, "sample": {}, "assets": {}, "downloads": true}`, `icon: "calendar"`.
2. `ArtifactData` → `set` `settings/brand` with everything from steps 2–4 (guide section 3). Tips:
   - `slug`: short, lowercase, hyphenated. File names use its initials.
   - `palette.colors`: 4–8 brand colors. Leave `assign` as auto unless the owner wants specific colors in specific places.
   - `voice`, `facts`, `photoRules`: short lines, the most important first. Ask Claude on the page reads these every time.
   - `flags`: anything that used to be true and isn't anymore (a closed location, an old price, a retired product).
   - `ruleText`: leave out unless the brand has rules the numbers don't express.
3. `events/*` from the brand's schedule if it has dated things; set `eventsAsOf`.

## 6. Seed it

- **Assets**: bring their photos/video into the workspace (attachments, Drive, Dropbox). Convert HEIC to JPEG and MOV to MP4 (H.264/AAC, under 20 MB). Make a 360 px square JPEG thumbnail for each. Upload with `Artifact` (`url` = the brand page, `asset: true`, `file_paths`, 25 per call). Look at every image yourself and write an `assets/<id>` doc per guide section 8: plain description of what's visible, categories, place, subjects, colors, and `people` per the photo rules (use Check when unsure; never guess who someone is). Number them in a `num` sequence.
- **Ideas**: 6–10 ideas in `ideas/*` with shot lists, `approval: "pending"`, split into "now" (can be made from assets on hand) and "later".
- Pieces and Threads drafts come from `social-studio-weekly`. If the owner wants a first batch now, run that skill next.

## 7. Upgrade an existing studio

When the template has a newer version than a brand's page (compare the version in the first line of each `studio.js`): `Artifact` read the brand page, then publish to its `url` with the same shell and the two `files` entries from the template. Don't pass `capabilities`. Nothing in the db changes. Tell the owner what's new in a line.

## 8. Wrap up

- Write `claude/<slug>-studio.md` to the project: the studio URL, template URL and version, date set up, and where assets and events come from. The weekly skill looks for it.
- Tell the owner in two or three sentences what's on the page and the first thing to do (usually: check the Asset Library tags and approve ideas). The page is private to their organization; anyone they share it with needs a Claude account.

## Rules

- No invented facts, prices, dates, quotes, people, scenes or statistics, in docs, settings or posts. Ask when something is missing.
- Ask before every write to an outside tool (scheduler, social accounts, Drive). Reading is fine.
- Don't set up scheduled tasks or anything that lets the page send requests into a Claude session. Weekly runs start when the owner asks.
- Never show faces of anyone under 18. Follow the brand's photo rules for everyone else.
- Don't make pages that imitate another organization's site or login.