// Ask Claude: a chat with tools, scoped to one shop. Claude can read the
// library, calendar and files, look at images, search the web, design and
// render pieces (which land as Suggested), and propose calendar or caption
// changes that someone on the Team applies with one tap. It never approves
// anything, never marks a caption Final, and only uses files the rules allow.
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, like, lte, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/pool.ts";
import { assets, calendarEntries, captions, conversationMessages, conversations, pieces, products, proposals, stores } from "../db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "../brands.ts";
import { callClaude, ClaudePausedError, type ClaudeDeps } from "./client.ts";
import { tryWithLock } from "../jobs.ts";
import { assetDetail, inspirationFor, ownAsset, tagAsset, usableInDesign } from "../assets.ts";
import { styleForDesign } from "../styles.ts";
import { renderAndWait, type RenderDeps } from "../render.ts";
import { recentVerdicts } from "../feedback.ts";
import { addedAt, isNewProduct, liveProducts } from "../store/sync.ts";
import { getPiece, setCaption } from "../library.ts";
import { addEntries, brandTimezone, moveEntry, type CalendarDeps } from "../calendar.ts";
import { CHANNELS, KIND_LABELS, channel, channelsFor, type Kind } from "../../../shared/channels.ts";
import { LAYOUTS, LAYOUT_KINDS, SIZES, brandVariables, layoutKind, readablePairs, type Design, type StyleSetView } from "../../../shared/design.ts";
import { utcToZoned, zonedToUtc } from "../../../shared/time.ts";
import type { AskEvent, ChatItem, ConversationSummary, ConversationView, ProposalView } from "../../../shared/ask.ts";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

export interface AskDeps extends ClaudeDeps {
  fetchImpl: typeof fetch;
  pool: RenderDeps["pool"];
  render: RenderDeps;
  calendar: CalendarDeps;
}

const MAX_TURNS = 14;
const MAX_TAG_PER_CALL = 12;
const RECENT_LAYOUTS_BLOCKED = 3; // a new piece can't reuse the layouts of the last 3 designs
const RECENT_SHOWN = 6; // recent designs described in each message
const RECENT_IMAGES = 3; // of which this many are shown as pictures

// Channels this kind of piece can go to that don't have a caption yet.
async function missingCaptions(db: Db, pieceId: string, kind: Kind): Promise<string[]> {
  const have = new Set((await db.select({ channel: captions.channel, text: captions.text }).from(captions).where(eq(captions.pieceId, pieceId))).filter((c) => c.text.trim()).map((c) => c.channel));
  return channelsFor(kind).map((c) => c.id as string).filter((id) => !have.has(id));
}

// The shop's most recent designed pieces, newest first.
async function recentDesigns(db: Db, brand: Brand, limit: number) {
  const rows = await db
    .select({ id: pieces.id, title: pieces.title, kind: pieces.kind, design: pieces.design, assetIds: pieces.assetIds })
    .from(pieces)
    .where(and(eq(pieces.brandId, brand.id), eq(pieces.archived, false), isNotNull(pieces.design)))
    .orderBy(desc(pieces.createdAt))
    .limit(limit);
  return rows.filter((r): r is typeof r & { design: Design } => !!r.design);
}
const KINDS = Object.keys(KIND_LABELS) as Kind[];

// ---- What Claude is told ----

function channelGuide(): string {
  return CHANNELS.map((c) => `- ${c.id} (${c.name}): takes ${Object.keys(c.kinds).join(", ")}; caption limit ${c.captionLimit}; sizes ${c.sizes}`).join("\n");
}

const RULES = `## Rules you always follow
- On brand, always: use only this shop's look (the style set below), its own files and its logo. Never another brand's look.
- Never generate, draw or describe-into-existence people or faces. People only appear through this shop's own photos.
- Never invent facts, prices, dates, quotes, stats, product names or events. Use what the shop told you, what's in its library, or what you found on the web (say where). If you don't know, ask or leave a clear placeholder like [price].
- Only use files that list_assets marks usable. Files may be blocked because they're marked Don't use, may show someone under 18, or have flagged private details. Never try to work around a block.
- Files marked "no faces" may only be used where no face shows (cropped, from behind, hands, products).
- Licensed stock is never presented as a customer.
- Products: when the shop has a connected online store, list_products gives its real product names, descriptions and links. Use only those names and links, never made-up ones. Never mention prices in posts or captions (the owner's rule), even if you find one.
- You never approve, schedule or post anything, and never mark a caption Final. Your pieces land as Suggested for the owner to review. Calendar and caption changes go through propose_change for the owner to apply.
- How posts reach the calendar: the owner approves a post in the Library for the networks they tick; then "Plan my calendar" on the Calendar places every approved post; the owner locks the dates and sends locked posts to Boutiqly. You can only propose calendar spots for approved posts and their approved networks, never move locked entries, and can't change approved posts.
- Write in the shop's voice from its notes. Plain, warm and specific. Avoid: empower, thrive, streamline, seamless, elevate, unlock, solution.`;

