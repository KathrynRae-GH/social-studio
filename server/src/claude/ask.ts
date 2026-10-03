// Ask Claude: a chat with tools, scoped to one shop. Claude can read the
// library, calendar and files, look at images, search the web, design and
// render pieces (which land as Suggested), and propose calendar or caption
// changes that someone on the Team applies with one tap. It never approves
// anything, never marks a caption Final, and only uses files the rules allow.
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/pool.ts";
import { assets, calendarEntries, captions, conversationMessages, conversations, pieces, proposals } from "../db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "../brands.ts";
import { callClaude, ClaudePausedError, type ClaudeDeps } from "./client.ts";
import { tryWithLock } from "../jobs.ts";
import { assetDetail, ownAsset } from "../assets.ts";
import { styleForDesign } from "../styles.ts";
import { renderAndWait, type RenderDeps } from "../render.ts";
import { getPiece, setCaption } from "../library.ts";
import { addEntries, brandTimezone, moveEntry, type CalendarDeps } from "../calendar.ts";
import { CHANNELS, KIND_LABELS, channel, channelsFor, type Kind } from "../../../shared/channels.ts";
import { SIZES, brandVariables, type StyleSetView } from "../../../shared/design.ts";
import { utcToZoned, zonedToUtc } from "../../../shared/time.ts";
import type { AskEvent, ChatItem, ConversationSummary, ConversationView, ProposalView } from "../../../shared/ask.ts";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlockParam;

export interface AskDeps extends ClaudeDeps {
  pool: RenderDeps["pool"];
  render: RenderDeps;
  calendar: CalendarDeps;
}

const MAX_TURNS = 14;
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
- You never approve, schedule or post anything, and never mark a caption Final. Your pieces land as Suggested for the owner to review. Calendar and caption changes go through propose_change for the owner to apply.
- Write in the shop's voice from its notes. Plain, warm and specific. Avoid: empower, thrive, streamline, seamless, elevate, unlock, solution.`;

function designGuide(style: StyleSetView): string {
  const vars = Object.keys(brandVariables(style)).join(", ");
  return `## How designs work
A design is HTML + CSS (with inline SVG for shapes and graphics) for each frame, rendered to an image at an exact size. Sizes:
${Object.entries(SIZES).map(([k, v]) => `- ${k}: ${v.label}`).join("\n")}
Use post/carousel → portrait, story/story_set → story, pin → pin, google_update → landscape.

The engine already sets: box-sizing border-box; html/body at the frame size with overflow hidden; body background var(--brand-background), color var(--brand-text), font var(--font-body); h1–h4 and .heading use var(--font-heading); class "photo" = width/height 100% object-fit cover.
Colors and fonts come only from these CSS variables: ${vars}. Don't write raw hex colors except white/black for contrast.
Photos: <img class="photo" src="asset:ASSET_ID"> or CSS url("asset:ASSET_ID"). The logo (only if the shop has an approved logo): src="asset:logo".
No scripts, no external links, no web fonts beyond the two in the style set. Text must be large enough to read on a phone (body text 34px+ on a 1080px-wide frame) with strong contrast.
Draw graphics in code (SVG shapes, patterns, lines). For a carousel, keep a consistent system across slides and make slide 1 a strong hook.
After design_piece returns, look at the rendered preview images to check them, and fix anything off (overflowing text, low contrast, cramped layout) with another design_piece call on the same piece_id.`;
}

function styleText(style: StyleSetView, shopName: string): string {
  return `## This shop
Name: ${shopName || "(not set)"}
Look: ${style.status === "approved" ? "the shop's approved style set" : "the basic Boutiqly look (the shop's own look isn't approved yet), with no logo"}
Colors: ${style.colors.map((c) => `${c.name} ${c.hex} (${c.role})`).join("; ")}
Heading font: ${style.headingFont}. Body font: ${style.bodyFont}.
Logo: ${style.logoUrl ? "yes (asset:logo)" : "none, so never include a logo"}
Vibe: ${style.vibe || "(no notes yet)"}
Dos and don'ts: ${style.dosDonts || "(none yet)"}`;
}

