// Brand → Strategy: when to post on each network, and what to post about
// (content pillars). Claude suggests from the shop's details and web
// research; the owner edits and approves. Once approved, the posting times
// are the defaults for scheduling and Plan my calendar, and Claude tags every
// new post with a pillar and leans toward pillars below their target share.
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import type Anthropic from "@anthropic-ai/sdk";
import type { Db } from "./db/pool.ts";
import { captions, pieces, products, stores, strategies } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import { callClaude, ClaudePausedError, type ClaudeDeps } from "./claude/client.ts";
import { brandTimezone, socialAccounts, type CalendarDeps } from "./calendar.ts";
import { getStyleSet } from "./styles.ts";
import { CHANNELS, KIND_LABELS, channel, type Kind } from "../../shared/channels.ts";
import { DAYS, MAX_PILLARS, MAX_SLOTS, type ChannelTimes, type Day, type Pillar, type StrategyLink, type StrategyView } from "../../shared/strategy.ts";

export interface StrategyDeps extends ClaudeDeps {
  calendar: CalendarDeps;
}

type Row = typeof strategies.$inferSelect;

const STALE_MS = 15 * 60_000;
const CHANNEL_IDS = CHANNELS.map((c) => c.id as string);
const LINK_KINDS = [...CHANNEL_IDS, "website", "other"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const suggesting = (r: Row | undefined) => !!r?.suggestingStartedAt && Date.now() - r.suggestingStartedAt.getTime() < STALE_MS;

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "pillar";
}

// Posts per pillar over the last 30 days ("none" for posts without one).
export async function pillarMix(db: Db, brandId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ pillar: pieces.pillar })
    .from(pieces)
    .where(and(eq(pieces.brandId, brandId), eq(pieces.archived, false), gte(pieces.createdAt, new Date(Date.now() - 30 * 86_400_000))));
  const mix: Record<string, number> = {};
  for (const r of rows) mix[r.pillar ?? "none"] = (mix[r.pillar ?? "none"] ?? 0) + 1;
  return mix;
}

// The strategy Claude and the calendar follow: only an approved one.
export async function approvedStrategy(db: Db, brandId: string): Promise<{ times: Record<string, ChannelTimes>; pillars: Pillar[] } | null> {
  const [row] = await db.select().from(strategies).where(eq(strategies.brandId, brandId));
  return row?.status === "approved" ? { times: row.times, pillars: row.pillars } : null;
}

export async function getStrategy(deps: { db: Db; calendar: CalendarDeps }, viewer: Viewer): Promise<StrategyView> {
  const brand = requirePermission(viewer, "use_tab");
  const [row] = await deps.db.select().from(strategies).where(eq(strategies.brandId, brand.id));
  const accounts = (await socialAccounts(deps.calendar, brand)) ?? [];
  const connected = accounts
    .filter((a) => !a.expired)
    .map((a) => ({ channel: CHANNELS.find((c) => c.plannerPlatform === a.platform)?.id ?? a.platform, name: a.name }));
  return {
    links: row?.links ?? [],
    connected,
    summary: row?.summary ?? "",
    times: row?.times ?? {},
    pillars: row?.pillars ?? [],
    status: row ? row.status : "none",
    approvedBy: row?.approvedBy ?? null,
    approvedAt: row?.approvedAt?.toISOString() ?? null,
    suggesting: suggesting(row),
    suggestError: row?.suggestError ?? null,
    suggestedAt: row?.suggestedAt?.toISOString() ?? null,
    mix: await pillarMix(deps.db, brand.id),
  };
}

// ---- Checking what people (or Claude) send ----

function cleanLinks(v: unknown): StrategyLink[] {
  if (!Array.isArray(v)) throw new AccessError("Links need a network and an address.", 400);
  return v.slice(0, 20).map((l) => {
    const x = l as { channel?: unknown; url?: unknown };
    const url = typeof x.url === "string" ? x.url.trim() : "";
    if (!LINK_KINDS.includes(String(x.channel)) || !/^https?:\/\/\S+\.\S+/i.test(url) || url.length > 300) {
      throw new AccessError("Each link needs a network and a web address starting with https://.", 400);
    }
    return { channel: String(x.channel), url };
  });
}

