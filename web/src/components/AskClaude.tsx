import { useEffect, useRef, useState } from "react";
import type { PieceView } from "../../../shared/content.ts";
import type { AskEvent, ChatItem, ClaudeStatus, ConversationSummary, ProposalView } from "../../../shared/ask.ts";
import { KIND_LABELS } from "../../../shared/channels.ts";
import { api, askClaude } from "../boutiqly.ts";
import { ErrorNote, Thumb } from "./bits.tsx";

const EXAMPLES = [
  "Make a 3-slide carousel about our fall arrivals",
  "Write a week of Threads posts in our voice",
  "What's on the calendar next week? Anything missing?",
];

export function AskClaude({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<ClaudeStatus | null>(null);
  const [chats, setChats] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [pieces, setPieces] = useState<Record<string, PieceView>>({});
  const [text, setText] = useState("");
  const [working, setWorking] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [interrupted, setInterrupted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);

  // While Claude works, show how long it's been (big requests take minutes).
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [working]);
  const minutes = startedAt ? Math.floor((Date.now() - startedAt) / 60_000) : 0;

  useEffect(() => {
    api.claudeStatus().then(setStatus, (e: Error) => setError(e.message));
    api.conversations().then((r) => setChats(r.conversations), () => {});
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [items, working]);

  async function openChat(id: string) {
    setError("");
    setCost(null);
    setInterrupted(false);
    if (!id) {
      setConversationId(null);
      setItems([]);
      return;
    }
    try {
      const { conversation } = await api.conversation(id);
      setConversationId(conversation.id);
      setItems(conversation.items);
      setPieces(Object.fromEntries(conversation.pieces.map((p) => [p.id, p])));
      setInterrupted(conversation.interrupted);
      if (conversation.working) {
        setStartedAt(Date.now());
        await followUntilDone(conversation.id);
        setWorking("");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function onEvent(e: AskEvent) {
    switch (e.type) {
      case "start":
        setConversationId(e.conversationId);
        break;
      case "text":
        setWorking("Writing…");
        setItems((list) => {
          const last = list[list.length - 1];
          if (last?.kind === "claude") return [...list.slice(0, -1), { kind: "claude", text: last.text + e.delta }];
          return [...list, { kind: "claude", text: e.delta }];
        });
        break;
      case "status":
        setWorking(e.text);
        break;
      case "piece":
        setPieces((p) => ({ ...p, [e.piece.id]: e.piece }));
        setItems((list) => (list.some((i) => i.kind === "piece" && i.pieceId === e.piece.id) ? list : [...list, { kind: "piece", pieceId: e.piece.id }]));
        break;
      case "proposal":
        setItems((list) => [...list, { kind: "proposal", proposal: e.proposal }]);
        break;
      case "done":
        setCost(e.costCents);
        break;
      case "error":
        setError(e.message);
        break;
      case "ping":
        break;
    }
  }

  async function send(message = text) {
    const t = message.trim();
    if (!t || working) return;
    setError("");
    setCost(null);
    setText("");
    setInterrupted(false);
    setItems((list) => [...list, { kind: "user", text: t }]);
    setWorking("Thinking…");
    setStartedAt(Date.now());
    let chatId = conversationId;
    let finished = false;
    try {
      await askClaude({ conversationId, text: t }, (e) => {
        if (e.type === "start") chatId = e.conversationId;
        if (e.type === "done") finished = true;
        onEvent(e);
      });
    } catch (e) {
      if (!chatId) setError((e as Error).message);
    }
    // If the connection dropped before Claude finished, Claude keeps working
    // on the server: follow along until it's done, then show the result.
    if (!finished && chatId) await followUntilDone(chatId);
    api.conversations().then((r) => setChats(r.conversations), () => {});
    setWorking("");
    setStartedAt(null);
  }

  // Follows a reply Claude is still writing on the server (the live connection
  // dropped, or the chat was reopened), for up to 30 minutes.
  async function followUntilDone(id: string) {
    setWorking("Claude is still working on the server…");
    for (let i = 0; i < 450; i++) {
      try {
        const { conversation } = await api.conversation(id);
        setItems(conversation.items);
        setPieces(Object.fromEntries(conversation.pieces.map((p) => [p.id, p])));
        if (!conversation.working) {
          setInterrupted(conversation.interrupted);
          return;
        }
      } catch {
        /* try again */
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
    setError("Claude is still working on this one. Reopen this chat in a few minutes to see the result.");
  }

  async function decide(p: ProposalView, decision: "apply" | "dismiss") {
    setError("");
    try {
      const { proposal } = await api.decideProposal(p.id, decision);
      setItems((list) => list.map((i) => (i.kind === "proposal" && i.proposal.id === p.id ? { kind: "proposal", proposal } : i)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const off = status && (!status.enabled || !status.connected);

  return (
    <aside className="ask-panel" aria-label="Ask Claude">
      <div className="ask-head">
        <h2>Ask Claude</h2>
        <button className="btn-secondary small" onClick={onClose}>Close</button>
      </div>
      <div className="field-row">
        <select value={conversationId ?? ""} onChange={(e) => void openChat(e.target.value)} aria-label="Chats" disabled={!!working}>
          <option value="">New chat</option>
          {chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {off && (
        <p className="notice attention small">
          {!status!.connected ? "Claude isn't connected yet." : "Claude is off for this shop. Boutiqly's team can turn it on from the Brand screen."}
        </p>
      )}

      <div className="chat">
        {items.length === 0 && !off && (
          <div className="muted small">
            <p>Ask for a post, a carousel, Stories, captions or a plan. Claude designs in this shop's approved look and only uses files marked "Claude can use".</p>
            <div className="tag-row">
              {EXAMPLES.map((x) => <button key={x} className="chip-tab" onClick={() => void send(x)}>{x}</button>)}
            </div>
          </div>
        )}
        {items.map((item, i) => {
          if (item.kind === "user") return <p key={i} className="bubble user">{item.text}</p>;
          if (item.kind === "claude") return <p key={i} className="bubble claude">{item.text}</p>;
          if (item.kind === "piece") {
            const p = pieces[item.pieceId];
            if (!p) return null;
            return (
              <div key={i} className="chat-card">
                <strong>{p.title || KIND_LABELS[p.kind]}</strong>
                <span className="muted small">{KIND_LABELS[p.kind]} · Suggested · in the Library</span>
                {p.assets.length > 0 && <div className="frames">{p.assets.map((a) => <Thumb key={a.id} asset={a} className="frame-thumb" />)}</div>}
                {Object.keys(p.captions).length > 0 && <span className="small">Captions for {Object.keys(p.captions).length} channel{Object.keys(p.captions).length > 1 ? "s" : ""}</span>}
              </div>
            );
          }
          const p = item.proposal;
          return (
            <div key={i} className="chat-card proposal">
              <span>{p.summary}</span>
              {p.status === "open" ? (
                <div className="field-row">
                  <button className="btn-secondary small" onClick={() => void decide(p, "apply")}>Apply</button>
                  <button className="btn-link small" onClick={() => void decide(p, "dismiss")}>Dismiss</button>
                </div>
              ) : (
                <span className="muted small">{p.status === "applied" ? "Applied" : "Dismissed"}</span>
              )}
            </div>
          );
        })}
        {working && <p className="muted small working">{working}{minutes > 0 ? ` (${minutes} min)` : ""}</p>}
        {interrupted && !working && (
          <div className="notice small">
            <p>Claude was interrupted before it finished (Social Studio was updating). Anything it already made is in the Library.</p>
            <button className="btn-secondary small" onClick={() => void send("Please continue where you left off.")}>Continue</button>
          </div>
        )}
        {cost !== null && <p className="muted small">This reply cost about {cost < 1 ? `${cost.toFixed(1)}¢` : `${Math.round(cost)}¢`} in Claude time.</p>}
        <ErrorNote message={error} />
        <div ref={bottom} />
      </div>

      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder={off ? "Claude is off for this shop" : "Ask Claude…"}
          disabled={!!off || !!working}
          maxLength={8000}
        />
        <button className="btn-secondary" type="submit" disabled={!!off || !!working || !text.trim()}>Send</button>
      </form>
    </aside>
  );
}