function systemPrompt(style: StyleSetView, shopName: string): string {
  return `You are Claude, working inside Social Studio, a social media studio built into Boutiqly for small shops. You help the shop's owner and team plan, design and write their social media: posts, carousels, Stories, Story sets, text posts, pins, Google updates, captions for every channel, alt text, ideas and the posting plan. You're a strong designer and a warm, specific writer. Keep replies short and useful; show, don't lecture.

${RULES}

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
        design: {
          type: "object",
          properties: {
            size: { type: "string", enum: Object.keys(SIZES) },
            css: { type: "string" },
            frames: { type: "array", items: { type: "object", properties: { html: { type: "string" } }, required: ["html"] } },
          },
          required: ["size", "css", "frames"],
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
  look_at_image: "Looking at a picture…",
  design_piece: "Designing and rendering…",
  propose_change: "Writing up a change for you…",
};

const SearchInput = z.object({ query: z.string().max(200).optional(), kind: z.enum(KINDS as [Kind, ...Kind[]]).optional(), limit: z.number().int().min(1).max(50).optional() });
const CalendarInput = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const AssetsInput = z.object({ query: z.string().max(200).optional(), only_usable: z.boolean().optional() });
const LookInput = z.object({ asset_id: z.string() });
const DesignInput = z.object({
  piece_id: z.string().optional(),
  kind: z.enum(KINDS as [Kind, ...Kind[]]),
  title: z.string().max(200),
  design: z.object({ size: z.string(), css: z.string(), frames: z.array(z.object({ html: z.string() })) }).optional(),
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
            captions: Object.fromEntries(caps.filter((c) => c.pieceId === r.id).map((c) => [c.channel, c.text.slice(0, 300)])),
            on_calendar: entries
              .filter((e) => e.pieceId === r.id)
              .map((e) => ({ entry_id: e.id, channel: e.channel, status: e.status, ...utcToZoned(e.scheduledAt, tz) })),
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
      const rows = await db.select().from(assets).where(and(eq(assets.brandId, brand.id), or(eq(assets.madeBy, "upload"), eq(assets.madeBy, "blur")))).orderBy(desc(assets.createdAt)).limit(500);
      const list = rows
        .map(assetDetail)
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
          ...(a.usable.ok ? {} : { why_not: a.usable.reason }),
        }));
      return { content: JSON.stringify(list) };
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
      let pieceId = input.piece_id;
      if (pieceId) {
        if (!isUuid(pieceId)) return { content: "piece_id isn't a valid id.", isError: true };
        const [p] = await db.select().from(pieces).where(and(eq(pieces.id, pieceId), eq(pieces.brandId, brand.id)));
        if (!p) return { content: "That piece isn't in this shop's library.", isError: true };
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
      return {
        content: JSON.stringify({
          piece_id: pieceId,
          status: "Suggested",
          rendered_frame_asset_ids: frames,
          captions_saved: Object.keys(view.captions),
          notes: capNotes,
        }),
      };
    }
    case "propose_change": {
      const input = ProposeInput.parse(rawInput);
      const problems: string[] = [];
      if (input.kind === "add_to_calendar" && (!input.piece_id || !input.channels?.length || !input.date || !input.time)) problems.push("add_to_calendar needs piece_id, channels, date and time.");
      if (input.kind === "move_entry" && (!input.entry_id || !input.date || !input.time)) problems.push("move_entry needs entry_id, date and time.");
      if (input.kind === "set_caption" && (!input.piece_id || !input.channel || input.text === undefined)) problems.push("set_caption needs piece_id, channel and text.");
      if (input.piece_id && !isUuid(input.piece_id)) problems.push("piece_id isn't a valid id.");
      if (input.entry_id && !isUuid(input.entry_id)) problems.push("entry_id isn't a valid id.");
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

export async function getConversation(db: Db, viewer: Viewer, id: string): Promise<ConversationView> {
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
      if (b.type === "text" && b.text.trim()) items.push({ kind: m.role === "user" ? "user" : "claude", text: b.text });
      if (b.type === "tool_use") toolNames.set(b.id, b.name);
      if (b.type === "tool_result" && !b.is_error && typeof b.content === "string") {
        const name = toolNames.get(b.tool_use_id);
        try {
          const parsed = JSON.parse(b.content);
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
  return { id: c.id, title: c.title || "New chat", items, pieces: pieceViews };
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
    const userContent: ContentBlock[] = [{ type: "text", text: `[${now.date} ${now.time}, ${tz}; from ${viewer.ctx.name || "the team"}]\n${text}` }];
    history.push({ role: "user", content: userContent });
    await append(deps.db, conversationId, "user", userContent);

    const runCtx: RunCtx = { deps, viewer, brand, conversationId, emit };
    let total = 0;
    try {
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const { message, costCents } = await callClaude(
          deps,
          { brand, userId: viewer.ctx.userId, purpose: "ask_claude", refId: conversationId },
          { system, messages: forRequest(history), tools: TOOLS, maxTokens: 64000, effort: "high", onText: (delta) => emit({ type: "text", delta }) },
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