function cleanTimes(v: unknown, strict: boolean): Record<string, ChannelTimes> {
  const out: Record<string, ChannelTimes> = {};
  const entries: [string, unknown][] = Array.isArray(v)
    ? v.map((t) => [String((t as { channel?: unknown }).channel), t])
    : v && typeof v === "object"
      ? Object.entries(v)
      : [];
  for (const [ch, t] of entries) {
    if (!CHANNEL_IDS.includes(ch)) {
      if (strict) throw new AccessError(`${ch} isn't a network Social Studio posts to.`, 400);
      continue;
    }
    const x = t as { slots?: unknown; why?: unknown };
    const slots = (Array.isArray(x.slots) ? x.slots : [])
      .map((s) => {
        const y = s as { days?: unknown; time?: unknown };
        const days = (Array.isArray(y.days) ? y.days : []).map(String).filter((d): d is Day => (DAYS as readonly string[]).includes(d));
        const time = String(y.time ?? "");
        return { days: DAYS.filter((d) => days.includes(d)), time };
      })
      .filter((s) => s.days.length > 0 && TIME.test(s.time))
      .slice(0, MAX_SLOTS);
    if (strict && Array.isArray(x.slots) && slots.length !== x.slots.length) throw new AccessError("Each posting time needs at least one day and a time.", 400);
    if (slots.length) out[ch] = { slots, why: String(x.why ?? "").slice(0, 600) };
  }
  return out;
}

function cleanPillars(v: unknown, existing: Pillar[], strict: boolean): Pillar[] {
  if (!Array.isArray(v)) throw new AccessError("Pillars need a name.", 400);
  const list = v
    .map((p) => p as Partial<Pillar>)
    .filter((p) => typeof p.name === "string" && p.name.trim())
    .slice(0, MAX_PILLARS);
  if (strict && list.length !== v.length) throw new AccessError(`Each pillar needs a name (up to ${MAX_PILLARS}).`, 400);
  const used = new Set<string>();
  const pillars = list.map((p) => {
    const name = p.name!.trim().slice(0, 60);
    // Keep a pillar's id when it's the same pillar (posts already use it).
    let id = (typeof p.id === "string" && existing.some((e) => e.id === p.id) ? p.id : existing.find((e) => e.name.toLowerCase() === name.toLowerCase())?.id) ?? slug(name);
    while (used.has(id)) id = `${id}-2`;
    used.add(id);
    return {
      id,
      name,
      description: String(p.description ?? "").slice(0, 600),
      why: String(p.why ?? "").slice(0, 600),
      share: Math.max(0, Math.min(100, Math.round(Number(p.share) || 0))),
      examples: (Array.isArray(p.examples) ? p.examples : []).map((e) => String(e).slice(0, 200)).slice(0, 5),
    };
  });
  // Target shares add up to 100.
  const total = pillars.reduce((n, p) => n + p.share, 0);
  if (pillars.length && total !== 100) {
    if (total === 0) pillars.forEach((p) => (p.share = Math.round(100 / pillars.length)));
    else pillars.forEach((p) => (p.share = Math.round((p.share / total) * 100)));
    const diff = 100 - pillars.reduce((n, p) => n + p.share, 0);
    pillars[0]!.share += diff;
  }
  return pillars;
}

// ---- Saving and approving (people only) ----

export async function saveStrategy(deps: { db: Db; calendar: CalendarDeps }, viewer: Viewer, input: Record<string, unknown>): Promise<StrategyView> {
  const brand = requirePermission(viewer, "manage_brand");
  const [row] = await deps.db.select().from(strategies).where(eq(strategies.brandId, brand.id));
  const changes: Partial<typeof strategies.$inferInsert> = {};
  if (input.links !== undefined) changes.links = cleanLinks(input.links);
  if (input.times !== undefined) changes.times = cleanTimes(input.times, true);
  if (input.pillars !== undefined) changes.pillars = cleanPillars(input.pillars, row?.pillars ?? [], true);
  if (typeof input.summary === "string") changes.summary = input.summary.slice(0, 2000);
  // Links alone don't change what Claude follows; anything else needs approving again.
  const needsApproval = changes.times !== undefined || changes.pillars !== undefined || changes.summary !== undefined;
  const values = {
    ...changes,
    ...(needsApproval ? { status: "draft" as const, approvedBy: null, approvedAt: null } : {}),
    updatedBy: viewer.ctx.userId,
    updatedAt: new Date(),
  };
  await deps.db.insert(strategies).values({ brandId: brand.id, ...values }).onConflictDoUpdate({ target: strategies.brandId, set: values });
  await audit(deps.db, viewer, "strategy.save", { fields: Object.keys(changes) });
  return getStrategy(deps, viewer);
}

