import { useEffect, useState } from "react";
import type { PieceView } from "../../../shared/content.ts";
import { KIND_LABELS, type Kind } from "../../../shared/channels.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote, StatusChip, Thumb, cardProps, channelName } from "../components/bits.tsx";
import { PieceEditor } from "./PieceEditor.tsx";

type Stage = "all" | "new" | "suggested" | "approved" | "on_calendar" | "locked" | "scheduled" | "posted";
const STAGES: { id: Stage; label: string }[] = [
  { id: "all", label: "Any status" },
  { id: "new", label: "New this week" },
  { id: "suggested", label: "Suggested" },
  { id: "approved", label: "Approved, no date yet" },
  { id: "on_calendar", label: "On calendar" },
  { id: "locked", label: "Locked" },
  { id: "scheduled", label: "Scheduled" },
  { id: "posted", label: "Posted" },
];
const WEEK = 7 * 86_400_000;

// A post can be at several stages at once (one per network), so it matches
// a filter if any of its networks is at that stage.
function atStage(p: PieceView, stage: Stage): boolean {
  if (stage === "all") return true;
  if (stage === "new") return Date.now() - new Date(p.createdAt).getTime() < WEEK;
  if (stage === "suggested") return !p.approval;
  if (!p.approval) return false;
  if (stage === "approved") return p.approval.channels.some((ch) => !p.onCalendar.some((e) => e.channel === ch));
  if (stage === "on_calendar") return p.onCalendar.some((e) => e.status === "approved" && !e.locked);
  if (stage === "locked") return p.onCalendar.some((e) => e.status === "approved" && e.locked);
  return p.onCalendar.some((e) => e.status === stage);
}

const FILTERS: (Kind | "all")[] = ["all", "post", "carousel", "story", "story_set", "reel", "text", "short", "pin", "google_update"];

export function LibraryScreen({ timezone, shopName = "" }: { timezone: string; shopName?: string }) {
  const [pieces, setPieces] = useState<PieceView[] | null>(null);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [stage, setStage] = useState<Stage>("all");
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

  const shown = (pieces ?? []).filter((p) => (filter === "all" || p.kind === filter) && atStage(p, stage));
  const count = (st: Stage) => (pieces ?? []).filter((p) => (filter === "all" || p.kind === filter) && atStage(p, st)).length;

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
      <div className="filters" role="tablist" aria-label="Filter by status">
        {STAGES.map((st) => (
          <button key={st.id} role="tab" aria-selected={stage === st.id} className={stage === st.id ? "chip-tab active" : "chip-tab"} onClick={() => setStage(st.id)}>
            {st.label}{st.id !== "all" && pieces ? ` (${count(st.id)})` : ""}
          </button>
        ))}
      </div>
      {pieces && pieces.length > 0 && shown.length === 0 && <p className="muted">No posts match these filters.</p>}

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
          <div key={p.id} className="piece-card" {...cardProps(() => setEditing(p))}>
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
          </div>
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
