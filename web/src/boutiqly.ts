// Talking to Boutiqly from inside its frame, and to our own API.
import type { Me, TeamEntry } from "../../shared/roles.ts";

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
      ...(init.body ? { "content-type": "application/json" } : {}),
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
  setRole: (userId: string, role: "owner" | "team") =>
    call<{ team: TeamEntry[] }>(`/api/team/${encodeURIComponent(userId)}`, { method: "PUT", body: JSON.stringify({ role }) }),
  remove: (userId: string) =>
    call<{ team: TeamEntry[] }>(`/api/team/${encodeURIComponent(userId)}`, { method: "DELETE" }),
};
