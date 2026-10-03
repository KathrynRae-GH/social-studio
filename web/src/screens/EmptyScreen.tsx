export function EmptyScreen({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h1>{title}</h1>
      <div className="card empty">
        <p className="muted">{text}</p>
        <p className="muted small">Coming in the next few weeks.</p>
      </div>
    </section>
  );
}
