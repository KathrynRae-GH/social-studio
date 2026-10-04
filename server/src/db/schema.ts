// Typed view of the tables created by the SQL files in server/migrations.
// The migrations are the source of truth; keep this file in step with them.
import { pgTable, text, uuid, timestamp, boolean, bigserial, bigint, integer, jsonb, numeric, primaryKey } from "drizzle-orm/pg-core";
import type { Design, SensitiveFlag, StyleColor } from "../../../shared/design.ts";

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: text("location_id").notNull(),
  companyId: text("company_id").notNull(),
  name: text("name"),
  timezone: text("timezone"),
  livePosting: boolean("live_posting").notNull().default(false),
  mediaFolderId: text("media_folder_id"),
  claudeEnabled: boolean("claude_enabled").notNull().default(false),
  claudeCapCents: integer("claude_cap_cents").notNull().default(2000),
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
  description: text("description").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  hasPeople: boolean("has_people"),
  possibleMinor: boolean("possible_minor").notNull().default(false),
  sensitive: jsonb("sensitive").$type<SensitiveFlag[]>().notNull().default([]),
  flagsCleared: boolean("flags_cleared").notNull().default(false),
  peopleRule: text("people_rule", { enum: ["ok", "no_faces", "dont_use"] }).notNull().default("ok"),
  taggedAt: ts("tagged_at"),
  sourceAssetId: uuid("source_asset_id"),
  madeBy: text("made_by", { enum: ["upload", "render", "blur"] }).notNull().default("upload"),
  purpose: text("purpose", { enum: ["content", "inspiration"] }).notNull().default("content"),
  productId: uuid("product_id"), // a photo copied from the shop's online store
});

export const pieces = pgTable("pieces", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull().default(""),
  assetIds: uuid("asset_ids").array().notNull().default([]),
  link: text("link").notNull().default(""),
  archived: boolean("archived").notNull().default(false),
  source: text("source", { enum: ["owner", "claude"] }).notNull().default("owner"),
  design: jsonb("design").$type<Design | null>(),
  approvedAt: ts("approved_at"),
  approvedBy: text("approved_by"),
  approvedByName: text("approved_by_name").notNull().default(""),
  approvedChannels: text("approved_channels").array().notNull().default([]),
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
  lockedAt: ts("locked_at"),
  lockedBy: text("locked_by"),
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

export const usageLedger = pgTable("usage_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  brandId: uuid("brand_id").notNull(),
  userId: text("user_id").notNull(),
  purpose: text("purpose").notNull(),
  refId: text("ref_id"),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  webSearches: integer("web_searches").notNull().default(0),
  speed: text("speed", { enum: ["standard", "fast"] }).notNull().default("standard"),
  costCents: numeric("cost_cents").notNull(),
  credits: numeric("credits").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const styleSets = pgTable("style_sets", {
  brandId: uuid("brand_id").primaryKey(),
  logoAssetId: uuid("logo_asset_id"),
  colors: jsonb("colors").$type<StyleColor[]>().notNull().default([]),
  headingFont: text("heading_font").notNull().default("Montserrat"),
  bodyFont: text("body_font").notNull().default("Montserrat"),
  vibe: text("vibe").notNull().default(""),
  dosDonts: text("dos_donts").notNull().default(""),
  status: text("status", { enum: ["draft", "approved"] }).notNull().default("draft"),
  approvedBy: text("approved_by"),
  approvedAt: ts("approved_at"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const renderOutputs = pgTable("render_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull(),
  frame: integer("frame").notNull(),
  mime: text("mime").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const conversationMessages = pgTable("conversation_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: jsonb("content").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  conversationId: uuid("conversation_id"),
  kind: text("kind").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").notNull(),
  status: text("status", { enum: ["open", "applied", "dismissed"] }).notNull().default("open"),
  decidedBy: text("decided_by"),
  decidedAt: ts("decided_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// brand_fonts.data (the file bytes) is read with plain SQL, never through Drizzle.
export const brandFonts = pgTable("brand_fonts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  family: text("family").notNull(),
  weight: integer("weight").notNull().default(400),
  italic: boolean("italic").notNull().default(false),
  format: text("format", { enum: ["woff2", "woff", "truetype", "opentype"] }).notNull(),
  fileName: text("file_name").notNull().default(""),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const pieceFeedback = pgTable("piece_feedback", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  brandId: uuid("brand_id").notNull(),
  pieceId: uuid("piece_id").notNull(),
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull().default(""),
  rating: integer("rating").notNull(),
  note: text("note").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const stores = pgTable("stores", {
  brandId: uuid("brand_id").primaryKey(),
  url: text("url").notNull(),
  platform: text("platform", { enum: ["unknown", "shopify", "other"] }).notNull().default("unknown"),
  status: text("status", { enum: ["new", "reading", "ok", "error"] }).notNull().default("new"),
  lastReadAt: ts("last_read_at"),
  lastError: text("last_error"),
  connectedBy: text("connected_by").notNull(),
  connectedAt: ts("connected_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull().default(""),
  productType: text("product_type").notNull().default(""),
  tags: text("tags").array().notNull().default([]),
  imageUrl: text("image_url"),
  assetId: uuid("asset_id"),
  assetImageUrl: text("asset_image_url"),
  available: boolean("available"),
  publishedAt: ts("published_at"),
  firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
  inFirstRead: boolean("in_first_read").notNull().default(false),
  pageLastmod: text("page_lastmod"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  removedAt: ts("removed_at"),
});
