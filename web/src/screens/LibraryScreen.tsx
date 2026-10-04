import { useEffect, useState } from "react";
import type { PieceView } from "../../../shared/content.ts";
import { KIND_LABELS, type Kind } from "../../../shared/channels.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote, StatusChip, Thumb, channelName } from "../components/bits.tsx";
import { PieceEditor } from "./PieceEditor.tsx";

const FILTERS: (Kind | "all")[] = ["all", "post", "carousel", "story", "story_set", "reel", "text", "short", "pin", "google_update"];

export function LibraryScreen({ timezone, shopName = "" }: { timezone: string; shopName?: string }) {
  const [pieces, setPieces] = useState<PieceView[] | null>(null);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [editing, setEditing] = useState<PieceView | null | "new">(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setPieces((await api.pieces()).pieces);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const shown = (pieces ?? []).filter((p) => filter === "all" || p.kind === filter);

  return (
    <section>
      <div className="screen-head">
        <h1>Library</h1>
        <button className="btn-secondary" onClick={() => setEditing("new")}>New post</button>
      </div>

      <div className="filters" role="tablist" aria-label="Filter by type">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "chip-tab active" : "chip-tab"} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : KIND_LABELS[f]}
          </button>
        ))}
      </div>

      <ErrorNote message={error} />
      {pieces === null && !error && <p className="muted">Loading…</p>}
      {pieces?.length === 0 && (
        <div className="card empty">
          <p>No posts yet.</p>
          <p className="muted">Click "New post" to upload photos or videos and write captions. Or ask Claude to make some.</p>
        </div>
      )}

      <div className="piece-grid">
        {shown.map((p) => (
          <button key={p.id} className="piece-card" onClick={() => setEditing(p)}>
            <Thumb asset={p.assets[0]} className="piece-thumb" />
            <div className="piece-body">
              <strong>{p.title || KIND_LABELS[p.kind]}</strong>
              <span className="muted small">
                {KIND_LABELS[p.kind]}
                {p.assets.length > 1 ? ` · ${p.assets.length} files` : ""}
              </span>
              <span className="chips">
                {!p.approval && <span className="status-chip status-suggested">Suggested</span>}
                {p.approval?.channels.map((ch) => {
                  const e = p.onCalendar.find((x) => x.channel === ch);
                  return (
                    <span key={ch} className="chip-line">
                      <span className="small">{channelName(ch)}</span>{" "}
                      {e ? <StatusChip status={e.status} locked={e.locked} /> : <span className="status-chip status-approved">Approved</span>}
                    </span>
                  );
                })}
              </span>
            </div>
          </button>
        ))}
      </div>

      {editing && (
        <PieceEditor
          piece={editing === "new" ? null : editing}
          timezone={timezone}
          shopName={shopName}
          onClose={() => { setEditing(null); void load(); }}
          onSaved={(saved) => setPieces((ps) => [saved, ...(ps ?? []).filter((p) => p.id !== saved.id)])}
        />
      )}
    </section>
  );
}
