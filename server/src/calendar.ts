// The Calendar: putting pieces on dates per channel, approving them (which
// sends them to Boutiqly's social planner, makes app pings, or readies a
// pack), and keeping their status in step with Boutiqly.
//
// Safety: nothing reaches a real social account unless the brand's Live
// posting switch is on (only Boutiqly's team can turn it on). While it's off,
// Approve records exactly what it would have sent and sends nothing.
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import type pg from "pg";
import type { Db } from "./db/pool.ts";
import { assets, brands, calendarEntries, captions, pieces } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import { getPieceRow } from "./library.ts";
import { tryWithLock } from "./jobs.ts";
import { BoutiqlyError, plannerMediaType, type BoutiqlyClient, type PlannerPostInput, type SocialAccount } from "./boutiqly/api.ts";
import { channel, channelsFor, routeFor, type Kind, type Route } from "../../shared/channels.ts";
import { DEFAULT_TIME_ZONE, utcToZoned, zonedToUtc } from "../../shared/time.ts";
import type { AccountView, CalendarData, EntryView, SendResult } from "../../shared/content.ts";

type Entry = typeof calendarEntries.$inferSelect;
type Piece = typeof pieces.$inferSelect;
type Asset = typeof assets.$inferSelect;
type Caption = typeof captions.$inferSelect;

export interface CalendarDeps {
  db: Db;
  pool: pg.Pool;
  client: (brand: Brand) => BoutiqlyClient;
  now?: () => Date;
}

const SYNC_EVERY_MS = 2 * 60 * 1000;
const STORY_FRAME_GAP_MS = 60 * 1000;

export function brandTimezone(brand: Brand): string {
  return brand.timezone || DEFAULT_TIME_ZONE;
}

// ---- Connected accounts ----

const accountCache = new Map<string, { at: number; accounts: SocialAccount[] }>();

export async function socialAccounts(deps: CalendarDeps, brand: Brand, fresh = false): Promise<SocialAccount[] | null> {
  const cached = accountCache.get(brand.id);
  if (!fresh && cached && Date.now() - cached.at < 60_000) return cached.accounts;
  try {
    const accounts = await deps.client(brand).listSocialAccounts();
    accountCache.set(brand.id, { at: Date.now(), accounts });
    return accounts;
  } catch {
    return null; // not installed, or Boutiqly unreachable: treat as nothing connected
  }
}

function accountFor(accounts: SocialAccount[] | null, channelId: string): SocialAccount | null {
  const platform = channel(channelId)?.plannerPlatform;
  if (!platform || !accounts) return null;
  return accounts.find((a) => a.platform === platform && !a.expired) ?? null;
}

// ---- Building what Boutiqly receives ----

