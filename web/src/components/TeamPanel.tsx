import { useEffect, useState } from "react";
import type { Me, TeamEntry } from "../../../shared/roles.ts";
import { api } from "../boutiqly.ts";

const LABEL = { owner: "Owner", team: "Team member", requested: "Asked for access" } as const;

export function TeamPanel({ me }: { me: Me }) {
  const [team, setTeam] = useState<TeamEntry[] | null>(null);
  const [error, setError] = useState("");
  const canManage = me.permissions.includes("manage_team");
  const hasOwner = team ? team.some((t) => t.role === "owner") : me.brand?.hasOwner;

  useEffect(() => {
    api.team().then((r) => setTeam(r.team), (e: Error) => setError(e.message));
  }, []);

  async function run(action: Promise<{ team: TeamEntry[] }>) {
    setError("");
    try {
      setTeam((await action).team);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="card team">
      <h2>Team</h2>
      {me.role === "boutiqly_team" && hasOwner === false && (
        <p className="notice">This shop has no owner yet. Once the shop's owner opens Social Studio, they'll appear below as "Asked for access" and you can make them the owner.</p>
      )}
      {team === null && !error && <p className="muted">Loading…</p>}
      {team?.length === 0 && <p className="muted">Nobody here yet.</p>}
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
