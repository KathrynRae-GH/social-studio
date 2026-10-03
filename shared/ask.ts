// Ask Claude: what the server streams to the tab, and what a saved
// conversation looks like when it's opened again.
import type { PieceView } from "./content.ts";

export interface ProposalView {
  id: string;
  kind: "add_to_calendar" | "move_entry" | "set_caption";
  summary: string;
  status: "open" | "applied" | "dismissed";
}

export type AskEvent =
  | { type: "start"; conversationId: string }
  | { type: "text"; delta: string }
  | { type: "status"; text: string } // "Looking through the library…"
  | { type: "piece"; piece: PieceView }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "done"; costCents: number }
  | { type: "error"; message: string };

export type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "claude"; text: string }
  | { kind: "piece"; pieceId: string }
  | { kind: "proposal"; proposal: ProposalView };

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ConversationView {
  id: string;
  title: string;
  items: ChatItem[];
  pieces: PieceView[];
}

export interface ClaudeStatus {
  enabled: boolean;
  capCents: number;
  spentCents: number;
  connected: boolean;
}
