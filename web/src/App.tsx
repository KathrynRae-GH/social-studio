import { useEffect, useState } from "react";
import { ApiError, NotInBoutiqlyError, signIn, type SessionState } from "./boutiqly.ts";
import { Shell } from "./components/Shell.tsx";
import { Message } from "./components/Message.tsx";
import { RequestAccess } from "./screens/RequestAccess.tsx";

type State =
  | { kind: "loading" }
  | { kind: "outside" }
  | { kind: "error"; message: string }
  | { kind: "ready"; session: SessionState };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    signIn()
      .then((session) => setState({ kind: "ready", session }))
      .catch((err: unknown) => {
        if (err instanceof NotInBoutiqlyError) setState({ kind: "outside" });
        else setState({ kind: "error", message: err instanceof ApiError ? err.message : "We couldn't load Social Studio. Reload the page to try again." });
      });
  }, []);

  if (state.kind === "loading") return <Message title="Opening Social Studio…" />;
  if (state.kind === "outside")
    return <Message title="Open Social Studio from Boutiqly">Social Studio works inside a Boutiqly sub-account. Find it in the left menu.</Message>;
  if (state.kind === "error") return <Message title="Something went wrong">{state.message}</Message>;

  const { me, requested } = state.session;
  if (!me.brand)
    return (
      <Message title={`Hi ${me.user.name}`}>
        Social Studio works one shop at a time. Switch into a sub-account to open its studio.
      </Message>
    );
  if (me.role === "none") return <RequestAccess me={me} alreadyRequested={requested} />;
  return <Shell me={me} />;
}