export function buildPlannerPosts(args: {
  entry: Pick<Entry, "channel" | "scheduledAt" | "route" | "plannerAccountId">;
  piece: Pick<Piece, "kind" | "title" | "link">;
  media: Pick<Asset, "url" | "mime">[];
  caption: Pick<Caption, "text" | "altText"> | null;
  userId: string;
}): PlannerPostInput[] {
  const { entry, piece, media, caption, userId } = args;
  const plan = routeFor(entry.channel, piece.kind as Kind, true);
  if (!plan?.plannerType || !entry.plannerAccountId) return [];
  const text = caption?.text ?? "";
  const toMedia = (a: Pick<Asset, "url" | "mime">) => ({
    url: a.url,
    type: plannerMediaType(a.mime, a.url),
    ...(caption?.altText && a.mime.startsWith("image/") ? { altText: caption.altText } : {}),
  });
  const base = {
    accountIds: [entry.plannerAccountId],
    status: "scheduled" as const,
    userId,
  };

  if (entry.channel === "instagram") {
    if (piece.kind === "story" || piece.kind === "story_set") {
      // One ping per frame, a minute apart, each saying which frame it is.
      // Instagram Stories take no caption, so it travels in the note.
      return media.map((m, i) => ({
        ...base,
        summary: "",
        media: [toMedia(m)],
        type: "story" as const,
        scheduleDate: new Date(entry.scheduledAt.getTime() + i * STORY_FRAME_GAP_MS).toISOString(),
        instagramPostDetails: {
          type: "story" as const,
          publishViaPushNotification: true,
          publisherNote: [media.length > 1 ? `Frame ${i + 1} of ${media.length}.` : "", text].filter(Boolean).join(" "),
        },
      }));
    }
    if (piece.kind === "reel") {
      return [
        {
          ...base,
          summary: text,
          media: media.slice(0, 1).map(toMedia),
          type: "reel",
          scheduleDate: entry.scheduledAt.toISOString(),
          instagramPostDetails: {
            type: "reel",
            publishViaPushNotification: true,
            publisherNote: "Add a trending sound or stickers, then post. The caption is copied for you.",
          },
        },
      ];
    }
    return [
      {
        ...base,
        summary: text,
        media: media.map(toMedia),
        type: "post",
        scheduleDate: entry.scheduledAt.toISOString(),
        instagramPostDetails: { type: "post" },
      },
    ];
  }

  const post: PlannerPostInput = {
    ...base,
    summary: text,
    // Text-only posts send an empty media list (Threads rejects them otherwise).
    media: media.map(toMedia),
    type: "post",
    scheduleDate: entry.scheduledAt.toISOString(),
  };
  if (entry.channel === "facebook") post.facebookPostDetails = { type: "post" };
  if (entry.channel === "youtube") {
    post.media = media.slice(0, 1).map(toMedia);
    post.youtubePostDetails = { type: "short", title: (piece.title || text).slice(0, 100), privacyLevel: "public" };
  }
  if (entry.channel === "google") {
    post.media = media.slice(0, 1).map(toMedia);
    post.gmbPostDetails = {
      gmbEventType: "STANDARD",
      ...(piece.link ? { url: piece.link, actionType: "learn_more" } : {}),
    };
  }
  return [post];
}

// What must be true before a piece can go to a channel.
export function problemsFor(
  channelId: string,
  kind: Kind,
  media: Pick<Asset, "mime">[],
  caption: Pick<Caption, "text"> | null,
): string[] {
  const c = channel(channelId);
  if (!c) return ["That isn't a channel Social Studio writes for."];
  const problems: string[] = [];
  const text = caption?.text ?? "";
  const videos = media.filter((m) => m.mime.startsWith("video/"));
  if (text.length > c.captionLimit) problems.push(`The ${c.name} caption is ${text.length} characters; the limit is ${c.captionLimit}.`);
  if (media.length > c.maxMedia) problems.push(`${c.name} takes at most ${c.maxMedia} files per post.`);
  if (kind === "text" && !text.trim()) problems.push(`Write the ${c.name} text first.`);
  if (kind !== "text" && media.length === 0) problems.push("Add a photo or video first.");
  if ((kind === "reel" || kind === "short") && (media.length !== 1 || videos.length !== 1)) {
    problems.push("A Reel or Short needs exactly one video.");
  }
  if (kind === "story_set" && media.length < 2) problems.push("A Story set needs at least two frames.");
  if (kind === "carousel" && media.length < 2) problems.push("A carousel needs at least two images.");
  const needsCaption = !(kind === "story" || kind === "story_set") && kind !== "text";
  if (needsCaption && !text.trim() && channelId !== "instagram") problems.push(`Write the ${c.name} caption first.`);
  return problems;
}

// ---- Views ----

