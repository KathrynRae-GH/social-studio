// Typed view of the tables created by the SQL files in server/migrations.
// The migrations are the source of truth; keep this file in step with them.
import { pgTable, text, uuid, timestamp, boolean, bigserial, bigint, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: text("location_id").notNull(),
  companyId: text("company_id").notNull(),
  name: text("name"),
  timezone: text("timezone"),
  livePosting: boolean("live_posting").notNull().default(false),
  mediaFolderId: text("media_folder_id"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  isAgency: boolean("is_agency").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    brandId: uuid("brand_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["owner", "team"] }).notNull(),
    addedBy: text("added_by").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.brandId, t.userId] })],
);

export const accessRequests = pgTable(
  "access_requests",
  {
    brandId: uuid("brand_id").notNull(),
    userId: text("user_id").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.brandId, t.userId] })],
);

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  brandId: uuid("brand_id"),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  detail: jsonb("detail").notNull().default({}),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const installs = pgTable("installs", {
  resourceId: text("resource_id").primaryKey(),
  userType: text("user_type").notNull(),
  companyId: text("company_id"),
  locationId: text("location_id"),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  beatAt: timestamp("beat_at", { withTimezone: true }).notNull().defaultNow(),
  version: text("version").notNull().default(""),
});

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  boutiqlyFileId: text("boutiqly_file_id"),
  url: text("url").notNull(),
  mime: text("mime").notNull(),
  name: text("name").notNull().default(""),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const pieces = pgTable("pieces", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull().default(""),
  assetIds: uuid("asset_ids").array().notNull().default([]),
  link: text("link").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const captions = pgTable(
  "captions",
  {
    pieceId: uuid("piece_id").notNull(),
    channel: text("channel").notNull(),
    text: text("text").notNull().default(""),
    altText: text("alt_text").notNull().default(""),
    status: text("status", { enum: ["draft", "final"] }).notNull().default("draft"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.pieceId, t.channel] })],
);

export const calendarEntries = pgTable("calendar_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  pieceId: uuid("piece_id").notNull(),
  channel: text("channel").notNull(),
  scheduledAt: ts("scheduled_at").notNull(),
  status: text("status", { enum: ["suggested", "approved", "scheduled", "posted", "needs_attention"] })
    .notNull()
    .default("suggested"),
  route: text("route", { enum: ["publish", "app_ping", "pack", "share_from_ig"] }).notNull(),
  plannerAccountId: text("planner_account_id"),
  plannerPostIds: text("planner_post_ids").array().notNull().default([]),
  dryRun: jsonb("dry_run"),
  plannerDraftIds: text("planner_draft_ids").array().notNull().default([]),
  draftSentAt: ts("draft_sent_at"),
  lastError: text("last_error"),
  source: text("source").notNull().default("owner"),
  approvedBy: text("approved_by"),
  approvedAt: ts("approved_at"),
  createdBy: text("created_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const ideas = pgTable("ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  title: text("title").notNull(),
  pitch: text("pitch").notNull().default(""),
  format: text("format").notNull().default(""),
  status: text("status", { enum: ["now", "later", "built", "done"] }).notNull().default("later"),
  pieceId: uuid("piece_id"),
  source: text("source").notNull().default("owner"),
  createdBy: text("created_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const shots = pgTable("shots", {
  id: uuid("id").primaryKey().defaultRandom(),
  ideaId: uuid("idea_id").notNull(),
  text: text("text").notNull(),
  done: boolean("done").notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  title: text("title").notNull(),
  startsAt: ts("starts_at").notNull(),
  link: text("link").notNull().default(""),
  canceled: boolean("canceled").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
});
