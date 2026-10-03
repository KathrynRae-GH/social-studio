export function AskClaude({ onClose }: { onClose: () => void }) {
  return (
    <aside className="ask-panel" aria-label="Ask Claude">
      <div className="ask-head">
        <h2>Ask Claude</h2>
        <button className="btn-secondary small" onClick={onClose}>Close</button>
      </div>
      <p className="muted">
        Soon you'll be able to ask Claude to design a post, write captions or plan a week, right here on any screen.
      </p>
    </aside>
  );
}
