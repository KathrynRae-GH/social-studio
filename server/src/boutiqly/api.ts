// Talking to Boutiqly's API for one sub-account. Every call uses that
// sub-account's own install token, so a client can only ever see or change
// that one shop.
import type { Db } from "../db/pool.ts";
import type { Config } from "../config.ts";
import { locationAccessToken } from "./installs.ts";

export class NotInstalledError extends Error {}

export class BoutiqlyError extends Error {
  readonly status: number;
  // Boutiqly's raw reply (trimmed), for the server log only. Never holds our token.
  readonly detail: string;
  constructor(message: string, status: number, detail = "") {
    super(message);
    this.status = status;
    this.detail = detail.slice(0, 1000);
  }
}

type Fetch = typeof fetch;

export interface BoutiqlyUser {
  id: string;
  name: string;
  email: string;
  isAgency: boolean;
}

export interface SocialAccount {
  id: string; // what the planner's accountIds take
  platform: string; // instagram, facebook, threads…
  name: string;
  avatar: string;
  expired: boolean;
}

export interface PlannerPostInput {
  accountIds: string[];
  summary: string;
  media: { url: string; type: string; altText?: string }[];
  status: "scheduled" | "draft";
  scheduleDate: string; // ISO, UTC
  type: "post" | "story" | "reel";
  userId: string;
  instagramPostDetails?: { type: "post" | "story" | "reel"; publishViaPushNotification?: boolean; publisherNote?: string };
  facebookPostDetails?: { type: "post" | "story" | "reel" };
  youtubePostDetails?: { type: "video" | "short"; title: string; privacyLevel?: "public" | "private" | "unlisted" };
  gmbPostDetails?: { gmbEventType: "STANDARD" | "EVENT" | "OFFER"; url?: string; actionType?: string };
}

export type PlannerStatus =
  | "draft"
  | "scheduled"
  | "in_review"
  | "published"
  | "in_progress"
  | "pending"
  | "failed"
  | "notification_sent"
  | "deleted";

interface RawUser {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  deleted?: boolean;
  roles?: { type?: string };
}

interface RawAccount {
  id?: string;
  _id?: string;
  platform?: string;
  name?: string;
  avatar?: string;
  isExpired?: boolean;
  expire?: string;
  deleted?: boolean;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/mov",
  webm: "video/webm",
};

// The media types Boutiqly's planner accepts.
export function plannerMediaType(mime: string, url = ""): string {
  if (mime === "video/quicktime") return "video/mov";
  if (Object.values(MIME_BY_EXT).includes(mime)) return mime;
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? mime;
}

export function boutiqlyClient(db: Db, config: Config, locationId: string, companyId: string, fetchImpl: Fetch = fetch) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await locationAccessToken(db, config, locationId, companyId, fetchImpl);
    if (!token) throw new NotInstalledError("Social Studio isn't installed in this sub-account yet.");
    const isForm = body instanceof FormData;
    const res = await fetchImpl(`${config.boutiqly.apiBase}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        version: "2021-07-28",
        accept: "application/json",
        ...(body !== undefined && !isForm ? { "content-type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(isForm ? 120_000 : 15_000),
    });
    const text = await res.text();
    if (!res.ok) {
      // Boutiqly's own error message is useful to the owner (e.g. a caption too
      // long). It never contains our token.
      let message = `Boutiqly said no (${res.status})`;
      try {
        const parsed = JSON.parse(text) as { message?: string | string[] };
        if (parsed.message) message = Array.isArray(parsed.message) ? parsed.message.join("; ") : parsed.message;
      } catch {
        /* not JSON */
      }
      throw new BoutiqlyError(message, res.status, text);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  return {
    // Everyone with a login to this sub-account, as Boutiqly lists them.
    async listUsers(): Promise<BoutiqlyUser[]> {
      const data = await request<{ users?: RawUser[] }>("GET", `/users/?locationId=${encodeURIComponent(locationId)}`);
      return (data.users ?? [])
        .filter((u) => u.id && !u.deleted)
        .map((u) => ({
          id: u.id!,
          name: (u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Unnamed user").trim(),
          email: u.email ?? "",
          isAgency: (u.roles?.type ?? "").toLowerCase() === "agency",
        }));
    },

    async getLocation(): Promise<{ name: string | null; timezone: string | null }> {
      const data = await request<{ location?: { name?: string; timezone?: string } }>(
        "GET",
        `/locations/${encodeURIComponent(locationId)}`,
      );
      return { name: data.location?.name?.trim() || null, timezone: data.location?.timezone?.trim() || null };
    },

    // The social accounts connected in Boutiqly's social planner.
    async listSocialAccounts(): Promise<SocialAccount[]> {
      const data = await request<{ results?: { accounts?: RawAccount[] } }>(
        "GET",
        `/social-media-posting/${encodeURIComponent(locationId)}/accounts`,
      );
      return (data.results?.accounts ?? [])
        .filter((a) => (a.id || a._id) && !a.deleted)
        .map((a) => ({
          id: (a.id || a._id)!,
          platform: (a.platform ?? "").toLowerCase(),
          name: a.name ?? "",
          avatar: a.avatar ?? "",
          expired: !!a.isExpired || (!!a.expire && Date.parse(a.expire) < Date.now()),
        }));
    },

    async createPost(input: PlannerPostInput): Promise<string> {
      const data = await request<{ results?: { post?: { _id?: string; id?: string }; _id?: string; id?: string } }>(
        "POST",
        `/social-media-posting/${encodeURIComponent(locationId)}/posts`,
        input,
      );
      const r = data.results;
      const id = r?.post?._id ?? r?.post?.id ?? r?._id ?? r?.id;
      if (!id) throw new BoutiqlyError("Boutiqly didn't say which post it created", 502, JSON.stringify(data));
      return id;
    },

    async getPost(postId: string): Promise<{ status: PlannerStatus | string; error: string | null }> {
      const data = await request<{ results?: { post?: { status?: string; error?: string } } }>(
        "GET",
        `/social-media-posting/${encodeURIComponent(locationId)}/posts/${encodeURIComponent(postId)}`,
      );
      return { status: data.results?.post?.status ?? "unknown", error: data.results?.post?.error ?? null };
    },

    // The "Social Studio" folder in this sub-account's media storage.
    async createFolder(name: string): Promise<string> {
      const data = await request<{ _id?: string; id?: string }>("POST", "/medias/folder", {
        altId: locationId,
        altType: "location",
        name,
      });
      const id = data._id ?? data.id;
      if (!id) throw new BoutiqlyError("Boutiqly didn't return the new folder", 502);
      return id;
    },

    async uploadFile(file: Blob, name: string, folderId: string | null): Promise<{ fileId: string | null; url: string }> {
      const form = new FormData();
      form.append("file", file, name);
      form.append("name", name);
      form.append("hosted", "false");
      if (folderId) form.append("parentId", folderId);
      const data = await request<{ fileId?: string; _id?: string; url?: string }>("POST", "/medias/upload-file", form);
      if (!data.url) throw new BoutiqlyError("Boutiqly didn't return the uploaded file's address", 502);
      return { fileId: data.fileId ?? data._id ?? null, url: data.url };
    },
  };
}

export type BoutiqlyClient = ReturnType<typeof boutiqlyClient>;
