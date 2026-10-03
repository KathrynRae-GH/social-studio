// Every channel Social Studio writes for, what it takes, and how a post gets
// there. One table, so a new channel is one entry here.

export type Kind =
  | "post" // one image
  | "carousel" // several images
  | "story" // one 9:16 frame
  | "story_set" // several 9:16 frames, sent one ping per frame
  | "reel" // 9:16 video
  | "text" // words only
  | "short" // YouTube Short (9:16 video)
  | "pin" // vertical image with title and link
  | "google_update"; // Google Business Profile update

export const KIND_LABELS: Record<Kind, string> = {
  post: "Post",
  carousel: "Carousel",
  story: "Story",
  story_set: "Story set",
  reel: "Reel",
  text: "Text post",
  short: "Short",
  pin: "Pin",
  google_update: "Google update",
};

// How a calendar entry reaches its channel.
//  publish        Boutiqly's social planner posts it at the set time.
//  app_ping       Boutiqly pings the phone at the set time; the owner posts
//                 from Instagram (adds audio or stickers). One ping per frame.
//  pack           A ready-to-post pack (media + caption) to post by hand.
//  share_from_ig  The Facebook copy of a Reel: shared from Instagram.
export type Route = "publish" | "app_ping" | "pack" | "share_from_ig";

export type ChannelId =
  | "instagram"
  | "facebook"
  | "threads"
  | "linkedin"
  | "bluesky"
  | "community"
  | "google"
  | "youtube"
  | "pinterest"
  | "tiktok"
  | "x";

export type PlannerType = "post" | "story" | "reel";

interface KindRule {
  route: Route;
  plannerType?: PlannerType;
}

export interface Channel {
  id: ChannelId;
  name: string;
  // The `platform` value Boutiqly's social planner uses for connected
  // accounts, or null for channels it can't post to.
  plannerPlatform: string | null;
  captionLimit: number;
  maxMedia: number;
  sizes: string;
  kinds: Partial<Record<Kind, KindRule>>;
}

const IMAGE_POST = "4:5, 1080×1350";
const VERTICAL = "9:16, 1080×1920";

