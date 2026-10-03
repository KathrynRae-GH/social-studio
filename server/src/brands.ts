// Brands, the Team list and the audit log. Every function here takes the
// verified user context (never IDs from the browser) and works on exactly
// one brand: the one for the sub-account Boutiqly says the tab is open in.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { accessRequests, auditLog, brands, teamMembers, users } from "./db/schema.ts";
import type { UserContext } from "./auth/userContext.ts";
import type { BoutiqlyUser } from "./boutiqly/api.ts";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "../../shared/time.ts";
import { ROLE_LABELS, can, resolveRole, type Me, type Permission, type Role, type TeamEntry, type TeamRole } from "../../shared/roles.ts";

export type Brand = typeof brands.$inferSelect;

export interface Viewer {
  ctx: UserContext;
  brand: Brand | null;
  role: Role;
}

export class AccessError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function touchUser(db: Db, ctx: UserContext): Promise<void> {
  await db
    .insert(users)
    .values({ id: ctx.userId, companyId: ctx.companyId, name: ctx.name, email: ctx.email, isAgency: ctx.isAgencyUser })
    .onConflictDoUpdate({
      target: users.id,
      set: { name: ctx.name, email: ctx.email, isAgency: ctx.isAgencyUser, lastSeenAt: sql`now()` },
    });
}

// The brand for the sub-account the tab is open in, created on first open.
export async function brandForContext(db: Db, ctx: UserContext): Promise<Brand | null> {
  if (!ctx.locationId) return null;
  await db
    .insert(brands)
    .values({ locationId: ctx.locationId, companyId: ctx.companyId })
    .onConflictDoNothing({ target: brands.locationId });
  const [brand] = await db.select().from(brands).where(eq(brands.locationId, ctx.locationId));
  // A sub-account always belongs to one agency. A mismatch means something is
  // wrong, so refuse rather than show another agency's brand.
  if (!brand || brand.companyId !== ctx.companyId) return null;
  return brand;
}

async function teamRoleOf(db: Db, brandId: string, userId: string): Promise<TeamRole | null> {
  const [row] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.brandId, brandId), eq(teamMembers.userId, userId)));
  return row?.role ?? null;
}

export async function loadViewer(db: Db, ctx: UserContext): Promise<Viewer> {
  await touchUser(db, ctx);
  const brand = await brandForContext(db, ctx);
  if (!brand) return { ctx, brand: null, role: ctx.isAgencyUser ? "boutiqly_team" : "none" };
  const teamRole = await teamRoleOf(db, brand.id, ctx.userId);
  return { ctx, brand, role: resolveRole({ isAgencyUser: ctx.isAgencyUser, teamRole }) };
}

export function requirePermission(viewer: Viewer, permission: Permission): Brand {
  if (!viewer.brand) throw new AccessError("Open Social Studio from inside a sub-account.", 400);
  if (!can(viewer.role, permission)) throw new AccessError("You don't have access to do that.");
  return viewer.brand;
}

async function ownerCount(db: Db, brandId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(teamMembers)
    .where(and(eq(teamMembers.brandId, brandId), eq(teamMembers.role, "owner")));
  return row?.n ?? 0;
}

export async function describeViewer(db: Db, viewer: Viewer): Promise<Me> {
  const permissions = (["use_tab", "manage_team", "manage_brand"] as const).filter((p) => can(viewer.role, p));
  return {
    user: { id: viewer.ctx.userId, name: viewer.ctx.name, email: viewer.ctx.email },
    role: viewer.role,
    roleLabel: ROLE_LABELS[viewer.role],
    brand: viewer.brand
      ? {
          id: viewer.brand.id,
          name: viewer.brand.name,
          locationId: viewer.brand.locationId,
          hasOwner: (await ownerCount(db, viewer.brand.id)) > 0,
          timezone: viewer.brand.timezone || DEFAULT_TIME_ZONE,
          livePosting: viewer.brand.livePosting,
        }
      : null,
    permissions,
  };
}

export async function audit(db: Db, viewer: Viewer, action: string, detail: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({
    brandId: viewer.brand?.id ?? null,
    userId: viewer.ctx.userId,
    userName: viewer.ctx.name,
    action,
    detail,
  });
}

export async function requestAccess(db: Db, viewer: Viewer): Promise<void> {
  if (!viewer.brand) throw new AccessError("Open Social Studio from inside a sub-account.", 400);
  if (viewer.role !== "none") return;
  await db
    .insert(accessRequests)
    .values({ brandId: viewer.brand.id, userId: viewer.ctx.userId })
    .onConflictDoNothing();
  await audit(db, viewer, "access.requested");
}

export async function hasRequestedAccess(db: Db, viewer: Viewer): Promise<boolean> {
  if (!viewer.brand) return false;
  const [row] = await db
    .select({ userId: accessRequests.userId })
    .from(accessRequests)
    .where(and(eq(accessRequests.brandId, viewer.brand.id), eq(accessRequests.userId, viewer.ctx.userId)));
  return !!row;
}

// The Team list plus anyone waiting for access, for one brand.
export async function listTeam(db: Db, viewer: Viewer): Promise<TeamEntry[]> {
  const brand = requirePermission(viewer, "use_tab");
  const members = await db
    .select({ userId: teamMembers.userId, role: teamMembers.role, name: users.name, email: users.email, isAgency: users.isAgency })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.brandId, brand.id))
    .orderBy(teamMembers.role, users.name);
  const entries: TeamEntry[] = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
    role: m.role,
    isAgency: m.isAgency,
  }));
  if (!can(viewer.role, "manage_team")) return entries;

  const requests = await db
    .select({ userId: accessRequests.userId, name: users.name, email: users.email, at: accessRequests.requestedAt })
    .from(accessRequests)
    .innerJoin(users, eq(users.id, accessRequests.userId))
    .where(eq(accessRequests.brandId, brand.id))
    .orderBy(accessRequests.requestedAt);
  return [
    ...entries,
    ...requests.map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      role: "requested" as const,
      requestedAt: r.at.toISOString(),
    })),
  ];
}

