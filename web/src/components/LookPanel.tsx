import { useEffect, useMemo, useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import type { AssetDetail } from "../../../shared/content.ts";
import { FALLBACK_STYLE, SIZES, frameDocument, sampleDesign, type StyleColor, type StyleSetView } from "../../../shared/design.ts";
import { api, fontDataUrl, type UploadedFont } from "../boutiqly.ts";
import { ErrorNote } from "./bits.tsx";

const ROLES: StyleColor["role"][] = ["background", "text", "accent", "highlight", "other"];
const ROLE_LABELS: Record<StyleColor["role"], string> = {
  background: "Background",
  text: "Text",
  accent: "Accent",
  highlight: "Highlight",
  other: "Other",
};
const POPULAR_FONTS = [
  "Montserrat", "Poppins", "Inter", "Lato", "Open Sans", "Raleway", "Nunito", "Work Sans", "DM Sans", "Karla",
  "Playfair Display", "Lora", "Cormorant Garamond", "DM Serif Display", "Libre Baskerville", "Fraunces",
  "Bebas Neue", "Oswald", "Anton", "Archivo Black", "Abril Fatface", "Pacifico", "Caveat", "Shrikhand",
];

const SAMPLE_SCALE = 0.25;
const WEIGHTS = [
  [100, "Thin"], [200, "Extra light"], [300, "Light"], [400, "Regular"], [500, "Medium"],
  [600, "Semibold"], [700, "Bold"], [800, "Extra bold"], [900, "Black"],
] as const;

// "RiotSans-Bold.woff2" → "Riot Sans" (the same guess the server makes)
function familyGuess(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").split(/[-_]/)[0] ?? "";
  return base.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 40);
}
function weightGuess(name: string): number {
  const n = name.toLowerCase();
  const found = [["black", 900], ["extrabold", 800], ["semibold", 600], ["bold", 700], ["medium", 500], ["light", 300], ["thin", 100]] as const;
  return found.find(([w]) => n.includes(w))?.[1] ?? 400;
}

