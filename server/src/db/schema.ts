// Typed view of the tables created by the SQL files in server/migrations.
// The migrations are the source of truth; keep this file in step with them.
import { pgTable, text, uuid, timestamp, boolean, bigserial, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  locationId: text("location_id").notNull(),
  companyId: text("company_id").notNull(),
  name: text("name"),
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
