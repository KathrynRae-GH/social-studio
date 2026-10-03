import { useEffect, useState } from "react";
import type { IdeaView } from "../../../shared/content.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote } from "../components/bits.tsx";

const STATUS: Record<IdeaView["status"], string> = {
  now: "Can make now",
  later: "Needs photos or video",
  built: "Made",
  done: "Posted",
};

export function IdeasScreen() {
  const [ideas, setIdeas] = useState<IdeaView[] | null>(null);
  const [draft, setDraft] = useState({ title: "", pitch: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    api.ideas().then((r) => setIdeas(r.ideas), (e: Error) => setError(e.message));
  }, []);

  async function run(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section>
      <h1>Ideas</h1>
      <form
        className="card idea-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const { idea } = await api.addIdea(draft);
            setIdeas((list) => [idea, ...(list ?? [])]);
            setDraft({ title: "", pitch: "" });
          });
        }}
      >
        <label className="field">
          <span>Idea</span>
          <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Studio tour Reel" maxLength={200} />
        </label>
        <label className="field">
          <span>What it is (optional)</span>
          <textarea rows={2} value={draft.pitch} onChange={(e) => setDraft((d) => ({ ...d, pitch: e.target.value }))} placeholder="A slow walk through the shop on a Saturday morning." />
        </label>
        <button className="btn-secondary" disabled={!draft.title.trim()}>Add idea</button>
      </form>
      <ErrorNote message={error} />
      {ideas === null && !error && <p className="muted">Loading…</p>}
      {ideas?.length === 0 && <p className="muted">No ideas yet. Claude will suggest ideas and shot lists here from Milestone 3.</p>}
      <div className="idea-list">
        {ideas?.map((idea) => (
          <article key={idea.id} className="card idea">
            <div>
              <strong>{idea.title}</strong>
              {idea.pitch && <p className="muted">{idea.pitch}</p>}
            </div>
            <div className="row-actions">
              <select
                value={idea.status}
                aria-label="Status"
                onChange={(e) =>
                  void run(async () => {
                    const { idea: updated } = await api.updateIdea(idea.id, { status: e.target.value as IdeaView["status"] });
                    setIdeas((list) => list?.map((i) => (i.id === idea.id ? updated : i)) ?? null);
                  })
                }
              >
                {Object.entries(STATUS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <button
                className="btn-link small"
                onClick={() =>
                  void run(async () => {
                    await api.deleteIdea(idea.id);
                    setIdeas((list) => list?.filter((i) => i.id !== idea.id) ?? null);
                  })
                }
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