function designGuide(style: StyleSetView): string {
  const vars = Object.keys(brandVariables(style)).join(", ");
  return `## How designs work (the technical part)
A design is HTML + CSS (with inline SVG) for each frame, rendered to an image at an exact size:
${Object.entries(SIZES).map(([k, v]) => `- ${k}: ${v.label}`).join("\n")}
Use post/carousel → portrait, story/story_set → story, pin → pin, google_update → landscape.
The engine already sets: box-sizing border-box; html/body at the frame size with overflow hidden; body background var(--brand-background), color var(--brand-text), font var(--font-body); h1–h4 and .heading use var(--font-heading); class "photo" = width/height 100% object-fit cover.
Brand colors and fonts come from these CSS variables: ${vars}. Build every color from them (tints and shades with color-mix(), e.g. color-mix(in srgb, var(--brand-accent) 40%, white), are fine). Pure white and black are fine for contrast.
Photos: <img class="photo" src="asset:ASSET_ID"> or CSS url("asset:ASSET_ID"). The logo, only if the shop has an approved one: src="asset:logo".
No scripts and no outside links; only the shop's two fonts (already loaded). Chromium renders it, so modern CSS works: grid, clip-path, mask, mix-blend-mode, filter, transforms, gradients, color-mix, text-stroke, and SVG filters such as feTurbulence for grain and paper texture.

## Design like a great social designer, not a template
Your first idea is usually the safe one. Push past it. Every post should look like this shop made it on a good day, not like a slide deck.

Before you design, decide (briefly, to yourself):
- The one thing someone should feel or do in the 1.5 seconds they look at it.
- The idea: a visual metaphor, a strong photo crop, a bold typographic statement, a playful graphic, a before/after, a list, a quote. Pick one and commit.
- Which of the shop's inspiration posts it borrows from (layout, energy, graphic habits), without copying them.

Composition
- Make one element clearly dominant (huge type, a big photo crop, or a bold shape), then one or two supporting pieces. Avoid a centered stack of small, evenly sized things.
- Use asymmetry, overlap and tension: type that runs off the edge, photos that break out of their frame, elements that overlap, tilted stickers (rotate 2–8°).
- Use real scale contrast: a headline 3–6x the size of body text. Headlines on a 1080px frame are often 120–260px. Keep body text 34px or more.
- Fill the frame on purpose: either generous empty space or edge-to-edge energy, never a lonely block floating in the middle.
- Keep the important things 60px or more from the edges (Instagram crops and overlays), except elements meant to bleed off.

Graphic language (draw it in code, matched to the shop's vibe)
- Shapes and accents: blobs, arches, circles, starbursts, badges, stickers with a white outline, hand-drawn-feeling squiggles and underlines (SVG paths with round caps), arrows, sparkles, tape, torn-paper edges (clip-path), halftone dots, stripes, checkerboards, grids.
- Texture adds warmth: subtle paper grain (an SVG feTurbulence filter at low opacity), soft gradients, risograph-style offset shadows.
- Color blocking: big flat fields of the brand colors, split layouts, color-on-color type. Use the accent sparingly, so it pops.
- Type treatments: tight leading on big headlines (0.9–1.0), uppercase with tracking for small labels, mixing weights, outline text, text on a curved path (SVG textPath), a highlighted word with a marker stroke behind it.
- Photo treatments: bold crops (close-ups beat wide shots), arch or circle masks, duotone with mix-blend-mode, a sticker-style cutout frame, a photo grid, a photo placed on a colored block with a shadow.

Variety (posts must not look alike)
- Posts come in three kinds, and each new post must be a different kind from the one before (the last post is described in each message), unless the owner asks for the same:
${Object.entries(LAYOUT_KINDS).map(([, k]) => `  - ${k.label}: ${k.layouts.join(", ")}`).join("\n")}
  For example, after a type poster make a full-bleed photo post, then a collage.
- Every design names its layout family, and never repeats the family of the last three posts:
${Object.entries(LAYOUTS).map(([k, v]) => `  - ${k}: ${v}`).join("\n")}
- Also vary placement: if recent posts put a starburst top right and a circle photo bottom right, put the focal point and graphics somewhere else this time (left, center, bottom band, full-bleed). Vary the background (light vs. saturated vs. photo vs. pattern), the headline position and the graphic motifs themselves.
- Record where the main graphics sit in "motifs" so the next post can avoid repeating them.

Carousels and Story sets
- Slide 1 is the hook: one bold statement or image that makes people swipe. No logo-only covers.
- Keep one visual system across slides (same grid, colors and type) but vary each slide's composition so it doesn't feel repetitive. A continuous element across slide edges (a line or shape that carries across) rewards swiping.
- End with a clear, friendly call to action slide when it fits.

Things that make a post look basic (avoid them)
- Everything centered, the same size, on a plain flat background.
- Default-looking rounded rectangles and small pill labels as the only graphics.
- A photo in the top half with text in the bottom half, every time.
- Tiny type, timid color, and lots of dead space with nothing intentional in it.
- Repeating the last post's layout.`;
}

const CRITIQUE = `Review the rendered frames above like a demanding art director, against this checklist:
1. Stop power: would this stop someone mid-scroll? Is there one clear focal point?
2. On brand: does it feel like this shop and its inspiration board, not a generic template?
3. Craft: hierarchy, scale contrast, spacing and alignment intentional; nothing awkwardly cramped or floating; text fully visible, not cut off or overflowing (unless it bleeds on purpose).
4. Legibility: readable on a phone, strong contrast.
5. Freshness: is any part "basic" (see the list in your instructions)?
Name the two or three biggest weaknesses to yourself, then fix them.`;

function colorMap(style: StyleSetView): string {
  const vars = brandVariables(style);
  const lines = style.colors.map((c, i) => `- var(--brand-color-${i + 1}) = ${c.name} ${c.hex}${c.primary ? " (PRIMARY)" : ""}`);
  const primaries = style.colors.filter((c) => c.primary);
  lines.push(
    "",
    "Every color is available for anything: backgrounds, type, shapes, stickers, borders, accents. Mix them in different combinations from post to post, and vary which color leads.",
    primaries.length
      ? `The primary colors (${primaries.map((c) => c.name).join(", ")}) carry the brand: use at least one prominently in every post, and the others in supporting roles.`
      : "No primary colors are marked yet, so balance all of them.",
    "Contrast rule: only put text on a color using a pairing from this list (white and black count). Body text needs 4.5:1; big headings (about 48px and up) can use 3:1.",
    ...readablePairs(style.colors).map(
      (p) =>
        `- On ${p.on.name}: body text in ${p.body.map((c) => c.name).join(", ") || "none, so keep text off this color"}${p.headings.length ? `; big headings also in ${p.headings.map((c) => c.name).join(", ")}` : ""}`,
    ),
    "",
    `Defaults the engine sets on the page: var(--brand-background) = ${vars["--brand-background"]}, var(--brand-text) = ${vars["--brand-text"]}. Override freely.`,
  );
  return lines.join("\n");
}

function styleText(style: StyleSetView, shopName: string): string {
  return `## This shop
Name: ${shopName || "(not set)"}
Look: ${style.status === "approved" ? "the shop's approved style set" : "the basic Boutiqly look (the shop's own look isn't approved yet), with no logo"}
Colors (and the CSS variable for each, so you never need to test them):
${colorMap(style)}
Heading font: ${style.headingFont}. Body font: ${style.bodyFont}.${style.customFonts.length ? `\nUploaded fonts (already loaded, use by family name): ${[...new Set(style.customFonts.map((f) => `${f.family} (${style.customFonts.filter((x) => x.family === f.family).map((x) => `${x.weight}${x.italic ? " italic" : ""}`).join(", ")})`))].join("; ")}.` : ""}
Logo: ${style.logoUrl ? "yes (asset:logo)" : "none, so never include a logo"}
Vibe: ${style.vibe || "(no notes yet)"}
Dos and don'ts: ${style.dosDonts || "(none yet)"}
Inspiration board: the shop's loved posts are attached at the start of each chat (if it has any). Study them closely: their layouts, graphic habits, type treatments, color use and energy. Design in that spirit for this shop's own content. Never copy another brand's posts, logos or text, and never put an inspiration image into a design.`;
}

