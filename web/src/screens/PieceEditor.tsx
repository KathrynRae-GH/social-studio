import { useEffect, useMemo, useState } from "react";
import type { AssetView, CaptionView, PieceView } from "../../../shared/content.ts";
import { KIND_LABELS, ROUTE_LABELS, channelsFor, type Kind } from "../../../shared/channels.ts";
import { api } from "../boutiqly.ts";
import { PostPreview } from "../components/PostPreview.tsx";
import { Verdict } from "../components/Verdict.tsx";
import { Comments } from "../components/Comments.tsx";
import { ErrorNote, Thumb, addDays, friendlyDate, friendlyTime, todayIn } from "../components/bits.tsx";
import { DAYS, type StrategyView } from "../../../shared/strategy.ts";

const KINDS = Object.keys(KIND_LABELS) as Kind[];
const NEEDS_LINK: Kind[] = ["pin", "google_update"];

const KIND_HELP: Record<Kind, string> = {
  post: "One photo. Instagram and Facebook: 4:5 (1080×1350).",
  carousel: "Two to ten photos, in order.",
  story: "One 9:16 frame (1080×1920). Instagram sends an app ping to your phone.",
  story_set: "Several 9:16 frames. One app ping per frame, a minute apart.",
  reel: "One 9:16 video. Instagram sends an app ping so you can add a sound.",
  text: "Words only: Threads, Facebook, LinkedIn, Bluesky, X.",
  short: "One 9:16 video for YouTube Shorts.",
  pin: "One tall image (2:3) with a title and link.",
  google_update: "An update for Google Business Profile, with an optional link.",
};

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

interface Props {
  shopName?: string;
  piece: PieceView | null;
  timezone: string;
  onClose: () => void;
  onSaved: (piece: PieceView) => void;
}

const emptyCaption: CaptionView = { text: "", altText: "", status: "draft" };

const sameSet = (a: Set<string>, b: string[]) => a.size === b.length && b.every((x) => a.has(x));