export async function approveStrategy(deps: { db: Db; calendar: CalendarDeps }, viewer: Viewer): Promise<StrategyView> {
  const brand = requirePermission(viewer, "manage_brand");
  const [row] = await deps.db.select().from(strategies).where(eq(strategies.brandId, brand.id));
  if (!row || (Object.keys(row.times).length === 0 && row.pillars.length === 0)) {
    throw new AccessError("Add posting times or content pillars first (or ask Claude to suggest them).", 400);
  }
  await deps.db.update(strategies).set({ status: "approved", approvedBy: viewer.ctx.name || viewer.ctx.userId, approvedAt: new Date() }).where(eq(strategies.brandId, brand.id));
  await audit(deps.db, viewer, "strategy.approve");
  return getStrategy(deps, viewer);
}

// ---- Claude suggests a strategy (in the background) ----

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "times", "pillars"],
  properties: {
    summary: { type: "string", description: "Two or three plain sentences: who this shop is talking to and the plan in short." },
    times: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["channel", "slots", "why"],
        properties: {
          channel: { type: "string", enum: CHANNEL_IDS },
          slots: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["days", "time"],
              properties: { days: { type: "array", items: { type: "string", enum: [...DAYS] } }, time: { type: "string", description: "HH:MM, 24-hour, the shop's local time" } },
            },
          },
          why: { type: "string" },
        },
      },
    },
    pillars: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "why", "share", "examples"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          why: { type: "string" },
          share: { type: "integer", description: "Target percent of posts; all pillars add up to 100." },
          examples: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const SYSTEM = `You are a social media strategist for a small shop, working inside Social Studio (part of Boutiqly). You recommend two things, each with plain, specific reasons the owner can follow:

1. Posting times for each network the shop uses: one to three day-and-time slots per network, in the shop's local time, best first. Base them on who the shop's customers are, the shop's type and location, how each network's audience behaves, and current research (use web search for recent, reputable sources on best posting times by network and industry; prefer data from the last two years). Say why in one or two sentences per network, naming what the reasoning rests on.
2. Content pillars: three to six themes the shop should post about, each with a short description, why it matters for this shop, a target share of posts (all add up to 100), and two or three concrete post ideas from the shop's own products, events and voice.

Rules: use only facts you have or found (say where if it matters); never invent the shop's numbers, prices, sales or events. Keep it plain and warm; no marketing jargon. Avoid: empower, thrive, streamline, seamless, elevate, unlock, solution.
Only include networks the shop has connected or linked, plus at most one or two more if they clearly fit (say so in why).`;

export async function startSuggestion(deps: StrategyDeps, viewer: Viewer): Promise<StrategyView> {
  const brand = requirePermission(viewer, "manage_brand");
  if (!brand.claudeEnabled) throw new AccessError("Claude isn't turned on for this shop yet.", 400);
  const [row] = await deps.db.select().from(strategies).where(eq(strategies.brandId, brand.id));
  if (suggesting(row)) throw new AccessError("Claude is already working on a suggestion.", 409);
  await deps.db
    .insert(strategies)
    .values({ brandId: brand.id, updatedBy: viewer.ctx.userId, suggestingStartedAt: new Date(), suggestError: null })
    .onConflictDoUpdate({ target: strategies.brandId, set: { suggestingStartedAt: new Date(), suggestError: null } });
  await audit(deps.db, viewer, "strategy.suggest");
  void suggest(deps, viewer, brand).catch(async (err) => {
    console.error(`[strategy] ${brand.id}: ${(err as Error).message}`);
    const message = err instanceof ClaudePausedError || err instanceof AccessError ? err.message : "Claude couldn't finish the suggestion. Try again in a minute.";
    await deps.db.update(strategies).set({ suggestingStartedAt: null, suggestError: message }).where(eq(strategies.brandId, brand.id)).catch(() => {});
  });
  return getStrategy(deps, viewer);
}