// Boutiqly's own list of people with a login to this brand's sub-account.
// Passed in so this file doesn't need to know how Boutiqly is called.
export type SubAccountUsers = () => Promise<BoutiqlyUser[]>;

async function hasAccessRequest(db: Db, brandId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: accessRequests.userId })
    .from(accessRequests)
    .where(and(eq(accessRequests.brandId, brandId), eq(accessRequests.userId, userId)));
  return !!row;
}

// People who could be added to the Team list: this sub-account's Boutiqly
// users, plus Boutiqly's agency team (those who have opened Social Studio,
// so we know them from Boutiqly's own signed user context). Agency people
// keep full access either way; being on the list names them for this shop,
// for example as its owner.
export async function listCandidates(db: Db, viewer: Viewer, subAccountUsers: SubAccountUsers): Promise<TeamEntry[]> {
  const brand = requirePermission(viewer, "manage_team");
  const onTeam = new Set(
    (await db.select({ userId: teamMembers.userId }).from(teamMembers).where(eq(teamMembers.brandId, brand.id))).map(
      (r) => r.userId,
    ),
  );
  const people = new Map<string, TeamEntry>();
  for (const u of await subAccountUsers()) {
    people.set(u.id, { userId: u.id, name: u.name, email: u.email, role: "candidate", isAgency: u.isAgency });
  }
  for (const u of await knownAgencyUsers(db, brand.companyId)) {
    if (!people.has(u.id)) people.set(u.id, { userId: u.id, name: u.name, email: u.email, role: "candidate", isAgency: true });
  }
  return [...people.values()]
    .filter((p) => !onTeam.has(p.userId))
    .sort((a, b) => Number(a.isAgency) - Number(b.isAgency) || a.name.localeCompare(b.name));
}

async function knownAgencyUsers(db: Db, companyId: string) {
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.companyId, companyId), eq(users.isAgency, true)));
}

// Adds someone to the Team list or changes their role. They must be on the
// list already, have asked for access in this brand's tab, be on this
// agency's Boutiqly team, or be a user of this sub-account according to
// Boutiqly itself (checked here, never taken from the browser).
export async function setTeamRole(
  db: Db,
  viewer: Viewer,
  targetUserId: string,
  role: TeamRole,
  subAccountUsers: SubAccountUsers,
): Promise<void> {
  const brand = requirePermission(viewer, "manage_team");
  let [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  const known =
    !!target &&
    target.companyId === brand.companyId &&
    (target.isAgency ||
      (await teamRoleOf(db, brand.id, targetUserId)) !== null ||
      (await hasAccessRequest(db, brand.id, targetUserId)));

  if (!known) {
    const fromBoutiqly = (await subAccountUsers()).find((u) => u.id === targetUserId);
    if (!fromBoutiqly) throw new AccessError("That person isn't a user of this sub-account in Boutiqly.", 404);
    [target] = await db
      .insert(users)
      .values({
        id: fromBoutiqly.id,
        companyId: brand.companyId,
        name: fromBoutiqly.name,
        email: fromBoutiqly.email,
        isAgency: fromBoutiqly.isAgency,
      })
      .onConflictDoUpdate({ target: users.id, set: { name: fromBoutiqly.name, email: fromBoutiqly.email } })
      .returning();
  }
  if (!target) throw new AccessError("That person isn't a user of this sub-account in Boutiqly.", 404);

  await db.transaction(async (tx) => {
    await tx
      .insert(teamMembers)
      .values({ brandId: brand.id, userId: targetUserId, role, addedBy: viewer.ctx.userId })
      .onConflictDoUpdate({ target: [teamMembers.brandId, teamMembers.userId], set: { role } });
    await tx
      .delete(accessRequests)
      .where(and(eq(accessRequests.brandId, brand.id), eq(accessRequests.userId, targetUserId)));
  });
  await audit(db, viewer, "team.set_role", { userId: targetUserId, name: target.name, role });
}

// Saves the shop's name and time zone from Boutiqly the first time we learn them.
export async function saveBrandDetails(
  db: Db,
  brand: Brand,
  details: { name: string | null; timezone: string | null },
): Promise<void> {
  const name = details.name ?? brand.name;
  const timezone = details.timezone && isValidTimeZone(details.timezone) ? details.timezone : brand.timezone;
  if (name === brand.name && timezone === brand.timezone) return;
  await db.update(brands).set({ name, timezone }).where(eq(brands.id, brand.id));
  brand.name = name;
  brand.timezone = timezone;
}

export async function removeFromTeam(db: Db, viewer: Viewer, targetUserId: string): Promise<void> {
  const brand = requirePermission(viewer, "manage_team");
  const removingOwner = (await teamRoleOf(db, brand.id, targetUserId)) === "owner";
  if (removingOwner && viewer.role === "owner" && (await ownerCount(db, brand.id)) <= 1) {
    throw new AccessError("A brand needs at least one owner. Ask Boutiqly's team to change owners.", 400);
  }
  await db.delete(teamMembers).where(and(eq(teamMembers.brandId, brand.id), eq(teamMembers.userId, targetUserId)));
  await db
    .delete(accessRequests)
    .where(and(eq(accessRequests.brandId, brand.id), eq(accessRequests.userId, targetUserId)));
  await audit(db, viewer, "team.remove", { userId: targetUserId });
}
