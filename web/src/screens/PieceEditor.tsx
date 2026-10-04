import { useMemo, useState } from "react";
import type { AssetView, CaptionView, PieceView } from "../../../shared/content.ts";
import { KIND_LABELS, ROUTE_LABELS, channelsFor, type Kind } from "../../../shared/channels.ts";
import { api } from "../boutiqly.ts";
import { PostPreview } from "../components/PostPreview.tsx";
import { Verdict } from "../components/Verdict.tsx";
import { ErrorNote, Thumb, addDays, friendlyDate, friendlyTime, todayIn } from "../components/bits.tsx";

const KINDS = Object.keys(KIND_LABELS) as Kind[];
const NEEDS_LINK: Kind[] = ["pin", "google_update"];

const KIND_HELP: Record<Kind, string> = {
  post: "One photo. Instagram and Facebook: 4:5 (1080×1350).",
  carousel: "Two to ten photos, in order.",
  story: "One 9:16 frame (1080×1920). Instagram sends an app ping to your phone.",
  story_set: "Several 9:16 frames. One app ping per frame, a minute apart.",
  reel: "One 9:16 video. Instagram sends an app ping so you can add a sound.",
  text: "Words only: Threads, Facebook, LinkedIn, Bluesky, community, X.",
  short: "One 9:16 video for YouTube Shorts.",
  pin: "One tall image (2:3) with a title and link.",
  google_update: "An update for Google Business Profile, with an optional link.",
};

interface Props {
  shopName?: string;
  piece: PieceView | null;
  timezone: string;
  onClose: () => void;
  onSaved: (piece: PieceView) => void;
}

const emptyCaption: CaptionView = { text: "", altText: "", status: "draft" };

