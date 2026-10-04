// What the server sends the tab for the Library, Calendar and Ideas.
import type { EntryStatus, Kind, Route } from "./channels.ts";
import type { Design, SensitiveFlag } from "./design.ts";

export interface AssetView {
  id: string;
  url: string;
  mime: string;
  name: string;
}

// A file with what Claude saw in it and the owner's rules for it (Assets screen).
export interface AssetDetail extends AssetView {
  createdAt: string;
  description: string;
  tags: string[];
  hasPeople: boolean | null;
  possibleMinor: boolean;
  sensitive: SensitiveFlag[];
  flagsCleared: boolean;
  peopleRule: "ok" | "no_faces" | "dont_use";
  tagged: boolean;
  madeBy: "upload" | "render" | "blur";
  purpose: "content" | "inspiration";
  sourceAssetId: string | null;
  fromStore: boolean; // copied from the shop's online store
  usable: { ok: boolean; reason: string | null }; // can Claude design with it
}

// One person's verdict on a post.
export interface FeedbackView {
  rating: 1 | -1;
  note: string;
  by: string;
  at: string;
}

export interface CaptionView {
  text: string;
  altText: string;
  status: "draft" | "final";
}

export interface PieceView {
  id: string;
  kind: Kind;
  title: string;
  link: string;
  archived: boolean;
  assets: AssetView[];
  captions: Record<string, CaptionView>; // by channel id
  onCalendar: { channel: string; status: EntryStatus; locked: boolean }[];
  // Approved in the Library for these networks (captions there are final).
  approval: { at: string; by: string; channels: string[] } | null;
  updatedAt: string;
  source: "owner" | "claude";
  design: Design | null;
}

export interface EntryView {
  id: string;
  pieceId: string;
  pieceTitle: string;
  kind: Kind;
  channel: string;
  date: string; // shop's local date, YYYY-MM-DD
  time: string; // shop's local time, HH:MM
  scheduledAt: string; // ISO, UTC
  status: EntryStatus;
  locked: boolean; // locked in place: can't be moved, ready to send
  route: Route;
  preview: AssetView | null;
  caption: string;
  frames: number; // planner posts this entry becomes (Story set = one per frame)
  sentFrames: number;
  lastError: string | null;
  dryRun: boolean; // approved while live posting was off: nothing sent
  draftsSent: number; // drafts made in Boutiqly's social planner (they never publish)
  draftSentAt: string | null;
  routeNote: string | null;
}

export interface AccountView {
  id: string;
  platform: string;
  name: string;
  avatar: string;
  expired: boolean;
}

export interface CalendarData {
  timezone: string;
  livePosting: boolean;
  entries: EntryView[];
  waiting: number; // approved post-and-network pairs not on the calendar yet
  accounts: AccountView[] | null; // null when Boutiqly couldn't be reached
  notices: string[];
}

export interface IdeaView {
  id: string;
  title: string;
  pitch: string;
  format: string;
  status: "now" | "later" | "built" | "done";
  pieceId: string | null;
}

// What "Send to Boutiqly" did with the locked entries.
export interface SendResult {
  live: boolean; // live posting on: scheduled posts; off: drafts
  scheduled: number;
  drafted: number;
  alreadySent: number; // drafts sent before (live posting off)
  byHand: number; // packs and shares, posted by hand
  problems: { entryId: string; message: string }[];
}

// What "Plan my calendar" did.
export interface PlanResult {
  placed: number;
  from: string; // shop's local dates
  to: string;
  notPlaced: { pieceId: string; title: string; reason: string }[];
  note: string; // Claude's one-line summary of the plan
  costCents: number;
}

// A comment on a post for Claude to act on, and the post's earlier versions.
export interface CommentView {
  id: number;
  by: string;
  mine: boolean;
  text: string;
  status: "open" | "sent" | "done";
  at: string;
}

export interface VersionView {
  id: number;
  reason: string;
  by: string;
  at: string;
  preview: AssetView | null;
}

export interface PieceComments {
  comments: CommentView[];
  versions: VersionView[];
  editing: boolean; // Claude is working on the sent comments
  reply: string; // what Claude said it changed last time
  error: string | null;
}
