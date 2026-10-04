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
  onCalendar: { channel: string; status: EntryStatus }[];
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

export interface DraftResult {
  entry: EntryView;
  alreadySent: boolean;
}

export interface ApproveResult {
  entry: EntryView;
  dryRun?: unknown[]; // what would have been sent, when live posting is off
}