async function entryViews(deps: CalendarDeps, brand: Brand, rows: Entry[]): Promise<EntryView[]> {
  if (rows.length === 0) return [];
  const pieceIds = [...new Set(rows.map((r) => r.pieceId))];
  const pieceRows = await deps.db.select().from(pieces).where(and(eq(pieces.brandId, brand.id), inArray(pieces.id, pieceIds)));
  const firstAssetIds = pieceRows.map((p) => p.assetIds[0]).filter((id): id is string => !!id);
  const [assetRows, captionRows] = await Promise.all([
    firstAssetIds.length
      ? deps.db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, firstAssetIds)))
      : Promise.resolve([]),
    deps.db.select().from(captions).where(inArray(captions.pieceId, pieceIds)),
  ]);
  const pieceById = new Map(pieceRows.map((p) => [p.id, p]));
  const assetById = new Map(assetRows.map((a) => [a.id, a]));
  const tz = brandTimezone(brand);
  return rows.map((e) => {
    const piece = pieceById.get(e.pieceId)!;
    const first = piece.assetIds[0] ? assetById.get(piece.assetIds[0]) : undefined;
    const local = utcToZoned(e.scheduledAt, tz);
    const frames = e.route === "app_ping" && (piece.kind === "story" || piece.kind === "story_set") ? piece.assetIds.length : 1;
    return {
      id: e.id,
      pieceId: e.pieceId,
      pieceTitle: piece.title,
      kind: piece.kind as Kind,
      channel: e.channel,
      date: local.date,
      time: local.time,
      scheduledAt: e.scheduledAt.toISOString(),
      status: e.status,
      locked: !!e.lockedAt,
      route: e.route,
      preview: first ? { id: first.id, url: first.url, mime: first.mime, name: first.name } : null,
      caption: captionRows.find((c) => c.pieceId === e.pieceId && c.channel === e.channel)?.text ?? "",
      frames,
      sentFrames: e.plannerPostIds.length,
      lastError: e.lastError,
      dryRun: !!e.dryRun,
      draftsSent: e.plannerDraftIds.filter(Boolean).length,
      draftSentAt: e.draftSentAt ? e.draftSentAt.toISOString() : null,
      routeNote:
        e.route === "pack" && channel(e.channel)?.plannerPlatform && !e.plannerAccountId
          ? `${channel(e.channel)?.name} isn't connected in Boutiqly's social planner, so this is a ready-to-post pack.`
          : e.route === "share_from_ig"
            ? "Share the Instagram Reel to Facebook from the Instagram app."
            : null,
    };
  });
}

async function ownEntry(deps: CalendarDeps, brand: Brand, entryId: string): Promise<Entry> {
  const [row] = await deps.db
    .select()
    .from(calendarEntries)
    .where(and(eq(calendarEntries.id, entryId), eq(calendarEntries.brandId, brand.id)));
  if (!row) throw new AccessError("That calendar entry isn't in this shop's calendar.", 404);
  return row;
}

async function oneView(deps: CalendarDeps, brand: Brand, entryId: string): Promise<EntryView> {
  const [view] = await entryViews(deps, brand, [await ownEntry(deps, brand, entryId)]);
  return view!;
}

function accountViews(accounts: SocialAccount[] | null): AccountView[] | null {
  return accounts?.map((a) => ({ id: a.id, platform: a.platform, name: a.name, avatar: a.avatar, expired: a.expired })) ?? null;
}

export async function getCalendar(
  deps: CalendarDeps,
  viewer: Viewer,
  range: { from?: string; to?: string },
): Promise<CalendarData> {
  const brand = requirePermission(viewer, "use_tab");
  await syncStatuses(deps, brand);
  const tz = brandTimezone(brand);
  const now = (deps.now ?? (() => new Date()))();
  const today = utcToZoned(now, tz).date;
  const from = zonedToUtc(/^\d{4}-\d{2}-\d{2}$/.test(range.from ?? "") ? range.from! : shiftDate(today, -35), "00:00", tz);
  const to = zonedToUtc(/^\d{4}-\d{2}-\d{2}$/.test(range.to ?? "") ? range.to! : shiftDate(today, 49), "23:59", tz);
  const rows = await deps.db
    .select()
    .from(calendarEntries)
    .where(and(eq(calendarEntries.brandId, brand.id), gte(calendarEntries.scheduledAt, from), lte(calendarEntries.scheduledAt, to)))
    .orderBy(asc(calendarEntries.scheduledAt))
    .limit(1000);
  const accounts = await socialAccounts(deps, brand);
  const notices: string[] = [];
  if (accounts === null) notices.push("Social Studio can't see this shop's social accounts. Check that it's installed in this sub-account.");
  for (const a of accounts ?? []) {
    if (a.expired) {
      const name = channel(CHANNEL_BY_PLATFORM[a.platform] ?? "")?.name ?? a.platform;
      notices.push(`${name}${a.name ? ` (${a.name})` : ""} needs reconnecting in Boutiqly's social planner. Scheduled posts to it will fail until then.`);
    }
  }
  const approved = await deps.db
    .select({ id: pieces.id, channels: pieces.approvedChannels })
    .from(pieces)
    .where(and(eq(pieces.brandId, brand.id), eq(pieces.archived, false), isNotNull(pieces.approvedAt)));
  const placed = approved.length
    ? new Set(
        (await deps.db.select({ pieceId: calendarEntries.pieceId, channel: calendarEntries.channel }).from(calendarEntries).where(inArray(calendarEntries.pieceId, approved.map((p) => p.id)))).map(
          (r) => `${r.pieceId}|${r.channel}`,
        ),
      )
    : new Set<string>();
  const waiting = approved.reduce((n, p) => n + p.channels.filter((c) => !placed.has(`${p.id}|${c}`)).length, 0);
  return { timezone: tz, livePosting: brand.livePosting, entries: await entryViews(deps, brand, rows), waiting, accounts: accountViews(accounts), notices };
}