export const CHANNELS: Channel[] = [
  {
    id: "instagram",
    name: "Instagram",
    plannerPlatform: "instagram",
    captionLimit: 2200,
    maxMedia: 10,
    sizes: `Feed ${IMAGE_POST}; Stories and Reels ${VERTICAL}`,
    kinds: {
      post: { route: "publish", plannerType: "post" },
      carousel: { route: "publish", plannerType: "post" },
      reel: { route: "app_ping", plannerType: "reel" },
      story: { route: "app_ping", plannerType: "story" },
      story_set: { route: "app_ping", plannerType: "story" },
    },
  },
  {
    id: "facebook",
    name: "Facebook",
    plannerPlatform: "facebook",
    captionLimit: 63206,
    maxMedia: 10,
    sizes: IMAGE_POST,
    kinds: {
      post: { route: "publish", plannerType: "post" },
      carousel: { route: "publish", plannerType: "post" },
      text: { route: "publish", plannerType: "post" },
      reel: { route: "share_from_ig" },
    },
  },
  {
    id: "threads",
    name: "Threads",
    plannerPlatform: "threads",
    captionLimit: 500,
    maxMedia: 10,
    sizes: IMAGE_POST,
    kinds: {
      text: { route: "publish", plannerType: "post" },
      post: { route: "publish", plannerType: "post" },
      carousel: { route: "publish", plannerType: "post" },
    },
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    plannerPlatform: "linkedin",
    captionLimit: 3000,
    maxMedia: 9,
    sizes: IMAGE_POST,
    kinds: {
      text: { route: "publish", plannerType: "post" },
      post: { route: "publish", plannerType: "post" },
      carousel: { route: "publish", plannerType: "post" },
    },
  },
  {
    id: "bluesky",
    name: "Bluesky",
    plannerPlatform: "bluesky",
    captionLimit: 300,
    maxMedia: 4,
    sizes: IMAGE_POST,
    kinds: {
      text: { route: "publish", plannerType: "post" },
      post: { route: "publish", plannerType: "post" },
      carousel: { route: "publish", plannerType: "post" },
    },
  },
  {
    id: "community",
    name: "Boutiqly community",
    plannerPlatform: "community",
    captionLimit: 8000,
    maxMedia: 10,
    sizes: IMAGE_POST,
    kinds: {
      text: { route: "publish", plannerType: "post" },
      post: { route: "publish", plannerType: "post" },
      carousel: { route: "publish", plannerType: "post" },
    },
  },
  {
    id: "google",
    name: "Google Business Profile",
    plannerPlatform: "google",
    captionLimit: 1500,
    maxMedia: 1,
    sizes: "4:3, 1200×900",
    kinds: {
      google_update: { route: "publish", plannerType: "post" },
      post: { route: "publish", plannerType: "post" },
    },
  },
  {
    id: "youtube",
    name: "YouTube",
    plannerPlatform: "youtube",
    captionLimit: 5000,
    maxMedia: 1,
    sizes: `Shorts ${VERTICAL}`,
    kinds: {
      short: { route: "publish", plannerType: "post" },
      reel: { route: "publish", plannerType: "post" },
    },
  },
  {
    // Boutiqly can post pins once a board is picked; until the tab can pick
    // boards, pins go out as ready-to-post packs.
    id: "pinterest",
    name: "Pinterest",
    plannerPlatform: null,
    captionLimit: 800,
    maxMedia: 1,
    sizes: "2:3, 1000×1500",
    kinds: {
      pin: { route: "pack" },
      post: { route: "pack" },
    },
  },
  {
    // Boutiqly can only post TikToks without sound, so TikToks are posted by
    // hand from the phone with a sound.
    id: "tiktok",
    name: "TikTok",
    plannerPlatform: null,
    captionLimit: 2200,
    maxMedia: 35,
    sizes: VERTICAL,
    kinds: {
      reel: { route: "pack" },
      short: { route: "pack" },
      carousel: { route: "pack" },
    },
  },
  {
    id: "x",
    name: "X",
    plannerPlatform: null,
    captionLimit: 280,
    maxMedia: 4,
    sizes: "16:9 or 1:1",
    kinds: {
      text: { route: "pack" },
      post: { route: "pack" },
      carousel: { route: "pack" },
      reel: { route: "pack" },
    },
  },
];

const BY_ID = new Map(CHANNELS.map((c) => [c.id, c]));

export function channel(id: string): Channel | undefined {
  return BY_ID.get(id as ChannelId);
}

export function channelsFor(kind: Kind): Channel[] {
  return CHANNELS.filter((c) => c.kinds[kind]);
}

export interface RoutePlan {
  route: Route;
  plannerType?: PlannerType;
  reason?: string; // why it isn't going out through Boutiqly, in plain words
}

// How one piece reaches one channel. `connected` says whether the shop has
// that channel connected in Boutiqly's social planner; if it hasn't, a post
// that Boutiqly would have sent becomes a ready-to-post pack.
export function routeFor(channelId: string, kind: Kind, connected: boolean): RoutePlan | null {
  const c = channel(channelId);
  const rule = c?.kinds[kind];
  if (!c || !rule) return null;
  if ((rule.route === "publish" || rule.route === "app_ping") && !connected) {
    return { route: "pack", reason: `${c.name} isn't connected in Boutiqly's social planner yet.` };
  }
  return { route: rule.route, plannerType: rule.plannerType };
}

export const ROUTE_LABELS: Record<Route, string> = {
  publish: "Boutiqly posts it",
  app_ping: "App ping to your phone",
  pack: "Ready-to-post pack",
  share_from_ig: "Share from Instagram",
};

// Calendar statuses, in order.
export type EntryStatus = "suggested" | "approved" | "scheduled" | "posted" | "needs_attention";

export const STATUS_LABELS: Record<EntryStatus, string> = {
  suggested: "Suggested",
  approved: "Approved",
  scheduled: "Scheduled",
  posted: "Posted",
  needs_attention: "Needs attention",
};
