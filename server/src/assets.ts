// The Assets screen: what Claude saw in each file, and the owner's rules.
// The content rules from CLAUDE.md are enforced here in code, not only in
// Claude's instructions: a file Claude may not use never reaches a design.
import { and, desc, eq } from "drizzle-orm";
import type pg from "pg";
import type { Db } from "./db/pool.ts";
import { assets } from "./db/schema.ts";
import { AccessError, audit, requirePermission, type Brand, type Viewer } from "./brands.ts";
import { callClaude, type ClaudeDeps } from "./claude/client.ts";
import { clearOutputs, enqueueJob, getJob, takeOutputs, tryWithLock } from "./jobs.ts";
import { storeFile } from "./media.ts";
import type { BoutiqlyClient } from "./boutiqly/api.ts";
import type { AssetDetail } from "../../shared/content.ts";
import type { SensitiveFlag } from "../../shared/design.ts";

export type Asset = typeof assets.$inferSelect;

export const SENSITIVE_KINDS = [
  "receipt",
  "email",
  "phone",
  "address",
  "customer_name",
  "payment",
  "customer_screen",
  "swear_word",
  "license_plate",
  "other",
] as const;

// Can Claude put this file in a design? Each "no" says why, in plain words.
export function usableInDesign(
  a: Pick<Asset, "mime" | "taggedAt" | "peopleRule" | "possibleMinor" | "sensitive" | "flagsCleared" | "madeBy"> & Partial<Pick<Asset, "purpose">>,
): {
  ok: boolean;
  reason: string | null;
} {
  if (a.purpose === "inspiration") return { ok: false, reason: "Inspiration only: Claude studies it but never puts it in a post." };
  if (!a.mime.startsWith("image/")) return { ok: false, reason: "Only photos and graphics go into designs for now." };
  if (a.madeBy === "render") return { ok: false, reason: "This is a finished design, not a source photo." };
  if (!a.taggedAt) return { ok: false, reason: "Claude hasn't looked at this file yet." };
  if (a.peopleRule === "dont_use") return { ok: false, reason: "The owner marked this file Don't use." };
  if (a.possibleMinor && !a.flagsCleared) return { ok: false, reason: "It may show someone under 18. The owner has to clear it first." };
  if (a.sensitive.length > 0 && !a.flagsCleared) return { ok: false, reason: "It has flagged details. Blur them, or the owner clears the flags." };
  return { ok: true, reason: null };
}

export function assetDetail(a: Asset): AssetDetail {
  return {
    id: a.id,
    url: a.url,
    mime: a.mime,
    name: a.name,
    createdAt: a.createdAt.toISOString(),
    description: a.description,
    tags: a.tags,
    hasPeople: a.hasPeople,
    possibleMinor: a.possibleMinor,
    sensitive: a.sensitive,
    flagsCleared: a.flagsCleared,
    peopleRule: a.peopleRule,
    tagged: !!a.taggedAt,
    madeBy: a.madeBy,
    purpose: a.purpose,
    sourceAssetId: a.sourceAssetId,
    usable: usableInDesign(a),
  };
}

export async function listAssetDetails(db: Db, viewer: Viewer): Promise<AssetDetail[]> {
  const brand = requirePermission(viewer, "use_tab");
  const rows = await db.select().from(assets).where(eq(assets.brandId, brand.id)).orderBy(desc(assets.createdAt)).limit(1000);
  return rows.map(assetDetail);
}

export async function ownAsset(db: Db, brand: Brand, assetId: string): Promise<Asset> {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) throw new AccessError("That file isn't in this shop's files.", 404);
  const [a] = await db.select().from(assets).where(and(eq(assets.id, assetId), eq(assets.brandId, brand.id)));
  if (!a) throw new AccessError("That file isn't in this shop's files.", 404);
  return a;
}

export interface AssetRulesInput {
  peopleRule?: unknown;
  flagsCleared?: unknown;
  description?: unknown;
  tags?: unknown;
}

// The owner's rules. Only people (never Claude) change these.
export async function updateAssetRules(db: Db, viewer: Viewer, assetId: string, input: AssetRulesInput): Promise<AssetDetail> {
  const brand = requirePermission(viewer, "use_tab");
  const a = await ownAsset(db, brand, assetId);
  const changes: Partial<typeof assets.$inferInsert> = {};
  if (input.peopleRule !== undefined) {
    if (!["ok", "no_faces", "dont_use"].includes(String(input.peopleRule))) throw new AccessError("Pick a people rule.", 400);
    changes.peopleRule = input.peopleRule as Asset["peopleRule"];
  }
  if (input.flagsCleared !== undefined) changes.flagsCleared = !!input.flagsCleared;
  if (typeof input.description === "string") changes.description = input.description.slice(0, 1000);
  if (Array.isArray(input.tags)) {
    changes.tags = input.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 20);
  }
  if (Object.keys(changes).length === 0) return assetDetail(a);
  const [row] = await db.update(assets).set(changes).where(eq(assets.id, a.id)).returning();
  await audit(db, viewer, "asset.rules", { assetId, ...changes });
  return assetDetail(row!);
}

