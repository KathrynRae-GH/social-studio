// Each shop's look (style set). The owner or Boutiqly's team edits and
// approves it; Claude never approves it. Until it's approved, Claude designs
// in the basic Boutiqly look with no logo (FALLBACK_STYLE).
import { and, eq } from "drizzle-orm";
import type { Db } from "./db/pool.ts";
import { assets, styleSets } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import { FALLBACK_STYLE, validColor, validFont, type StyleColor, type StyleSetView } from "../../shared/design.ts";
import { fontsFor } from "./fonts.ts";

type Row = typeof styleSets.$inferSelect;

async function logoUrl(db: Db, brand: Brand, assetId: string | null): Promise<string | null> {
  if (!assetId) return null;
  const [a] = await db.select({ url: assets.url }).from(assets).where(and(eq(assets.id, assetId), eq(assets.brandId, brand.id)));
  return a?.url ?? null;
}

async function view(db: Db, brand: Brand, row: Row): Promise<StyleSetView> {
  return {
    colors: row.colors,
    customFonts: await fontsFor(db, brand),
    headingFont: row.headingFont,
    bodyFont: row.bodyFont,
    vibe: row.vibe,
    dosDonts: row.dosDonts,
    logoAssetId: row.logoAssetId,
    logoUrl: await logoUrl(db, brand, row.logoAssetId),
    status: row.status,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

// What the Brand screen shows: the saved set (approved or not), or the fallback.
export async function getStyleSet(db: Db, viewer: Viewer): Promise<StyleSetView> {
  const brand = requirePermission(viewer, "use_tab");
  const [row] = await db.select().from(styleSets).where(eq(styleSets.brandId, brand.id));
  return row ? view(db, brand, row) : { ...FALLBACK_STYLE, customFonts: await fontsFor(db, brand) };
}

// What Claude designs with: only an approved set, never a draft.
export async function styleForDesign(db: Db, brand: Brand): Promise<StyleSetView> {
  const [row] = await db.select().from(styleSets).where(eq(styleSets.brandId, brand.id));
  if (!row || row.status !== "approved") return FALLBACK_STYLE;
  const v = await view(db, brand, row);
  return v.colors.length ? v : { ...v, colors: FALLBACK_STYLE.colors };
}

export interface StyleInput {
  colors?: unknown;
  headingFont?: unknown;
  bodyFont?: unknown;
  vibe?: unknown;
  dosDonts?: unknown;
  logoAssetId?: unknown;
}

// Any change puts the set back to draft, so the owner approves what Claude uses.
export async function saveStyleSet(db: Db, viewer: Viewer, input: StyleInput): Promise<StyleSetView> {
  const brand = requirePermission(viewer, "manage_brand");
  const [current] = await db.select().from(styleSets).where(eq(styleSets.brandId, brand.id));
  const next = {
    colors: current?.colors ?? [],
    headingFont: current?.headingFont ?? "Montserrat",
    bodyFont: current?.bodyFont ?? "Montserrat",
    vibe: current?.vibe ?? "",
    dosDonts: current?.dosDonts ?? "",
    logoAssetId: current?.logoAssetId ?? null,
  };
  if (input.colors !== undefined) {
    if (!Array.isArray(input.colors) || input.colors.length > 8 || !input.colors.every(validColor)) {
      throw new AccessError("Colors need a name, a hex code like #1d3c34 and a role. Up to 8.", 400);
    }
    next.colors = (input.colors as StyleColor[]).map((c) => ({ name: c.name.trim(), hex: c.hex.toLowerCase(), role: c.role }));
  }
  for (const key of ["headingFont", "bodyFont"] as const) {
    if (input[key] === undefined) continue;
    if (!validFont(input[key])) throw new AccessError("Pick a font by its name: a Google font like Montserrat, or one you've uploaded.", 400);
    next[key] = (input[key] as string).trim();
  }
  for (const key of ["vibe", "dosDonts"] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "string" || (input[key] as string).length > 2000) throw new AccessError("Keep notes under 2,000 characters.", 400);
    next[key] = input[key] as string;
  }
  if (input.logoAssetId !== undefined) {
    if (input.logoAssetId === null || input.logoAssetId === "") next.logoAssetId = null;
    else {
      const [a] = await db
        .select({ id: assets.id, mime: assets.mime })
        .from(assets)
        .where(and(eq(assets.id, String(input.logoAssetId)), eq(assets.brandId, brand.id)));
      if (!a || !a.mime.startsWith("image/")) throw new AccessError("Pick an image from this shop's files for the logo.", 400);
      next.logoAssetId = a.id;
    }
  }
  const values = { ...next, status: "draft" as const, approvedBy: null, approvedAt: null, updatedBy: viewer.ctx.userId, updatedAt: new Date() };
  await db
    .insert(styleSets)
    .values({ brandId: brand.id, ...values })
    .onConflictDoUpdate({ target: styleSets.brandId, set: values });
  await audit(db, viewer, "style.save", { colors: next.colors.length, headingFont: next.headingFont, bodyFont: next.bodyFont, logo: !!next.logoAssetId });
  return getStyleSet(db, viewer);
}

export async function approveStyleSet(db: Db, viewer: Viewer): Promise<StyleSetView> {
  const brand = requirePermission(viewer, "manage_brand");
  const [row] = await db.select().from(styleSets).where(eq(styleSets.brandId, brand.id));
  if (!row) throw new AccessError("Save the shop's look first.", 400);
  if (row.colors.length < 2) throw new AccessError("Add at least two colors before approving.", 400);
  await db
    .update(styleSets)
    .set({ status: "approved", approvedBy: viewer.ctx.name || viewer.ctx.userId, approvedAt: new Date() })
    .where(eq(styleSets.brandId, brand.id));
  await audit(db, viewer, "style.approve");
  return getStyleSet(db, viewer);
}
