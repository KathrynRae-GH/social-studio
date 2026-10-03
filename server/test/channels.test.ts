import { describe, expect, it } from "vitest";
import { CHANNELS, channelsFor, routeFor } from "../../shared/channels.ts";
import { utcToZoned, zonedToUtc } from "../../shared/time.ts";

describe("how each kind reaches each channel", () => {
  it.each([
    ["instagram", "post", "publish", "post"],
    ["instagram", "carousel", "publish", "post"],
    ["instagram", "reel", "app_ping", "reel"],
    ["instagram", "story", "app_ping", "story"],
    ["instagram", "story_set", "app_ping", "story"],
    ["facebook", "post", "publish", "post"],
    ["facebook", "reel", "share_from_ig", undefined],
    ["threads", "text", "publish", "post"],
    ["google", "google_update", "publish", "post"],
    ["youtube", "short", "publish", "post"],
    ["tiktok", "reel", "pack", undefined],
    ["x", "text", "pack", undefined],
    ["pinterest", "pin", "pack", undefined],
  ] as const)("%s %s → %s", (ch, kind, route, plannerType) => {
    expect(routeFor(ch, kind, true)).toEqual({ route, plannerType });
  });

  it("turns a Boutiqly route into a pack when the channel isn't connected", () => {
    const plan = routeFor("instagram", "post", false);
    expect(plan?.route).toBe("pack");
    expect(plan?.reason).toContain("isn't connected");
    // Packs and shares don't need a connection.
    expect(routeFor("tiktok", "reel", false)?.route).toBe("pack");
    expect(routeFor("facebook", "reel", false)?.route).toBe("share_from_ig");
  });

  it("refuses kinds a channel doesn't take", () => {
    expect(routeFor("instagram", "text", true)).toBeNull();
    expect(routeFor("facebook", "story", true)).toBeNull();
    expect(routeFor("nowhere", "post", true)).toBeNull();
  });

  it("lists the channels for a kind", () => {
    expect(channelsFor("text").map((c) => c.id)).toEqual(["facebook", "threads", "linkedin", "bluesky", "community", "x"]);
  });

  it("names every channel and gives it a caption limit", () => {
    for (const c of CHANNELS) {
      expect(c.name).toBeTruthy();
      expect(c.captionLimit).toBeGreaterThan(0);
      expect(Object.keys(c.kinds).length).toBeGreaterThan(0);
    }
  });
});

describe("shop time zone ↔ UTC", () => {
  it("converts Dallas time to UTC in summer and winter", () => {
    expect(zonedToUtc("2026-10-20", "09:00", "America/Chicago").toISOString()).toBe("2026-10-20T14:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", "America/Chicago").toISOString()).toBe("2026-12-01T15:00:00.000Z");
  });

  it("handles the days the clocks change", () => {
    // Nov 1, 2026: clocks go back at 2 am in Dallas.
    expect(zonedToUtc("2026-11-01", "09:00", "America/Chicago").toISOString()).toBe("2026-11-01T15:00:00.000Z");
    // Mar 8, 2026: clocks go forward.
    expect(zonedToUtc("2026-03-08", "09:00", "America/Chicago").toISOString()).toBe("2026-03-08T14:00:00.000Z");
  });

  it("round-trips back to the shop's local time", () => {
    for (const tz of ["America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London", "UTC"]) {
      const utc = zonedToUtc("2026-11-01", "18:30", tz);
      expect(utcToZoned(utc, tz)).toEqual({ date: "2026-11-01", time: "18:30" });
    }
  });

  it("rejects nonsense", () => {
    expect(() => zonedToUtc("soon", "9", "America/Chicago")).toThrow();
  });
});