// ---- Claude looks at a file ----

const TAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["description", "tags", "has_people", "possible_minor", "sensitive"],
  properties: {
    description: { type: "string", description: "One or two plain sentences on what the file shows." },
    tags: { type: "array", items: { type: "string" }, description: "Up to 12 short lowercase tags (products, colors, setting, mood)." },
    has_people: { type: "boolean", description: "True if any person, face or body part is visible." },
    possible_minor: { type: "boolean", description: "True if anyone visible might be under 18. When unsure, true." },
    sensitive: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "note", "x", "y", "w", "h"],
        properties: {
          kind: { type: "string", enum: [...SENSITIVE_KINDS] },
          note: { type: "string" },
          x: { type: "number", description: "Left edge, 0 to 1 of image width" },
          y: { type: "number", description: "Top edge, 0 to 1 of image height" },
          w: { type: "number" },
          h: { type: "number" },
        },
      },
    },
  },
} as const;

const TAG_SYSTEM = `You look at one photo or graphic from a small shop's media library and describe it for the shop's social media team.

Report:
- description: what it shows, plainly (products, setting, text on it).
- tags: up to 12 short lowercase tags.
- has_people: true if any person, face or body part is visible.
- possible_minor: true if anyone visible might be under 18; when unsure, true.
- sensitive: every detail that must not be posted, with a box around it: receipts, email addresses, phone numbers, street addresses, customer names, payment details, screens showing customer data, swear words, license plates. Use "other" for anything else private. Leave the list empty if there is nothing.

Describe only what you can see. Don't guess names, prices or dates that aren't visible.`;

const SUPPORTED_IMAGE = /^image\/(jpeg|png|gif|webp)$/;
const MAX_INLINE_BYTES = 4_500_000;

async function imageSource(a: Asset, fetchImpl: typeof fetch) {
  if (SUPPORTED_IMAGE.test(a.mime)) {
    try {
      const res = await fetchImpl(a.url, { signal: AbortSignal.timeout(20_000) });
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length <= MAX_INLINE_BYTES) {
          return { type: "base64" as const, media_type: a.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: bytes.toString("base64") };
        }
      }
    } catch {
      /* fall back to the address */
    }
  }
  return { type: "url" as const, url: a.url };
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

export async function tagAsset(
  deps: ClaudeDeps & { fetchImpl: typeof fetch },
  viewer: Viewer,
  assetId: string,
): Promise<AssetDetail> {
  const brand = requirePermission(viewer, "use_tab");
  const a = await ownAsset(deps.db, brand, assetId);
  if (!a.mime.startsWith("image/")) throw new AccessError("Claude looks at photos and graphics for now; videos come with Reels.", 400);
  const { message } = await callClaude(deps, { brand, userId: viewer.ctx.userId, purpose: "tag_asset", refId: a.id }, {
    system: [{ type: "text", text: TAG_SYSTEM }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: await imageSource(a, deps.fetchImpl) },
          { type: "text", text: `File name: ${a.name || "(none)"}` },
        ],
      },
    ],
    maxTokens: 4000,
    effort: "low",
    jsonSchema: TAG_SCHEMA as unknown as Record<string, unknown>,
  });
  if (message.stop_reason === "refusal") throw new AccessError("Claude couldn't look at this file. Set its rules by hand.", 422);
  const text = message.content.find((b) => b.type === "text")?.text ?? "";
  let parsed: { description: string; tags: string[]; has_people: boolean; possible_minor: boolean; sensitive: { kind: string; note: string; x: number; y: number; w: number; h: number }[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AccessError("Claude's answer about this file didn't come through. Try again.", 502);
  }
  const sensitive: SensitiveFlag[] = (parsed.sensitive ?? []).slice(0, 30).map((s) => ({
    kind: (SENSITIVE_KINDS as readonly string[]).includes(s.kind) ? s.kind : "other",
    note: String(s.note ?? "").slice(0, 200),
    box: { x: clamp01(s.x), y: clamp01(s.y), w: clamp01(s.w), h: clamp01(s.h) },
  }));
  const [row] = await deps.db
    .update(assets)
    .set({
      description: String(parsed.description ?? "").slice(0, 1000),
      tags: (parsed.tags ?? []).map((t) => String(t).toLowerCase().slice(0, 40)).slice(0, 12),
      hasPeople: !!parsed.has_people,
      possibleMinor: !!parsed.possible_minor,
      sensitive,
      flagsCleared: false,
      taggedAt: new Date(),
    })
    .where(eq(assets.id, a.id))
    .returning();
  await audit(deps.db, viewer, "asset.tag", { assetId, sensitive: sensitive.length, possibleMinor: !!parsed.possible_minor });
  return assetDetail(row!);
}

