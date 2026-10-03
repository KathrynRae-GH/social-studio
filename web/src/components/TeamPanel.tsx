import { useEffect, useState } from "react";
import type { Me, TeamEntry } from "../../../shared/roles.ts";
import { api } from "../boutiqly.ts";

const LABEL = { owner: "Owner", team: "Team member", requested: "Asked for access", candidate: "" } as const;

interface Picker {
  people: TeamEntry[] | null;
  message: string;
}

export function TeamPanel({ me, onTeamChange }: { me: Me; onTeamChange?: (team: TeamEntry[]) => void }) {
  const [team, setTeam] = useState<TeamEntry[] | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [error, setError] = useState("");
  const canManage = me.permissions.includes("manage_team");
  const hasOwner = team ? team.some((t) => t.role === "owner") : me.brand?.hasOwner;

  function showTeam(next: TeamEntry[]) {
    setTeam(next);
    onTeamChange?.(next);
  }

  useEffect(() => {
    api.team().then((r) => showTeam(r.team), (e: Error) => setError(e.message));
  }, []);

  async function openPicker() {
    setError("");
    setPicker({ people: null, message: "" });
    try {
      const r = await api.candidates();
      setPicker({ people: r.people, message: r.available ? "" : (r.message ?? "") });
    } catch (e) {
      setPicker(null);
      setError((e as Error).message);
    }
  }

  async function run(action: Promise<{ team: TeamEntry[] }>, fromPicker = false) {
    setError("");
    try {
      showTeam((await action).team);
      if (fromPicker) setPicker(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card team">
      <div className="team-head">
        <h2>Team</h2>
        {canManage && !picker && (
          <button className="btn-secondary small" onClick={openPicker}>Add someone</button>
        )}
      </div>

      {me.role === "boutiqly_team" && hasOwner === false && !picker && (
        <p className="notice">This shop has no owner yet. Click "Add someone" and make the shop's owner the owner.</p>
      )}

      {picker && (
        <div className="picker">
          <div className="team-head">
            <h3>People in this sub-account</h3>
            <button className="btn-link small" onClick={() => setPicker(null)}>Close</button>
          </div>
          {picker.people === null && <p className="muted">Loading from Boutiqly…</p>}
          {picker.message && <p className="notice">{picker.message}</p>}
          {picker.people?.length === 0 && !picker.message && (
            <p className="muted">Everyone with a login to this sub-account is already on the team.</p>
          )}
          <ul className="team-list">
            {picker.people?.map((p) => (
              <li key={p.userId}>
                <div>
                  <strong>{p.name}</strong>
                  <span className="muted small">{p.email}</span>
                </div>
                <div className="row-actions">
                  <button className="btn-secondary small" onClick={() => run(api.setRole(p.userId, "owner"), true)}>Make owner</button>
                  <button className="btn-secondary small" onClick={() => run(api.setRole(p.userId, "team"), true)}>Make team member</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {team === null && !error && <p className="muted">Loading…</p>}
      {team?.length === 0 && <p className="muted">Nobody on the team yet.</p>}
      <ul className="team-list">
        {team?.map((t) => (
          <li key={t.userId}>
            <div>
              <strong>{t.name}</strong>
              <span className="muted small">{t.email}</span>
            </div>
            <span className={`role-chip role-${t.role}`}>{LABEL[t.role]}</span>
            {canManage && t.userId !== me.user.id && (
              <div className="row-actions">
                {t.role !== "owner" && <button className="btn-secondary small" onClick={() => run(api.setRole(t.userId, "owner"))}>Make owner</button>}
                {t.role !== "team" && <button className="btn-secondary small" onClick={() => run(api.setRole(t.userId, "team"))}>Make team member</button>}
                <button className="btn-link small" onClick={() => run(api.remove(t.userId))}>{t.role === "requested" ? "Decline" : "Remove"}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
