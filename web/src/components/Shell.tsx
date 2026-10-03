import { useState } from "react";
import type { Me } from "../../../shared/roles.ts";
import { AskClaude } from "./AskClaude.tsx";
import { EmptyScreen } from "../screens/EmptyScreen.tsx";
import { BrandScreen } from "../screens/BrandScreen.tsx";

const SCREENS = ["Calendar", "Library", "Assets", "Ideas", "Brand"] as const;
type Screen = (typeof SCREENS)[number];

const EMPTY_TEXT: Record<Exclude<Screen, "Brand">, string> = {
  Calendar: "This week's posts, what needs approval and what's scheduled will show here.",
  Library: "Every post, carousel, Story and Reel Claude makes for you will show here, with captions for each channel.",
  Assets: "Your photos and videos will live here, each tagged and with its people rule.",
  Ideas: "Post ideas and shot lists will show here.",
};

export function Shell({ me }: { me: Me }) {
  const [screen, setScreen] = useState<Screen>("Calendar");
  const [askOpen, setAskOpen] = useState(false);

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
        {screen === "Brand" ? <BrandScreen me={me} /> : <EmptyScreen title={screen} text={EMPTY_TEXT[screen]} />}
      </main>

      {askOpen && <AskClaude onClose={() => setAskOpen(false)} />}
    </div>
  );
}