// ---- Blur flagged details (worker job) ----

export interface BlurDeps {
  db: Db;
  pool: pg.Pool;
  clientFor: (brand: Brand) => BoutiqlyClient;
}

export async function startBlur(deps: BlurDeps, viewer: Viewer, assetId: string): Promise<{ jobId: string }> {
  const brand = requirePermission(viewer, "use_tab");
  const a = await ownAsset(deps.db, brand, assetId);
  const boxes = a.sensitive.map((s) => s.box).filter((b): b is NonNullable<typeof b> => !!b && b.w > 0 && b.h > 0);
  if (!a.mime.startsWith("image/") || boxes.length === 0) throw new AccessError("There's nothing marked to blur in this file.", 400);
  const jobId = await enqueueJob(deps.pool, brand.id, "blur", { url: a.url, boxes });
  await audit(deps.db, viewer, "asset.blur_start", { assetId, jobId, boxes: boxes.length });
  return { jobId };
}

// Collects a finished blur: the blurred copy becomes a new file whose flags
// are cleared; the original stays as it was.
export async function finishBlur(deps: BlurDeps, viewer: Viewer, assetId: string, jobId: string): Promise<{ status: "pending" | "failed" | "done"; asset?: AssetDetail; error?: string }> {
  const brand = requirePermission(viewer, "use_tab");
  const a = await ownAsset(deps.db, brand, assetId);
  const job = await getJob(deps.pool, brand.id, jobId);
  if (!job) throw new AccessError("That blur isn't in this shop.", 404);
  if (job.status === "queued" || job.status === "running") return { status: "pending" };
  if (job.status === "failed") return { status: "failed", error: "The blur didn't work. Try again, or mark the file Don't use." };
  const done = await tryWithLock(deps.pool, `blur:${jobId}`, async () => {
    const [existing] = await deps.db.select().from(assets).where(and(eq(assets.brandId, brand.id), eq(assets.sourceAssetId, a.id), eq(assets.madeBy, "blur"))).orderBy(desc(assets.createdAt)).limit(1);
    const outputs = await takeOutputs(deps.pool, jobId);
    if (outputs.length === 0) return existing ?? null;
    const out = outputs[0]!;
    const name = `${a.name.replace(/\.[^.]+$/, "") || "photo"}-blurred.png`;
    const stored = await storeFile(deps.db, brand, deps.clientFor(brand), { bytes: out.data, mime: out.mime, name });
    const [row] = await deps.db
      .insert(assets)
      .values({
        brandId: brand.id,
        boutiqlyFileId: stored.fileId,
        url: stored.url,
        mime: out.mime,
        name,
        sizeBytes: out.data.length,
        uploadedBy: viewer.ctx.userId,
        description: a.description,
        tags: a.tags,
        hasPeople: a.hasPeople,
        possibleMinor: a.possibleMinor,
        sensitive: [],
        flagsCleared: a.flagsCleared,
        peopleRule: a.peopleRule,
        taggedAt: a.taggedAt,
        sourceAssetId: a.id,
        madeBy: "blur",
      })
      .returning();
    await clearOutputs(deps.pool, jobId);
    await audit(deps.db, viewer, "asset.blur_done", { assetId, blurredId: row!.id });
    return row!;
  });
  if (!done) return { status: "pending" };
  return { status: "done", asset: assetDetail(done) };
}

// ---- The inspiration board ----

export const MAX_INSPIRATION = 10;

export async function inspirationFor(db: Db, brand: Brand): Promise<Asset[]> {
  return db
    .select()
    .from(assets)
    .where(and(eq(assets.brandId, brand.id), eq(assets.purpose, "inspiration")))
    .orderBy(desc(assets.createdAt))
    .limit(MAX_INSPIRATION);
}

export async function inspirationCount(db: Db, brand: Brand): Promise<number> {
  return (await db.select({ id: assets.id }).from(assets).where(and(eq(assets.brandId, brand.id), eq(assets.purpose, "inspiration")))).length;
}

// Takes a post off the board. The file stays in Boutiqly media storage.
export async function removeInspiration(db: Db, viewer: Viewer, assetId: string): Promise<void> {
  const brand = requirePermission(viewer, "manage_brand");
  const a = await ownAsset(db, brand, assetId);
  if (a.purpose !== "inspiration") throw new AccessError("That file isn't on the inspiration board.", 400);
  await db.delete(assets).where(eq(assets.id, a.id));
  await audit(db, viewer, "inspiration.remove", { assetId });
}