function systemPrompt(style: StyleSetView, shopName: string): string {
  return `You are Claude, working inside Social Studio, a social media studio built into Boutiqly for small shops. You help the shop's owner and team plan, design and write their social media: posts, carousels, Stories, Story sets, text posts, pins, Google updates, captions for every channel, alt text, ideas and the posting plan. You're a strong designer and a warm, specific writer. Keep replies short and useful; show, don't lecture.

${RULES}

## How you work on a design request
1. If the post is about products (new arrivals, a featured piece, a restock), call list_products first: it has the real names, links and which ones are new, plus the asset id of each product's photo when it can be used. Then call list_assets and pick the shop's best photos for the idea (product posts feature product photos). If nothing usable fits, tell the owner plainly what's missing (for example "I don't have photos of the new arrivals yet; upload a few in Assets") and either ask or make a clearly typographic post, never fake it with empty color blocks.
2. Write real copy: an on-brand headline and short lines on the slides, and **a caption for every channel this kind of piece can go to** (see Channels; the owner picks where to post later), each written for that channel, with alt text, in the shop's voice from its vibe notes and dos and don'ts. Only skip channels if the owner says so. Use only facts you have; put [placeholders] where the owner must fill in a price or date.
3. Every design_piece call makes a real post the owner sees in their Library. Never make tests, color swatches, palette checks, layout experiments or placeholder pieces. You already know every color and font from this prompt.
4. A carousel has 3–10 frames; a Story set has 2–10.

${designGuide(style)}

## Channels
${channelGuide()}

Captions: write one per channel the piece is for, within each channel's limit, plus alt text describing the image for screen readers. Threads, Bluesky and X are short and conversational; LinkedIn is plainer; Instagram can be longer with a few relevant hashtags at the end.

${styleText(style, shopName)}`;
}

// ---- Tools ----

const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "search_library",
    description: "Search this shop's library of pieces (posts, carousels, Stories...). Returns ids, kinds, titles, caption excerpts and calendar status.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to match in titles or captions. Empty for the latest." },
        kind: { type: "string", enum: KINDS },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
    },
  },
  {
    name: "read_calendar",
    description: "Read the shop's calendar between two dates (shop's local dates, YYYY-MM-DD). Defaults to the next 14 days.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
    },
  },
  {
    name: "list_assets",
    description: "List this shop's files (photos, graphics, videos) with Claude's description, tags and whether they may be used in designs.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to match in names, descriptions or tags." },
        only_usable: { type: "boolean", description: "Default true." },
      },
    },
  },
  {
    name: "list_products",
    description:
      "List products from the shop's connected online store, newest first: name, link, type, a short description, whether it's new (added in the last 14 days), whether it's in stock, and photo_asset_id when its photo may be used in designs. No prices, on purpose.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to match in names, types, tags or descriptions." },
        new_only: { type: "boolean", description: "Only products added in the last 14 days." },
        limit: { type: "integer", minimum: 1, maximum: 60 },
      },
    },
  },
  {
    name: "look_at_image",
    description: "See one of this shop's files (or a rendered design frame) as an image.",
    input_schema: { type: "object", properties: { asset_id: { type: "string" } }, required: ["asset_id"] },
  },
  {
    name: "design_piece",
    description:
      "Create a new piece, or change one (pass piece_id), with its design and captions. The design is rendered to images and attached; the result includes the rendered frames' asset ids so you can look at them. Pieces you make are Suggested; you can't edit pieces already approved or scheduled. For a text post, leave design out.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        piece_id: { type: "string" },
        kind: { type: "string", enum: KINDS },
        title: { type: "string", description: "Short internal name, like 'Fall sale carousel'." },
        link: { type: "string", description: "The product or shop page this post points to, exactly as list_products gave it. Saved with the post and used as its link where the channel takes one." },
        design: {
          type: "object",
          properties: {
            size: { type: "string", enum: Object.keys(SIZES) },
            layout: { type: "string", enum: Object.keys(LAYOUTS), description: "The layout family (see Variety in your instructions)." },
            motifs: { type: "string", description: "Where the main graphic elements sit, e.g. 'starburst top right; rope line along the bottom; arrow bottom left'." },
            owner_asked_for_this_layout: { type: "boolean", description: "True only if the owner explicitly asked for this layout or to match a recent post." },
            css: { type: "string" },
            frames: { type: "array", items: { type: "object", properties: { html: { type: "string" } }, required: ["html"] } },
          },
          required: ["size", "layout", "motifs", "css", "frames"],
        },
        captions: {
          type: "object",
          description: "By channel id: { text, alt_text }.",
          additionalProperties: {
            type: "object",
            properties: { text: { type: "string" }, alt_text: { type: "string" } },
            required: ["text"],
          },
        },
      },
      required: ["kind", "title"],
    },
  },
  {
    name: "propose_change",
    description:
      "Propose a change for the owner to apply with one tap: add a piece to the calendar, move a calendar entry, or replace a caption. Nothing changes until they tap Apply.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["add_to_calendar", "move_entry", "set_caption"] },
        summary: { type: "string", description: "One plain sentence the owner sees, like 'Post the fall carousel on Instagram Tue Oct 20 at 9 am'." },
        piece_id: { type: "string" },
        channels: { type: "array", items: { type: "string" } },
        entry_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD, shop's local date" },
        time: { type: "string", description: "HH:MM, 24-hour, shop's local time" },
        channel: { type: "string" },
        text: { type: "string" },
        alt_text: { type: "string" },
      },
      required: ["kind", "summary"],
    },
  },
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
];

const STATUS_TEXT: Record<string, string> = {
  search_library: "Looking through the library…",
  read_calendar: "Reading the calendar…",
  list_assets: "Looking through your files…",
  list_products: "Looking through your store's products…",
  look_at_image: "Looking at a picture…",
  design_piece: "Designing and rendering…",
  propose_change: "Writing up a change for you…",
};