export function PieceEditor({ piece: initial, timezone, onClose, onSaved }: Props) {
  const [piece, setPiece] = useState<PieceView | null>(initial);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "post");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [files, setFiles] = useState<AssetView[]>(initial?.assets ?? []);
  const [captions, setCaptions] = useState<Record<string, CaptionView>>(initial?.captions ?? {});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const channels = useMemo(() => channelsFor(kind), [kind]);
  const [active, setActive] = useState<string>(channels[0]?.id ?? "instagram");
  // The networks this post goes to. Before approval: every network with a caption.
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(initial?.approval?.channels ?? Object.entries(initial?.captions ?? {}).filter(([, c]) => c.text.trim()).map(([id]) => id)),
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const tomorrow = addDays(todayIn(timezone), 1);
  const [when, setWhen] = useState({ date: tomorrow, time: "09:00" });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pillar, setPillar] = useState<string | null>(initial?.pillar ?? null);
  // The shop's approved strategy: pillars to pick from, and each network's best time.
  const [strategy, setStrategy] = useState<StrategyView | null>(null);
  useEffect(() => {
    api.strategy().then((r) => setStrategy(r.strategy.status === "approved" ? r.strategy : null), () => {});
  }, []);

  function pick(id: string, on: boolean) {
    // The first network picked sets the date and time to its next best slot.
    const slot = on && picked.size === 0 ? strategy?.times[id]?.slots[0] : undefined;
    if (slot) {
      for (let d = 1; d <= 7; d++) {
        const date = addDays(todayIn(timezone), d);
        const day = DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]!;
        if (slot.days.includes(day)) {
          setWhen({ date, time: slot.time });
          break;
        }
      }
    }
    setPicked((p) => {
      const n = new Set(p);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  const activeChannel = channels.find((c) => c.id === active) ?? channels[0];
  const current = (activeChannel && captions[activeChannel.id]) || emptyCaption;
  const approval = piece?.approval ?? null;
  const tickedHere = channels.filter((c) => ticked.has(c.id)).map((c) => c.id);
  const changedSinceApproval = !!approval && (!sameSet(new Set(tickedHere), approval.channels) || dirty.size > 0 || fieldsDirty);
  const lockedOrSent = (piece?.onCalendar ?? []).some((e) => e.locked || e.status === "scheduled" || e.status === "posted");

  // Claude edited the post, or an earlier version came back: show it as saved.
  function reloadFrom(p: PieceView) {
    setPiece(p);
    setKind(p.kind);
    setTitle(p.title);
    setLink(p.link);
    setPillar(p.pillar);
    setFiles(p.assets);
    setCaptions(p.captions);
    setDirty(new Set());
    setFieldsDirty(false);
    setTicked(new Set(p.approval?.channels ?? Object.entries(p.captions).filter(([, c]) => c.text.trim()).map(([id]) => id)));
    onSaved(p);
  }

  function editCaption(changes: Partial<CaptionView>) {
    if (!activeChannel) return;
    setCaptions((c) => ({ ...c, [activeChannel.id]: { ...(c[activeChannel.id] ?? emptyCaption), ...changes } }));
    setDirty((d) => new Set(d).add(activeChannel.id));
    if (changes.text?.trim()) setTicked((t) => (approval ? t : new Set(t).add(activeChannel.id)));
  }

  function toggleTick(id: string, on: boolean) {
    setTicked((t) => {
      const n = new Set(t);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
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
        setFieldsDirty(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function moveFile(i: number, by: number) {
    setFieldsDirty(true);
    setFiles((f) => {
      const next = [...f];
      const [item] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, item!);
      return next;
    });
  }

  async function save(quiet = false): Promise<PieceView | null> {
    setError("");
    setMessage("");
    setBusy("Saving…");
    try {
      const fields = { kind, title, link, assetIds: files.map((f) => f.id), pillar };
      let saved = piece ? (await api.updatePiece(piece.id, fields)).piece : (await api.createPiece(fields)).piece;
      for (const ch of dirty) {
        const c = captions[ch];
        if (c) saved = (await api.setCaption(saved.id, ch, c)).piece;
      }
      setDirty(new Set());
      setFieldsDirty(false);
      setPiece(saved);
      onSaved(saved);
      if (!quiet) setMessage("Saved.");
      return saved;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function approve() {
    const saved = await save(true);
    if (!saved) return;
    setBusy("Approving…");
    try {
      const { piece: done } = await api.approvePiece(saved.id, tickedHere);
      setPiece(done);
      setCaptions(done.captions);
      onSaved(done);
      setMessage("Approved. Use Plan my calendar on the Calendar to put it on a date, or add it yourself below.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function unapprove() {
    if (!piece) return;
    setError("");
    setBusy("Undoing the approval…");
    try {
      const { piece: done } = await api.unapprovePiece(piece.id);
      setPiece(done);
      setCaptions(done.captions);
      onSaved(done);
      setMessage("Back to Suggested. Its calendar spots were removed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function schedule() {
    const saved = await save(true);
    if (!saved || picked.size === 0) return;
    setBusy("Adding to the calendar…");
    try {
      const { entries } = await api.schedule(saved.id, [...picked], when.date, when.time);
      setMessage(
        `Added to the calendar for ${friendlyDate(when.date)} at ${friendlyTime(when.time)}: ` +
          entries.map((e) => `${channels.find((c) => c.id === e.channel)?.name} (${ROUTE_LABELS[e.route].toLowerCase()})`).join(", ") +
          ". Lock it on the Calendar when you're happy with the date.",
      );
      setPicked(new Set());
      const fresh = (await api.updatePiece(saved.id, {})).piece;
      setPiece(fresh);
      onSaved(fresh);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const over = activeChannel ? current.text.length > activeChannel.captionLimit : false;
  const placed = new Set((piece?.onCalendar ?? []).map((e) => e.channel));
  const canPlace = (approval?.channels ?? []).filter((c) => !placed.has(c));

  return (
    <div className="overlay" role="dialog" aria-label={piece ? "Edit post" : "New post"}>
      <div className={files.length ? "sheet wide" : "sheet"}>
        <div className="sheet-head">
          <h2>{piece ? "Edit post" : "New post"}</h2>
          <button className="btn-link" onClick={onClose}>Close</button>
        </div>

        <PostPreview files={files}>
          <div className="net-tabs" role="tablist" aria-label="Caption for">
            {channels.map((c) => (
              <span key={c.id} className={c.id === activeChannel?.id ? "net-tab active" : "net-tab"}>
                <input
                  type="checkbox"
                  checked={ticked.has(c.id)}
                  onChange={(e) => toggleTick(c.id, e.target.checked)}
                  aria-label={`Post to ${c.name}`}
                  title={`Post to ${c.name}`}
                />
                <button role="tab" aria-selected={c.id === activeChannel?.id} onClick={() => setActive(c.id)}>
                  {c.name}
                  {!captions[c.id]?.text?.trim() ? " ·" : ""}
                </button>
              </span>
            ))}
          </div>
          <p className="muted small">Tick the networks to post to. Click a name to see and edit its caption.</p>

          {activeChannel && (
            <div className="caption-edit">
              <label className="field">
                <span>{activeChannel.name} {kind === "text" ? "text" : "caption"}</span>
                <textarea rows={10} value={current.text} onChange={(e) => editCaption({ text: e.target.value })} placeholder={`Write the ${activeChannel.name} caption…`} />
              </label>
              <div className="caption-meta">
                <span className={over ? "count over" : "count"}>
                  {current.text.length} / {activeChannel.captionLimit}
                </span>
                {channels.length > 1 && current.text && (
                  <button className="btn-link small" onClick={copyToAll}>Use for networks with no caption yet</button>
                )}
              </div>
              {kind !== "text" && (
                <label className="field">
                  <span>Alt text (describes the image for screen readers)</span>
                  <input value={current.altText} onChange={(e) => editCaption({ altText: e.target.value })} maxLength={2000} />
                </label>
              )}
            </div>
          )}

          <div className="approve-box">
            {approval && (
              <p className="small">
                <span className="status-chip status-approved">Approved</span>{" "}
                by {approval.by || "your team"} on {DAY.format(new Date(approval.at))} for{" "}
                {approval.channels.map((id) => channels.find((c) => c.id === id)?.name ?? id).join(", ")}.
              </p>
            )}
            {(!approval || changedSinceApproval) && (
              <button className="btn-primary" disabled={!!busy || tickedHere.length === 0} onClick={() => void approve()}>
                {approval ? "Approve changes" : `Approve for ${tickedHere.length} network${tickedHere.length === 1 ? "" : "s"}`}
              </button>
            )}
            {approval && !lockedOrSent && (
              <button className="btn-link small" disabled={!!busy} onClick={() => void unapprove()}>Undo approval</button>
            )}
            {!approval && <p className="muted small">Approved posts go on the calendar with one click: Plan my calendar.</p>}
          </div>

          {piece && <Comments pieceId={piece.id} onPieceChanged={reloadFrom} />}
          {piece && <Verdict pieceId={piece.id} />}
        </PostPreview>

        {busy && <p className="notice">{busy}</p>}
        {message && <p className="notice">{message}</p>}
        <ErrorNote message={error} />

        <h3>Details</h3>
        <div className="field-row">
          <label className="field">
            <span>Type</span>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as Kind);
                setActive(channelsFor(e.target.value as Kind)[0]?.id ?? "");
                setFieldsDirty(true);
              }}
            >
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </label>
          <label className="field grow">
            <span>Name (just for you)</span>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setFieldsDirty(true); }} placeholder="Fall sale carousel" maxLength={200} />
          </label>
        </div>
        <p className="muted small">{KIND_HELP[kind]}</p>
        {(strategy?.pillars.length ?? 0) > 0 && (
          <label className="field">
            <span>Content pillar</span>
            <select value={pillar ?? ""} onChange={(e) => { setPillar(e.target.value || null); setFieldsDirty(true); }}>
              <option value="">None</option>
              {strategy!.pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}

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
                    <button className="btn-link small" onClick={() => { setFiles((fs) => fs.filter((_, j) => j !== i)); setFieldsDirty(true); }}>Remove</button>
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

        {(NEEDS_LINK.includes(kind) || link) && (
          <label className="field">
            <span>Link</span>
            <input value={link} onChange={(e) => { setLink(e.target.value); setFieldsDirty(true); }} placeholder="https://" />
          </label>
        )}

        {approval && canPlace.length > 0 && (
          <details className="schedule card-inset">
            <summary>Put it on the calendar yourself</summary>
            <div className="channel-checks">
              {canPlace.map((id) => (
                <label key={id} className="check">
                  <input
                    type="checkbox"
                    checked={picked.has(id)}
                    onChange={(e) => pick(id, e.target.checked)}
                  />
                  {channels.find((c) => c.id === id)?.name ?? id}
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
              <button className="btn-secondary small" onClick={() => void schedule()} disabled={!!busy || picked.size === 0}>Add to calendar</button>
            </div>
          </details>
        )}

        <div className="sheet-actions">
          <button className="btn-secondary" onClick={() => void save()} disabled={!!busy}>Save</button>
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