async function shopContext(deps: StrategyDeps, viewer: Viewer, brand: Brand) {
  const [row] = await deps.db.select().from(strategies).where(eq(strategies.brandId, brand.id));
  const style = await getStyleSet(deps.db, viewer);
  const accounts = ((await socialAccounts(deps.calendar, brand)) ?? []).filter((a) => !a.expired);
  const [store] = await deps.db.select().from(stores).where(eq(stores.brandId, brand.id));
  const productRows = store ? await deps.db.select({ type: products.productType, title: products.title }).from(products).where(and(eq(products.brandId, brand.id), isNull(products.removedAt))).limit(300) : [];
  const types = Object.entries(productRows.reduce<Record<string, number>>((m, p) => ((m[p.type || "other"] = (m[p.type || "other"] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const recent = await deps.db.select({ id: pieces.id, kind: pieces.kind, title: pieces.title }).from(pieces).where(and(eq(pieces.brandId, brand.id), eq(pieces.archived, false))).orderBy(desc(pieces.createdAt)).limit(12);
  const caps = recent.length
    ? await deps.db.select({ pieceId: captions.pieceId, text: captions.text }).from(captions).where(inArray(captions.pieceId, recent.map((p) => p.id)))
    : [];
  return {
    shop: { name: brand.name ?? "", time_zone: brandTimezone(brand) },
    voice: { vibe: style.vibe, dos_and_donts: style.dosDonts },
    networks_connected_in_boutiqly: accounts.map((a) => ({ network: CHANNELS.find((c) => c.plannerPlatform === a.platform)?.id ?? a.platform, account: a.name })),
    links_the_owner_added: row?.links ?? [],
    online_store: store ? { address: store.url, products: productRows.length, product_types: types.map(([t, n]) => `${t} (${n})`), sample_products: productRows.slice(0, 15).map((p) => p.title) } : null,
    recent_posts: recent.map((p) => ({ kind: KIND_LABELS[p.kind as Kind] ?? p.kind, title: p.title, caption_start: caps.find((c) => c.pieceId === p.id && c.text)?.text.slice(0, 200) ?? "" })),
    current_pillars: (row?.pillars ?? []).map((p) => ({ name: p.name, share: p.share })),
    networks: CHANNELS.map((c) => ({ id: c.id, name: c.name })),
  };
}

async function suggest(deps: StrategyDeps, viewer: Viewer, brand: Brand): Promise<void> {
  const context = await shopContext(deps, viewer, brand);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: [{ type: "text", text: `Recommend this shop's posting times and content pillars.\n\n${JSON.stringify(context)}` }] },
  ];
  let text = "";
  for (let i = 0; i < 4; i++) {
    const { message } = await callClaude(deps, { brand, userId: viewer.ctx.userId, purpose: "strategy" }, {
      system: [{ type: "text", text: SYSTEM }],
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 } as Anthropic.Beta.BetaToolUnion],
      maxTokens: 16000,
      effort: "high",
      jsonSchema: SCHEMA as unknown as Record<string, unknown>,
    });
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }
    if (message.stop_reason === "refusal") throw new AccessError("Claude couldn't make a suggestion this time.", 422);
    text = message.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    break;
  }
  let parsed: { summary: string; times: unknown[]; pillars: unknown[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AccessError("Claude's suggestion didn't come through. Try again.", 502);
  }
  const [row] = await deps.db.select().from(strategies).where(eq(strategies.brandId, brand.id));
  await deps.db
    .update(strategies)
    .set({
      summary: String(parsed.summary ?? "").slice(0, 2000),
      times: cleanTimes(parsed.times, false),
      pillars: cleanPillars(parsed.pillars ?? [], row?.pillars ?? [], false),
      status: "draft",
      approvedBy: null,
      approvedAt: null,
      suggestingStartedAt: null,
      suggestError: null,
      suggestedAt: new Date(),
    })
    .where(eq(strategies.brandId, brand.id));
}

// For Claude's prompts: the approved strategy in a few lines.
export function strategyText(s: { times: Record<string, ChannelTimes>; pillars: Pillar[] } | null): string {
  if (!s) return "";
  const times = Object.entries(s.times).map(([ch, t]) => `- ${channel(ch)?.name ?? ch}: ${t.slots.map((x) => `${x.days.join("/")} ${x.time}`).join("; ")}`);
  const pillars = s.pillars.map((p) => `- ${p.id}: ${p.name} (target ${p.share}%). ${p.description}`);
  return [
    times.length ? `Posting times (the shop's local time; use these when placing posts):\n${times.join("\n")}` : "",
    pillars.length ? `Content pillars (tag every new piece with one by its id):\n${pillars.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
