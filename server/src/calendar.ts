// The Calendar: putting pieces on dates per channel, approving them (which
// sends them to Boutiqly's social planner, makes app pings, or readies a
// pack), and keeping their status in step with Boutiqly.
//
// Safety: nothing reaches a real social account unless the brand's Live
// posting switch is on (only Boutiqly's team can turn it on). While it's off,
// Approve records exactly what it would have sent and sends nothing.
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type pg from "pg";
import type { Db } from "./db/pool.ts";
import { assets, brands, calendarEntries, captions, pieces } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import { getPieceRow } from "./library.ts";
import { BoutiqlyError, plannerMediaType, type BoutiqlyClient, type PlannerPostInput, type SocialAccount } from "./boutiqly/api.ts";
import { channel, routeFor, type Kind, type Route } from "../../shared/channels.ts";
import { DEFAULT_TIME_ZONE, utcToZoned, zonedToUtc } from "../../shared/time.ts";
import type { AccountView, ApproveResult, CalendarData, DraftResult, EntryView } from "../../shared/content.ts";

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
  return { timezone: tz, livePosting: brand.livePosting, entries: await entryViews(deps, brand, rows), accounts: accountViews(accounts), notices };
}

const CHANNEL_BY_PLATFORM: Record<string, string> = Object.fromEntries(
  ["instagram", "facebook", "threads", "linkedin", "bluesky", "community", "google", "youtube"].map((id) => [
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
  const scheduledAt = parseWhen(brand, input.date, input.time);
  await deps.db
    .update(calendarEntries)
    .set({ scheduledAt, updatedAt: new Date(), dryRun: null, status: entry.status === "approved" ? "suggested" : entry.status })
    .where(eq(calendarEntries.id, entry.id));
  await audit(deps.db, viewer, "calendar.move", { entryId, scheduledAt: scheduledAt.toISOString() });
  return oneView(deps, brand, entryId);
}

export async function removeEntry(deps: CalendarDeps, viewer: Viewer, entryId: string): Promise<void> {
  const brand = requirePermission(viewer, "use_tab");
  const entry = await ownEntry(deps, brand, entryId);
  if (alreadySent(entry)) throw new AccessError("This one is already in Boutiqly's social planner. Delete it there first.", 400);
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

// ---- Approve ----

// Stops two clicks (or two people) from sending the same entry twice.
async function withEntryLock<T>(pool: pg.Pool, entryId: string, fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtext($1)) AS ok", [entryId]);
    if (!rows[0]?.ok) throw new AccessError("This post is already being sent. Give it a moment.", 409);
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [entryId]);
    }
  } finally {
    client.release();
  }
}

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

export async function approveEntry(deps: CalendarDeps, viewer: Viewer, entryId: string): Promise<ApproveResult> {
  const brand = requirePermission(viewer, "use_tab");
  return withEntryLock(deps.pool, entryId, async () => {
    const entry = await ownEntry(deps, brand, entryId);
    const retryable = entry.status === "suggested" || entry.status === "needs_attention" || (entry.status === "approved" && !!entry.dryRun);
    if (!retryable) throw new AccessError("This one has already been approved.", 400);

    const { piece, media, caption } = await entryContent(deps, brand, entry);
    const problems = problemsFor(entry.channel, piece.kind as Kind, media, caption);
    if (problems.length) throw new AccessError(problems.join(" "), 400);
    const now = (deps.now ?? (() => new Date()))();
    const approved = { approvedBy: viewer.ctx.userId, approvedAt: now, updatedAt: now };

    if (entry.route === "pack" || entry.route === "share_from_ig") {
      await deps.db.update(calendarEntries).set({ ...approved, status: "approved", lastError: null }).where(eq(calendarEntries.id, entry.id));
      await audit(deps.db, viewer, "calendar.approve", { entryId, route: entry.route });
      return { entry: await oneView(deps, brand, entryId) };
    }

    if (entry.scheduledAt.getTime() < now.getTime() + 60_000) {
      throw new AccessError("That time has already passed. Move it to a time in the future first.", 400);
    }
    const accountId = await plannerAccountFor(deps, brand, entry);
    const posts = buildPlannerPosts({ entry: { ...entry, plannerAccountId: accountId }, piece, media, caption, userId: viewer.ctx.userId });

    // Live posting off: show what would go out, send nothing.
    const [fresh] = await deps.db.select({ live: brands.livePosting }).from(brands).where(eq(brands.id, brand.id));
    if (!fresh?.live) {
      await deps.db
        .update(calendarEntries)
        .set({ ...approved, status: "approved", dryRun: posts, plannerAccountId: accountId, lastError: null })
        .where(eq(calendarEntries.id, entry.id));
      await audit(deps.db, viewer, "calendar.approve_dry_run", { entryId, posts: posts.length });
      return { entry: await oneView(deps, brand, entryId), dryRun: posts };
    }

    // Live: send each planner post once. Ids are saved as they come back, so
    // a retry after a half-sent Story set only sends the missing frames.
    const ids = [...entry.plannerPostIds];
    for (let i = 0; i < posts.length; i++) {
      if (ids[i]) continue;
      try {
        ids[i] = await deps.client(brand).createPost(posts[i]!);
        await deps.db.update(calendarEntries).set({ plannerPostIds: ids }).where(eq(calendarEntries.id, entry.id));
      } catch (err) {
        const message = err instanceof BoutiqlyError ? err.message : "Boutiqly couldn't be reached.";
        if (err instanceof BoutiqlyError) console.warn(`[approve] Boutiqly said ${err.status} for entry ${entryId}: ${err.detail}`);
        await deps.db
          .update(calendarEntries)
          .set({
            ...approved,
            status: "needs_attention",
            plannerAccountId: accountId,
            lastError: posts.length > 1 ? `Frame ${i + 1} of ${posts.length} didn't go through: ${message}` : message,
          })
          .where(eq(calendarEntries.id, entry.id));
        await audit(deps.db, viewer, "calendar.approve_failed", { entryId, sent: i, of: posts.length, message });
        return { entry: await oneView(deps, brand, entryId) };
      }
    }
    await deps.db
      .update(calendarEntries)
      .set({ ...approved, status: "scheduled", dryRun: null, plannerAccountId: accountId, lastError: null })
      .where(eq(calendarEntries.id, entry.id));
    await audit(deps.db, viewer, "calendar.approve", { entryId, route: entry.route, plannerPosts: ids.length });
    return { entry: await oneView(deps, brand, entryId) };
  });
}

