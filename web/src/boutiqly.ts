// Talking to Boutiqly from inside its frame, and to our own API.
import type { StoreView } from "../../shared/store.ts";
import type { StrategyView } from "../../shared/strategy.ts";
import type { Me, TeamEntry } from "../../shared/roles.ts";
import type { PieceComments, PlanResult, SendResult, AccountView, AssetDetail, AssetView, FeedbackView, CalendarData, EntryView, IdeaView, PieceView } from "../../shared/content.ts";
import type { AskEvent, ClaudeStatus, ConversationSummary, ConversationView, ProposalView } from "../../shared/ask.ts";
import type { CustomFont, StyleColor, StyleSetView } from "../../shared/design.ts";

export type UploadedFont = CustomFont & { fileName: string; sizeBytes: number };

interface MessageSource {
  postMessage(message: unknown, targetOrigin: string): void;
}
interface MessageTarget {
  addEventListener(type: "message", fn: (e: MessageEvent) => void): void;
  removeEventListener(type: "message", fn: (e: MessageEvent) => void): void;
}

export class NotInBoutiqlyError extends Error {}

// Asks the Boutiqly page around us for its encrypted "who's looking" note.
// The note is useless without the server's shared secret, so it's safe to
// pass through the browser.
export function requestUserContext(
  parent: MessageSource | null = window.parent !== window ? window.parent : null,
  target: MessageTarget = window,
  timeoutMs = 8000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!parent) return reject(new NotInBoutiqlyError("Not inside Boutiqly"));
    const timer = setTimeout(() => {
      target.removeEventListener("message", onMessage);
      reject(new NotInBoutiqlyError("Boutiqly didn't answer"));
    }, timeoutMs);
    function onMessage(e: MessageEvent) {
      if (e.source !== (parent as unknown)) return;
      const data = e.data as { message?: string; payload?: unknown } | null;
      if (data?.message !== "REQUEST_USER_DATA_RESPONSE" || typeof data.payload !== "string") return;
      clearTimeout(timer);
      target.removeEventListener("message", onMessage);
      resolve(data.payload);
    }
    target.addEventListener("message", onMessage);
    parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
  });
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface SessionState {
  me: Me;
  requested: boolean;
}

let token = "";

async function call<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && retry && path !== "/api/session") {
    await signIn(); // the pass expired: ask Boutiqly again, quietly
    return call<T>(path, init, false);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? "Something went wrong.", res.status);
  return body as T;
}

export async function signIn(): Promise<SessionState> {
  const payload = await requestUserContext();
  const res = await call<SessionState & { token: string }>("/api/session", {
    method: "POST",
    body: JSON.stringify({ payload }),
  });
  token = res.token;
  return { me: res.me, requested: res.requested };
}

