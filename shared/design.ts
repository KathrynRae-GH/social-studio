// The shared, unbranded design engine. A design is HTML/CSS/SVG per frame;
// a shop's look (its style set) arrives only as CSS variables, fonts and a
// logo, so a fix here reaches every brand. Used by the server (to build the
// documents the worker renders) and by the tab (the Look sample).

export interface StyleColor {
  name: string;
  hex: string; // #rrggbb
  role: "background" | "text" | "accent" | "highlight" | "other";
}

// A font file the shop uploaded (not on Google Fonts).
export interface CustomFont {
  id: string;
  family: string;
  weight: number; // 100..900
  italic: boolean;
  format: "woff2" | "woff" | "truetype" | "opentype";
}

export interface StyleSetView {
  colors: StyleColor[];
  customFonts: CustomFont[];
  headingFont: string;
  bodyFont: string;
  vibe: string;
  dosDonts: string;
  logoUrl: string | null;
  logoAssetId: string | null;
  status: "draft" | "approved" | "fallback";
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface SensitiveFlag {
  kind: string; // receipt, email, phone, address, customer_name, payment, customer_screen, swear_word, license_plate, other
  note: string;
  box: { x: number; y: number; w: number; h: number } | null; // fractions of the image, 0..1
}

export type DesignSize = "portrait" | "story" | "square" | "pin" | "landscape";

export const SIZES: Record<DesignSize, { width: number; height: number; label: string }> = {
  portrait: { width: 1080, height: 1350, label: "4:5 feed post (1080×1350)" },
  story: { width: 1080, height: 1920, label: "9:16 Story (1080×1920)" },
  square: { width: 1080, height: 1080, label: "1:1 square (1080×1080)" },
  pin: { width: 1000, height: 1500, label: "2:3 pin (1000×1500)" },
  landscape: { width: 1200, height: 900, label: "4:3 Google update (1200×900)" },
};

export interface DesignFrame {
  html: string; // body content; photos as src="asset:<id>", the logo as src="asset:logo"
}

// Layout families Claude picks from, so posts don't all look alike. Each
// design names its family and where its main graphics sit (motifs), and the
// next post is steered away from the recent ones.
export const LAYOUTS: Record<string, string> = {
  "type-poster": "Oversized headline is the whole design; type as image, little or no photo",
  "full-bleed-photo": "A photo edge to edge, with type on a band, shape or sticker over it",
  "split-screen": "The frame split in two (vertical, horizontal or diagonal): photo on one side, color and type on the other",
  "photo-collage": "3–5 photos scrapbook style: overlapping, rotated, taped or torn",
  "product-grid": "A tidy grid or row of products, each with a short label",
  "arch-window": "One photo in an arch, circle or blob mask as the hero, with type wrapped around it",
  "magazine-cover": "A masthead, a hero photo and cover lines, like a magazine",
  "polaroid": "Photos as instant prints or snapshots with handwritten notes",
  "quote-card": "A short line or quote, typographic, inside a decorative frame or border",
  "big-number": "A huge number leads (\"3 new picks\", \"No. 1\"), with a short list or note",
  "list": "A numbered list or checklist: tips, picks, reasons",
  "sticker-sheet": "Lots of small stickers and badges scattered around a central message",
  "ticket-or-tag": "Styled like a ticket, receipt, price tag, label or postcard",
  "pattern": "A bold repeating pattern background with the message framed on top",
  "minimal": "Quiet and spacious: small, elegant type and one detail",
  "speech-bubble": "Speech or thought bubbles, a conversation or a callout",
  "this-or-that": "Two halves compared: this or that, before and after, day and night",
};

// The three kinds of post. Each new post switches kind from the one before
// (graphics-led → photo-led → several photos…), unless the owner asks.
export const LAYOUT_KINDS: Record<string, { label: string; layouts: string[] }> = {
  graphic: {
    label: "mostly graphics and type",
    layouts: ["type-poster", "quote-card", "big-number", "list", "sticker-sheet", "ticket-or-tag", "pattern", "minimal", "speech-bubble"],
  },
  photo: { label: "one big photo leads", layouts: ["full-bleed-photo", "split-screen", "arch-window", "magazine-cover"] },
  photos: { label: "several photos", layouts: ["photo-collage", "product-grid", "polaroid", "this-or-that"] },
};

export function layoutKind(layout: string | undefined): string | null {
  if (!layout) return null;
  return Object.entries(LAYOUT_KINDS).find(([, k]) => k.layouts.includes(layout))?.[0] ?? null;
}

export interface Design {
  size: DesignSize;
  layout?: string; // one of LAYOUTS
  motifs?: string; // where the main graphics sit, e.g. "starburst top right; rope line along the bottom"
  css: string; // shared by every frame
  frames: DesignFrame[];
  renderedAt?: string | null;
  renderJobId?: string | null;
  renderError?: string | null;
}

// The basic Boutiqly look used before a shop's own look is approved (and to
// fill gaps): Boutiqly's palette, Montserrat, plain layouts, never a logo.
export const FALLBACK_STYLE: StyleSetView = {
  colors: [
    { name: "Page Cream", hex: "#fbf8f3", role: "background" },
    { name: "Deep Forest", hex: "#1d3c34", role: "text" },
    { name: "Orange", hex: "#de771f", role: "accent" },
    { name: "Pale Mint", hex: "#c4e5e2", role: "highlight" },
    { name: "Green", hex: "#276f3d", role: "other" },
  ],
  customFonts: [],
  headingFont: "Montserrat",
  bodyFont: "Montserrat",
  vibe: "Plain, warm and clear. Simple layouts with lots of space.",
  dosDonts: "",
  logoUrl: null,
  logoAssetId: null,
  status: "fallback",
  approvedBy: null,
  approvedAt: null,
};

const HEX = /^#[0-9a-f]{6}$/i;
const FONT = /^[A-Za-z0-9 ]{2,40}$/;

export function validColor(c: unknown): c is StyleColor {
  const x = c as StyleColor;
  return !!x && typeof x.name === "string" && x.name.length <= 40 && typeof x.hex === "string" && HEX.test(x.hex) &&
    ["background", "text", "accent", "highlight", "other"].includes(x.role);
}

export function validFont(f: unknown): f is string {
  return typeof f === "string" && FONT.test(f);
}

function colorFor(style: StyleSetView, role: StyleColor["role"], fallback: string): string {
  return style.colors.find((c) => c.role === role)?.hex ?? fallback;
}

// CSS variables every design can use. Designs should use these, not raw hex,
// so the same structure works for any shop.
export function brandVariables(style: StyleSetView): Record<string, string> {
  const vars: Record<string, string> = {
    "--brand-background": colorFor(style, "background", "#fbf8f3"),
    "--brand-text": colorFor(style, "text", "#1d3c34"),
    "--brand-accent": colorFor(style, "accent", "#de771f"),
    "--brand-highlight": colorFor(style, "highlight", "#c4e5e2"),
    "--font-heading": `"${style.headingFont}", sans-serif`,
    "--font-body": `"${style.bodyFont}", sans-serif`,
  };
  style.colors.forEach((c, i) => (vars[`--brand-color-${i + 1}`] = c.hex));
  return vars;
}

const uploaded = (style: StyleSetView, family: string) =>
  (style.customFonts ?? []).some((f) => f.family.toLowerCase() === family.toLowerCase());

// The Google Fonts address for the families that aren't uploaded, or null
// when both fonts are the shop's own.
export function googleFontsHref(style: StyleSetView): string | null {
  const families = [...new Set([style.headingFont, style.bodyFont])].filter((f) => !uploaded(style, f));
  if (families.length === 0) return null;
  const query = families.map((f) => `family=${f.trim().replace(/ /g, "+")}:wght@300;400;500;600;700;800`).join("&");
  return `https://fonts.googleapis.com/css2?${query}&display=block`;
}

// Where the renderer fetches an uploaded font (answered by the worker from
// the database, for the job's own shop only).
export const fontRenderUrl = (id: string) => `https://fonts.render.local/${id}`;

// @font-face rules for the shop's uploaded fonts. urls maps font id to an
// address (the tab passes data: addresses for its preview).
export function fontFaces(style: StyleSetView, urls: Record<string, string> = {}): string {
  return (style.customFonts ?? [])
    .map(
      (f) =>
        `@font-face { font-family: "${f.family}"; src: url("${urls[f.id] ?? fontRenderUrl(f.id)}") format("${f.format}"); font-weight: ${f.weight}; font-style: ${f.italic ? "italic" : "normal"}; font-display: block; }`,
    )
    .join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

// Strips anything that could run code or pull in outside content. The worker
// also renders with JavaScript off and the network locked down; this is the
// first line, not the only one.
export function cleanMarkup(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|link|meta|base|form|frame|frameset)\b[\s\S]*?(<\s*\/\s*\1\s*>|\/?>)/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/@import[^;]*;?/gi, "");
}