const CHANNEL_BY_PLATFORM: Record<string, string> = Object.fromEntries(
  ["instagram", "facebook", "threads", "linkedin", "bluesky", "google", "youtube"].map((id) => [
    channel(id)!.plannerPlatform!,
    id,
  ]),
);

export async function listAccounts(deps: CalendarDeps, viewer: Viewer): Promise<AccountView[] | null> {
  const brand = requirePermission(viewer, "use_tab");
  return accountViews(await socialAccounts(deps, brand, true));
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---- Changing the calendar ----

function parseWhen(brand: Brand, date: unknown, time: unknown): Date {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof time !== "string" || !/^\d{2}:\d{2}$/.test(time)) {
    throw new AccessError("Pick a date and time.", 400);
  }
  return zonedToUtc(date, time, brandTimezone(brand));
}

export async function addEntries(
  deps: CalendarDeps,
  viewer: Viewer,
  input: { pieceId?: unknown; channels?: unknown; date?: unknown; time?: unknown },
): Promise<EntryView[]> {
  const brand = requirePermission(viewer, "use_tab");
  if (typeof input.pieceId !== "string") throw new AccessError("Pick a post from the library.", 400);
  const piece = await getPieceRow(deps.db, brand, input.pieceId);
  const channels = Array.isArray(input.channels) ? [...new Set(input.channels.filter((c): c is string => typeof c === "string"))] : [];
  if (channels.length === 0) throw new AccessError("Pick at least one channel.", 400);
  // Only approved posts go on the calendar, and only to the networks they were approved for.
  if (!piece.approvedAt) throw new AccessError("Approve the post in the Library first.", 400);
  const notApproved = channels.filter((c) => !piece.approvedChannels.includes(c));
  if (notApproved.length) {
    throw new AccessError(`This post isn't approved for ${notApproved.map((c) => channel(c)?.name ?? c).join(", ")}. Tick it in the Library and approve again.`, 400);
  }
  const scheduledAt = parseWhen(brand, input.date, input.time);
  const accounts = await socialAccounts(deps, brand);

  const rows: (typeof calendarEntries.$inferInsert)[] = channels.map((ch) => {
    const account = accountFor(accounts, ch);
    const plan = routeFor(ch, piece.kind as Kind, !!account);
    if (!plan) throw new AccessError(`${channel(ch)?.name ?? ch} doesn't take a ${piece.kind.replace("_", " ")}.`, 400);
    return {
      brandId: brand.id,
      pieceId: piece.id,
      channel: ch,
      scheduledAt,
      route: plan.route,
      plannerAccountId: plan.route === "publish" || plan.route === "app_ping" ? account!.id : null,
      status: "approved" as const,
      approvedBy: piece.approvedBy,
      approvedAt: piece.approvedAt,
      createdBy: viewer.ctx.userId,
    };
  });
  const inserted = await deps.db.insert(calendarEntries).values(rows).returning();
  await audit(deps.db, viewer, "calendar.add", { pieceId: piece.id, channels, scheduledAt: scheduledAt.toISOString() });
  return entryViews(deps, brand, inserted);
}

function alreadySent(e: Entry): boolean {
  return e.plannerPostIds.length > 0 || e.status === "scheduled" || e.status === "posted";
}

export async function moveEntry(
  deps: CalendarDeps,
  viewer: Viewer,
  entryId: string,
  input: { date?: unknown; time?: unknown },
): Promise<EntryView> {
  const brand = requirePermission(viewer, "use_tab");
  const entry = await ownEntry(deps, brand, entryId);
  if (alreadySent(entry)) throw new AccessError("This one is already in Boutiqly's social planner. Move it there.", 400);
  if (entry.lockedAt) throw new AccessError("This one is locked. Unlock it to move it.", 400);
  const scheduledAt = parseWhen(brand, input.date, input.time);
  await deps.db
    .update(calendarEntries)
    .set({ scheduledAt, updatedAt: new Date(), dryRun: null, plannerDraftIds: [], draftSentAt: null })
    .where(eq(calendarEntries.id, entry.id));
  await audit(deps.db, viewer, "calendar.move", { entryId, scheduledAt: scheduledAt.toISOString() });
  return oneView(deps, brand, entryId);
}

