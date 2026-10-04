import { useEffect, useState } from "react";
import type { FeedbackView } from "../../../shared/content.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote } from "./bits.tsx";

// Love it / not this, and why. Claude reads these before designing.
export function Verdict({ pieceId }: { pieceId: string }) {
  const [list, setList] = useState<FeedbackView[]>([]);
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.feedback(pieceId).then((r) => setList(r.feedback), () => {});
  }, [pieceId]);

  async function save() {
    if (!rating) return;
    setBusy(true);
    setError("");
    try {
      setList((await api.addFeedback(pieceId, rating, note)).feedback);
      setRating(null);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="verdict card-inset">
      <h3>What do you think?</h3>
      <p className="muted small">Claude reads these before every design, so it learns what this shop likes.</p>
      <div className="field-row">
        <button className={rating === 1 ? "chip-tab active" : "chip-tab"} onClick={() => setRating(1)} aria-pressed={rating === 1}>👍 Love it</button>
        <button className={rating === -1 ? "chip-tab active" : "chip-tab"} onClick={() => setRating(-1)} aria-pressed={rating === -1}>👎 Not this</button>
      </div>
      {rating && (
        <>
          <label className="field">
            <span>Why? (the more specific, the better)</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={rating === 1 ? "The bold type and the ring around the photo" : "Too much going on; the text is hard to read"} />
          </label>
          <button className="btn-secondary small" onClick={() => void save()} disabled={busy}>Save</button>
        </>
      )}
      <ErrorNote message={error} />
      {list.length > 0 && (
        <ul className="verdict-list">
          {list.map((f, i) => (
            <li key={i} className="small">
              {f.rating === 1 ? "👍" : "👎"} {f.note || <span className="muted">(no note)</span>} <span className="muted">· {f.by}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
