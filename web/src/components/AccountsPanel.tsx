import { useEffect, useState } from "react";
import type { AccountView } from "../../../shared/content.ts";
import { CHANNELS } from "../../../shared/channels.ts";
import type { Me } from "../../../shared/roles.ts";
import { api } from "../boutiqly.ts";
import { ErrorNote } from "./bits.tsx";

const NAME_BY_PLATFORM = Object.fromEntries(CHANNELS.filter((c) => c.plannerPlatform).map((c) => [c.plannerPlatform!, c.name]));

export function AccountsPanel({ me }: { me: Me }) {
  const [accounts, setAccounts] = useState<AccountView[] | null | undefined>(undefined);
  const [live, setLive] = useState(!!me.brand?.livePosting);
  const [error, setError] = useState("");
  const isBoutiqlyTeam = me.role === "boutiqly_team";

  useEffect(() => {
    api.accounts().then((r) => setAccounts(r.accounts), (e: Error) => setError(e.message));
  }, []);

  async function toggle(on: boolean) {
    setError("");
    setLive(on); // flip straight away; flip back if the server says no
    try {
      setLive((await api.setLivePosting(on)).livePosting);
    } catch (e) {
      setLive(!on);
      setError((e as Error).message);
    }
  }

  return (
    <div className="card">
      <h2>Posting</h2>
      <p className="muted small">Times are in this shop's time zone: {me.brand?.timezone.replace("_", " ")}.</p>

      <h3>Connected social accounts</h3>
      {accounts === undefined && <p className="muted">Checking Boutiqly…</p>}
      {accounts === null && <p className="notice attention">Social Studio can't see this shop's social accounts. Check that it's installed in this sub-account.</p>}
      {accounts?.length === 0 && <p className="muted">None yet. Connect accounts in Boutiqly's social planner; they show up here.</p>}
      <ul className="team-list">
        {accounts?.map((a) => (
          <li key={a.id}>
            <div>
              <strong>{NAME_BY_PLATFORM[a.platform] ?? a.platform}</strong>
              <span className="muted small">{a.name}</span>
            </div>
            {a.expired ? <span className="status-chip status-needs_attention">Needs reconnecting</span> : <span className="status-chip status-approved">Connected</span>}
          </li>
        ))}
      </ul>

      <h3>Live posting</h3>
      <p className="small">
        {live
          ? "On. Approving a post sends it to Boutiqly's social planner for real."
          : "Off. Approving a post shows exactly what would go to Boutiqly, but nothing is posted."}
      </p>
      {isBoutiqlyTeam ? (
        <label className="check">
          <input type="checkbox" checked={live} onChange={(e) => void toggle(e.target.checked)} />
          Live posting for this shop
        </label>
      ) : (
        <p className="muted small">Boutiqly's team turns this on when the shop is ready.</p>
      )}
      <ErrorNote message={error} />
    </div>
  );
}