export async function removeEntry(deps: CalendarDeps, viewer: Viewer, entryId: string): Promise<void> {
  const brand = requirePermission(viewer, "use_tab");
  const entry = await ownEntry(deps, brand, entryId);
  if (alreadySent(entry)) throw new AccessError("This one is already in Boutiqly's social planner. Delete it there first.", 400);
  if (entry.lockedAt) throw new AccessError("This one is locked. Unlock it to take it off the calendar.", 400);
  await deps.db.delete(calendarEntries).where(eq(calendarEntries.id, entry.id));
  await audit(deps.db, viewer, "calendar.remove", { entryId, channel: entry.channel });
}

export async function markPosted(deps: CalendarDeps, viewer: Viewer, entryId: string): Promise<EntryView> {
  const brand = requirePermission(viewer, "use_tab");
  const entry = await ownEntry(deps, brand, entryId);
  const byHand: Route[] = ["pack", "share_from_ig", "app_ping"];
  if (!byHand.includes(entry.route) || !(entry.status === "approved" || entry.status === "scheduled")) {
    throw new AccessError("Only approved posts that go out by hand can be marked as posted.", 400);
  }
  await deps.db.update(calendarEntries).set({ status: "posted", updatedAt: new Date() }).where(eq(calendarEntries.id, entry.id));
  await audit(deps.db, viewer, "calendar.mark_posted", { entryId });
  return oneView(deps, brand, entryId);
}

// ---- Approving a post (in the Library) ----

function unsentEntry(e: Entry): boolean {
  return !alreadySent(e) && e.plannerDraftIds.length === 0;
}

// Approves the post for the networks the owner ticked. Their captions become
// final. Only people do this; Claude never can.
export async function approvePiece(deps: CalendarDeps, viewer: Viewer, pieceId: string, input: { channels?: unknown }): Promise<void> {
  const brand = requirePermission(viewer, "use_tab");
  const piece = await getPieceRow(deps.db, brand, pieceId);
  const allowed = channelsFor(piece.kind as Kind).map((c) => c.id as string);
  const picked = Array.isArray(input.channels) ? [...new Set(input.channels.filter((c): c is string => typeof c === "string" && allowed.includes(c)))] : [];
  if (picked.length === 0) throw new AccessError("Tick at least one network to post to.", 400);

  const mediaRows = piece.assetIds.length ? await deps.db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, piece.assetIds))) : [];
  const media = piece.assetIds.map((id) => mediaRows.find((a) => a.id === id)).filter((a): a is Asset => !!a);
  const captionRows = await deps.db.select().from(captions).where(eq(captions.pieceId, piece.id));
  const problems = [...new Set(picked.flatMap((c) => problemsFor(c, piece.kind as Kind, media, captionRows.find((r) => r.channel === c) ?? null)))];
  if (problems.length) throw new AccessError(problems.join(" "), 400);

  // Networks taken off: their calendar spots go too, unless already locked or sent.
  const entries = await deps.db.select().from(calendarEntries).where(eq(calendarEntries.pieceId, piece.id));
  const dropped = entries.filter((e) => !picked.includes(e.channel));
  const stuck = dropped.filter((e) => e.lockedAt || !unsentEntry(e));
  if (stuck.length) {
    throw new AccessError(`${stuck.map((e) => channel(e.channel)?.name ?? e.channel).join(", ")} is already locked or sent on the calendar. Unlock it there first.`, 400);
  }
  if (dropped.length) await deps.db.delete(calendarEntries).where(inArray(calendarEntries.id, dropped.map((e) => e.id)));

  const now = new Date();
  await deps.db
    .update(captions)
    .set({ status: "final", updatedAt: now })
    .where(and(eq(captions.pieceId, piece.id), inArray(captions.channel, picked)));
  await deps.db
    .update(pieces)
    .set({ approvedAt: now, approvedBy: viewer.ctx.userId, approvedByName: viewer.ctx.name, approvedChannels: picked, updatedAt: now })
    .where(eq(pieces.id, piece.id));
  await audit(deps.db, viewer, "piece.approve", { pieceId, channels: picked });
}