const SearchInput = z.object({ query: z.string().max(200).optional(), kind: z.enum(KINDS as [Kind, ...Kind[]]).optional(), limit: z.number().int().min(1).max(50).optional() });
const CalendarInput = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const AssetsInput = z.object({ query: z.string().max(200).optional(), only_usable: z.boolean().optional() });
const LookInput = z.object({ asset_id: z.string() });
const ProductsInput = z.object({ query: z.string().max(200).optional(), new_only: z.boolean().optional(), limit: z.number().int().min(1).max(60).optional() });
const DesignInput = z.object({
  piece_id: z.string().optional(),
  kind: z.enum(KINDS as [Kind, ...Kind[]]),
  title: z.string().max(200),
  link: z.string().max(2048).optional(),
  design: z
    .object({
      size: z.string(),
      layout: z.string().optional(),
      motifs: z.string().optional(),
      owner_asked_for_this_layout: z.boolean().optional(),
      css: z.string(),
      frames: z.array(z.object({ html: z.string() })),
    })
    .optional(),
  captions: z.record(z.string(), z.object({ text: z.string(), alt_text: z.string().optional() })).optional(),
});
const ProposeInput = z.object({
  kind: z.enum(["add_to_calendar", "move_entry", "set_caption"]),
  summary: z.string().min(3).max(300),
  piece_id: z.string().optional(),
  channels: z.array(z.string()).optional(),
  entry_id: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  channel: z.string().optional(),
  text: z.string().optional(),
  alt_text: z.string().optional(),
});

interface ToolOutcome {
  content: string | ContentBlock[];
  isError?: boolean;
}

interface RunCtx {
  drafts: Map<string, number>; // design_piece renders per piece in this reply
  deps: AskDeps;
  viewer: Viewer;
  brand: Brand;
  conversationId: string;
  emit: (e: AskEvent) => void;
}

