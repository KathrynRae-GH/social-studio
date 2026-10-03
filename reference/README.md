# Reference: the prototype

Read-only material from the Claude-artifact prototype. Use it to understand what already works and to port the data model and flows. Don't copy its code into the app wholesale, and don't reuse any brand's content from it.

These files predate the "always Boutiqly" naming rule and use the platform vendor's old name in places. Nothing new should.

| Path | What it is | Why it matters |
|---|---|---|
| `studio-template/guide.md` | The data contract for the multi-brand template (v1.0.0): every collection, every `settings/brand` field, piece shapes, calendar entries, packs | The starting data model for the app's database |
| `studio-template/studio.js`, `studio.css`, `index.html` | The template's page code: Content Library, Calendar, Asset Library, Ideas, Ask Claude | How each screen behaves today (week checks, six-week plan, grid preview, packs) |
| `make-space-content-library/index.html` | Make Space's own page, the most complete prototype: posting routes, app pings, week hand-off, packs, Story sets with highlight covers. Includes Make Space's content | Behavior to match for M2. Its Make Space branding and content must never appear on another brand |
| `skills/social-studio-setup.md` | The Claude skill that sets up a brand's studio: interview, research, brand docs, settings, seeding | The basis of onboarding (M5), now with brand capture first |
| `skills/social-studio-weekly.md` | The Claude skill for the weekly run: act on notes, make pieces, Threads drafts, tag uploads, schedule | The basis of the weekly run and Ask Claude's behavior |
| `engine/` (to add) | Make Space's content engine scripts | Ported into the worker in M3–M4 |

Things the app changes from the prototype: many brands instead of one page per brand; "Locked" is now "Approved"; posting goes through Boutiqly's API instead of weekly packs; rendering runs on a server; Ask Claude runs on Opus 5.5 with full design ability; usage is billed to each sub-account's wallet.
