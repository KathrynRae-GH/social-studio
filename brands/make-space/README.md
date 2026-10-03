# Make Space: to bring over

Make Space is the first brand in the app and its prototype is the most complete one, but its brand docs and content engine live in the separate Make Space project in Claude, which this kit couldn't read. Bring them in before the milestones that need them.

**What exists today**
- Prototype page: the Make Space Content Library, https://claude.ai/artifact/J9YaRGdp7NGuFygoD2PaeG. Its page code is copied in `reference/make-space-content-library/index.html`; its pieces, captions, calendar and assets live in that page's own database.
- Brand docs in the Make Space project: voice and copy rules, the visual brand and video guide, the Reel and post styles, and the content library doc.
- Content engine: Python and video scripts in Claude's workspace that render its posts, carousels, Stories and Reels (16 Reel styles, 8 instructor-post styles, Story templates).

**What to add here, and when**
- Before M2 (Make Space moves into the app, early November): an export of the prototype's data (pieces, captions, calendar entries, assets with tags) so it can be imported.
- Before M3 (late October): the brand docs, as Markdown files in this folder.
- Before M3/M4: the engine scripts, into `reference/engine/`.

Ask Claude in the Make Space project to export these as files.