const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function runTool(ctx: RunCtx, name: string, rawInput: unknown): Promise<ToolOutcome> {
  const { deps, brand, viewer } = ctx;
  const db = deps.db;
  switch (name) {
    case "search_library": {
      const input = SearchInput.parse(rawInput);
      const q = input.query?.trim();
      const conds = [eq(pieces.brandId, brand.id), eq(pieces.archived, false)];
      if (input.kind) conds.push(eq(pieces.kind, input.kind));
      let rows = await db.select().from(pieces).where(and(...conds)).orderBy(desc(pieces.updatedAt)).limit(200);
      const caps = rows.length ? await db.select().from(captions).where(inArray(captions.pieceId, rows.map((r) => r.id))) : [];
      if (q) {
        const needle = q.toLowerCase();
        rows = rows.filter((r) => r.title.toLowerCase().includes(needle) || caps.some((c) => c.pieceId === r.id && c.text.toLowerCase().includes(needle)));
      }
      rows = rows.slice(0, input.limit ?? 20);
      const entries = rows.length ? await db.select().from(calendarEntries).where(and(eq(calendarEntries.brandId, brand.id), inArray(calendarEntries.pieceId, rows.map((r) => r.id)))) : [];
      const tz = brandTimezone(brand);
      return {
        content: JSON.stringify(
          rows.map((r) => ({
            piece_id: r.id,
            kind: r.kind,
            title: r.title,
            made_by: r.source,
            frames: r.assetIds.length,
            frame_asset_ids: r.assetIds,
            has_design: !!r.design,
            approved_for: r.approvedAt ? r.approvedChannels : null,
            captions: Object.fromEntries(caps.filter((c) => c.pieceId === r.id).map((c) => [c.channel, c.text.slice(0, 300)])),
            on_calendar: entries
              .filter((e) => e.pieceId === r.id)
              .map((e) => ({ entry_id: e.id, channel: e.channel, status: e.status === "approved" ? "on_calendar" : e.status, locked: !!e.lockedAt, ...utcToZoned(e.scheduledAt, tz) })),
          })),
        ),
      };
    }
    case "read_calendar": {
      const input = CalendarInput.parse(rawInput);
      const tz = brandTimezone(brand);
      const today = utcToZoned(new Date(), tz).date;
      const from = zonedToUtc(input.from ?? today, "00:00", tz);
      const toDate = input.to ?? new Date(Date.parse(`${today}T12:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10);
      const to = zonedToUtc(toDate, "23:59", tz);
      const rows = await db
        .select({ e: calendarEntries, title: pieces.title, kind: pieces.kind })
        .from(calendarEntries)
        .innerJoin(pieces, eq(pieces.id, calendarEntries.pieceId))
        .where(and(eq(calendarEntries.brandId, brand.id), gte(calendarEntries.scheduledAt, from), lte(calendarEntries.scheduledAt, to)))
        .orderBy(asc(calendarEntries.scheduledAt))
        .limit(300);
      return {
        content: JSON.stringify({
          time_zone: tz,
          today,
          entries: rows.map(({ e, title, kind }) => ({ entry_id: e.id, piece_id: e.pieceId, title, kind, channel: e.channel, status: e.status, ...utcToZoned(e.scheduledAt, tz) })),
        }),
      };
    }
    case "list_assets": {
      const input = AssetsInput.parse(rawInput);
      const q = input.query?.trim().toLowerCase();
      // Photos uploaded while Claude was off were never looked at, so they
      // can't be used yet. Look at them now (a cent or so each).
      const untagged = await db
        .select({ id: assets.id })
        .from(assets)
        .where(and(eq(assets.brandId, brand.id), eq(assets.madeBy, "upload"), eq(assets.purpose, "content"), isNull(assets.taggedAt), like(assets.mime, "image/%")))
        .limit(MAX_TAG_PER_CALL);
      if (untagged.length) {
        ctx.emit({ type: "status", text: `Looking at ${untagged.length} new photo${untagged.length > 1 ? "s" : ""} first…` });
        const results = await Promise.allSettled(untagged.map((u) => tagAsset(deps, viewer, u.id)));
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length) console.warn(`[ask] ${failed.length} photo(s) couldn't be tagged: ${(failed[0] as PromiseRejectedResult).reason}`);
      }
      const rows = await db.select().from(assets).where(and(eq(assets.brandId, brand.id), or(eq(assets.madeBy, "upload"), eq(assets.madeBy, "blur")))).orderBy(desc(assets.createdAt)).limit(500);
      const productIds = rows.map((r) => r.productId).filter((x): x is string => !!x);
      const productNames = new Map(
        productIds.length ? (await db.select({ id: products.id, title: products.title }).from(products).where(and(eq(products.brandId, brand.id), inArray(products.id, productIds)))).map((p) => [p.id, p.title]) : [],
      );
      const list = rows
        .map((r) => ({ ...assetDetail(r), product: r.productId ? productNames.get(r.productId) : undefined }))
        .filter((a) => (input.only_usable === false ? true : a.usable.ok))
        .filter((a) => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.tags.some((t) => t.includes(q)))
        .slice(0, 60)
        .map((a) => ({
          asset_id: a.id,
          name: a.name,
          type: a.mime,
          description: a.description,
          tags: a.tags,
          people: a.hasPeople,
          people_rule: a.peopleRule,
          usable: a.usable.ok,
          ...(a.product ? { store_product: a.product } : {}),
          ...(a.usable.ok ? {} : { why_not: a.usable.reason }),
        }));
      return { content: JSON.stringify(list) };
    }
    case "list_products": {
      const input = ProductsInput.parse(rawInput);
      const [store] = await db.select().from(stores).where(eq(stores.brandId, brand.id));
      if (!store) return { content: "This shop hasn't connected its online store yet. The owner can add it on Brand → Online store. Ask the owner for product details, or use what's in the library." };
      const q = input.query?.trim().toLowerCase();
      const rows = (await liveProducts(db, brand.id))
        .filter((p) => !input.new_only || isNewProduct(p))
        .filter((p) => !q || [p.title, p.productType, p.description, ...p.tags].some((t) => t.toLowerCase().includes(q)))
        .slice(0, input.limit ?? 30);
      const photoIds = rows.map((p) => p.assetId).filter((x): x is string => !!x);
      const usable = new Set(
        photoIds.length ? (await db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, photoIds)))).filter((a) => usableInDesign(a).ok).map((a) => a.id) : [],
      );
      return {
        content: JSON.stringify({
          store: store.url,
          last_read: store.lastReadAt?.toISOString().slice(0, 10) ?? "not yet",
          products: rows.map((p) => ({
            product_id: p.id,
            name: p.title,
            link: p.url,
            type: p.productType || undefined,
            tags: p.tags.length ? p.tags : undefined,
            description: p.description.slice(0, 400),
            new: isNewProduct(p),
            added: addedAt(p)?.toISOString().slice(0, 10),
            in_stock: p.available ?? undefined,
            photo_asset_id: p.assetId && usable.has(p.assetId) ? p.assetId : undefined,
          })),
        }),
      };
    }
    case "look_at_image": {
      const input = LookInput.parse(rawInput);
      const a = await ownAsset(db, brand, input.asset_id);
      if (!a.mime.startsWith("image/")) return { content: "That file is a video; only images can be looked at for now.", isError: true };
      return {
        content: [
          { type: "image", source: { type: "url", url: a.url } },
          { type: "text", text: `${a.name}${a.madeBy === "render" ? " (a rendered design frame)" : ""}` },
        ],
      };
    }
    case "design_piece": {
      const input = DesignInput.parse(rawInput);
      if (!input.piece_id && Object.values(input.captions ?? {}).every((c) => !c.text.trim())) {
        return {
          content: "Nothing was saved. A new piece needs its captions: write one for each channel it's for (at least Instagram for a post or carousel), plus alt text, in the shop's voice. Then call design_piece again.",
          isError: true,
        };
      }
      if (input.design && input.kind !== "text") {
        if (!input.design.layout || !(input.design.layout in LAYOUTS)) {
          return { content: `Nothing was saved. Name the layout family: one of ${Object.keys(LAYOUTS).join(", ")}.`, isError: true };
        }
        if (!input.piece_id && !input.design.owner_asked_for_this_layout) {
          const recent = await recentDesigns(db, brand, RECENT_LAYOUTS_BLOCKED);
          // The kind of post switches from the last one (graphics → photo → several photos).
          const lastKind = layoutKind(recent[0]?.design.layout);
          const thisKind = layoutKind(input.design.layout);
          if (lastKind && thisKind === lastKind) {
            const usablePhotos = (await db.select().from(assets).where(and(eq(assets.brandId, brand.id), eq(assets.purpose, "content"), like(assets.mime, "image/%"))))
              .filter((a) => a.madeBy !== "render" && usableInDesign(a).ok).length;
            const photoKindsPossible = usablePhotos > 0;
            if (lastKind !== "graphic" || photoKindsPossible) {
              const others = Object.entries(LAYOUT_KINDS).filter(([k]) => k !== lastKind && (photoKindsPossible || k === "graphic"));
              return {
                content: `Nothing was saved. The last post ("${recent[0]!.title}") was ${LAYOUT_KINDS[lastKind]!.label} (${recent[0]!.design.layout}). Make this one a different kind: ${others.map(([, k]) => `${k.label} (${k.layouts.join(", ")})`).join("; or ")}.`,
                isError: true,
              };
            }
          }
          const clash = recent.find((r) => r.design.layout === input.design!.layout);
          if (clash) {
            return {
              content: `Nothing was saved. "${clash.title}" already used the ${input.design.layout} layout recently. Pick a different layout family for variety (recent: ${recent.map((r) => r.design.layout ?? "?").join(", ")}), and place your graphics differently too.`,
              isError: true,
            };
          }
        }
      }
      let pieceId = input.piece_id;
      if (pieceId) {
        if (!isUuid(pieceId)) return { content: "piece_id isn't a valid id.", isError: true };
        const [p] = await db.select().from(pieces).where(and(eq(pieces.id, pieceId), eq(pieces.brandId, brand.id)));
        if (!p) return { content: "That piece isn't in this shop's library.", isError: true };
        if (p.approvedAt) return { content: "That piece is already approved, so it can't be changed. Make a new piece instead, or ask the owner to undo the approval.", isError: true };
        const locked = await db
          .select({ id: calendarEntries.id })
          .from(calendarEntries)
          .where(and(eq(calendarEntries.pieceId, pieceId), inArray(calendarEntries.status, ["approved", "scheduled", "posted"])))
          .limit(1);
        if (locked.length) return { content: "That piece is already approved or scheduled, so it can't be changed. Make a new piece instead.", isError: true };
        await db.update(pieces).set({ kind: input.kind, title: input.title, updatedAt: new Date() }).where(eq(pieces.id, pieceId));
      } else {
        const [row] = await db
          .insert(pieces)
          .values({ brandId: brand.id, kind: input.kind, title: input.title, source: "claude", createdBy: viewer.ctx.userId })
          .returning({ id: pieces.id });
        pieceId = row!.id;
        await audit(db, viewer, "piece.create_by_claude", { pieceId, kind: input.kind, conversationId: ctx.conversationId });
      }

      const capNotes: string[] = [];
      if (input.link !== undefined) {
        const link = input.link.trim();
        const [known] = link ? await db.select({ id: products.id }).from(products).where(and(eq(products.brandId, brand.id), eq(products.url, link))).limit(1) : [];
        const [store] = await db.select({ url: stores.url }).from(stores).where(eq(stores.brandId, brand.id));
        let onStore = false;
        try {
          onStore = !!store && new URL(link).hostname === new URL(store.url).hostname;
        } catch {
          /* not a web address */
        }
        if (!link || known || onStore) await db.update(pieces).set({ link }).where(eq(pieces.id, pieceId));
        else capNotes.push("The link wasn't saved: use a product link exactly as list_products gave it, or one on the shop's own store.");
      }
      const allowed = new Set(channelsFor(input.kind).map((c) => c.id as string));
      for (const [ch, cap] of Object.entries(input.captions ?? {})) {
        if (!allowed.has(ch)) {
          capNotes.push(`${ch} doesn't take a ${input.kind}, so that caption was skipped.`);
          continue;
        }
        const limit = channel(ch)!.captionLimit;
        if (cap.text.length > limit) capNotes.push(`The ${ch} caption is ${cap.text.length} characters; the limit is ${limit}. Shorten it.`);
        // Always a draft: only people mark captions Final.
        await setCaption(db, viewer, pieceId, ch, { text: cap.text, altText: cap.alt_text ?? "", status: "draft" });
      }

      const missing = await missingCaptions(db, pieceId, input.kind);
      if (missing.length) capNotes.push(`Still missing captions for: ${missing.join(", ")}. Write them (each in that channel's style) in your next design_piece call with piece_id ${pieceId}.`);

      let frames: string[] = [];
      if (input.design) {
        if (input.kind === "text") return { content: "A text post has no design; leave design out.", isError: true };
        try {
          const state = await renderAndWait(deps.render, brand, pieceId, input.design, viewer.ctx.userId);
          if (state !== "done") {
            const [p] = await db.select({ design: pieces.design }).from(pieces).where(eq(pieces.id, pieceId));
            return {
              content: state === "pending" ? `The render is taking longer than usual. piece_id ${pieceId}. It will attach when it finishes.` : `The render failed: ${p?.design?.renderError ?? "unknown error"}. Fix the design and call design_piece again with piece_id ${pieceId}.`,
              isError: state === "failed",
            };
          }
        } catch (err) {
          if (err instanceof AccessError) return { content: `${err.message} (piece_id ${pieceId})`, isError: true };
          throw err;
        }
        const [p] = await db.select({ assetIds: pieces.assetIds }).from(pieces).where(eq(pieces.id, pieceId));
        frames = p?.assetIds ?? [];
      }
      const view = await getPiece(db, viewer, pieceId);
      ctx.emit({ type: "piece", piece: view });
      const summary = JSON.stringify({
        piece_id: pieceId,
        status: "Suggested",
        rendered_frame_asset_ids: frames,
        captions_saved: Object.keys(view.captions),
        notes: capNotes,
      });
      if (frames.length === 0) return { content: summary };
      // Claude sees what it made, and the first draft of a piece always gets
      // a critique-and-improve round before the owner sees the final.
      const draft = (ctx.drafts.get(pieceId) ?? 0) + 1;
      ctx.drafts.set(pieceId, draft);
      const frameRows = await db.select({ id: assets.id, url: assets.url }).from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, frames)));
      const images: ContentBlock[] = frames
        .map((id) => frameRows.find((r) => r.id === id))
        .filter((r): r is { id: string; url: string } => !!r)
        .flatMap((r, i) => [
          { type: "text" as const, text: `Frame ${i + 1}:` },
          { type: "image" as const, source: { type: "url" as const, url: r.url } },
        ]);
      const next =
        draft === 1
          ? `This is draft 1. Required before you reply to the owner: ${CRITIQUE}\nThen call design_piece again with piece_id ${pieceId} and the improved design (keep the captions unless they need changing).`
          : draft >= 3
            ? `This is the final draft for this turn.${missing.length ? ` First add the missing captions (${missing.join(", ")}) with one more design_piece call on piece_id ${pieceId} without a design.` : ""} Then reply to the owner: say in a sentence or two what you made and why, and offer one or two specific directions they could ask for next.`
            : `This is draft ${draft}. ${CRITIQUE}\nIf something is still clearly weak, call design_piece once more with piece_id ${pieceId}; otherwise reply to the owner with a sentence or two on what you made and why.`;
      return { content: [{ type: "text", text: summary }, ...images, { type: "text", text: next }] };
    }
    case "propose_change": {
      const input = ProposeInput.parse(rawInput);
      const problems: string[] = [];
      if (input.kind === "add_to_calendar" && (!input.piece_id || !input.channels?.length || !input.date || !input.time)) problems.push("add_to_calendar needs piece_id, channels, date and time.");
      if (input.kind === "move_entry" && (!input.entry_id || !input.date || !input.time)) problems.push("move_entry needs entry_id, date and time.");
      if (input.kind === "set_caption" && (!input.piece_id || !input.channel || input.text === undefined)) problems.push("set_caption needs piece_id, channel and text.");
      if (input.piece_id && !isUuid(input.piece_id)) problems.push("piece_id isn't a valid id.");
      if (input.entry_id && !isUuid(input.entry_id)) problems.push("entry_id isn't a valid id.");
      if (!problems.length && input.kind === "add_to_calendar") {
        const [p] = await db.select().from(pieces).where(and(eq(pieces.id, input.piece_id!), eq(pieces.brandId, brand.id)));
        if (!p) problems.push("That piece isn't in this shop's library.");
        else if (!p.approvedAt) problems.push("That piece isn't approved yet. Ask the owner to approve it in the Library first; then Plan my calendar places it.");
        else if (input.channels!.some((c) => !p.approvedChannels.includes(c))) problems.push(`It's only approved for ${p.approvedChannels.join(", ")}.`);
      }
      if (problems.length) return { content: problems.join(" "), isError: true };
      const [row] = await db
        .insert(proposals)
        .values({ brandId: brand.id, conversationId: ctx.conversationId, kind: input.kind, summary: input.summary, payload: input })
        .returning();
      const proposal: ProposalView = { id: row!.id, kind: input.kind, summary: input.summary, status: "open" };
      ctx.emit({ type: "proposal", proposal });
      return { content: JSON.stringify({ proposal_id: row!.id, status: "waiting for the owner to tap Apply" }) };
    }
    default:
      return { content: `There's no tool called ${name}.`, isError: true };
  }
}

