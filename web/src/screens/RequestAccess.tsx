import { useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import { api } from "../boutiqly.ts";

export function RequestAccess({ me, alreadyRequested }: { me: Me; alreadyRequested: boolean }) {
  const [requested, setRequested] = useState(alreadyRequested);
  const [error, setError] = useState("");

  async function ask() {
    setError("");
    try {
      await api.requestAccess();
      setRequested(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main className="centered">
      <div className="card narrow">
        <h1>Social Studio</h1>
        <p>Hi {me.user.name}. You're not on this shop's Social Studio team yet.</p>
        {requested ? (
          <p className="notice">Request sent. The shop's owner will see it on their Team list.</p>
        ) : (
          <>
            <p className="muted">Ask for access and the shop's owner can add you.</p>
            <button className="btn-secondary" onClick={ask}>Ask for access</button>
          </>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
