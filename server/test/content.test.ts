import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import { people, signInAs, testApp } from "./helpers.ts";

// ---- A stand-in for Boutiqly's API that records everything sent to it ----
interface Sent {
  path: string;
  body: Record<string, unknown>;
}
let posts: Sent[] = [];
let uploads = 0;
let folders = 0;
let failPostNumber: number | null = null;
const postStatus = new Map<string, string>();

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const fakeBoutiqly = (async (url: string, init: RequestInit = {}) => {
  const path = url.replace("https://api.test", "");
  if (path === "/oauth/token") {
    return json({ access_token: "tok", refresh_token: "ref", expires_in: 86_400, userType: "Location", companyId: "co_boutiqly", locationId: "loc_test_1" });
  }
  if (path === "/locations/loc_test_1") return json({ location: { name: "Test Boutique", timezone: "America/Chicago" } });
  if (path === "/social-media-posting/loc_test_1/accounts") {
    return json({
      results: {
        accounts: [
          { id: "acc_ig", platform: "instagram", name: "@testboutique" },
          { id: "acc_fb", platform: "facebook", name: "Test Boutique" },
          { id: "acc_th", platform: "threads", name: "@testboutique" },
          { id: "acc_li", platform: "linkedin", name: "Test Boutique", isExpired: true },
        ],
      },
    });
  }
  if (path === "/social-media-posting/loc_test_1/posts" && init.method === "POST") {
    const n = posts.length + 1;
    if (failPostNumber === n) {
      failPostNumber = null;
      return json({ message: "Instagram is busy, try again" }, 422);
    }
    posts.push({ path, body: JSON.parse(String(init.body)) });
    return json({ success: true, results: { post: { _id: `post_${n}` } } }, 201);
  }
  const postMatch = path.match(/^\/social-media-posting\/loc_test_1\/posts\/(.+)$/);
  if (postMatch) return json({ results: { post: { status: postStatus.get(postMatch[1]!) ?? "scheduled" } } });
  if (path === "/medias/folder") {
    folders++;
    return json({ _id: "folder_1" });
  }
  if (path === "/medias/upload-file") {
    uploads++;
    return json({ fileId: `file_${uploads}`, url: `https://cdn.test/file_${uploads}.jpg` });
  }
  if (url.startsWith("https://cdn.test/")) return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  return new Response("not found", { status: 404 });
}) as unknown as typeof fetch;

let t: Awaited<ReturnType<typeof testApp>>;
let agency: Awaited<ReturnType<typeof signInAs>>;

beforeEach(async () => {
  if (t) await t.pool.end();
  posts = [];
  uploads = 0;
  folders = 0;
  failPostNumber = null;
  postStatus.clear();
  t = await testApp(fakeBoutiqly);
  await t.app.inject({ url: "/oauth/callback?code=abc" });
  agency = await signInAs(t.app, people.agency);
});
afterAll(async () => {
  await t?.pool.end();
});