// ---- Conversations ----

async function ownConversation(db: Db, brand: Brand, viewer: Viewer, id: string) {
  if (!isUuid(id)) throw new AccessError("That conversation isn't here.", 404);
  const [c] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.brandId, brand.id), eq(conversations.userId, viewer.ctx.userId)));
  if (!c) throw new AccessError("That conversation isn't here.", 404);
  return c;
}

export async function listConversations(db: Db, viewer: Viewer): Promise<ConversationSummary[]> {
  const brand = requirePermission(viewer, "use_tab");
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.brandId, brand.id), eq(conversations.userId, viewer.ctx.userId)))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
  return rows.map((c) => ({ id: c.id, title: c.title || "New chat", updatedAt: c.updatedAt.toISOString() }));
}

export async function getConversation(db: Db, viewer: Viewer, id: string, pool?: AskDeps["pool"]): Promise<ConversationView> {
  const brand = requirePermission(viewer, "use_tab");
  const c = await ownConversation(db, brand, viewer, id);
  const msgs = await db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, c.id)).orderBy(asc(conversationMessages.id));
  const props = await db.select().from(proposals).where(eq(proposals.conversationId, c.id));
  const items: ChatItem[] = [];
  const pieceIds: string[] = [];
  const toolNames = new Map<string, string>();
  for (const m of msgs) {
    const content = m.content as ContentBlock[] | string;
    if (typeof content === "string") {
      items.push({ kind: m.role === "user" ? "user" : "claude", text: content });
      continue;
    }
    for (const b of content) {
      if (b.type === "text" && b.text.trim()) {
        if (m.role === "user" && b.text.startsWith("The shop's inspiration board")) continue;
        // The note we add in front of each message (date, sender) isn't shown.
        items.push({ kind: m.role === "user" ? "user" : "claude", text: m.role === "user" ? b.text.replace(/^\[[^\]]*\]\n/, "") : b.text });
      }
      if (b.type === "tool_use") toolNames.set(b.id, b.name);
      const resultText =
        b.type === "tool_result" && !b.is_error
          ? typeof b.content === "string"
            ? b.content
            : (b.content ?? []).find((c): c is Anthropic.Beta.BetaTextBlockParam => c.type === "text")?.text
          : undefined;
      if (b.type === "tool_result" && resultText) {
        const name = toolNames.get(b.tool_use_id);
        try {
          const parsed = JSON.parse(resultText);
          if (name === "design_piece" && parsed.piece_id) {
            if (!pieceIds.includes(parsed.piece_id)) pieceIds.push(parsed.piece_id);
            items.push({ kind: "piece", pieceId: parsed.piece_id });
          }
          if (name === "propose_change" && parsed.proposal_id) {
            const p = props.find((x) => x.id === parsed.proposal_id);
            if (p) items.push({ kind: "proposal", proposal: { id: p.id, kind: p.kind as ProposalView["kind"], summary: p.summary, status: p.status } });
          }
        } catch {
          /* not one of ours */
        }
      }
    }
  }
  const pieceViews = [];
  for (const pid of pieceIds) {
    try {
      pieceViews.push(await getPiece(db, viewer, pid));
    } catch {
      /* deleted since */
    }
  }
  // Still working if another request holds this chat's lock.
  const working = pool ? (await tryWithLock(pool, `ask:${c.id}`, async () => true)) === null : false;
  return { id: c.id, title: c.title || "New chat", working, items, pieces: pieceViews };
}

