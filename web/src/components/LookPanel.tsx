import { useEffect, useMemo, useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import type { AssetDetail } from "../../../shared/content.ts";
import { FALLBACK_STYLE, SIZES, frameDocument, sampleDesign, type StyleColor, type StyleSetView } from "../../../shared/design.ts";
import { api } from "../boutiqly.ts";
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

// The shop's look: colors, fonts, logo and notes, with a live sample tile
// drawn by the same engine Claude designs with.
export function LookPanel({ me }: { me: Me }) {
  const [saved, setSaved] = useState<StyleSetView | null>(null);
  const [draft, setDraft] = useState<StyleSetView>(FALLBACK_STYLE);
  const [images, setImages] = useState<AssetDetail[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const canEdit = me.permissions.includes("manage_brand");

  useEffect(() => {
    api.style().then((r) => { setSaved(r.style); setDraft(r.style); }, (e: Error) => setError(e.message));
    if (canEdit) api.assets().then((r) => setImages(r.assets.filter((a) => a.mime.startsWith("image/") && a.madeBy !== "render")), () => {});
  }, [canEdit]);

  const sample = useMemo(() => {
    const logo = draft.logoAssetId ? images.find((i) => i.id === draft.logoAssetId)?.url ?? draft.logoUrl : null;
    return frameDocument(sampleDesign(me.brand?.name ?? ""), 0, draft, logo ? { logo } : {});
  }, [draft, images, me.brand?.name]);

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
          <datalist id="google-fonts">{POPULAR_FONTS.map((f) => <option key={f} value={f} />)}</datalist>
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
          <p className="muted small">Any font from Google Fonts, by its exact name.</p>

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
