// The shop's strategy (Brand → Strategy): when to post on each network and
// what to post about (content pillars). Claude suggests; people edit and approve.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export const DAY_LABELS: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export interface PostingSlot {
  days: Day[];
  time: string; // HH:MM, shop's local time
}

export interface ChannelTimes {
  slots: PostingSlot[]; // up to 3, best first
  why: string;
}

export interface Pillar {
  id: string; // short slug, stable once posts use it
  name: string;
  description: string;
  why: string;
  share: number; // target % of posts
  examples: string[];
}

export interface StrategyLink {
  channel: string; // a channel id, or "website" / "other"
  url: string;
}

export interface StrategyView {
  links: StrategyLink[];
  connected: { channel: string; name: string }[]; // accounts in Boutiqly's social planner
  summary: string;
  times: Record<string, ChannelTimes>; // by channel id
  pillars: Pillar[];
  status: "none" | "draft" | "approved";
  approvedBy: string | null;
  approvedAt: string | null;
  suggesting: boolean; // Claude is working on a suggestion
  suggestError: string | null;
  suggestedAt: string | null;
  mix: Record<string, number>; // posts per pillar id in the last 30 days (plus "none")
}

export const MAX_PILLARS = 6;
export const MAX_SLOTS = 3;

export function slotLabel(s: PostingSlot): string {
  const d = s.days;
  const weekdays = ["mon", "tue", "wed", "thu", "fri"];
  const days =
    d.length === 7 ? "Every day" : d.length === 5 && weekdays.every((x) => d.includes(x as Day)) ? "Weekdays" : d.length === 2 && d.includes("sat") && d.includes("sun") ? "Weekends" : d.map((x) => DAY_LABELS[x]).join(", ");
  const [h, m] = s.time.split(":").map(Number) as [number, number];
  return `${days}, ${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
