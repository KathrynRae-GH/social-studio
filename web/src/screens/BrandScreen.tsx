import type { Me } from "../../../shared/roles.ts";
import { TeamPanel } from "../components/TeamPanel.tsx";

export function BrandScreen({ me }: { me: Me }) {
  return (
    <section>
      <h1>Brand</h1>
      <div className="card empty">
        <p className="muted">Your brand board, brand doc and style set will show here once brand capture is built.</p>
      </div>
      <TeamPanel me={me} />
    </section>
  );
}
