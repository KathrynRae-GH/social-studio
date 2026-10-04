// "Plan my calendar": Claude places every approved post that isn't on the
// calendar yet, for each network it was approved for, over the next 4, 8 or
// 12 weeks (or the 4 weeks after the current plan). Entries already on the
// calendar stay where they are. Claude only picks order, dates and times;
// people approved the posts and the networks, and people lock and send.
import { and, asc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { calendarEntries, captions, pieces } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Viewer } from "./brands.ts";
import { callClaude, type ClaudeDeps } from "./claude/client.ts";
import { addEntries, brandTimezone, type CalendarDeps } from "./calendar.ts";
import { tryWithLock } from "./jobs.ts";
import { getStyleSet } from "./styles.ts";
import { approvedStrategy } from "./strategy.ts";
import { channel, KIND_LABELS, type Kind } from "../../shared/channels.ts";
import { layoutKind, LAYOUT_KINDS } from "../../shared/design.ts";
import { utcToZoned, zonedToUtc } from "../../shared/time.ts";
import type { PlanResult } from "../../shared/content.ts";

export interface PlannerDeps extends ClaudeDeps {
  calendar: CalendarDeps;
}

export const PLAN_WEEKS = [4, 8, 12] as const;
const MAX_CANDIDATES = 120;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["placements", "not_placed", "note"],
  properties: {
    placements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["piece_id", "channel", "date", "time"],
        properties: {
          piece_id: { type: "string" },
          channel: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD, the shop's local date" },
          time: { type: "string", description: "HH:MM, 24-hour, the shop's local time" },
        },
      },
    },
    not_placed: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["piece_id", "reason"],
        properties: { piece_id: { type: "string" }, reason: { type: "string" } },
      },
    },
    note: { type: "string", description: "One or two plain sentences for the owner on the plan's shape." },
  },
} as const;