// Every asset id a design refers to, in order of first use.
export function assetRefs(design: Pick<Design, "css" | "frames">): string[] {
  const ids: string[] = [];
  const text = design.css + design.frames.map((f) => f.html).join("\n");
  for (const m of text.matchAll(/asset:([0-9a-f-]{36}|logo)/gi)) {
    if (!ids.includes(m[1]!)) ids.push(m[1]!);
  }
  return ids;
}

// The full HTML document for one frame, exactly as the worker renders it.
export function frameDocument(
  design: Pick<Design, "size" | "css" | "frames">,
  index: number,
  style: StyleSetView,
  assetUrls: Record<string, string>,
  fontUrls: Record<string, string> = {},
): string {
  const { width, height } = SIZES[design.size];
  const swap = (s: string) =>
    s.replace(/asset:([0-9a-f-]{36}|logo)/gi, (_m, id: string) => assetUrls[id] ?? "about:blank");
  const vars = Object.entries(brandVariables(style)).map(([k, v]) => `${k}: ${v};`).join(" ");
  const frame = design.frames[index];
  const google = googleFontsHref(style);
  return `<!doctype html>
<html><head><meta charset="utf-8">
${google ? `<link rel="stylesheet" href="${escapeHtml(google)}">` : ""}
<style>
${fontFaces(style, fontUrls)}
:root { ${vars} --frame-width: ${width}px; --frame-height: ${height}px; }
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
body { background: var(--brand-background); color: var(--brand-text); font-family: var(--font-body); }
h1, h2, h3, h4, .heading { font-family: var(--font-heading); margin: 0; }
p { margin: 0; }
img { display: block; max-width: 100%; }
.photo { width: 100%; height: 100%; object-fit: cover; }
</style>
<style>${swap(cleanMarkup(design.css)).replace(/<\/style/gi, "")}</style>
</head><body>${swap(cleanMarkup(frame?.html ?? ""))}</body></html>`;
}

// The Look sample on the Brand screen: one plain tile from the engine.
export function sampleDesign(shopName: string): Design {
  return {
    size: "portrait",
    css: `.wrap{position:absolute;inset:0;padding:96px;display:flex;flex-direction:column;justify-content:space-between}
.tag{display:inline-block;background:var(--brand-highlight);padding:14px 26px;border-radius:999px;font-size:30px;font-weight:600}
h1{font-size:104px;line-height:1.02;font-weight:800}
.bar{height:18px;width:220px;background:var(--brand-accent);border-radius:9px;margin-top:36px}
.foot{display:flex;align-items:center;justify-content:space-between;font-size:34px}
.foot img{height:110px;width:auto}`,
    frames: [
      {
        html: `<div class="wrap"><div><span class="tag">New this week</span></div>
<div><h1>Fall favorites are in</h1><div class="bar"></div></div>
<div class="foot"><span>${escapeHtml(shopName || "Your shop")}</span><img src="asset:logo" alt=""></div></div>`,
      },
    ],
  };
}