function multipart(filename: string, mime: string, content: string) {
  const boundary = "----socialstudio";
  const body =
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--\r\n`;
  return { payload: body, headers: { ...agency.headers, "content-type": `multipart/form-data; boundary=${boundary}` } };
}

async function upload(name = "photo.jpg", mime = "image/jpeg") {
  const res = await t.app.inject({ method: "POST", url: "/api/assets", ...multipart(name, mime, "fake image bytes") });
  expect(res.statusCode).toBe(200);
  return res.json().asset as { id: string; url: string };
}

async function piece(kind: string, assetIds: string[], captions: Record<string, string> = {}) {
  const res = await t.app.inject({ method: "POST", url: "/api/pieces", headers: agency.headers, payload: { kind, title: `Test ${kind}`, assetIds } });
  expect(res.statusCode).toBe(200);
  const id = res.json().piece.id as string;
  for (const [ch, text] of Object.entries(captions)) {
    await t.app.inject({ method: "PUT", url: `/api/pieces/${id}/captions/${ch}`, headers: agency.headers, payload: { text, altText: "A sunny shop window" } });
  }
  return id;
}

const approvePiece = (id: string, channels: string[], headers = agency.headers) =>
  t.app.inject({ method: "POST", url: `/api/pieces/${id}/approve`, headers, payload: { channels } });

// Approves the post for these networks, then puts it on the calendar.
async function schedule(pieceId: string, channels: string[], date = "2030-10-20", time = "09:00") {
  const ok = await approvePiece(pieceId, channels);
  expect(ok.statusCode, ok.body).toBe(200);
  const res = await t.app.inject({ method: "POST", url: "/api/calendar", headers: agency.headers, payload: { pieceId, channels, date, time } });
  expect(res.statusCode, res.body).toBe(200);
  return res.json().entries as { id: string; channel: string; route: string; status: string }[];
}

const lock = (id: string, locked = true, headers = agency.headers) => t.app.inject({ method: "POST", url: `/api/calendar/${id}/lock`, headers, payload: { locked } });
const send = (headers = agency.headers) => t.app.inject({ method: "POST", url: "/api/calendar/send", headers });
// Locks the entries and sends everything locked.
async function lockAndSend(...ids: string[]) {
  for (const id of ids) expect((await lock(id)).statusCode).toBe(200);
  const res = await send();
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}
const entryById = async (id: string) =>
  (await t.app.inject({ url: "/api/calendar?from=2000-01-01&to=2100-01-01", headers: agency.headers })).json().entries.find((e: { id: string }) => e.id === id);
const goLive = (on = true, headers = agency.headers) => t.app.inject({ method: "PUT", url: "/api/settings/live-posting", headers, payload: { on } });

describe("library", () => {
  it("uploads into a Social Studio folder in Boutiqly media storage, made once", async () => {
    const a = await upload();
    await upload("two.jpg");
    expect(a.url).toBe("https://cdn.test/file_1.jpg");
    expect(folders).toBe(1);
    expect(uploads).toBe(2);
  });

  it("refuses files that aren't photos or videos", async () => {
    const res = await t.app.inject({ method: "POST", url: "/api/assets", ...multipart("notes.pdf", "application/pdf", "x") });
    expect(res.statusCode).toBe(400);
  });

  it("keeps each shop's library to itself", async () => {
    const a = await upload();
    await piece("post", [a.id], { instagram: "Hello" });
    const elsewhere = await signInAs(t.app, { ...people.agency, activeLocation: "loc_other" });
    expect((await t.app.inject({ url: "/api/pieces", headers: elsewhere.headers })).json().pieces).toEqual([]);
    // And can't borrow this shop's files.
    const res = await t.app.inject({ method: "POST", url: "/api/pieces", headers: elsewhere.headers, payload: { kind: "post", assetIds: [a.id] } });
    expect(res.statusCode).toBe(400);
  });

  it("shows captions per channel", async () => {
    const a = await upload();
    const id = await piece("post", [a.id], { instagram: "Hello IG", facebook: "Hello FB" });
    const p = (await t.app.inject({ url: `/api/pieces/${id}`, headers: agency.headers })).json().piece;
    expect(p.captions.instagram).toEqual({ text: "Hello IG", altText: "A sunny shop window", status: "draft" });
    expect(p.assets).toHaveLength(1);
  });
});

describe("approving in the Library", () => {
  it("approves for the ticked networks and makes those captions final", async () => {
    const a = await upload();
    const id = await piece("post", [a.id], { instagram: "Hi", facebook: "Hi there" });
    const res = await approvePiece(id, ["instagram", "facebook", "youtube"]); // a post can't go to YouTube: ignored
    expect(res.statusCode).toBe(200);
    expect(res.json().piece.approval).toMatchObject({ by: "Katy Agency", channels: ["instagram", "facebook"] });
    expect(res.json().piece.captions.instagram.status).toBe("final");
    const log = await t.pool.query("SELECT action FROM audit_log WHERE action = 'piece.approve'");
    expect(log.rowCount).toBe(1);
  });

  it("won't approve what can't be posted", async () => {
    const noPhoto = await piece("post", [], { instagram: "Hi" });
    expect((await approvePiece(noPhoto, ["instagram"])).json().error).toContain("Add a photo");
    const long = await piece("text", [], { threads: "x".repeat(501) });
    expect((await approvePiece(long, ["threads"])).json().error).toContain("limit is 500");
    const none = await piece("text", [], { threads: "hi" });
    expect((await approvePiece(none, [])).statusCode).toBe(400);
  });

  it("only approved posts go on the calendar, and only to approved networks", async () => {
    const id = await piece("text", [], { threads: "hi", facebook: "hi" });
    const add = (channels: string[]) => t.app.inject({ method: "POST", url: "/api/calendar", headers: agency.headers, payload: { pieceId: id, channels, date: "2030-10-20", time: "09:00" } });
    expect((await add(["threads"])).json().error).toContain("Approve the post");
    await approvePiece(id, ["threads"]);
    expect((await add(["facebook"])).json().error).toContain("isn't approved for Facebook");
    expect((await add(["threads"])).statusCode).toBe(200);
  });

  it("undo takes it off the calendar, unless something's locked or sent", async () => {
    const id = await piece("text", [], { threads: "hi", facebook: "hi" });
    const [threads] = await schedule(id, ["threads", "facebook"]);
    await lock(threads!.id);
    const undo = () => t.app.inject({ method: "DELETE", url: `/api/pieces/${id}/approve`, headers: agency.headers });
    expect((await undo()).statusCode).toBe(400);
    // Dropping a locked network isn't allowed either; dropping an unlocked one removes its spot.
    expect((await approvePiece(id, ["facebook"])).statusCode).toBe(400);
    expect((await approvePiece(id, ["threads"])).statusCode).toBe(200);
    expect((await t.pool.query("SELECT channel FROM calendar_entries")).rows).toEqual([{ channel: "threads" }]);
    await lock(threads!.id, false);
    const res = await undo();
    expect(res.json().piece).toMatchObject({ approval: null, onCalendar: [] });
    expect(res.json().piece.captions.threads.status).toBe("draft");
  });

  it("lets the shop's owner approve, but not people without access", async () => {
    const id = await piece("text", [], { threads: "hi" });
    const other = await signInAs(t.app, people.other);
    expect((await approvePiece(id, ["threads"], other.headers)).statusCode).toBe(403);
    const owner = await signInAs(t.app, people.owner);
    await t.pool.query("INSERT INTO team_members (brand_id, user_id, role, added_by) SELECT id, 'u_owner', 'owner', 'u_agency' FROM brands");
    expect((await approvePiece(id, ["threads"], owner.headers)).statusCode).toBe(200);
  });
});

describe("calendar", () => {
  it("picks how each channel gets the post, from what's connected", async () => {
    const a = await upload();
    const id = await piece("post", [a.id], { instagram: "Hi", linkedin: "Hi", x: "Hi" });
    const entries = await schedule(id, ["instagram", "linkedin", "x"]);
    expect(Object.fromEntries(entries.map((e) => [e.channel, e.route]))).toEqual({
      instagram: "publish",
      linkedin: "pack", // connected but expired
      x: "pack",
    });
    expect(entries.every((e) => e.status === "approved")).toBe(true);
  });

  it("refuses a kind the channel doesn't take", async () => {
    const id = await piece("text", [], { instagram: "words" });
    const res = await t.app.inject({ method: "POST", url: "/api/calendar", headers: agency.headers, payload: { pieceId: id, channels: ["instagram"], date: "2030-10-20", time: "09:00" } });
    expect(res.statusCode).toBe(400);
  });

  it("warns about accounts that need reconnecting, and counts approved posts waiting for a date", async () => {
    const id = await piece("text", [], { threads: "hi", facebook: "hi" });
    await approvePiece(id, ["threads", "facebook"]);
    const cal = (await t.app.inject({ url: "/api/calendar", headers: agency.headers })).json();
    expect(cal.timezone).toBe("America/Chicago");
    expect(cal.notices.join(" ")).toContain("LinkedIn (Test Boutique) needs reconnecting");
    expect(cal.waiting).toBe(2);
  });
});

describe("locking", () => {
  it("locked entries can't be moved or removed until unlocked", async () => {
    const id = await piece("text", [], { threads: "hi" });
    const [entry] = await schedule(id, ["threads"]);
    expect((await lock(entry!.id)).json().entry.locked).toBe(true);
    const move = () => t.app.inject({ method: "PATCH", url: `/api/calendar/${entry!.id}`, headers: agency.headers, payload: { date: "2030-11-01", time: "10:00" } });
    expect((await move()).json().error).toContain("locked");
    expect((await t.app.inject({ method: "DELETE", url: `/api/calendar/${entry!.id}`, headers: agency.headers })).statusCode).toBe(400);
    await lock(entry!.id, false);
    expect((await move()).statusCode).toBe(200);
  });

  it("Lock all locks every planned entry still to come", async () => {
    const id = await piece("text", [], { threads: "hi", facebook: "hi" });
    await schedule(id, ["threads", "facebook"]);
    const res = await t.app.inject({ method: "POST", url: "/api/calendar/lock-all", headers: agency.headers });
    expect(res.json().locked).toBe(2);
  });
});

describe("send while live posting is off", () => {
  it("sends only locked entries, as drafts, and never the same one twice", async () => {
    const a = await upload();
    const id = await piece("post", [a.id], { instagram: "Fall sale Saturday", facebook: "Fall sale" });
    const [ig, fb] = await schedule(id, ["instagram", "facebook"]);
    const first = await lockAndSend(ig!.id);
    expect(first).toMatchObject({ live: false, drafted: 1, scheduled: 0, problems: [] });
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toEqual({
      accountIds: ["acc_ig"],
      status: "draft",
      userId: "u_agency",
      summary: "Fall sale Saturday",
      media: [{ url: a.url, type: "image/jpeg", altText: "A sunny shop window" }],
      type: "post",
      scheduleDate: "2030-10-20T14:00:00.000Z", // 9 am Dallas time
      instagramPostDetails: { type: "post" },
    });
    expect(await entryById(ig!.id)).toMatchObject({ status: "approved", locked: true, draftsSent: 1 });
    expect((await entryById(fb!.id)).draftsSent).toBe(0); // not locked: not sent

    const again = (await send()).json();
    expect(again).toMatchObject({ drafted: 0, alreadySent: 1 });
    expect(posts).toHaveLength(1);
  });

  it("makes one draft per Story frame and only resends the missing ones", async () => {
    const frames = [await upload("1.jpg"), await upload("2.jpg"), await upload("3.jpg")];
    const id = await piece("story_set", frames.map((f) => f.id));
    const [entry] = await schedule(id, ["instagram"]);
    failPostNumber = 2;
    const first = await lockAndSend(entry!.id);
    expect(first.problems[0].message).toContain("Frame 2 of 3 didn't go through: Instagram is busy, try again");
    const second = (await send()).json();
    expect(second.drafted).toBe(1);
    expect(await entryById(entry!.id)).toMatchObject({ draftsSent: 3, lastError: null });
    expect(posts).toHaveLength(3);
    expect(posts.every((p) => p.body.status === "draft")).toBe(true);
  });

  it("counts packs as by hand, and refuses people without access", async () => {
    const id = await piece("text", [], { x: "hi" });
    const [pack] = await schedule(id, ["x"]);
    expect((await lockAndSend(pack!.id)).byHand).toBe(1);
    const other = await signInAs(t.app, people.other);
    expect((await send(other.headers)).statusCode).toBe(403);
    expect(posts).toHaveLength(0);
  });
});

describe("live posting", () => {
  it("can only be switched by Boutiqly's team", async () => {
    const owner = await signInAs(t.app, people.owner);
    await t.app.inject({ method: "PUT", url: "/api/team/u_owner", headers: agency.headers, payload: { role: "owner" } });
    expect((await goLive(true, owner.headers)).statusCode).toBe(403);
    expect((await goLive(true)).statusCode).toBe(200);
    const log = await t.pool.query("SELECT action FROM audit_log WHERE action LIKE 'posting.%'");
    expect(log.rows).toEqual([{ action: "posting.live_on" }]);
  });

  it("schedules a locked feed post in Boutiqly's planner, once", async () => {
    await goLive();
    const a = await upload();
    const id = await piece("post", [a.id], { instagram: "Hello" });
    const [entry] = await schedule(id, ["instagram"]);
    expect(await lockAndSend(entry!.id)).toMatchObject({ live: true, scheduled: 1 });
    expect(await entryById(entry!.id)).toMatchObject({ status: "scheduled", sentFrames: 1 });
    expect(posts[0]!.body).toMatchObject({ accountIds: ["acc_ig"], status: "scheduled", scheduleDate: "2030-10-20T14:00:00.000Z" });
    expect((await send()).json().scheduled).toBe(0);
    expect(posts).toHaveLength(1);
    expect((await lock(entry!.id, false)).statusCode).toBe(400); // sent: change it in Boutiqly
  });

  it("schedules drafts for real once live posting is on", async () => {
    const id = await piece("text", [], { threads: "hi" });
    const [entry] = await schedule(id, ["threads"]);
    await lockAndSend(entry!.id);
    await goLive();
    expect((await send()).json().scheduled).toBe(1);
    expect(posts.map((p) => p.body.status)).toEqual(["draft", "scheduled"]);
  });

  it("sends a Story set as one app ping per frame, a minute apart", async () => {
    await goLive();
    const frames = [await upload("1.jpg"), await upload("2.jpg"), await upload("3.jpg")];
    const id = await piece("story_set", frames.map((f) => f.id), { instagram: "Swipe up for hours" });
    const [entry] = await schedule(id, ["instagram"]);
    await lockAndSend(entry!.id);
    expect(posts.map((p) => p.body.scheduleDate)).toEqual([
      "2030-10-20T14:00:00.000Z",
      "2030-10-20T14:01:00.000Z",
      "2030-10-20T14:02:00.000Z",
    ]);
    expect(posts[1]!.body).toMatchObject({
      type: "story",
      summary: "",
      instagramPostDetails: { type: "story", publishViaPushNotification: true, publisherNote: "Frame 2 of 3. Swipe up for hours" },
    });
  });

  it("only resends the missing frames after a half-sent Story set", async () => {
    await goLive();
    const frames = [await upload("1.jpg"), await upload("2.jpg"), await upload("3.jpg")];
    const id = await piece("story_set", frames.map((f) => f.id));
    const [entry] = await schedule(id, ["instagram"]);
    failPostNumber = 2;
    await lockAndSend(entry!.id);
    const first = await entryById(entry!.id);
    expect(first).toMatchObject({ status: "needs_attention", sentFrames: 1 });
    expect(first.lastError).toBe("Frame 2 of 3 didn't go through: Instagram is busy, try again");
    await send();
    expect(await entryById(entry!.id)).toMatchObject({ status: "scheduled", sentFrames: 3, lastError: null });
    expect(posts).toHaveLength(3);
  });

  it("sends a Reel as an app ping with the caption", async () => {
    await goLive();
    const v = await upload("reel.mp4", "video/mp4");
    const id = await piece("reel", [v.id], { instagram: "Behind the counter" });
    const [entry] = await schedule(id, ["instagram"]);
    await lockAndSend(entry!.id);
    expect(posts[0]!.body).toMatchObject({ type: "reel", summary: "Behind the counter", instagramPostDetails: { type: "reel", publishViaPushNotification: true } });
  });

  it("sends a text-only Threads post with an empty media list", async () => {
    await goLive();
    const id = await piece("text", [], { threads: "new stock is in. come say hi" });
    const [entry] = await schedule(id, ["threads"]);
    await lockAndSend(entry!.id);
    expect(posts[0]!.body).toMatchObject({ accountIds: ["acc_th"], media: [], summary: "new stock is in. come say hi" });
  });

  it("won't send something whose time has passed", async () => {
    await goLive();
    const id = await piece("text", [], { threads: "hi" });
    const [late] = await schedule(id, ["threads"], "2020-01-01", "09:00");
    const res = await lockAndSend(late!.id);
    expect(res.problems[0].message).toContain("time has passed");
    expect(posts).toHaveLength(0);
  });
});

describe("after it's sent", () => {
  it("moves entries to Posted or Needs attention as Boutiqly reports", async () => {
    await goLive();
    const id = await piece("text", [], { threads: "one", facebook: "one" });
    const [a, b] = await schedule(id, ["threads", "facebook"]);
    await lockAndSend(a!.id, b!.id);
    postStatus.set("post_1", "published");
    postStatus.set("post_2", "failed");
    // Pretend the posting time has passed.
    await t.pool.query("UPDATE calendar_entries SET scheduled_at = now() - interval '1 hour'; UPDATE brands SET synced_at = NULL");
    const cal = (await t.app.inject({ url: "/api/calendar?from=2000-01-01&to=2100-01-01", headers: agency.headers })).json();
    const byChannel = Object.fromEntries(cal.entries.map((e: { channel: string; status: string }) => [e.channel, e.status]));
    expect(byChannel).toEqual({ threads: "posted", facebook: "needs_attention" });
  });

  it("builds a ready-to-post pack with the files and a posting sheet", async () => {
    const v = await upload("clip.mp4", "video/mp4");
    const id = await piece("reel", [v.id], { tiktok: "POV: new arrivals" });
    const [entry] = await schedule(id, ["tiktok"]);
    expect(entry!.route).toBe("pack");
    await lock(entry!.id);
    const res = await t.app.inject({ url: `/api/calendar/${entry!.id}/pack`, headers: agency.headers });
    expect(res.headers["content-type"]).toBe("application/zip");
    const files = unzipSync(new Uint8Array(res.rawPayload));
    expect(Object.keys(files).sort()).toEqual(["POSTING SHEET.txt", "tiktok-2030-10-20-01.mp4"]);
    const sheet = strFromU8(files["POSTING SHEET.txt"]!);
    expect(sheet).toContain("Post on 2030-10-20 at 09:00 (America/Chicago)");
    expect(sheet).toContain("POV: new arrivals");
    expect(sheet).toContain("Add a sound in TikTok");
    // Marked posted by hand.
    expect((await t.app.inject({ method: "POST", url: `/api/calendar/${entry!.id}/posted`, headers: agency.headers })).json().entry.status).toBe("posted");
  });

  it("won't move or remove an entry that's already in the planner", async () => {
    await goLive();
    const id = await piece("text", [], { threads: "hi" });
    const [entry] = await schedule(id, ["threads"]);
    await lockAndSend(entry!.id);
    await t.pool.query("UPDATE calendar_entries SET locked_at = NULL"); // even if somehow unlocked
    expect((await t.app.inject({ method: "PATCH", url: `/api/calendar/${entry!.id}`, headers: agency.headers, payload: { date: "2030-11-01", time: "10:00" } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: "DELETE", url: `/api/calendar/${entry!.id}`, headers: agency.headers })).statusCode).toBe(400);
  });
});

describe("ideas", () => {
  it("adds, updates and removes ideas for this shop only", async () => {
    const created = (await t.app.inject({ method: "POST", url: "/api/ideas", headers: agency.headers, payload: { title: "Studio tour Reel", pitch: "Walk through the shop" } })).json().idea;
    expect(created).toMatchObject({ title: "Studio tour Reel", status: "later" });
    const updated = (await t.app.inject({ method: "PATCH", url: `/api/ideas/${created.id}`, headers: agency.headers, payload: { status: "now" } })).json().idea;
    expect(updated.status).toBe("now");
    const elsewhere = await signInAs(t.app, { ...people.agency, activeLocation: "loc_other" });
    expect((await t.app.inject({ method: "PATCH", url: `/api/ideas/${created.id}`, headers: elsewhere.headers, payload: { status: "done" } })).statusCode).toBe(404);
    await t.app.inject({ method: "DELETE", url: `/api/ideas/${created.id}`, headers: agency.headers });
    expect((await t.app.inject({ url: "/api/ideas", headers: agency.headers })).json().ideas).toEqual([]);
  });
});