const SYSTEM = `You plan the posting calendar for a small shop's social media inside Social Studio (part of Boutiqly).

You get the shop's approved posts that aren't on the calendar yet, each with the networks the owner approved it for, plus what's already on the calendar. Place every approved post-and-network pair on a date and time inside the planning window. Things already on the calendar never move; plan around them.

How to plan well:
- Spread posts evenly across the window, at a steady rhythm the shop can keep up. Don't front-load, and don't leave long gaps when there's enough to fill them.
- Never put two posts on the same network on the same day. Keep a few hours between posts on different networks the same day, unless it's the same post going out to several networks together (that's fine, and usually good).
- Mix it up: don't run the same kind of post (graphics-led, single photo, several photos; post, carousel, Story, text) back to back on a network.
- Timely things go first: new arrivals, launches, restocks and anything tied to a date or season mentioned in the post go early, or near that date. Evergreen posts fill the gaps.
- If the shop has posting times for a network (posting_times), use exactly those days and times for it. Otherwise use sensible local times: Instagram and Facebook late morning or early evening; LinkedIn weekday mornings; Threads, Bluesky and X late morning; Pinterest evenings and weekends; Google Business Profile weekday mornings; Stories mid-morning or lunchtime.
- If the shop has content pillars, balance them over each week toward their target shares, so no theme bunches up.
- Follow anything the shop's notes say about timing or days.
- Use only the piece ids and networks given. If something can't fit (the window is too full), list it in not_placed with a short reason instead of overcrowding.`;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function planCalendar(deps: PlannerDeps, viewer: Viewer, input: { weeks?: unknown; continue?: unknown }): Promise<PlanResult> {
  const brand = requirePermission(viewer, "use_tab");
  const weeks = PLAN_WEEKS.find((w) => w === Number(input.weeks));
  if (!weeks) throw new AccessError("Pick 4, 8 or 12 weeks.", 400);
  const result = await tryWithLock(deps.calendar.pool, `plan:${brand.id}`, async () => {
    const db: Db = deps.db;
    const tz = brandTimezone(brand);
    const now = (deps.calendar.now ?? (() => new Date()))();
    const today = utcToZoned(now, tz).date;
    const all = await db
      .select({ e: calendarEntries, title: pieces.title, kind: pieces.kind, design: pieces.design })
      .from(calendarEntries)
      .innerJoin(pieces, eq(pieces.id, calendarEntries.pieceId))
      .where(and(eq(calendarEntries.brandId, brand.id), gte(calendarEntries.scheduledAt, zonedToUtc(addDays(today, -14), "00:00", tz))))
      .orderBy(asc(calendarEntries.scheduledAt));
    let from = addDays(today, 1);
    if (input.continue === true && all.length) {
      const last = utcToZoned(all[all.length - 1]!.e.scheduledAt, tz).date;
      if (last >= from) from = addDays(last, 1);
    }
    const to = addDays(from, weeks * 7 - 1);

    // Approved posts and the networks they still need a spot on.
    const approved = await db
      .select()
      .from(pieces)
      .where(and(eq(pieces.brandId, brand.id), eq(pieces.archived, false), isNotNull(pieces.approvedAt)))
      .orderBy(asc(pieces.approvedAt));
    const placedPairs = new Set(
      (await db.select({ pieceId: calendarEntries.pieceId, channel: calendarEntries.channel }).from(calendarEntries).where(eq(calendarEntries.brandId, brand.id))).map(
        (r) => `${r.pieceId}|${r.channel}`,
      ),
    );
    const candidates = approved
      .map((p) => ({ piece: p, channels: p.approvedChannels.filter((c) => !placedPairs.has(`${p.id}|${c}`)) }))
      .filter((c) => c.channels.length > 0)
      .slice(0, MAX_CANDIDATES);
    if (candidates.length === 0) {
      return { placed: 0, from, to, notPlaced: [], note: "Nothing new to plan. Approve posts in the Library, then plan again.", costCents: 0 } satisfies PlanResult;
    }

    const captionRows = await db.select().from(captions).where(inArray(captions.pieceId, candidates.map((c) => c.piece.id)));
    const style = await getStyleSet(db, viewer);
    const strategy = await approvedStrategy(db, brand.id);
    const layoutLabel = (layout: string | undefined) => {
      const k = layoutKind(layout);
      return k ? LAYOUT_KINDS[k]!.label : undefined;
    };
    const context = {
      today,
      time_zone: tz,
      window: { from, to },
      shop_notes: [style.vibe, style.dosDonts].filter(Boolean).join("\n") || "(none)",
      posting_times: strategy?.times ?? {},
      pillars: (strategy?.pillars ?? []).map((p) => ({ id: p.id, name: p.name, target_share: p.share })),
      already_on_calendar: all.map(({ e, title, kind }) => ({
        ...utcToZoned(e.scheduledAt, tz),
        network: e.channel,
        title,
        kind: KIND_LABELS[kind as Kind] ?? kind,
        locked: !!e.lockedAt,
      })),
      to_place: candidates.map(({ piece, channels }) => {
        const caption = captionRows.find((c) => c.pieceId === piece.id && channels.includes(c.channel))?.text ?? "";
        return {
          piece_id: piece.id,
          title: piece.title,
          kind: KIND_LABELS[piece.kind as Kind] ?? piece.kind,
          look: layoutLabel(piece.design?.layout),
          pillar: piece.pillar ?? undefined,
          networks: channels,
          caption_start: caption.slice(0, 280),
          approved: piece.approvedAt!.toISOString().slice(0, 10),
        };
      }),
    };

    const { message, costCents } = await callClaude(deps, { brand, userId: viewer.ctx.userId, purpose: "plan_calendar" }, {
      system: [{ type: "text", text: SYSTEM }],
      messages: [{ role: "user", content: [{ type: "text", text: JSON.stringify(context) }] }],
      maxTokens: 16000,
      effort: "medium",
      jsonSchema: PLAN_SCHEMA as unknown as Record<string, unknown>,
    });
    let plan: { placements: { piece_id: string; channel: string; date: string; time: string }[]; not_placed: { piece_id: string; reason: string }[]; note: string };
    try {
      plan = JSON.parse(message.content.find((b) => b.type === "text")?.text ?? "");
    } catch {
      throw new AccessError("Claude's plan didn't come through. Try again.", 502);
    }

    // Check every placement against what was asked; group a post's networks
    // at the same time into one calendar add.
    const wanted = new Map(candidates.map((c) => [c.piece.id, new Set(c.channels)]));
    const groups = new Map<string, { pieceId: string; date: string; time: string; channels: string[] }>();
    const rejected: { pieceId: string; reason: string }[] = [];
    const nowPlus = new Date(now.getTime() + 15 * 60_000);
    for (const p of plan.placements ?? []) {
      const allowed = wanted.get(p.piece_id);
      if (!allowed?.has(p.channel)) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || !/^\d{2}:\d{2}$/.test(p.time) || p.date < from || p.date > to) {
        rejected.push({ pieceId: p.piece_id, reason: `${channel(p.channel)?.name ?? p.channel}: the date Claude picked was outside the plan.` });
        continue;
      }
      if (zonedToUtc(p.date, p.time, tz) < nowPlus) continue;
      allowed.delete(p.channel);
      const key = `${p.piece_id}|${p.date}|${p.time}`;
      const g = groups.get(key) ?? { pieceId: p.piece_id, date: p.date, time: p.time, channels: [] };
      g.channels.push(p.channel);
      groups.set(key, g);
    }
    let placed = 0;
    for (const g of groups.values()) {
      try {
        placed += (await addEntries(deps.calendar, viewer, { pieceId: g.pieceId, channels: g.channels, date: g.date, time: g.time })).length;
      } catch (err) {
        rejected.push({ pieceId: g.pieceId, reason: (err as Error).message });
      }
    }
    const titles = new Map(candidates.map((c) => [c.piece.id, c.piece.title || "Untitled post"]));
    const reasons = new Map<string, string>();
    for (const n of plan.not_placed ?? []) if (wanted.has(n.piece_id)) reasons.set(n.piece_id, String(n.reason).slice(0, 200));
    for (const r of rejected) reasons.set(r.pieceId, r.reason);
    const notPlaced = [...wanted.entries()]
      .filter(([, left]) => left.size > 0)
      .map(([pieceId, left]) => ({
        pieceId,
        title: titles.get(pieceId)!,
        reason: reasons.get(pieceId) ?? `Not placed on ${[...left].map((c) => channel(c)?.name ?? c).join(", ")}. Plan again, or add it by hand.`,
      }));
    await audit(db, viewer, "calendar.plan", { weeks, from, to, placed, notPlaced: notPlaced.length });
    return { placed, from, to, notPlaced, note: String(plan.note ?? "").slice(0, 500), costCents } satisfies PlanResult;
  });
  if (!result) throw new AccessError("Claude is already planning the calendar. Give it a moment.", 409);
  return result;
}
