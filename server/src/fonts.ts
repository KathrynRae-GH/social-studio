// Fonts a shop uploads because they aren't on Google Fonts. They work like
// Google fonts in the Look editor, in Claude's designs and in rendered posts.
import { and, asc, eq } from "drizzle-orm";
import type pg from "pg";
import type { Db } from "./db/pool.ts";
import { brandFonts, styleSets } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import type { CustomFont } from "../../shared/design.ts";

export const MAX_FONT_BYTES = 5 * 1024 * 1024;
const FAMILY = /^[A-Za-z0-9 ]{2,40}$/;

const MIME: Record<CustomFont["format"], string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  truetype: "font/ttf",
  opentype: "font/otf",
};

// What kind of font file this is, from its first bytes (never the name).
export function sniffFont(bytes: Uint8Array): CustomFont["format"] | null {
  if (bytes.length < 12) return null;
  const tag = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  if (tag === "wOF2") return "woff2";
  if (tag === "wOFF") return "woff";
  if (tag === "OTTO") return "opentype";
  if (tag === "true" || (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0)) return "truetype";
  return null;
}

// "RiotSans-BoldItalic.woff2" → "Riot Sans"
export function familyFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").split(/[-_]/)[0] ?? "";
  return base.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 40);
}

const row = (f: typeof brandFonts.$inferSelect): CustomFont & { fileName: string; sizeBytes: number } => ({
  id: f.id,
  family: f.family,
  weight: f.weight,
  italic: f.italic,
  format: f.format,
  fileName: f.fileName,
  sizeBytes: f.sizeBytes,
});

export async function fontsFor(db: Db, brand: Brand): Promise<CustomFont[]> {
  const rows = await db.select().from(brandFonts).where(eq(brandFonts.brandId, brand.id)).orderBy(asc(brandFonts.family), asc(brandFonts.weight));
  return rows.map(({ id, family, weight, italic, format }) => ({ id, family, weight, italic, format }));
}

export async function listFonts(db: Db, viewer: Viewer) {
  const brand = requirePermission(viewer, "use_tab");
  const rows = await db.select().from(brandFonts).where(eq(brandFonts.brandId, brand.id)).orderBy(asc(brandFonts.family), asc(brandFonts.weight));
  return rows.map(row);
}

export async function uploadFont(
  db: Db,
  pool: pg.Pool,
  viewer: Viewer,
  file: { bytes: Uint8Array; fileName: string; family?: unknown; weight?: unknown; italic?: unknown },
) {
  const brand = requirePermission(viewer, "manage_brand");
  if (file.bytes.length > MAX_FONT_BYTES) throw new AccessError("That font file is over 5 MB.", 413);
  const format = sniffFont(file.bytes);
  if (!format) throw new AccessError("That isn't a font file. Upload a .woff2, .woff, .ttf or .otf file.", 400);
  const family = (typeof file.family === "string" && file.family.trim() ? file.family.trim() : familyFromFileName(file.fileName)).replace(/\s+/g, " ");
  if (!FAMILY.test(family)) throw new AccessError("Give the font a name using letters, numbers and spaces, like Riot Sans.", 400);
  const weight = Number(file.weight ?? 400);
  if (!Number.isInteger(weight) || weight < 100 || weight > 900 || weight % 100 !== 0) throw new AccessError("Pick a weight from 100 to 900.", 400);
  const italic = file.italic === true || file.italic === "true";
  const fileName = file.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO brand_fonts (brand_id, family, weight, italic, format, file_name, data, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [brand.id, family, weight, italic, format, fileName, Buffer.from(file.bytes), file.bytes.length, viewer.ctx.userId],
  );
  await audit(db, viewer, "font.upload", { fontId: rows[0]!.id, family, weight, italic, format });
  const [saved] = await db.select().from(brandFonts).where(eq(brandFonts.id, rows[0]!.id));
  return row(saved!);
}

// Removing a font the approved look uses puts the look back to draft, so the
// owner sees the change before Claude designs with the fallback.
export async function deleteFont(db: Db, viewer: Viewer, fontId: string): Promise<void> {
  const brand = requirePermission(viewer, "manage_brand");
  if (!/^[0-9a-f-]{36}$/i.test(fontId)) throw new AccessError("That font isn't in this shop.", 404);
  const [font] = await db.select().from(brandFonts).where(and(eq(brandFonts.id, fontId), eq(brandFonts.brandId, brand.id)));
  if (!font) throw new AccessError("That font isn't in this shop.", 404);
  await db.delete(brandFonts).where(eq(brandFonts.id, fontId));
  const left = await db.select({ id: brandFonts.id }).from(brandFonts).where(and(eq(brandFonts.brandId, brand.id), eq(brandFonts.family, font.family)));
  const [style] = await db.select().from(styleSets).where(eq(styleSets.brandId, brand.id));
  const inUse = !!style && [style.headingFont, style.bodyFont].some((f) => f.toLowerCase() === font.family.toLowerCase());
  if (inUse && left.length === 0 && style!.status === "approved") {
    await db.update(styleSets).set({ status: "draft", approvedBy: null, approvedAt: null }).where(eq(styleSets.brandId, brand.id));
  }
  await audit(db, viewer, "font.delete", { fontId, family: font.family, lookBackToDraft: inUse && left.length === 0 });
}

// The file itself, for the tab's preview. Only this shop's team can read it.
export async function fontFile(pool: pg.Pool, viewer: Viewer, fontId: string): Promise<{ mime: string; data: Buffer }> {
  const brand = requirePermission(viewer, "use_tab");
  if (!/^[0-9a-f-]{36}$/i.test(fontId)) throw new AccessError("That font isn't in this shop.", 404);
  const { rows } = await pool.query<{ format: CustomFont["format"]; data: Buffer }>(
    "SELECT format, data FROM brand_fonts WHERE id = $1 AND brand_id = $2",
    [fontId, brand.id],
  );
  if (!rows[0]) throw new AccessError("That font isn't in this shop.", 404);
  return { mime: MIME[rows[0].format], data: rows[0].data };
}
