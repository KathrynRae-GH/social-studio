// The shared, unbranded design engine. A design is HTML/CSS/SVG per frame;
// a shop's look (its style set) arrives only as CSS variables, fonts and a
// logo, so a fix here reaches every brand. Used by the server (to build the
// documents the worker renders) and by the tab (the Look sample).

export interface StyleColor {
  name: string;
  hex: string; // #rrggbb
  role: "background" | "text" | "accent" | "highlight" | "other";
}

export interface StyleSetView {
  colors: StyleColor[];
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

export interface Design {
  size: DesignSize;
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

export function googleFontsHref(style: StyleSetView): string {
  const families = [...new Set([style.headingFont, style.bodyFont])]
    .map((f) => `family=${f.trim().replace(/ /g, "+")}:wght@300;400;500;600;700;800`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=block`;
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
export function frameDocument(design: Pick<Design, "size" | "css" | "frames">, index: number, style: StyleSetView, assetUrls: Record<string, string>): string {
  const { width, height } = SIZES[design.size];
  const swap = (s: string) =>
    s.replace(/asset:([0-9a-f-]{36}|logo)/gi, (_m, id: string) => assetUrls[id] ?? "about:blank");
  const vars = Object.entries(brandVariables(style)).map(([k, v]) => `${k}: ${v};`).join(" ");
  const frame = design.frames[index];
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="${escapeHtml(googleFontsHref(style))}">
<style>
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
