import type { ReactNode } from "react";

export function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="centered">
      <div className="card narrow">
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
    </main>
  );
}