// Takes the approval back. Its unlocked calendar spots are removed.
export async function unapprovePiece(deps: CalendarDeps, viewer: Viewer, pieceId: string): Promise<void> {
  const brand = requirePermission(viewer, "use_tab");
  const piece = await getPieceRow(deps.db, brand, pieceId);
  if (!piece.approvedAt) return;
  const entries = await deps.db.select().from(calendarEntries).where(eq(calendarEntries.pieceId, piece.id));
  if (entries.some((e) => e.lockedAt || !unsentEntry(e))) {
    throw new AccessError("It's locked or already sent on the calendar. Unlock it there first.", 400);
  }
  if (entries.length) await deps.db.delete(calendarEntries).where(inArray(calendarEntries.id, entries.map((e) => e.id)));
  const now = new Date();
  await deps.db.update(captions).set({ status: "draft", updatedAt: now }).where(eq(captions.pieceId, piece.id));
  await deps.db
    .update(pieces)
    .set({ approvedAt: null, approvedBy: null, approvedByName: "", approvedChannels: [], updatedAt: now })
    .where(eq(pieces.id, piece.id));
  await audit(deps.db, viewer, "piece.unapprove", { pieceId, removedEntries: entries.length });
}

// ---- Sending ----

async function entryContent(deps: CalendarDeps, brand: Brand, entry: Entry) {
  const piece = await getPieceRow(deps.db, brand, entry.pieceId);
  const mediaRows = piece.assetIds.length
    ? await deps.db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, piece.assetIds)))
    : [];
  const media = piece.assetIds.map((id) => mediaRows.find((a) => a.id === id)).filter((a): a is Asset => !!a);
  const [captionRow] = await deps.db
    .select()
    .from(captions)
    .where(and(eq(captions.pieceId, piece.id), eq(captions.channel, entry.channel)));
  return { piece, media, caption: captionRow ?? null };
}

async function plannerAccountFor(deps: CalendarDeps, brand: Brand, entry: Entry): Promise<string> {
  const accountId = entry.plannerAccountId ?? accountFor(await socialAccounts(deps, brand, true), entry.channel)?.id ?? null;
  if (!accountId) throw new AccessError(`Connect ${channel(entry.channel)?.name} in Boutiqly's social planner first.`, 400);
  return accountId;
}

// ---- Lock ----

// A locked entry stays put (nobody moves it, Claude's planning works around
// it) and is what "Send to Boutiqly" sends.
export async function lockEntry(deps: CalendarDeps, viewer: Viewer, entryId: string, locked: boolean): Promise<EntryView> {
  const brand = requirePermission(viewer, "use_tab");
  const entry = await ownEntry(deps, brand, entryId);
  if (locked) {
    if (entry.status === "suggested") throw new AccessError("Approve the post in the Library first.", 400);
    if (!entry.lockedAt) {
      await deps.db.update(calendarEntries).set({ lockedAt: new Date(), lockedBy: viewer.ctx.userId, updatedAt: new Date() }).where(eq(calendarEntries.id, entry.id));
      await audit(deps.db, viewer, "calendar.lock", { entryId });
    }
  } else if (entry.lockedAt) {
    if (alreadySent(entry)) throw new AccessError("This one is already scheduled in Boutiqly's social planner. Change it there.", 400);
    await deps.db.update(calendarEntries).set({ lockedAt: null, lockedBy: null, updatedAt: new Date() }).where(eq(calendarEntries.id, entry.id));
    await audit(deps.db, viewer, "calendar.unlock", { entryId });
  }
  return oneView(deps, brand, entryId);
}

// Locks every approved, unlocked entry from a date on (the "Lock all" button).
export async function lockAll(deps: CalendarDeps, viewer: Viewer): Promise<number> {
  const brand = requirePermission(viewer, "use_tab");
  const now = (deps.now ?? (() => new Date()))();
  const rows = await deps.db
    .update(calendarEntries)
    .set({ lockedAt: now, lockedBy: viewer.ctx.userId, updatedAt: now })
    .where(and(eq(calendarEntries.brandId, brand.id), eq(calendarEntries.status, "approved"), isNull(calendarEntries.lockedAt), gte(calendarEntries.scheduledAt, now)))
    .returning({ id: calendarEntries.id });
  await audit(deps.db, viewer, "calendar.lock_all", { count: rows.length });
  return rows.length;
}