export function PieceEditor({ piece: initial, timezone, onClose, onSaved, shopName = "" }: Props) {
  const [piece, setPiece] = useState<PieceView | null>(initial);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "post");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [files, setFiles] = useState<AssetView[]>(initial?.assets ?? []);
  const [captions, setCaptions] = useState<Record<string, CaptionView>>(initial?.captions ?? {});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const channels = useMemo(() => channelsFor(kind), [kind]);
  const [active, setActive] = useState<string>(channels[0]?.id ?? "instagram");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const tomorrow = addDays(todayIn(timezone), 1);
  const [when, setWhen] = useState({ date: tomorrow, time: "09:00" });
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const activeChannel = channels.find((c) => c.id === active) ?? channels[0];
  const current = (activeChannel && captions[activeChannel.id]) || emptyCaption;

  function editCaption(changes: Partial<CaptionView>) {
    if (!activeChannel) return;
    setCaptions((c) => ({ ...c, [activeChannel.id]: { ...(c[activeChannel.id] ?? emptyCaption), ...changes } }));
    setDirty((d) => new Set(d).add(activeChannel.id));
  }

  function copyToAll() {
    const source = current;
    setCaptions((c) => {
      const next = { ...c };
      for (const ch of channels) {
        if (!next[ch.id]?.text) next[ch.id] = { ...source, status: "draft" };
      }
      return next;
    });
    setDirty(new Set(channels.map((c) => c.id)));
  }

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    setBusy(`Uploading ${list.length} file${list.length > 1 ? "s" : ""} to Boutiqly media storage…`);
    try {
      for (const file of Array.from(list)) {
        const { asset } = await api.upload(file);
        setFiles((f) => [...f, asset]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function moveFile(i: number, by: number) {
    setFiles((f) => {
      const next = [...f];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item!);
      return next;
    });
  }

  async function save(): Promise<PieceView | null> {
    setError("");
    setMessage("");
    setBusy("Saving…");
    try {
      const fields = { kind, title, link, assetIds: files.map((f) => f.id) };
      let saved = piece ? (await api.updatePiece(piece.id, fields)).piece : (await api.createPiece(fields)).piece;
      for (const ch of dirty) {
        const c = captions[ch];
        if (c) saved = (await api.setCaption(saved.id, ch, c)).piece;
      }
      setDirty(new Set());
      setPiece(saved);
      onSaved(saved);
      setMessage("Saved.");
      return saved;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function schedule() {
    const saved = await save();
    if (!saved || picked.size === 0) return;
    setBusy("Adding to the calendar…");
    try {
      const { entries } = await api.schedule(saved.id, [...picked], when.date, when.time);
      setMessage(
        `Added to the calendar for ${friendlyDate(when.date)} at ${friendlyTime(when.time)}: ` +
          entries.map((e) => `${channels.find((c) => c.id === e.channel)?.name} (${ROUTE_LABELS[e.route].toLowerCase()})`).join(", ") +
          ". Approve it on the Calendar.",
      );
      setPicked(new Set());
      onSaved((await api.updatePiece(saved.id, {})).piece);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const over = activeChannel ? current.text.length > activeChannel.captionLimit : false;

  return (
    <div className="overlay" role="dialog" aria-label={piece ? "Edit post" : "New post"}>
      <div className={files.length ? "sheet wide" : "sheet"}>
        <div className="sheet-head">
          <h2>{piece ? "Edit post" : "New post"}</h2>
          <button className="btn-link" onClick={onClose}>Close</button>
        </div>

        <PostPreview
          files={files}
          channels={channels.map((c) => ({ id: c.id, name: c.name }))}
          captions={Object.fromEntries(Object.entries(captions).map(([k, v]) => [k, v.text]))}
          active={activeChannel?.id ?? ""}
          onActive={setActive}
          shopName={shopName}
        >
          {piece && <Verdict pieceId={piece.id} />}
        </PostPreview>

        <div className="field-row">
          <label className="field">
            <span>Type</span>
            <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setActive(channelsFor(e.target.value as Kind)[0]?.id ?? ""); }}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="field grow">
            <span>Name (just for you)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fall sale carousel" maxLength={200} />
          </label>
        </div>
        <p className="muted small">{KIND_HELP[kind]}</p>

        {kind !== "text" && (
          <section className="files">
            <div className="file-strip">
              {files.map((f, i) => (
                <figure key={f.id + i} className="file">
                  <Thumb asset={f} />
                  <figcaption>
                    <span>{i + 1}</span>
                    <button className="btn-link small" onClick={() => moveFile(i, -1)} disabled={i === 0} aria-label="Move earlier">←</button>
                    <button className="btn-link small" onClick={() => moveFile(i, 1)} disabled={i === files.length - 1} aria-label="Move later">→</button>
                    <button className="btn-link small" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>Remove</button>
                  </figcaption>
                </figure>
              ))}
              <label className="file add-file">
                <input type="file" accept="image/*,video/*" multiple onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} hidden />
                <span>+ Add photos or videos</span>
              </label>
            </div>
          </section>
        )}

        {NEEDS_LINK.includes(kind) && (
          <label className="field">
            <span>Link</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </label>
        )}

        <section className="captions">
          <div className="channel-tabs" role="tablist">
            {channels.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={c.id === activeChannel?.id}
                className={c.id === activeChannel?.id ? "chip-tab active" : "chip-tab"}
                onClick={() => setActive(c.id)}
              >
                {c.name}
                {captions[c.id]?.status === "final" ? " ✓" : captions[c.id]?.text ? " •" : ""}
              </button>
            ))}
          </div>
          {activeChannel && (
            <>
              <label className="field">
                <span>{activeChannel.name} {kind === "text" ? "text" : "caption"}</span>
                <textarea rows={6} value={current.text} onChange={(e) => editCaption({ text: e.target.value })} />
              </label>
              <div className="caption-meta">
                <span className={over ? "count over" : "count"}>
                  {current.text.length} / {activeChannel.captionLimit}
                </span>
                <label className="check">
                  <input type="checkbox" checked={current.status === "final"} onChange={(e) => editCaption({ status: e.target.checked ? "final" : "draft" })} />
                  Final
                </label>
                {channels.length > 1 && current.text && (
                  <button className="btn-link small" onClick={copyToAll}>Use for channels with no caption yet</button>
                )}
              </div>
              {kind !== "text" && (
                <label className="field">
                  <span>Alt text (describes the image for people using screen readers)</span>
                  <input value={current.altText} onChange={(e) => editCaption({ altText: e.target.value })} maxLength={2000} />
                </label>
              )}
              <p className="muted small">Sizes: {activeChannel.sizes}</p>
            </>
          )}
        </section>

        <section className="schedule card-inset">
          <h3>Add to the calendar</h3>
          <div className="channel-checks">
            {channels.map((c) => (
              <label key={c.id} className="check">
                <input
                  type="checkbox"
                  checked={picked.has(c.id)}
                  onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })}
                />
                {c.name}
              </label>
            ))}
          </div>
          <div className="field-row">
            <label className="field">
              <span>Date</span>
              <input type="date" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} />
            </label>
            <label className="field">
              <span>Time ({timezone.replace("_", " ")})</span>
              <input type="time" value={when.time} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} />
            </label>
          </div>
        </section>

        {busy && <p className="notice">{busy}</p>}
        {message && <p className="notice">{message}</p>}
        <ErrorNote message={error} />

        <div className="sheet-actions">
          <button className="btn-secondary" onClick={() => void save()} disabled={!!busy}>Save</button>
          <button className="btn-secondary" onClick={() => void schedule()} disabled={!!busy || picked.size === 0}>
            Save and add to calendar
          </button>
          {piece && (
            <button className="btn-link" onClick={async () => { await api.updatePiece(piece.id, { archived: true }); onClose(); }}>
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
