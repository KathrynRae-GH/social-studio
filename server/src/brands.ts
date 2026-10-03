// Brands, the Team list and the audit log. Every function here takes the
// verified user context (never IDs from the browser) and works on exactly
// one brand: the one for the sub-account Boutiqly says the tab is open in.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { accessRequests, auditLog, brands, teamMembers, users } from "./db/schema.ts";
import type { UserContext } from "./auth/userContext.ts";
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
    .select({ userId: teamMembers.userId, role: teamMembers.role, name: users.name, email: users.email })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.brandId, brand.id))
    .orderBy(teamMembers.role, users.name);
  const entries: TeamEntry[] = members.map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role }));
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

// Adds someone to the Team list or changes their role. Only people who have
// opened this sub-account's tab can be added (we know them from Boutiqly's
// own user context), and they must belong to the same agency.
export async function setTeamRole(db: Db, viewer: Viewer, targetUserId: string, role: TeamRole): Promise<void> {
  const brand = requirePermission(viewer, "manage_team");
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  if (!target || target.companyId !== brand.companyId) throw new AccessError("That person hasn't opened this tab yet.", 404);
  if (target.isAgency) throw new AccessError("Boutiqly's team already has full access.", 400);

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
