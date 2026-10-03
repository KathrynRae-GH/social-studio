import type { Me, TeamEntry } from "../../../shared/roles.ts";
import { TeamPanel } from "../components/TeamPanel.tsx";
import { AccountsPanel } from "../components/AccountsPanel.tsx";

export function BrandScreen({ me, onTeamChange }: { me: Me; onTeamChange: (team: TeamEntry[]) => void }) {
  return (
    <section>
      <h1>Brand</h1>
      <TeamPanel me={me} onTeamChange={onTeamChange} />
      <AccountsPanel me={me} />
      <div className="card empty">
        <p className="muted">Your brand board, brand doc and style set will show here once brand capture is built.</p>
      </div>
    </section>
  );
}
