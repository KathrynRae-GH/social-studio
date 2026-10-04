import { useEffect, useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import type { ClaudeStatus } from "../../../shared/ask.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote } from "./bits.tsx";

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Claude on/off and the monthly limit (Boutiqly's team), and what's been used.
export function ClaudePanel({ me }: { me: Me }) {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [cap, setCap] = useState("");
  const [error, setError] = useState("");
  const isBoutiqlyTeam = me.role === "boutiqly_team";

  useEffect(() => {
    api.claudeStatus().then((s) => { setStatus(s); setCap(String(s.capCents / 100)); }, (e: Error) => setError(e.message));
  }, []);

  async function save(input: Partial<{ enabled: boolean; capCents: number }>) {
    setError("");
    const before = status;
    // Flip straight away; flip back if the server says no.
    if (input.enabled !== undefined && status) setStatus({ ...status, enabled: input.enabled });
    try {
      const s = await api.setClaude(input);
      setStatus(s);
      setCap(String(s.capCents / 100));
    } catch (e) {
      setStatus(before);
      setError((e as Error).message);
    }
  }

  if (!status) return <div className="card"><h2>Claude</h2><ErrorNote message={error} /></div>;
  const used = Math.min(100, status.capCents ? (status.spentCents / status.capCents) * 100 : 100);

  return (
    <div className="card">
      <h2>Claude</h2>
      <p className="small">
        {status.enabled
          ? "On. Claude can design, write and look at this shop's files."
          : "Off. Nothing Claude does is available, and nothing is spent."}
      </p>
      {status.fastMode && <p className="muted small">Fast mode on: replies come back faster, at twice the Claude cost.</p>}
      {!status.connected && <p className="notice attention small">The Claude API key isn't set in Render yet, so Claude can't run.</p>}
      <p className="small">
        Used this month: <strong>{dollars(status.spentCents)}</strong> of {dollars(status.capCents)} in Claude cost. Claude pauses at the limit.
      </p>
      <div className="meter" aria-hidden="true"><span style={{ width: `${used}%` }} /></div>

      {isBoutiqlyTeam ? (
        <div className="field-row">
          <label className="check">
            <input type="checkbox" checked={status.enabled} onChange={(e) => void save({ enabled: e.target.checked })} />
            Claude on for this shop
          </label>
          <label className="field">
            <span>Monthly limit ($)</span>
            <input type="number" min="0" step="1" value={cap} onChange={(e) => setCap(e.target.value)} style={{ width: 110 }} />
          </label>
          <button className="btn-secondary small" onClick={() => void save({ capCents: Math.round(Number(cap) * 100) })} disabled={!cap || Number.isNaN(Number(cap))}>
            Save limit
          </button>
        </div>
      ) : (
        <p className="muted small">Boutiqly's team turns Claude on and sets the limit.</p>
      )}
      <ErrorNote message={error} />
    </div>
  );
}
