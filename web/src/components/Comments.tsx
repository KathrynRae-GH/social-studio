import { useEffect, useRef, useState } from "react";
import type { PieceComments, PieceView } from "../../../shared/content.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote, Thumb } from "./bits.tsx";

const WHEN = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Comments for Claude on this post. Collect as many as you like, then send
// them in one go; Claude edits the post and it comes back as Suggested.
// Earlier versions are kept, so an edit can be undone.
export function Comments({ pieceId, onPieceChanged }: { pieceId: string; onPieceChanged: (p: PieceView) => void }) {
  const [data, setData] = useState<PieceComments | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasEditing = useRef(false);

  async function load() {
    try {
      const d = await api.comments(pieceId);
      setData(d);
      // Claude just finished: show the edited post.
      if (wasEditing.current && !d.editing) onPieceChanged((await api.piece(pieceId)).piece);
      wasEditing.current = d.editing;
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [pieceId]);
  useEffect(() => {
    if (!data?.editing) return;
    const t = setTimeout(() => void load(), 4000);
    return () => clearTimeout(t);
  }, [data]);

  async function run(fn: () => Promise<PieceComments | void>) {
    setBusy(true);
    setError("");
    try {
      const d = await fn();
      if (d) {
        setData(d);
        wasEditing.current = d.editing;
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const open = (data?.comments ?? []).filter((c) => c.status === "open");
  const earlier = (data?.comments ?? []).filter((c) => c.status !== "open");

  return (
    <div className="comments card-inset">
      <h3>Comments for Claude</h3>
      <p className="muted small">Say what to change. Add as many as you like, then send them together. Claude edits this post, and it comes back as Suggested for you to approve again.</p>

      {earlier.length > 0 && (
        <details className="small">
          <summary>{earlier.length} earlier comment{earlier.length === 1 ? "" : "s"}</summary>
          <ul className="comment-list">
            {earlier.map((c) => (
              <li key={c.id}><strong>{c.by}</strong> {c.text} <span className="muted">· {c.status === "sent" ? "with Claude" : "done"}</span></li>
            ))}
          </ul>
        </details>
      )}
      {data?.reply && !data.editing && <p className="notice small"><strong>Claude:</strong> {data.reply}</p>}
      {data?.error && !data.editing && <p className="error small">{data.error} Your comments are still here; send them again.</p>}

      {open.length > 0 && (
        <ul className="comment-list">
          {open.map((c) => (
            <li key={c.id}>
              <strong>{c.by}</strong> {c.text}
              {c.mine && (
                <button className="btn-link small" disabled={busy} onClick={() => run(() => api.deleteComment(pieceId, c.id))}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {data?.editing ? (
        <p className="notice small">Claude is working on your edits… The new version shows here when it's ready (usually a minute or two).</p>
      ) : (
        <>
          <form
            className="comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void run(async () => { const d = await api.addComment(pieceId, text); setText(""); return d; });
            }}
          >
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Make the headline bigger. Use the photo of the green tote instead." maxLength={2000} />
            <button className="btn-secondary small" disabled={busy || !text.trim()}>Add comment</button>
          </form>
          {open.length > 0 && (
            <button className="btn-secondary" disabled={busy} onClick={() => run(() => api.sendEdits(pieceId))}>
              Send {open.length} comment{open.length === 1 ? "" : "s"} to Claude
            </button>
          )}
        </>
      )}

      {(data?.versions.length ?? 0) > 0 && (
        <details className="small versions">
          <summary>Earlier versions ({data!.versions.length})</summary>
          <ul className="version-list">
            {data!.versions.map((v) => (
              <li key={v.id}>
                <Thumb asset={v.preview} className="version-thumb" />
                <span>{v.reason} · {WHEN.format(new Date(v.at))}</span>
                <button
                  className="btn-link small"
                  disabled={busy || data!.editing}
                  onClick={() => {
                    if (confirm("Go back to this version? The current one is kept as an earlier version too, and the post goes back to Suggested."))
                      void run(async () => {
                        onPieceChanged((await api.restoreVersion(pieceId, v.id)).piece);
                        return api.comments(pieceId);
                      });
                  }}
                >
                  Go back
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <ErrorNote message={error} />
    </div>
  );
}
