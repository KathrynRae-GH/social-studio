import type { Me, TeamEntry } from "../../../shared/roles.ts";
import { TeamPanel } from "../components/TeamPanel.tsx";
import { AccountsPanel } from "../components/AccountsPanel.tsx";
import { LookPanel } from "../components/LookPanel.tsx";
import { ClaudePanel } from "../components/ClaudePanel.tsx";
import { StorePanel } from "../components/StorePanel.tsx";

export function BrandScreen({ me, onTeamChange }: { me: Me; onTeamChange: (team: TeamEntry[]) => void }) {
  return (
    <section>
      <h1>Brand</h1>
      <LookPanel me={me} />
      <StorePanel me={me} />
      <ClaudePanel me={me} />
      <TeamPanel me={me} onTeamChange={onTeamChange} />
      <AccountsPanel me={me} />
      <div className="card empty">
        <p className="muted">Soon Claude will read the shop's website and social accounts and fill in the look for you (brand capture).</p>
      </div>
    </section>
  );
}