export const api = {
  me: () => call<SessionState>("/api/me"),
  requestAccess: () => call<{ ok: true }>("/api/access-requests", { method: "POST", body: "{}" }),
  team: () => call<{ team: TeamEntry[] }>("/api/team"),
  candidates: () => call<{ available: boolean; people: TeamEntry[]; message?: string }>("/api/team/candidates"),
  setRole: (userId: string, role: "owner" | "team") =>
    call<{ team: TeamEntry[] }>(`/api/team/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify({ role }) }),
  remove: (userId: string) =>
    call<{ team: TeamEntry[] }>(`/api/team/${encodeURIComponent(userId)}`, { method: "DELETE" }),

  // Library
  upload: (file: File, purpose: "content" | "inspiration" = "content") => {
    const form = new FormData();
    form.append("purpose", purpose); // must come before the file
    form.append("file", file);
    return call<{ asset: AssetView }>("/api/assets", { method: "POST", body: form });
  },
  pieces: () => call<{ pieces: PieceView[] }>("/api/pieces"),
  createPiece: (input: Partial<{ kind: string; title: string; link: string; assetIds: string[]; pillar: string | null }>) =>
    call<{ piece: PieceView }>("/api/pieces", { method: "POST", body: JSON.stringify(input) }),
  updatePiece: (id: string, input: Partial<{ kind: string; title: string; link: string; assetIds: string[]; archived: boolean; pillar: string | null }>) =>
    call<{ piece: PieceView }>(`/api/pieces/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  setCaption: (id: string, channel: string, input: { text: string; altText: string; status: "draft" | "final" }) =>
    call<{ piece: PieceView }>(`/api/pieces/${id}/captions/${channel}`, { method: "PUT", body: JSON.stringify(input) }),

  // Calendar
  calendar: (from?: string, to?: string) =>
    call<CalendarData>(`/api/calendar${from && to ? `?from=${from}&to=${to}` : ""}`),
  schedule: (pieceId: string, channels: string[], date: string, time: string) =>
    call<{ entries: EntryView[] }>("/api/calendar", { method: "POST", body: JSON.stringify({ pieceId, channels, date, time }) }),
  move: (id: string, date: string, time: string) =>
    call<{ entry: EntryView }>(`/api/calendar/${id}`, { method: "PATCH", body: JSON.stringify({ date, time }) }),
  unschedule: (id: string) => call<{ ok: true }>(`/api/calendar/${id}`, { method: "DELETE" }),
  lock: (id: string, locked: boolean) => call<{ entry: EntryView }>(`/api/calendar/${id}/lock`, { method: "POST", body: JSON.stringify({ locked }) }),
  lockAll: () => call<{ locked: number }>("/api/calendar/lock-all", { method: "POST", body: "{}" }),
  sendLocked: () => call<SendResult>("/api/calendar/send", { method: "POST", body: "{}" }),
  plan: (weeks: number, more: boolean) => call<PlanResult>("/api/calendar/plan", { method: "POST", body: JSON.stringify({ weeks, continue: more }) }),
  piece: (id: string) => call<{ piece: PieceView }>(`/api/pieces/${id}`),
  comments: (id: string) => call<PieceComments>(`/api/pieces/${id}/comments`),
  addComment: (id: string, text: string) => call<PieceComments>(`/api/pieces/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
  deleteComment: (id: string, commentId: number) => call<PieceComments>(`/api/pieces/${id}/comments/${commentId}`, { method: "DELETE" }),
  sendEdits: (id: string) => call<PieceComments>(`/api/pieces/${id}/send-edits`, { method: "POST", body: "{}" }),
  restoreVersion: (id: string, versionId: number) => call<{ piece: PieceView }>(`/api/pieces/${id}/versions/${versionId}/restore`, { method: "POST", body: "{}" }),
  approvePiece: (id: string, channels: string[]) => call<{ piece: PieceView }>(`/api/pieces/${id}/approve`, { method: "POST", body: JSON.stringify({ channels }) }),
  unapprovePiece: (id: string) => call<{ piece: PieceView }>(`/api/pieces/${id}/approve`, { method: "DELETE" }),
  markPosted: (id: string) => call<{ entry: EntryView }>(`/api/calendar/${id}/posted`, { method: "POST", body: "{}" }),
  accounts: () => call<{ accounts: AccountView[] | null }>("/api/accounts"),
  setLivePosting: (on: boolean) =>
    call<{ livePosting: boolean }>("/api/settings/live-posting", { method: "PUT", body: JSON.stringify({ on }) }),

  // Claude
  claudeStatus: () => call<ClaudeStatus>("/api/claude/status"),
  setClaude: (input: Partial<{ enabled: boolean; capCents: number }>) =>
    call<ClaudeStatus>("/api/settings/claude", { method: "PUT", body: JSON.stringify(input) }),
  style: () => call<{ style: StyleSetView }>("/api/style"),
  saveStyle: (input: Partial<{ colors: StyleColor[]; headingFont: string; bodyFont: string; vibe: string; dosDonts: string; logoAssetId: string | null }>) =>
    call<{ style: StyleSetView }>("/api/style", { method: "PUT", body: JSON.stringify(input) }),
  fonts: () => call<{ fonts: UploadedFont[] }>("/api/fonts"),
  uploadFont: (file: File, fields: { family: string; weight: number; italic: boolean }) => {
    const form = new FormData();
    form.append("family", fields.family);
    form.append("weight", String(fields.weight));
    form.append("italic", String(fields.italic));
    form.append("file", file);
    return call<{ font: UploadedFont }>("/api/fonts", { method: "POST", body: form });
  },
  removeInspiration: (id: string) => call<{ ok: true }>(`/api/inspiration/${id}`, { method: "DELETE" }),
  deleteFont: (id: string) => call<{ ok: true }>(`/api/fonts/${id}`, { method: "DELETE" }),
  approveStyle: () => call<{ style: StyleSetView }>("/api/style/approve", { method: "POST", body: "{}" }),
  assets: () => call<{ assets: AssetDetail[] }>("/api/assets"),
  setAssetRules: (id: string, input: Partial<{ peopleRule: AssetDetail["peopleRule"]; flagsCleared: boolean }>) =>
    call<{ asset: AssetDetail }>(`/api/assets/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  tagNewAssets: () => call<{ tagged: number; of: number; error: string | null; assets: AssetDetail[] }>("/api/assets/tag-new", { method: "POST", body: "{}" }),
  tagAsset: (id: string) => call<{ asset: AssetDetail }>(`/api/assets/${id}/tag`, { method: "POST", body: "{}" }),
  blurAsset: (id: string) => call<{ jobId: string }>(`/api/assets/${id}/blur`, { method: "POST", body: "{}" }),
  blurResult: (id: string, jobId: string) =>
    call<{ status: "pending" | "failed" | "done"; asset?: AssetDetail; error?: string }>(`/api/assets/${id}/blur/${jobId}`),
  feedback: (id: string) => call<{ feedback: FeedbackView[] }>(`/api/pieces/${id}/feedback`),
  addFeedback: (id: string, rating: 1 | -1, note: string) =>
    call<{ feedback: FeedbackView[] }>(`/api/pieces/${id}/feedback`, { method: "POST", body: JSON.stringify({ rating, note }) }),
  pieceRender: (id: string) => call<{ state: "done" | "pending" | "failed"; piece: PieceView }>(`/api/pieces/${id}/render`, { method: "POST", body: "{}" }),
  conversations: () => call<{ conversations: ConversationSummary[] }>("/api/conversations"),
  conversation: (id: string) => call<{ conversation: ConversationView }>(`/api/conversations/${id}`),
  decideProposal: (id: string, decision: "apply" | "dismiss") =>
    call<{ proposal: ProposalView }>(`/api/proposals/${id}/${decision}`, { method: "POST", body: "{}" }),

  // Online store
  store: () => call<{ store: StoreView | null }>("/api/store"),
  connectStore: (url: string) => call<{ store: StoreView | null }>("/api/store", { method: "PUT", body: JSON.stringify({ url }) }),
  refreshStore: () => call<{ store: StoreView | null }>("/api/store/refresh", { method: "POST", body: "{}" }),
  disconnectStore: () => call<{ store: null }>("/api/store", { method: "DELETE" }),

  // Strategy
  strategy: () => call<{ strategy: StrategyView }>("/api/strategy"),
  saveStrategy: (input: Partial<Pick<StrategyView, "links" | "times" | "pillars" | "summary">>) =>
    call<{ strategy: StrategyView }>("/api/strategy", { method: "PUT", body: JSON.stringify(input) }),
  approveStrategy: () => call<{ strategy: StrategyView }>("/api/strategy/approve", { method: "POST", body: "{}" }),
  suggestStrategy: () => call<{ strategy: StrategyView }>("/api/strategy/suggest", { method: "POST", body: "{}" }),

  // Ideas
  ideas: () => call<{ ideas: IdeaView[] }>("/api/ideas"),
  addIdea: (input: { title: string; pitch: string }) =>
    call<{ idea: IdeaView }>("/api/ideas", { method: "POST", body: JSON.stringify(input) }),
  updateIdea: (id: string, input: Partial<{ status: IdeaView["status"]; title: string; pitch: string }>) =>
    call<{ idea: IdeaView }>(`/api/ideas/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteIdea: (id: string) => call<{ ok: true }>(`/api/ideas/${id}`, { method: "DELETE" }),
};

// Packs come back as a zip; fetch it with the login pass and hand it to the
// browser as a download.
export async function downloadPack(entryId: string, filename: string): Promise<void> {
  const res = await fetch(`/api/calendar/${entryId}/pack`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? "The pack couldn't be made.", res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Ask Claude streams one JSON event per line while it works.
export async function askClaude(input: { conversationId: string | null; text: string }, onEvent: (e: AskEvent) => void, retry = true): Promise<void> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
  });
  if (res.status === 401 && retry) {
    await signIn();
    return askClaude(input, onEvent, false);
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(body.error ?? "Claude couldn't be reached.", res.status);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as AskEvent);
    }
  }
}

// An uploaded font as a data: address, for the Look sample (which can't send
// the sign-in pass itself).
const fontDataCache = new Map<string, Promise<string>>();
export function fontDataUrl(id: string): Promise<string> {
  if (!fontDataCache.has(id)) {
    fontDataCache.set(
      id,
      (async () => {
        const res = await fetch(`/api/fonts/${id}/file`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new ApiError("The font couldn't be loaded.", res.status);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
      })(),
    );
  }
  return fontDataCache.get(id)!;
}