// ---- Send locked entries to Boutiqly ----

type SendOutcome = "scheduled" | "drafted" | "failed";

// Sends one entry. Live posting on: scheduled posts. Off: drafts (they never
// publish). Ids are saved as they come back, so a retry after a half-sent
// Story set only sends the missing frames.
async function sendEntry(deps: CalendarDeps, viewer: Viewer, brand: Brand, entry: Entry, live: boolean): Promise<{ outcome: SendOutcome; error?: string }> {
  const { piece, media, caption } = await entryContent(deps, brand, entry);
  const problems = problemsFor(entry.channel, piece.kind as Kind, media, caption);
  if (problems.length) return { outcome: "failed", error: problems.join(" ") };
  let accountId: string;
  try {
    accountId = await plannerAccountFor(deps, brand, entry);
  } catch (err) {
    return { outcome: "failed", error: (err as Error).message };
  }
  const posts = buildPlannerPosts({ entry: { ...entry, plannerAccountId: accountId }, piece, media, caption, userId: viewer.ctx.userId }).map((p) =>
    live ? p : { ...p, status: "draft" as const },
  );
  const field = live ? "plannerPostIds" : "plannerDraftIds";
  const ids = [...entry[field]];
  for (let i = 0; i < posts.length; i++) {
    if (ids[i]) continue;
    try {
      ids[i] = await deps.client(brand).createPost(posts[i]!);
      await deps.db.update(calendarEntries).set({ [field]: ids }).where(eq(calendarEntries.id, entry.id));
    } catch (err) {
      const message = err instanceof BoutiqlyError ? err.message : "Boutiqly couldn't be reached.";
      if (err instanceof BoutiqlyError) console.warn(`[send] Boutiqly said ${err.status} for entry ${entry.id}: ${err.detail}`);
      const error = posts.length > 1 ? `Frame ${i + 1} of ${posts.length} didn't go through: ${message}` : message;
      await deps.db
        .update(calendarEntries)
        .set({ ...(live ? { status: "needs_attention" as const } : {}), plannerAccountId: accountId, lastError: error, updatedAt: new Date() })
        .where(eq(calendarEntries.id, entry.id));
      await audit(deps.db, viewer, live ? "calendar.send_failed" : "calendar.send_draft_failed", { entryId: entry.id, sent: i, of: posts.length, message });
      return { outcome: "failed", error };
    }
  }
  const now = new Date();
  if (live) {
    await deps.db
      .update(calendarEntries)
      .set({ status: "scheduled", dryRun: null, plannerAccountId: accountId, lastError: null, updatedAt: now })
      .where(eq(calendarEntries.id, entry.id));
    await audit(deps.db, viewer, "calendar.send", { entryId: entry.id, plannerPosts: ids.length });
    return { outcome: "scheduled" };
  }
  await deps.db.update(calendarEntries).set({ draftSentAt: now, plannerAccountId: accountId, lastError: null, updatedAt: now }).where(eq(calendarEntries.id, entry.id));
  await audit(deps.db, viewer, "calendar.send_draft", { entryId: entry.id, drafts: ids.length });
  return { outcome: "drafted" };
}