// ---- Drafts: proving the connection without posting ----

// Sends the entry to Boutiqly's social planner as a draft. Drafts never
// publish, so this works whether Live posting is on or off. The entry's own
// status doesn't change.
export async function sendDraft(deps: CalendarDeps, viewer: Viewer, entryId: string): Promise<DraftResult> {
  const brand = requirePermission(viewer, "use_tab");
  return withEntryLock(deps.pool, entryId, async () => {
    const entry = await ownEntry(deps, brand, entryId);
    if (entry.route !== "publish" && entry.route !== "app_ping") {
      throw new AccessError("This one goes out as a ready-to-post pack, so there's nothing to send to Boutiqly's social planner.", 400);
    }
    const { piece, media, caption } = await entryContent(deps, brand, entry);
    const problems = problemsFor(entry.channel, piece.kind as Kind, media, caption);
    if (problems.length) throw new AccessError(problems.join(" "), 400);
    const accountId = await plannerAccountFor(deps, brand, entry);
    const posts = buildPlannerPosts({ entry: { ...entry, plannerAccountId: accountId }, piece, media, caption, userId: viewer.ctx.userId })
      .map((p) => ({ ...p, status: "draft" as const }));

    const ids = [...entry.plannerDraftIds];
    if (posts.length > 0 && ids.length >= posts.length && ids.every(Boolean)) {
      return { entry: await oneView(deps, brand, entryId), alreadySent: true };
    }
    // Ids are saved as they come back, so a retry only sends the missing frames.
    for (let i = 0; i < posts.length; i++) {
      if (ids[i]) continue;
      try {
        ids[i] = await deps.client(brand).createPost(posts[i]!);
        await deps.db.update(calendarEntries).set({ plannerDraftIds: ids }).where(eq(calendarEntries.id, entry.id));
      } catch (err) {
        const message = err instanceof BoutiqlyError ? err.message : "Boutiqly couldn't be reached.";
        if (err instanceof BoutiqlyError) {
          console.warn(`[draft] Boutiqly said ${err.status} for entry ${entryId}: ${err.detail}`);
        } else {
          console.warn(`[draft] couldn't reach Boutiqly for entry ${entryId}: ${(err as Error).message}`);
        }
        await audit(deps.db, viewer, "calendar.send_draft_failed", { entryId, sent: i, of: posts.length, message });
        throw new AccessError(
          posts.length > 1 ? `Frame ${i + 1} of ${posts.length} didn't go through. Boutiqly said: ${message}` : `Boutiqly said: ${message}`,
          502,
        );
      }
    }
    const now = (deps.now ?? (() => new Date()))();
    await deps.db.update(calendarEntries).set({ draftSentAt: now, plannerAccountId: accountId }).where(eq(calendarEntries.id, entry.id));
    await audit(deps.db, viewer, "calendar.send_draft", { entryId, drafts: ids.length });
    return { entry: await oneView(deps, brand, entryId), alreadySent: false };
  });
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