async function append(db: Db, conversationId: string, role: "user" | "assistant", content: unknown) {
  await db.insert(conversationMessages).values({ conversationId, role, content });
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
}

// The history as the API wants it, with a cache breakpoint on the newest
// message so the next turn re-reads the conversation from cache. Stored
// messages are never edited (thinking blocks stay valid).
function forRequest(history: MessageParam[]): MessageParam[] {
  if (history.length === 0) return history;
  const out = history.slice(0, -1);
  const last = history[history.length - 1]!;
  const blocks: ContentBlock[] = typeof last.content === "string" ? [{ type: "text", text: last.content }] : [...last.content];
  const tail = blocks[blocks.length - 1];
  if (tail && (tail.type === "text" || tail.type === "tool_result" || tail.type === "image")) {
    blocks[blocks.length - 1] = { ...tail, cache_control: { type: "ephemeral" } } as ContentBlock;
  }
  out.push({ role: last.role, content: blocks });
  return out;
}

export async function ask(deps: AskDeps, viewer: Viewer, input: { conversationId?: unknown; text?: unknown }, emit: (e: AskEvent) => void): Promise<void> {
  const brand = requirePermission(viewer, "use_tab");
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) throw new AccessError("Type a message first.", 400);
  if (text.length > 8000) throw new AccessError("That message is very long. Keep it under 8,000 characters.", 400);

  let conversationId: string;
  if (typeof input.conversationId === "string" && input.conversationId) {
    conversationId = (await ownConversation(deps.db, brand, viewer, input.conversationId)).id;
  } else {
    const [c] = await deps.db.insert(conversations).values({ brandId: brand.id, userId: viewer.ctx.userId, title: text.slice(0, 80) }).returning();
    conversationId = c!.id;
  }
  emit({ type: "start", conversationId });

  const ran = await tryWithLock(deps.pool, `ask:${conversationId}`, async () => {
    const style = await styleForDesign(deps.db, brand);
    const tz = brandTimezone(brand);
    const now = utcToZoned(new Date(), tz);
    const system: Anthropic.Beta.BetaTextBlockParam[] = [
      { type: "text", text: systemPrompt(style, brand.name ?? ""), cache_control: { type: "ephemeral" } },
    ];
    const stored = await deps.db.select().from(conversationMessages).where(eq(conversationMessages.conversationId, conversationId)).orderBy(asc(conversationMessages.id));
    const history: MessageParam[] = stored.map((m) => ({ role: m.role, content: m.content as MessageParam["content"] }));
    const userContent: ContentBlock[] = [];
    if (stored.length === 0) {
      // A new chat starts with the shop's inspiration board, so it's part of
      // the cached history (later turns only ever append).
      const board = await inspirationFor(deps.db, brand);
      if (board.length) {
        userContent.push({ type: "text", text: `The shop's inspiration board (${board.length} post${board.length > 1 ? "s" : ""} they love). Study these before designing:` });
        for (const a of board) userContent.push({ type: "image", source: { type: "url", url: a.url } });
      }
    }
    // What the owner thought of recent posts: follow what they loved, avoid what they didn't.
    const verdicts = await recentVerdicts(deps.db, brand);
    if (verdicts) {
      userContent.push({
        type: "text",
        text: `The owner's verdicts on recent posts (newest first). Treat these as design direction: repeat what they loved (without copying the same layout), never repeat what they rejected, and follow every note:\n${verdicts}`,
      });
    }
    // What the shop's recent designs look like, so the next one is different.
    const recent = await recentDesigns(deps.db, brand, RECENT_SHOWN);
    if (recent.length) {
      userContent.push({
        type: "text",
        text:
          "The shop's most recent designs (newest first). Make new posts clearly different from these in layout family, composition and where graphics sit:\n" +
          recent.map((r, i) => `${i + 1}. "${r.title}" (${r.kind}): layout ${r.design.layout ?? "unknown"} (${LAYOUT_KINDS[layoutKind(r.design.layout) ?? ""]?.label ?? "kind unknown"}); motifs: ${r.design.motifs ?? "not recorded"}`).join("\n"),
      });
      const firstFrames = recent.slice(0, RECENT_IMAGES).map((r) => r.assetIds[0]).filter((id): id is string => !!id);
      const urls = firstFrames.length ? await deps.db.select({ id: assets.id, url: assets.url }).from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, firstFrames))) : [];
      for (const id of firstFrames) {
        const u = urls.find((x) => x.id === id);
        if (u) userContent.push({ type: "image", source: { type: "url", url: u.url } });
      }
    }
    userContent.push({ type: "text", text: `[${now.date} ${now.time}, ${tz}; from ${viewer.ctx.name || "the team"}]\n${text}` });
    history.push({ role: "user", content: userContent });
    await append(deps.db, conversationId, "user", userContent);

    const runCtx: RunCtx = { drafts: new Map(), deps, viewer, brand, conversationId, emit };
    let total = 0;
    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const { message, costCents } = await callClaude(
          deps,
          { brand, userId: viewer.ctx.userId, purpose: "ask_claude", refId: conversationId },
          { system, messages: forRequest(history), tools: TOOLS, maxTokens: 64000, effort: "xhigh", onText: (delta) => emit({ type: "text", delta }) },
        );
        total += costCents;
        history.push({ role: "assistant", content: message.content as unknown as ContentBlock[] });
        await append(deps.db, conversationId, "assistant", message.content);

        if (message.stop_reason === "refusal") {
          emit({ type: "error", message: "Claude can't help with that one." });
          break;
        }
        if (message.stop_reason === "pause_turn") continue;
        const uses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        if (uses.length === 0) break;
        if (message.stop_reason === "max_tokens") {
          emit({ type: "error", message: "That answer ran too long. Ask for a smaller piece at a time." });
          break;
        }

        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const use of uses) {
          emit({ type: "status", text: STATUS_TEXT[use.name] ?? "Working…" });
          let outcome: ToolOutcome;
          try {
            outcome = await runTool(runCtx, use.name, use.input);
          } catch (err) {
            if (err instanceof z.ZodError) outcome = { content: `The input didn't fit the tool: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
            else if (err instanceof AccessError) outcome = { content: err.message, isError: true };
            else throw err;
          }
          // A one-line trace per tool call in the server log, to diagnose odd results.
          const preview = typeof outcome.content === "string" ? outcome.content : outcome.content.find((c) => c.type === "text")?.text ?? "";
          console.info(`[ask] ${conversationId} ${use.name} ${outcome.isError ? "ERROR" : "ok"}: ${preview.replace(/\s+/g, " ").slice(0, 160)}`);
          results.push({ type: "tool_result", tool_use_id: use.id, content: outcome.content as Anthropic.Beta.BetaToolResultBlockParam["content"], ...(outcome.isError ? { is_error: true } : {}) });
        }
        history.push({ role: "user", content: results });
        await append(deps.db, conversationId, "user", results);
      }
    } catch (err) {
      if (err instanceof ClaudePausedError) emit({ type: "error", message: err.message });
      else {
        console.error(`[ask] conversation ${conversationId} failed: ${(err as Error).message}`);
        emit({ type: "error", message: "Something went wrong talking to Claude. Try again in a moment." });
      }
    }
    emit({ type: "done", costCents: Math.round(total * 100) / 100 });
    return true;
  });
  if (!ran) emit({ type: "error", message: "Claude is still working on your last message in this chat." });
}

// ---- Proposals: applied only by a person ----

export async function decideProposal(deps: AskDeps, viewer: Viewer, id: string, decision: "apply" | "dismiss"): Promise<ProposalView> {
  const brand = requirePermission(viewer, "use_tab");
  if (!isUuid(id)) throw new AccessError("That change isn't here.", 404);
  const [p] = await deps.db.select().from(proposals).where(and(eq(proposals.id, id), eq(proposals.brandId, brand.id)));
  if (!p) throw new AccessError("That change isn't here.", 404);
  if (p.status !== "open") throw new AccessError(p.status === "applied" ? "That change was already applied." : "That change was dismissed.", 400);
  if (decision === "apply") {
    const x = p.payload as z.infer<typeof ProposeInput>;
    if (x.kind === "add_to_calendar") await addEntries(deps.calendar, viewer, { pieceId: x.piece_id, channels: x.channels, date: x.date, time: x.time });
    if (x.kind === "move_entry") await moveEntry(deps.calendar, viewer, x.entry_id!, { date: x.date, time: x.time });
    // A caption from Claude stays a draft until a person marks it Final.
    if (x.kind === "set_caption") await setCaption(deps.db, viewer, x.piece_id!, x.channel!, { text: x.text, altText: x.alt_text ?? "", status: "draft" });
  }
  const status = decision === "apply" ? "applied" : "dismissed";
  await deps.db.update(proposals).set({ status, decidedBy: viewer.ctx.userId, decidedAt: new Date() }).where(eq(proposals.id, id));
  await audit(deps.db, viewer, `proposal.${status}`, { proposalId: id, kind: p.kind });
  return { id, kind: p.kind as ProposalView["kind"], summary: p.summary, status };
}