// The one-click "Send to Boutiqly": every locked entry that hasn't gone yet.
// Entries already scheduled (or, with live posting off, already sent as
// drafts) are skipped, so nothing goes twice.
export async function sendLocked(deps: CalendarDeps, viewer: Viewer): Promise<SendResult> {
  const brand = requirePermission(viewer, "use_tab");
  const done = await tryWithLock(deps.pool, `send:${brand.id}`, async () => {
    const now = (deps.now ?? (() => new Date()))();
    const [fresh] = await deps.db.select({ live: brands.livePosting }).from(brands).where(eq(brands.id, brand.id));
    const live = !!fresh?.live;
    const rows = await deps.db
      .select()
      .from(calendarEntries)
      .where(and(eq(calendarEntries.brandId, brand.id), isNotNull(calendarEntries.lockedAt), inArray(calendarEntries.status, ["approved", "needs_attention"])))
      .orderBy(asc(calendarEntries.scheduledAt));
    const result: SendResult = { live, scheduled: 0, drafted: 0, alreadySent: 0, byHand: 0, problems: [] };
    for (const entry of rows) {
      const name = `${entry.channel ? channel(entry.channel)?.name ?? entry.channel : ""}`;
      if (entry.route === "pack" || entry.route === "share_from_ig") {
        result.byHand++;
        continue;
      }
      if (!live && entry.draftSentAt) {
        result.alreadySent++;
        continue;
      }
      if (entry.scheduledAt.getTime() < now.getTime() + 60_000) {
        result.problems.push({ entryId: entry.id, message: `${name}: that time has passed. Unlock it and move it.` });
        continue;
      }
      const r = await sendEntry(deps, viewer, brand, entry, live);
      if (r.outcome === "scheduled") result.scheduled++;
      else if (r.outcome === "drafted") result.drafted++;
      else result.problems.push({ entryId: entry.id, message: `${name}: ${r.error}` });
    }
    await audit(deps.db, viewer, "calendar.send_locked", { ...result, problems: result.problems.length });
    return result;
  });
  if (!done) throw new AccessError("Already sending. Give it a moment.", 409);
  return done;
}


// ---- Keeping status in step with Boutiqly ----

export async function syncStatuses(deps: CalendarDeps, brand: Brand): Promise<void> {
  const now = (deps.now ?? (() => new Date()))();
  if (brand.syncedAt && now.getTime() - brand.syncedAt.getTime() < SYNC_EVERY_MS) return;
  await deps.db.update(brands).set({ syncedAt: now }).where(eq(brands.id, brand.id));
  brand.syncedAt = now;

  const due = await deps.db
    .select()
    .from(calendarEntries)
    .where(and(eq(calendarEntries.brandId, brand.id), eq(calendarEntries.status, "scheduled"), lte(calendarEntries.scheduledAt, now)))
    .limit(50);
  for (const e of due) {
    if (e.plannerPostIds.length === 0) continue;
    try {
      const statuses = await Promise.all(e.plannerPostIds.map((id) => deps.client(brand).getPost(id)));
      const failed = statuses.find((s) => s.status === "failed" || s.status === "deleted");
      if (failed) {
        await deps.db
          .update(calendarEntries)
          .set({
            status: "needs_attention",
            lastError: failed.status === "deleted" ? "It was deleted in Boutiqly's social planner." : `Boutiqly couldn't post it${failed.error ? `: ${failed.error}` : "."}`,
            updatedAt: now,
          })
          .where(eq(calendarEntries.id, e.id));
      } else if (statuses.every((s) => s.status === "published" || s.status === "notification_sent")) {
        await deps.db.update(calendarEntries).set({ status: "posted", updatedAt: now }).where(eq(calendarEntries.id, e.id));
      }
    } catch {
      // Boutiqly unreachable just now: try again next time.
    }
  }
}

// ---- Live posting switch ----

export async function setLivePosting(deps: CalendarDeps, viewer: Viewer, on: boolean): Promise<void> {
  const brand = requirePermission(viewer, "manage_brand");
  if (viewer.role !== "boutiqly_team") throw new AccessError("Only Boutiqly's team can turn live posting on or off.");
  await deps.db.update(brands).set({ livePosting: on }).where(eq(brands.id, brand.id));
  await audit(deps.db, viewer, on ? "posting.live_on" : "posting.live_off");
}

export async function entryForPack(deps: CalendarDeps, viewer: Viewer, entryId: string) {
  const brand = requirePermission(viewer, "use_tab");
  const entry = await ownEntry(deps, brand, entryId);
  const piece = await getPieceRow(deps.db, brand, entry.pieceId);
  const mediaRows = piece.assetIds.length
    ? await deps.db.select().from(assets).where(and(eq(assets.brandId, brand.id), inArray(assets.id, piece.assetIds)))
    : [];
  const [caption] = await deps.db
    .select()
    .from(captions)
    .where(and(eq(captions.pieceId, piece.id), eq(captions.channel, entry.channel)));
  return {
    brand,
    entry,
    piece,
    media: piece.assetIds.map((id) => mediaRows.find((a) => a.id === id)).filter((a): a is Asset => !!a),
    caption: caption ?? null,
  };
}