// The shop's look: colors, fonts, logo and notes, with a live sample tile
// drawn by the same engine Claude designs with.
export function LookPanel({ me }: { me: Me }) {
  const [saved, setSaved] = useState<StyleSetView | null>(null);
  const [draft, setDraft] = useState<StyleSetView>(FALLBACK_STYLE);
  const [images, setImages] = useState<AssetDetail[]>([]);
  const [fonts, setFonts] = useState<UploadedFont[]>([]);
  const [fontUrls, setFontUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ file: File; family: string; weight: number; italic: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const canEdit = me.permissions.includes("manage_brand");

  useEffect(() => {
    api.style().then((r) => { setSaved(r.style); setDraft(r.style); }, (e: Error) => setError(e.message));
    if (canEdit) api.assets().then((r) => setImages(r.assets.filter((a) => a.mime.startsWith("image/") && a.madeBy !== "render")), () => {});
    api.fonts().then((r) => setFonts(r.fonts), () => {});
  }, [canEdit]);

  // Each uploaded font as a data address, so the sample shows the real thing.
  useEffect(() => {
    for (const f of fonts) {
      if (fontUrls[f.id]) continue;
      fontDataUrl(f.id).then((url) => setFontUrls((u) => ({ ...u, [f.id]: url })), () => {});
    }
  }, [fonts, fontUrls]);

  const sample = useMemo(() => {
    const logo = draft.logoAssetId ? images.find((i) => i.id === draft.logoAssetId)?.url ?? draft.logoUrl : null;
    const loaded = fonts.filter((f) => fontUrls[f.id]);
    return frameDocument(sampleDesign(me.brand?.name ?? ""), 0, { ...draft, customFonts: loaded }, logo ? { logo } : {}, fontUrls);
  }, [draft, images, me.brand?.name, fonts, fontUrls]);

  async function uploadFont() {
    if (!pending) return;
    setError("");
    setBusy("Uploading the font…");
    try {
      await api.uploadFont(pending.file, { family: pending.family, weight: pending.weight, italic: pending.italic });
      setFonts((await api.fonts()).fonts);
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function removeFont(id: string) {
    setError("");
    try {
      await api.deleteFont(id);
      setFonts((await api.fonts()).fonts);
      const { style } = await api.style(); // removing a font in use puts the look back to draft
      setSaved(style);
      setDraft((d) => ({ ...d, customFonts: style.customFonts }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const changed = JSON.stringify(stripMeta(draft)) !== JSON.stringify(saved ? stripMeta(saved) : null);

  function setColor(i: number, c: Partial<StyleColor>) {
    setDraft((d) => ({ ...d, colors: d.colors.map((x, j) => (j === i ? { ...x, ...c } : x)) }));
  }

  async function save() {
    setError("");
    setBusy("Saving…");
    try {
      const { style } = await api.saveStyle({
        colors: draft.colors,
        headingFont: draft.headingFont,
        bodyFont: draft.bodyFont,
        vibe: draft.vibe,
        dosDonts: draft.dosDonts,
        logoAssetId: draft.logoAssetId,
      });
      setSaved(style);
      setDraft(style);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function approve() {
    setError("");
    setBusy("Approving…");
    try {
      const { style } = await api.approveStyle();
      setSaved(style);
      setDraft(style);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setBusy("Uploading the logo to Boutiqly media storage…");
    try {
      const { asset } = await api.upload(file);
      const { assets } = await api.assets();
      setImages(assets.filter((a) => a.mime.startsWith("image/") && a.madeBy !== "render"));
      setDraft((d) => ({ ...d, logoAssetId: asset.id, logoUrl: asset.url }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const status = saved?.status ?? "fallback";
  const { width, height } = SIZES.portrait;

  return (
    <div className="card">
      <div className="screen-head">
        <h2>Look</h2>
        <span className={`status-chip ${status === "approved" ? "status-approved" : "status-suggested"}`}>
          {status === "approved" ? `Approved${saved?.approvedBy ? ` by ${saved.approvedBy}` : ""}` : status === "draft" ? "Draft, not approved" : "Basic Boutiqly look"}
        </span>
      </div>
      <p className="muted small">
        Claude designs this shop's posts with its approved look only. Until it's approved, posts use a basic Boutiqly look with no logo.
        {status === "draft" ? " Changes need approving again before Claude uses them." : ""}
      </p>

      <div className="look">
        <div className="look-form">
          <h3>Colors</h3>
          {draft.colors.map((c, i) => (
            <div key={i} className="color-row">
              <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} disabled={!canEdit} aria-label={`${c.name || "Color"} value`} />
              <input type="text" value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} placeholder="Name" maxLength={40} disabled={!canEdit} aria-label="Color name" />
              <select value={c.role} onChange={(e) => setColor(i, { role: e.target.value as StyleColor["role"] })} disabled={!canEdit} aria-label="Color use">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              {canEdit && <button className="btn-link small" onClick={() => setDraft((d) => ({ ...d, colors: d.colors.filter((_, j) => j !== i) }))}>Remove</button>}
            </div>
          ))}
          {canEdit && draft.colors.length < 8 && (
            <button className="btn-link small" onClick={() => setDraft((d) => ({ ...d, colors: [...d.colors, { name: "", hex: "#999999", role: "other" }] }))}>
              + Add a color
            </button>
          )}

          <h3>Fonts</h3>
          <datalist id="google-fonts">
            {[...new Set(fonts.map((f) => f.family))].map((f) => <option key={`u-${f}`} value={f}>Uploaded</option>)}
            {POPULAR_FONTS.map((f) => <option key={f} value={f} />)}
          </datalist>
          <div className="field-row">
            <label className="field grow">
              <span>Headings</span>
              <input list="google-fonts" value={draft.headingFont} onChange={(e) => setDraft((d) => ({ ...d, headingFont: e.target.value }))} disabled={!canEdit} />
            </label>
            <label className="field grow">
              <span>Body text</span>
              <input list="google-fonts" value={draft.bodyFont} onChange={(e) => setDraft((d) => ({ ...d, bodyFont: e.target.value }))} disabled={!canEdit} />
            </label>
          </div>
          <p className="muted small">Any font from Google Fonts by its exact name, or one of the shop's uploaded fonts below.</p>

          <h3>Uploaded fonts</h3>
          {fonts.length === 0 && <p className="muted small">None yet.</p>}
          <ul className="font-list">
            {fonts.map((f) => (
              <li key={f.id}>
                <span style={fontUrls[f.id] ? { fontFamily: `"ss-${f.id}"` } : undefined}>
                  <strong>{f.family}</strong> <span className="muted small">{WEIGHTS.find(([w]) => w === f.weight)?.[1] ?? f.weight}{f.italic ? " italic" : ""} · {f.fileName}</span>
                </span>
                {canEdit && <button className="btn-link small" onClick={() => void removeFont(f.id)}>Remove</button>}
              </li>
            ))}
          </ul>
          <style>{fonts.filter((f) => fontUrls[f.id]).map((f) => `@font-face{font-family:"ss-${f.id}";src:url("${fontUrls[f.id]}") format("${f.format}");font-weight:${f.weight};font-style:${f.italic ? "italic" : "normal"}}`).join("\n")}</style>
          {canEdit && (
            <>
              {pending ? (
                <div className="card-inset font-upload">
                  <div className="field-row">
                    <label className="field grow">
                      <span>Font name</span>
                      <input value={pending.family} onChange={(e) => setPending({ ...pending, family: e.target.value })} maxLength={40} />
                    </label>
                    <label className="field">
                      <span>Weight</span>
                      <select value={pending.weight} onChange={(e) => setPending({ ...pending, weight: Number(e.target.value) })}>
                        {WEIGHTS.map(([w, label]) => <option key={w} value={w}>{label} ({w})</option>)}
                      </select>
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={pending.italic} onChange={(e) => setPending({ ...pending, italic: e.target.checked })} />
                      Italic
                    </label>
                  </div>
                  <p className="muted small">{pending.file.name}. Upload each weight (regular, bold…) as its own file with the same font name.</p>
                  <div className="field-row">
                    <button className="btn-secondary small" onClick={() => void uploadFont()} disabled={!!busy || !pending.family.trim()}>Upload this font</button>
                    <button className="btn-link small" onClick={() => setPending(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <label className="btn-secondary small">
                  Upload a font
                  <input
                    type="file"
                    accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPending({ file, family: familyGuess(file.name), weight: weightGuess(file.name), italic: /italic|oblique/i.test(file.name) });
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <p className="muted small">
                Not on Google Fonts? Upload the font file your designer gave you (.woff2, .woff, .ttf or .otf). Make sure your license allows using it in social media images.
              </p>
            </>
          )}

          <h3>Logo</h3>
          {canEdit ? (
            <div className="field-row">
              <select value={draft.logoAssetId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, logoAssetId: e.target.value || null, logoUrl: images.find((i) => i.id === e.target.value)?.url ?? null }))} aria-label="Logo">
                <option value="">No logo</option>
                {images.map((i) => <option key={i.id} value={i.id}>{i.name || i.id.slice(0, 8)}</option>)}
              </select>
              <label className="btn-secondary small">
                Upload a logo
                <input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden onChange={(e) => { void uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
          ) : (
            <p className="small">{draft.logoUrl ? "Set" : "None"}</p>
          )}
          <p className="muted small">A PNG with a see-through background works best.</p>

          <label className="field">
            <span>The vibe (how posts should feel)</span>
            <textarea rows={3} value={draft.vibe} onChange={(e) => setDraft((d) => ({ ...d, vibe: e.target.value }))} disabled={!canEdit} maxLength={2000} placeholder="Bold and playful, lots of color, hand-drawn touches…" />
          </label>
          <label className="field">
            <span>Dos and don'ts</span>
            <textarea rows={3} value={draft.dosDonts} onChange={(e) => setDraft((d) => ({ ...d, dosDonts: e.target.value }))} disabled={!canEdit} maxLength={2000} placeholder="Always say 'y'all'. Never use emojis in headlines…" />
          </label>
        </div>

        <figure className="look-sample">
          <div className="sample-frame" style={{ width: width * SAMPLE_SCALE, height: height * SAMPLE_SCALE }}>
            <iframe
              title="Sample post in this look"
              sandbox=""
              srcDoc={sample}
              style={{ width, height, transform: `scale(${SAMPLE_SCALE})`, transformOrigin: "0 0" }}
            />
          </div>
          <figcaption className="muted small">A sample tile in this look</figcaption>
        </figure>
      </div>

      {busy && <p className="notice">{busy}</p>}
      <ErrorNote message={error} />
      {canEdit && (
        <div className="sheet-actions">
          <button className="btn-secondary" onClick={() => void save()} disabled={!!busy || !changed}>Save look</button>
          {status === "draft" && !changed && (
            <button className="btn-primary" onClick={() => void approve()} disabled={!!busy}>Approve look</button>
          )}
        </div>
      )}
    </div>
  );
}

function stripMeta(s: StyleSetView) {
  return { colors: s.colors, headingFont: s.headingFont, bodyFont: s.bodyFont, vibe: s.vibe, dosDonts: s.dosDonts, logoAssetId: s.logoAssetId };
}
