import { useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import { AskClaude } from "./AskClaude.tsx";
import { AssetsScreen } from "../screens/AssetsScreen.tsx";
import { BrandScreen } from "../screens/BrandScreen.tsx";
import { CalendarScreen } from "../screens/CalendarScreen.tsx";
import { LibraryScreen } from "../screens/LibraryScreen.tsx";
import { IdeasScreen } from "../screens/IdeasScreen.tsx";

const SCREENS = ["Calendar", "Library", "Assets", "Ideas", "Brand"] as const;
type Screen = (typeof SCREENS)[number];

export function Shell({ me }: { me: Me }) {
  const [screen, setScreen] = useState<Screen>("Calendar");
  const [askOpen, setAskOpen] = useState(false);
  const [hasOwner, setHasOwner] = useState(!!me.brand?.hasOwner);
  const timezone = me.brand?.timezone ?? "America/Chicago";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-name">
          <strong>Social Studio</strong>
          <span className="muted">{me.brand?.name ?? "This shop"}</span>
        </div>
        <div className="who" aria-label="Signed in as">
          <span>{me.user.name}</span>
          <span className={`role-chip role-${me.role}`}>{me.roleLabel}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Screens">
        {SCREENS.map((s) => (
          <button key={s} className={s === screen ? "tab active" : "tab"} aria-current={s === screen ? "page" : undefined} onClick={() => setScreen(s)}>
            {s}
          </button>
        ))}
        <button className="tab ask" onClick={() => setAskOpen(true)}>
          Ask Claude
        </button>
      </nav>

      <main className="screen">
        {screen === "Calendar" && <CalendarScreen me={me} hasOwner={hasOwner} onOpenTeam={() => setScreen("Brand")} />}
        {screen === "Library" && <LibraryScreen timezone={timezone} shopName={me.brand?.name ?? ""} />}
        {screen === "Assets" && <AssetsScreen />}
        {screen === "Ideas" && <IdeasScreen />}
        {screen === "Brand" && (
          <BrandScreen me={me} onTeamChange={(team) => setHasOwner(team.some((t) => t.role === "owner"))} />
        )}
      </main>

      {askOpen && <AskClaude onClose={() => setAskOpen(false)} />}
    </div>
  );
}
