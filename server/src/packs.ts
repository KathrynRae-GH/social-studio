// Ready-to-post packs: for channels Boutiqly can't post to (TikTok, X,
// Pinterest for now) or that aren't connected yet. A zip with the files in
// order and a posting sheet with the caption, alt text and when to post.
import { zipSync, strToU8 } from "fflate";
import { channel, KIND_LABELS, type Kind } from "../../shared/channels.ts";
import { utcToZoned } from "../../shared/time.ts";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export function postingSheet(args: {
  channelId: string;
  kind: Kind;
  title: string;
  scheduledAt: Date;
  timezone: string;
  caption: string;
  altText: string;
  link: string;
  files: string[];
}): string {
  const c = channel(args.channelId);
  const when = utcToZoned(args.scheduledAt, args.timezone);
  const lines = [
    `${c?.name ?? args.channelId}: ${KIND_LABELS[args.kind]}${args.title ? ` · ${args.title}` : ""}`,
    `Post on ${when.date} at ${when.time} (${args.timezone})`,
    "",
    "Files, in order:",
    ...args.files.map((f, i) => `  ${i + 1}. ${f}`),
    "",
    "Caption:",
    args.caption || "(none)",
  ];
  if (args.altText) lines.push("", "Alt text:", args.altText);
  if (args.link) lines.push("", "Link:", args.link);
  if (args.channelId === "tiktok") lines.push("", "Add a sound in TikTok before posting.");
  lines.push("", "When it's posted, mark it Posted in Social Studio.");
  return lines.join("\n") + "\n";
}

export async function buildPack(
  args: Parameters<typeof postingSheet>[0] & { media: { url: string; mime: string }[] },
  fetchImpl: typeof fetch = fetch,
): Promise<Uint8Array> {
  const prefix = `${args.channelId}-${utcToZoned(args.scheduledAt, args.timezone).date}`;
  const files: Record<string, Uint8Array> = {};
  const names: string[] = [];
  for (const [i, m] of args.media.entries()) {
    const res = await fetchImpl(m.url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Couldn't fetch file ${i + 1} (${res.status})`);
    const name = `${prefix}-${String(i + 1).padStart(2, "0")}.${EXT_BY_MIME[m.mime] ?? "bin"}`;
    files[name] = new Uint8Array(await res.arrayBuffer());
    names.push(name);
  }
  files["POSTING SHEET.txt"] = strToU8(postingSheet({ ...args, files: names }));
  // Photos and videos are already compressed; storing them is faster.
  return zipSync(files, { level: 0 });
}
