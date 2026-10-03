// What the server sends the tab for the Library, Calendar and Ideas.
import type { EntryStatus, Kind, Route } from "./channels.ts";

export interface AssetView {
  id: string;
  url: string;
  mime: string;
  name: string;
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

export interface ApproveResult {
  entry: EntryView;
  dryRun?: unknown[]; // what would have been sent, when live posting is off
}
