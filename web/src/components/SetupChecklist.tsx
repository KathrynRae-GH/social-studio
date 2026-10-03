// What's left to set up for this shop. Shown to Boutiqly's team and owners.
// Steps that aren't built yet show as "Coming soon" so the path is clear.
interface Step {
  title: string;
  text: string;
  state: "done" | "todo" | "soon";
  action?: { label: string; onClick: () => void };
}

export function SetupChecklist({ hasOwner, onOpenTeam }: { hasOwner: boolean; onOpenTeam: () => void }) {
  const steps: Step[] = [
    {
      title: "Name the shop's owner",
      text: hasOwner ? "Done. Owners can add their own staff on the Brand screen." : "Pick the owner: someone from the shop, or from Boutiqly's team.",
      state: hasOwner ? "done" : "todo",
      action: hasOwner ? undefined : { label: "Choose the owner", onClick: onOpenTeam },
    },
    {
      title: "Capture the brand",
      text: "Claude reads the shop's website, social accounts and brand files, then shows a brand board to approve.",
      state: "soon",
    },
    {
      title: "Connect social accounts",
      text: "Check which accounts are connected in Boutiqly's social planner.",
      state: "soon",
    },
  ];

  return (
    <section className="card setup" aria-label="Set up this shop">
      <h2>Set up this shop</h2>
      <ol className="steps">
        {steps.map((s, i) => (
          <li key={s.title} className={`step step-${s.state}`}>
            <span className="step-mark" aria-hidden="true">{s.state === "done" ? "✓" : i + 1}</span>
            <div className="step-body">
              <strong>{s.title}</strong>
              <span className="muted small">{s.text}</span>
            </div>
            {s.state === "soon" && <span className="role-chip soon">Coming soon</span>}
            {s.action && (
              <button className="btn-secondary small" onClick={s.action.onClick}>{s.action.label}</button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
