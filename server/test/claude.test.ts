import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { people, signInAs, testApp } from "./helpers.ts";
import Anthropic from "@anthropic-ai/sdk";
import { costCents, usageRows, type ClaudeApi, type ClaudeMessage, type StreamParams } from "../src/claude/client.ts";
import { usableInDesign } from "../src/assets.ts";

// ---- A stand-in for Boutiqly's API ----
let uploads = 0;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const fakeBoutiqly = (async (url: string) => {
  const path = url.replace("https://api.test", "");
  if (path === "/oauth/token") {
    return json({ access_token: "tok", refresh_token: "ref", expires_in: 86_400, userType: "Location", companyId: "co_boutiqly", locationId: "loc_test_1" });
  }
  if (path === "/locations/loc_test_1") return json({ location: { name: "Test Boutique", timezone: "America/Chicago" } });
  if (path === "/social-media-posting/loc_test_1/accounts") return json({ results: { accounts: [{ id: "acc_ig", platform: "instagram", name: "@tb" }] } });
  if (path === "/medias/folder") return json({ _id: "folder_1" });
  if (path === "/medias/upload-file") {
    uploads++;
    return json({ fileId: `file_${uploads}`, url: `https://cdn.test/file_${uploads}.png` });
  }
  if (url.startsWith("https://cdn.test/")) return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
  return new Response("not found", { status: 404 });
}) as unknown as typeof fetch;

// ---- A scripted stand-in for Claude ----
type Script = (params: StreamParams, call: number) => (Partial<ClaudeMessage> & { content: ClaudeMessage["content"] }) | Error;
let script: Script[] = [];
let calls: StreamParams[] = [];
const fakeClaude: ClaudeApi = {
  async send(params, onText) {
    calls.push(structuredClone(params));
    const step = script.shift();
    if (!step) throw new Error("No scripted reply left");
    const reply = step(params, calls.length);
    if (reply instanceof Error) throw reply;
    for (const b of reply.content) if (b.type === "text") onText?.(b.text);
    const speed = (params as { speed?: string }).speed === "fast" ? "fast" : "standard";
    return {
      id: `msg_${calls.length}`,
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      stop_reason: reply.content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: null, iterations: null, speed },
      ...reply,
    } as unknown as ClaudeMessage;
  },
};
const say = (text: string): Script => () => ({ content: [{ type: "text", text, citations: null }] as ClaudeMessage["content"] });
const useTool = (name: string, input: unknown, id = `tu_${name}`): Script => () => ({
  content: [{ type: "tool_use", id, name, input }] as unknown as ClaudeMessage["content"],
});

// ---- A stand-in for the worker: finishes render and blur jobs ----
let workerTimer: ReturnType<typeof setInterval> | null = null;
let renderedDocs: string[][] = [];
function startFakeWorker() {
  workerTimer = setInterval(() => void tick().catch(() => {}), 50);
  async function tick() {
    // Claim jobs first so two overlapping ticks never work on the same one.
    const { rows } = await t.pool.query("UPDATE jobs SET status = 'running' WHERE status = 'queued' RETURNING id, kind, payload");
    for (const job of rows) {
      const docs: string[] = job.kind === "render" ? job.payload.docs : ["blurred"];
      if (job.kind === "render") renderedDocs.push(docs);
      for (let i = 0; i < docs.length; i++) {
        await t.pool.query("INSERT INTO render_outputs (job_id, frame, mime, data) VALUES ($1, $2, 'image/png', $3)", [job.id, i, Buffer.from([137, 80, 78, 71, i])]);
      }
      await t.pool.query("UPDATE jobs SET status = 'done', result = '{}' WHERE id = $1", [job.id]);
    }
  }
}

let t: Awaited<ReturnType<typeof testApp>>;
let agency: Awaited<ReturnType<typeof signInAs>>;

beforeEach(async () => {
  if (t) await t.pool.end();
  uploads = 0;
  script = [];
  calls = [];
  renderedDocs = [];
  t = await testApp(fakeBoutiqly, fakeClaude);
  await t.app.inject({ url: "/oauth/callback?code=abc" });
  agency = await signInAs(t.app, people.agency);
  startFakeWorker();
});
afterEach(() => {
  if (workerTimer) clearInterval(workerTimer);
});
afterAll(async () => {
  await t?.pool.end();
});

const claudeOn = (body: Record<string, unknown> = { enabled: true }, headers = agency.headers) =>
  t.app.inject({ method: "PUT", url: "/api/settings/claude", headers, payload: body });

async function askRaw(text: string, conversationId?: string, headers = agency.headers) {
  const res = await t.app.inject({ method: "POST", url: "/api/ask", headers, payload: { text, conversationId } });
  const events = res.body.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { res, events };
}

async function upload(name = "photo.jpg") {
  const boundary = "----ss";
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/jpeg\r\n\r\nbytes\r\n--${boundary}--\r\n`;
  const res = await t.app.inject({ method: "POST", url: "/api/assets", payload: body, headers: { ...agency.headers, "content-type": `multipart/form-data; boundary=${boundary}` } });
  expect(res.statusCode).toBe(200);
  return res.json().asset.id as string;
}

async function markTagged(id: string, extra = "") {
  await t.pool.query(`UPDATE assets SET tagged_at = now(), description = 'Shop window' ${extra} WHERE id = $1`, [id]);
}

describe("the spend guard", () => {
  it("is off until Boutiqly's team turns it on, and only they can", async () => {
    const { events } = await askRaw("Hello");
    expect(events.find((e) => e.type === "error")?.message).toContain("isn't turned on");
    expect(calls).toHaveLength(0);

    await t.app.inject({ method: "PUT", url: "/api/team/u_owner", headers: agency.headers, payload: { role: "owner" } });
    const owner = await signInAs(t.app, people.owner);
    expect((await claudeOn({ enabled: true }, owner.headers)).statusCode).toBe(403);
    const res = await claudeOn({ enabled: true, capCents: 500 });
    expect(res.json()).toMatchObject({ enabled: true, capCents: 500, spentCents: 0, connected: true });
    const log = await t.pool.query("SELECT action FROM audit_log WHERE action = 'claude.settings'");
    expect(log.rowCount).toBe(1);
  });

  it("meters every call and pauses at the monthly limit", async () => {
    await claudeOn({ enabled: true, capCents: 1 });
    script = [say("Hi there")];
    const first = await askRaw("Hello");
    expect(first.events.map((e) => e.type)).toEqual(["start", "text", "done"]);
    const ledger = await t.pool.query("SELECT model, input_tokens, output_tokens, cost_cents, credits, purpose FROM usage_ledger");
    // 1,000 input at $4/M + 200 output at $20/M = 0.8 cents, doubled in fast mode = 1.6; credits are 2x.
    expect(ledger.rows).toEqual([{ model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 200, cost_cents: "1.6000", credits: "3.2000", purpose: "ask_claude" }]);

    script = [say("Again")];
    await askRaw("And again");
    // Now past 1 cent: the next one is refused before Claude is called.
    const before = calls.length;
    const third = await askRaw("One more");
    expect(third.events.find((e) => e.type === "error")?.message).toContain("this month's limit");
    expect(calls.length).toBe(before);
  });

  it("prices each model run at its own rates, including web searches", () => {
    const u = { model: "claude-opus-5-5", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0, webSearches: 10 };
    expect(costCents({ ...u, speed: "standard" })).toBeCloseTo(400 + 20 + 10, 6);
    // Fast mode doubles the tokens, not the web searches.
    expect(costCents({ ...u, speed: "fast" })).toBeCloseTo(800 + 40 + 10, 6);
    const rows = usageRows(
      {
        model: "claude-opus-4-8",
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          server_tool_use: { web_search_requests: 2, web_fetch_requests: 0 },
          iterations: [
            { type: "message", model: "claude-opus-5-5", input_tokens: 100, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
            { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
          ],
        },
      } as unknown as ClaudeMessage,
      "claude-opus-5-5",
    );
    expect(rows.map((r) => [r.model, r.outputTokens, r.webSearches])).toEqual([
      ["claude-opus-5-5", 10, 2],
      ["claude-opus-4-8", 50, 0],
    ]);
  });

  it("sends the configured model with adaptive thinking and the cached system prompt", async () => {
    await claudeOn();
    script = [say("Hi")];
    await askRaw("Hello");
    expect(calls[0]).toMatchObject({ model: "claude-opus-5-5", thinking: { type: "adaptive" }, fallbacks: "default", output_config: { effort: "xhigh" } });
    expect((calls[0]!.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: "ephemeral" });
  });
});

describe("making a real post", () => {
  const tagReply: Script = () => ({
    content: [{ type: "text", text: JSON.stringify({ description: "New sweaters on a rack", tags: ["sweater"], has_people: false, possible_minor: false, sensitive: [] }), citations: null }] as ClaudeMessage["content"],
  });

  it("looks at photos uploaded while Claude was off before listing them", async () => {
    const photo = await upload(); // uploaded while Claude is off: never tagged
    await claudeOn();
    script = [useTool("list_assets", {}), tagReply, say("Found it.")];
    const { events } = await askRaw("What photos do I have?");
    expect(events.some((e) => e.type === "status" && e.text.includes("Looking at 1 new photo"))).toBe(true);
    const listed = JSON.parse((calls[2]!.messages.at(-1)!.content as { content: string }[])[0]!.content);
    expect(listed).toEqual([expect.objectContaining({ asset_id: photo, usable: true, description: "New sweaters on a rack" })]);
  });

  it("won't save a new piece without captions, and tells Claude every color", async () => {
    await claudeOn();
    script = [useTool("design_piece", { kind: "post", title: "x", design: { size: "portrait", layout: "type-poster", motifs: "test motif", css: "", frames: [{ html: "<h1>Hi</h1>" }] } }), say("ok")];
    await askRaw("A post");
    const result = (calls[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("needs its captions");
    expect((await t.pool.query("SELECT 1 FROM pieces")).rowCount).toBe(0);
    const system = (calls[0]!.system as { text: string }[])[0]!.text;
    expect(system).toContain("var(--brand-color-1) = Page Cream #fbf8f3");
    expect(system).toContain("var(--brand-color-2) = Deep Forest #1d3c34 (PRIMARY)");
    expect(system).toContain("Every color is available for anything");
    // Readable pairs: Deep Forest on cream reads; cream on orange doesn't for body text.
    expect(system).toMatch(/On Page Cream: body text in [^\n]*Deep Forest/);
    expect(system).not.toMatch(/On Orange: body text in [^\n]*Page Cream/);
    expect(system).toContain("Never make tests, color swatches, palette checks");
  });
});

describe("fast mode", () => {
  it("asks for fast mode, meters it at 2x, and falls back to normal speed when it's busy", async () => {
    await claudeOn();
    script = [say("Quick!")];
    await askRaw("Hello");
    expect(calls[0]).toMatchObject({ speed: "fast" });
    expect(calls[0]!.betas).toEqual(["server-side-fallback-2026-07-01", "fast-mode-2026-02-01"]);

    script = [() => new Anthropic.RateLimitError(429, {}, "fast mode is busy", new Headers()), say("Still here.")];
    const { events } = await askRaw("Again");
    expect(events.find((e) => e.type === "error")).toBeUndefined();
    expect(calls[2]!.speed).toBeUndefined();
    expect(calls[2]!.betas).toEqual(["server-side-fallback-2026-07-01"]);

    const ledger = await t.pool.query("SELECT speed, cost_cents FROM usage_ledger ORDER BY id");
    // 1,000 input + 200 output = 0.8 cents at normal speed, 1.6 in fast mode.
    expect(ledger.rows).toEqual([{ speed: "fast", cost_cents: "1.6000" }, { speed: "standard", cost_cents: "0.8000" }]);
  });

  it("doesn't retry other errors", async () => {
    await claudeOn();
    script = [() => new Anthropic.BadRequestError(400, {}, "messages: bad input", new Headers())];
    const { events } = await askRaw("Hello");
    expect(events.find((e) => e.type === "error")?.message).toContain("Something went wrong");
    expect(calls).toHaveLength(1);
  });
});

describe("designing with Claude", () => {
  it("only uses files the rules allow", async () => {
    const photo = await upload(); // before Claude is on, so it isn't tagged in the background
    await claudeOn();
    const design = { size: "portrait", layout: "full-bleed-photo", motifs: "test motif", css: "", frames: [{ html: `<img class="photo" src="asset:${photo}">` }] };
    script = [useTool("design_piece", { kind: "post", title: "Window", captions: { instagram: { text: "Hi there", alt_text: "A post" } }, design }), say("Done")];
    await askRaw("Make a post with the window photo");
    const toolResult = (calls[1]!.messages.at(-1)!.content as { type: string; is_error?: boolean; content: string }[])[0]!;
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain("hasn't looked at this file");
    expect(renderedDocs).toHaveLength(0);
  });

  it("renders a carousel in the fallback look, saves it as Suggested with draft captions", async () => {
    const photo = await upload(); // before Claude is on, so it isn't tagged in the background
    await claudeOn();
    await markTagged(photo);
    const design = {
      size: "portrait", layout: "split-screen", motifs: "test motif",
      css: "h1{color:var(--brand-accent)}",
      frames: [{ html: `<h1>Fall is here</h1><img class="photo" src="asset:${photo}"><script>alert(1)</script>` }, { html: "<h1>Come say hi</h1>" }],
    };
    script = [
      useTool("design_piece", { kind: "carousel", title: "Fall carousel", design, captions: { instagram: { text: "Fall is here.", alt_text: "A shop window" }, youtube: { text: "nope" } } }),
      say("Here it is"),
    ];
    const { events } = await askRaw("Make a fall carousel");
    const pieceEvent = events.find((e) => e.type === "piece");
    expect(pieceEvent.piece).toMatchObject({ kind: "carousel", title: "Fall carousel", source: "claude", onCalendar: [] });
    expect(pieceEvent.piece.assets).toHaveLength(2);
    expect(pieceEvent.piece.captions.instagram).toEqual({ text: "Fall is here.", altText: "A shop window", status: "draft" });
    expect(pieceEvent.piece.captions.youtube).toBeUndefined();

    // The documents sent to the worker: the shop's own photo, the basic
    // Boutiqly palette (no shop look approved yet), and no scripts.
    const doc = renderedDocs[0]![0]!;
    expect(doc).toContain("https://cdn.test/file_1.png");
    expect(doc).toContain("--brand-accent: #de771f");
    expect(doc).not.toContain("<script");

    const toolContent = (calls[1]!.messages.at(-1)!.content as { content: { type: string; text?: string; source?: { url: string } }[] }[])[0]!.content;
    const result = JSON.parse(toolContent[0]!.text!);
    // Claude sees each rendered frame, and draft 1 always gets a critique round.
    expect(toolContent.filter((b) => b.type === "image").map((b) => b.source!.url)).toHaveLength(2);
    expect(toolContent.at(-1)!.text).toContain("This is draft 1. Required before you reply");
    expect(result.rendered_frame_asset_ids).toHaveLength(2);
    expect(result.notes.join(" ")).toContain("youtube doesn't take a carousel");
    const rendered = await t.pool.query("SELECT made_by FROM assets WHERE made_by = 'render'");
    expect(rendered.rowCount).toBe(2);
  });

  it("can't use another shop's files", async () => {
    const photo = await upload(); // before Claude is on, so it isn't tagged in the background
    await claudeOn();
    await markTagged(photo);
    await t.pool.query("INSERT INTO brands (location_id, company_id) VALUES ('loc_other', 'co_boutiqly')");
    await t.pool.query("UPDATE assets SET brand_id = (SELECT id FROM brands WHERE location_id = 'loc_other')");
    script = [useTool("design_piece", { kind: "post", title: "x", captions: { instagram: { text: "Hi there", alt_text: "A post" } }, design: { size: "portrait", layout: "photo-collage", motifs: "test motif", css: "", frames: [{ html: `<img src="asset:${photo}">` }] } }), say("ok")];
    await askRaw("Use that photo");
    const toolResult = (calls[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain("isn't one of this shop's files");
  });

  it("uses the shop's look only once it's approved", async () => {
    await claudeOn();
    await t.app.inject({ method: "PUT", url: "/api/style", headers: agency.headers, payload: { colors: [{ name: "Cream", hex: "#fff8f0" }, { name: "Riot Pink", hex: "#ff3399", primary: true }, { name: "Ink", hex: "#111111" }], headingFont: "Bebas Neue" } });
    const design = { size: "story", layout: "arch-window", motifs: "test motif", css: "", frames: [{ html: "<h1>Hi</h1>" }] };
    script = [useTool("design_piece", { kind: "story", title: "a", captions: { instagram: { text: "Hi there", alt_text: "A post" } }, design }), say("ok"), useTool("design_piece", { kind: "story", title: "b", captions: { instagram: { text: "Hi there", alt_text: "A post" } }, design: { ...design, layout: "pattern" } }), say("ok")];
    await askRaw("Story please");
    expect(renderedDocs[0]![0]).toContain("--brand-accent: #de771f"); // still the fallback

    const approve = await t.app.inject({ method: "POST", url: "/api/style/approve", headers: agency.headers });
    expect(approve.json().style).toMatchObject({ status: "approved", approvedBy: "Katy Agency" });
    await askRaw("Another");
    expect(renderedDocs[1]![0]).toContain("--brand-accent: #ff3399");
    expect(renderedDocs[1]![0]).toContain("Bebas+Neue");
  });

  it("won't change a piece that's already approved", async () => {
    await claudeOn();
    const make = await t.app.inject({ method: "POST", url: "/api/pieces", headers: agency.headers, payload: { kind: "text", title: "Hi" } });
    const pieceId = make.json().piece.id;
    await t.app.inject({ method: "PUT", url: `/api/pieces/${pieceId}/captions/threads`, headers: agency.headers, payload: { text: "hi", status: "final" } });
    await t.app.inject({ method: "POST", url: `/api/pieces/${pieceId}/approve`, headers: agency.headers, payload: { channels: ["threads"] } });
    script = [useTool("design_piece", { piece_id: pieceId, kind: "text", title: "Changed", captions: { threads: { text: "changed" } } }), say("ok")];
    await askRaw("Change it");
    const toolResult = (calls[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(toolResult.is_error).toBe(true);
    const cap = await t.pool.query("SELECT text, status FROM captions WHERE piece_id = $1", [pieceId]);
    expect(cap.rows).toEqual([{ text: "hi", status: "final" }]);
  });
});

describe("comments into edits", () => {
  async function approvedPost() {
    const id = (await t.app.inject({ method: "POST", url: "/api/pieces", headers: agency.headers, payload: { kind: "text", title: "Hours post" } })).json().piece.id as string;
    await t.app.inject({ method: "PUT", url: `/api/pieces/${id}/captions/threads`, headers: agency.headers, payload: { text: "We're open 9 to 5" } });
    await t.app.inject({ method: "POST", url: `/api/pieces/${id}/approve`, headers: agency.headers, payload: { channels: ["threads"] } });
    return id;
  }
  const comment = (id: string, text: string, headers = agency.headers) => t.app.inject({ method: "POST", url: `/api/pieces/${id}/comments`, headers, payload: { text } });
  async function settled(id: string) {
    for (let i = 0; i < 100; i++) {
      const c = (await t.app.inject({ url: `/api/pieces/${id}/comments`, headers: agency.headers })).json();
      if (!c.editing) return c;
      await new Promise((r) => setTimeout(r, 30));
    }
    throw new Error("The edit never finished");
  }

  it("sends all comments at once; the post goes back to Suggested, and Go back restores it", async () => {
    await claudeOn();
    const id = await approvedPost();
    await t.app.inject({ method: "POST", url: "/api/calendar", headers: agency.headers, payload: { pieceId: id, channels: ["threads"], date: "2030-10-20", time: "09:00" } });
    await comment(id, "Say we're open late on Fridays");
    expect((await comment(id, "Add a wave emoji")).json().comments).toHaveLength(2);

    script = [
      useTool("design_piece", { piece_id: id, kind: "text", title: "Hours post", captions: { threads: { text: "We're open 9 to 5, and till 8 on Fridays 👋" } } }),
      say("Added Friday's late hours and a wave."),
    ];
    const sent = await t.app.inject({ method: "POST", url: `/api/pieces/${id}/send-edits`, headers: agency.headers });
    expect(sent.statusCode, sent.body).toBe(200);
    const done = await settled(id);
    expect(done).toMatchObject({ editing: false, reply: "Added Friday's late hours and a wave.", error: null });
    expect(done.comments.map((c: { status: string }) => c.status)).toEqual(["done", "done"]);
    expect(done.versions).toHaveLength(1);
    expect(JSON.stringify(calls[0]!.messages)).toContain("Say we're open late on Fridays");

    const piece = (await t.app.inject({ url: `/api/pieces/${id}`, headers: agency.headers })).json().piece;
    expect(piece).toMatchObject({ approval: null, onCalendar: [] });
    expect(piece.captions.threads).toMatchObject({ text: "We're open 9 to 5, and till 8 on Fridays 👋", status: "draft" });

    const back = await t.app.inject({ method: "POST", url: `/api/pieces/${id}/versions/${done.versions[0].id}/restore`, headers: agency.headers });
    expect(back.json().piece.captions.threads.text).toBe("We're open 9 to 5");
    expect((await settled(id)).versions).toHaveLength(2); // the edited one is kept too
  });

  it("won't edit a post already in Boutiqly's planner, needs Claude on, and keeps the comments if Claude fails", async () => {
    const id = await approvedPost();
    await comment(id, "Shorter please");
    const send = () => t.app.inject({ method: "POST", url: `/api/pieces/${id}/send-edits`, headers: agency.headers });
    expect((await send()).json().error).toContain("isn't turned on");

    await claudeOn();
    const [entry] = (await t.app.inject({ method: "POST", url: "/api/calendar", headers: agency.headers, payload: { pieceId: id, channels: ["threads"], date: "2030-10-20", time: "09:00" } })).json().entries;
    await t.pool.query("UPDATE calendar_entries SET status = 'scheduled' WHERE id = $1", [entry.id]);
    expect((await send()).json().error).toContain("already scheduled or posted");
    expect((await settled(id)).comments[0].status).toBe("open");

    await t.pool.query("DELETE FROM calendar_entries");
    script = [() => new Error("Claude is down")];
    await send();
    const after = await settled(id);
    expect(after.error).toBeTruthy();
    expect(after.comments[0].status).toBe("open");
  });

  it("keeps people without access out", async () => {
    const id = await approvedPost();
    const other = await signInAs(t.app, people.other);
    expect((await comment(id, "hi", other.headers)).statusCode).toBe(403);
    const elsewhere = await signInAs(t.app, { ...people.agency, activeLocation: "loc_other" });
    expect((await comment(id, "hi", elsewhere.headers)).statusCode).toBe(404);
  });
});

describe("plan my calendar", () => {
  async function approvedText(title: string, channels: string[]) {
    const id = (await t.app.inject({ method: "POST", url: "/api/pieces", headers: agency.headers, payload: { kind: "text", title } })).json().piece.id as string;
    for (const ch of channels) await t.app.inject({ method: "PUT", url: `/api/pieces/${id}/captions/${ch}`, headers: agency.headers, payload: { text: `${title} on ${ch}` } });
    await t.app.inject({ method: "POST", url: `/api/pieces/${id}/approve`, headers: agency.headers, payload: { channels } });
    return id;
  }
  const plan = (weeks: number, more = false) => t.app.inject({ method: "POST", url: "/api/calendar/plan", headers: agency.headers, payload: { weeks, continue: more } });
  const day = (n: number) => {
    const d = new Date(Date.now() + n * 86_400_000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(d);
  };

  it("places approved posts in the window, checks every spot, and leaves the rest alone", async () => {
    await claudeOn();
    const a = await approvedText("Fall drop", ["threads", "facebook"]);
    const b = await approvedText("Shop tour", ["threads"]);
    script = [
      say(
        JSON.stringify({
          placements: [
            { piece_id: a, channel: "threads", date: day(3), time: "11:00" },
            { piece_id: a, channel: "facebook", date: day(3), time: "11:00" },
            { piece_id: b, channel: "threads", date: day(400), time: "11:00" }, // outside the window
            { piece_id: "not-a-piece", channel: "threads", date: day(5), time: "11:00" },
          ],
          not_placed: [],
          note: "Fall drop first, while it's new.",
        }),
      ),
    ];
    const res = await plan(4);
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ placed: 2, from: day(1), to: day(28), note: "Fall drop first, while it's new." });
    expect(body.notPlaced).toEqual([{ pieceId: b, title: "Shop tour", reason: expect.stringContaining("outside the plan") }]);
    const rows = await t.pool.query("SELECT channel, status, locked_at FROM calendar_entries ORDER BY channel");
    expect(rows.rows).toEqual([
      { channel: "facebook", status: "approved", locked_at: null },
      { channel: "threads", status: "approved", locked_at: null },
    ]);
    // Claude saw only what still needs a spot, plus the shop's time zone and window.
    const sent = JSON.parse((calls[0]!.messages[0]!.content as { text: string }[])[0]!.text);
    expect(sent.to_place.map((p: { piece_id: string }) => p.piece_id).sort()).toEqual([a, b].sort());
    expect(sent.window).toEqual({ from: day(1), to: day(28) });
    const ledger = await t.pool.query("SELECT purpose FROM usage_ledger");
    expect(ledger.rows).toEqual([{ purpose: "plan_calendar" }]);
  });

  it("plans the 4 weeks after the current plan, and says when there's nothing to plan", async () => {
    await claudeOn();
    const a = await approvedText("One", ["threads"]);
    await t.app.inject({ method: "POST", url: "/api/calendar", headers: agency.headers, payload: { pieceId: a, channels: ["threads"], date: day(20), time: "09:00" } });
    expect((await plan(4)).json()).toMatchObject({ placed: 0, note: expect.stringContaining("Nothing new to plan") });
    expect(calls).toHaveLength(0);

    await approvedText("Two", ["threads"]);
    script = [say(JSON.stringify({ placements: [], not_placed: [], note: "" }))];
    expect((await plan(4, true)).json()).toMatchObject({ from: day(21), to: day(48) });
    expect((await plan(5)).statusCode).toBe(400);
  });
});

describe("the online store", () => {
  it("gives Claude real product names and links (no prices), and only saves real product links", async () => {
    await claudeOn();
    const brandId = (await t.pool.query("SELECT id FROM brands")).rows[0].id;
    await t.pool.query("INSERT INTO stores (brand_id, url, status, connected_by) VALUES ($1, 'https://shop.test', 'ok', 'u_agency')", [brandId]);
    await t.pool.query(
      `INSERT INTO products (brand_id, external_id, title, url, description, published_at) VALUES
       ($1, 'shopify:1', 'Linen Apron', 'https://shop.test/products/linen-apron', 'Soft linen.', now() - interval '1 day'),
       ($1, 'shopify:2', 'Clay Mug', 'https://shop.test/products/clay-mug', 'Stoneware.', '2025-01-01')`,
      [brandId],
    );
    script = [
      useTool("list_products", { new_only: true }),
      useTool("design_piece", { kind: "text", title: "Apron", link: "https://shop.test/products/linen-apron", captions: { threads: { text: "New: the Linen Apron" } } }, "tu_a"),
      useTool("design_piece", { kind: "text", title: "Made up", link: "https://elsewhere.test/thing", captions: { threads: { text: "Hi" } } }, "tu_b"),
      say("Done"),
    ];
    await askRaw("Post about what's new");
    expect(calls[0]!.system!.toString() + JSON.stringify(calls[0]!.system)).toContain("Never mention prices");
    const products = (calls[1]!.messages.at(-1)!.content as { content: string }[])[0]!.content;
    const parsed = JSON.parse(products);
    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0]).toMatchObject({ name: "Linen Apron", link: "https://shop.test/products/linen-apron", new: true });
    expect(products).not.toMatch(/price/i);

    const links = await t.pool.query("SELECT title, link FROM pieces ORDER BY created_at");
    expect(links.rows).toEqual([
      { title: "Apron", link: "https://shop.test/products/linen-apron" },
      { title: "Made up", link: "" },
    ]);
    const note = JSON.stringify(calls[3]!.messages.at(-1)!.content);
    expect(note).toContain("link wasn't saved");
  });
});

describe("proposals", () => {
  it("change nothing until someone taps Apply, and only once", async () => {
    await claudeOn();
    const make = await t.app.inject({ method: "POST", url: "/api/pieces", headers: agency.headers, payload: { kind: "text", title: "Hi" } });
    const pieceId = make.json().piece.id;
    await t.app.inject({ method: "PUT", url: `/api/pieces/${pieceId}/captions/threads`, headers: agency.headers, payload: { text: "hi" } });
    const propose = useTool("propose_change", { kind: "add_to_calendar", summary: "Post it on Threads Tue at 9", piece_id: pieceId, channels: ["threads"], date: "2030-10-22", time: "09:00" });
    // Not approved yet: Claude is told so, and nothing is proposed.
    script = [propose, say("Approve it first")];
    const before = await askRaw("Schedule it");
    expect(before.events.some((e) => e.type === "proposal")).toBe(false);
    expect(JSON.stringify(calls[1]!.messages.at(-1)!.content)).toContain("isn't approved yet");

    await t.app.inject({ method: "POST", url: `/api/pieces/${pieceId}/approve`, headers: agency.headers, payload: { channels: ["threads"] } });
    script = [propose, say("Tap Apply if that works")];
    const { events } = await askRaw("Schedule it");
    const proposal = events.find((e) => e.type === "proposal").proposal;
    expect(proposal).toMatchObject({ kind: "add_to_calendar", status: "open" });
    expect((await t.pool.query("SELECT 1 FROM calendar_entries")).rowCount).toBe(0);

    const elsewhere = await signInAs(t.app, { ...people.agency, activeLocation: "loc_other" });
    expect((await t.app.inject({ method: "POST", url: `/api/proposals/${proposal.id}/apply`, headers: elsewhere.headers })).statusCode).toBe(404);

    const apply = await t.app.inject({ method: "POST", url: `/api/proposals/${proposal.id}/apply`, headers: agency.headers });
    expect(apply.json().proposal.status).toBe("applied");
    const entries = await t.pool.query("SELECT channel, status FROM calendar_entries");
    expect(entries.rows).toEqual([{ channel: "threads", status: "approved" }]);
    expect((await t.app.inject({ method: "POST", url: `/api/proposals/${proposal.id}/apply`, headers: agency.headers })).statusCode).toBe(400);
  });
});

describe("conversations", () => {
  it("keep the whole history, append-only, and stay with the person who started them", async () => {
    await claudeOn();
    script = [useTool("search_library", {}), say("Your library is empty."), say("Sure.")];
    const first = await askRaw("What's in my library?");
    const conversationId = first.events[0].conversationId;
    await askRaw("Thanks", conversationId);
    // The second ask resends everything: user, tool use, tool result, reply, new user message.
    expect(calls[2]!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);

    const view = (await t.app.inject({ url: `/api/conversations/${conversationId}`, headers: agency.headers })).json().conversation;
    expect(view.items.map((i: { kind: string }) => i.kind)).toEqual(["user", "claude", "user", "claude"]);
    expect(view.working).toBe(false); // the reply finished, so nothing is still running

    const colleague = await signInAs(t.app, { ...people.agency, userId: "u_ashley", userName: "Ashley" });
    expect((await t.app.inject({ url: `/api/conversations/${conversationId}`, headers: colleague.headers })).statusCode).toBe(404);
  });
});

describe("assets", () => {
  it("records what Claude sees and blocks flagged files until the owner clears them", async () => {
    await claudeOn();
    // Uploading with Claude on starts tagging in the background.
    script = [
      () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({ description: "A receipt on the counter", tags: ["receipt"], has_people: false, possible_minor: false, sensitive: [{ kind: "payment", note: "card digits", x: 0.1, y: 0.2, w: 0.3, h: 0.1 }] }),
            citations: null,
          },
        ] as ClaudeMessage["content"],
      }),
    ];
    const id = await upload("receipt.jpg");
    for (let i = 0; i < 40 && (await t.pool.query("SELECT 1 FROM assets WHERE tagged_at IS NOT NULL")).rowCount === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    let list = (await t.app.inject({ url: "/api/assets", headers: agency.headers })).json().assets;
    let a = list.find((x: { id: string }) => x.id === id);
    expect(a).toMatchObject({ tagged: true, usable: { ok: false } });
    expect(a.sensitive[0]).toMatchObject({ kind: "payment", box: { x: 0.1, y: 0.2, w: 0.3, h: 0.1 } });
    const ledger = await t.pool.query("SELECT purpose FROM usage_ledger");
    expect(ledger.rows).toEqual([{ purpose: "tag_asset" }]);

    // A blurred copy is a new, usable file; the original stays blocked.
    const blur = (await t.app.inject({ method: "POST", url: `/api/assets/${id}/blur`, headers: agency.headers })).json();
    let done: { status: string; asset?: { usable: { ok: boolean }; madeBy: string } } = { status: "pending" };
    for (let i = 0; i < 40 && done.status === "pending"; i++) {
      await new Promise((r) => setTimeout(r, 50));
      done = (await t.app.inject({ url: `/api/assets/${id}/blur/${blur.jobId}`, headers: agency.headers })).json();
    }
    expect(done).toMatchObject({ status: "done", asset: { madeBy: "blur", usable: { ok: true } } });

    a = (await t.app.inject({ method: "PATCH", url: `/api/assets/${id}`, headers: agency.headers, payload: { flagsCleared: true } })).json().asset;
    expect(a.usable.ok).toBe(true);
    a = (await t.app.inject({ method: "PATCH", url: `/api/assets/${id}`, headers: agency.headers, payload: { peopleRule: "dont_use" } })).json().asset;
    expect(a.usable).toEqual({ ok: false, reason: "The owner marked this file Don't use." });
    list = (await t.app.inject({ url: "/api/assets", headers: agency.headers })).json().assets;
    expect(list).toHaveLength(2);
  });

  it("never lets a possible minor through without the owner's say-so", () => {
    const base = { mime: "image/jpeg", taggedAt: new Date(), peopleRule: "ok" as const, sensitive: [], flagsCleared: false, madeBy: "upload" as const };
    expect(usableInDesign({ ...base, possibleMinor: true }).ok).toBe(false);
    expect(usableInDesign({ ...base, possibleMinor: true, flagsCleared: true }).ok).toBe(true);
    expect(usableInDesign({ ...base, possibleMinor: false, mime: "video/mp4" }).ok).toBe(false);
  });
});

describe("uploaded fonts", () => {
  function fontForm(fileName: string, bytes: Buffer, fields: Record<string, string> = {}, headers = agency.headers) {
    const boundary = "----font";
    const parts = Object.entries(fields).map(([k, v]) => Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    const file = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return t.app.inject({ method: "POST", url: "/api/fonts", payload: Buffer.concat([...parts, file]), headers: { ...headers, "content-type": `multipart/form-data; boundary=${boundary}` } });
  }
  const woff2 = Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(60, 1)]);

  it("checks the file and names the family", async () => {
    const res = await fontForm("RiotSans-Bold.woff2", woff2, { weight: "700" });
    expect(res.statusCode).toBe(200);
    expect(res.json().font).toMatchObject({ family: "Riot Sans", weight: 700, italic: false, format: "woff2" });
    expect((await fontForm("notes.woff2", Buffer.from("hello, not a font at all"))).statusCode).toBe(400);
    expect((await fontForm("x.woff2", woff2, { family: "<script>" })).statusCode).toBe(400);
    const other = await signInAs(t.app, people.other);
    expect((await fontForm("x.woff2", woff2, {}, other.headers)).statusCode).toBe(403);
  });

  it("keeps each shop's fonts to itself", async () => {
    const id = (await fontForm("Riot.woff2", woff2, { family: "Riot Sans" })).json().font.id;
    const file = await t.app.inject({ url: `/api/fonts/${id}/file`, headers: agency.headers });
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toBe("font/woff2");
    const elsewhere = await signInAs(t.app, { ...people.agency, activeLocation: "loc_other" });
    expect((await t.app.inject({ url: `/api/fonts/${id}/file`, headers: elsewhere.headers })).statusCode).toBe(404);
    expect((await t.app.inject({ method: "DELETE", url: `/api/fonts/${id}`, headers: elsewhere.headers })).statusCode).toBe(404);
    expect((await t.app.inject({ url: "/api/fonts", headers: elsewhere.headers })).json().fonts).toEqual([]);
  });

  it("renders designs with the uploaded font, and puts the look back to draft if it's removed", async () => {
    await claudeOn();
    const id = (await fontForm("Riot.woff2", woff2, { family: "Riot Sans" })).json().font.id;
    await t.app.inject({ method: "PUT", url: "/api/style", headers: agency.headers, payload: { colors: [{ name: "Ink", hex: "#111111", role: "text" }, { name: "Pink", hex: "#ff3399", role: "accent" }], headingFont: "Riot Sans", bodyFont: "DM Sans" } });
    const style = (await t.app.inject({ method: "POST", url: "/api/style/approve", headers: agency.headers })).json().style;
    expect(style.customFonts).toEqual([{ id, family: "Riot Sans", weight: 400, italic: false, format: "woff2" }]);

    script = [useTool("design_piece", { kind: "post", title: "a", captions: { instagram: { text: "Hi there", alt_text: "A post" } }, design: { size: "portrait", layout: "magazine-cover", motifs: "test motif", css: "", frames: [{ html: "<h1>Hi</h1>" }] } }), say("ok")];
    await askRaw("A post please");
    const doc = renderedDocs[0]![0]!;
    expect(doc).toContain(`@font-face { font-family: "Riot Sans"; src: url("https://fonts.render.local/${id}") format("woff2")`);
    expect(doc).toContain("family=DM+Sans");
    expect(doc).not.toContain("family=Riot");
    const job = await t.pool.query("SELECT payload->>'brandId' AS b FROM jobs WHERE kind = 'render'");
    expect(job.rows[0].b).toBeTruthy();
    expect((calls[0]!.system as { text: string }[])[0]!.text).toContain("Uploaded fonts (already loaded, use by family name): Riot Sans (400)");

    await t.app.inject({ method: "DELETE", url: `/api/fonts/${id}`, headers: agency.headers });
    const after = (await t.app.inject({ url: "/api/style", headers: agency.headers })).json().style;
    expect(after).toMatchObject({ status: "draft", customFonts: [] });
  });
});

describe("the inspiration board", () => {
  async function addInspiration(name = "loved.png", headers = agency.headers) {
    const boundary = "----insp";
    const body =
      `--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ninspiration\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\nbytes\r\n--${boundary}--\r\n`;
    return t.app.inject({ method: "POST", url: "/api/assets", payload: body, headers: { ...headers, "content-type": `multipart/form-data; boundary=${boundary}` } });
  }

  it("holds up to 10 loved posts that Claude studies but never uses", async () => {
    await claudeOn();
    const first = await addInspiration();
    expect(first.statusCode).toBe(200);
    // Not tagged in the background, and never usable in a design.
    await new Promise((r) => setTimeout(r, 100));
    expect(calls).toHaveLength(0);
    const a = (await t.app.inject({ url: "/api/assets", headers: agency.headers })).json().assets[0];
    expect(a).toMatchObject({ purpose: "inspiration", usable: { ok: false } });
    for (let i = 0; i < 9; i++) await addInspiration(`p${i}.png`);
    const eleventh = await addInspiration("one-too-many.png");
    expect(eleventh.statusCode).toBe(400);
    expect(eleventh.json().error).toContain("holds 10 posts");

    const other = await signInAs(t.app, people.other);
    expect((await addInspiration("x.png", other.headers)).statusCode).toBe(403);
    expect((await t.app.inject({ method: "DELETE", url: `/api/inspiration/${a.id}`, headers: agency.headers })).statusCode).toBe(200);
  });

  it("starts each new chat with the board, and keeps it out of the chat view", async () => {
    await claudeOn();
    await addInspiration("loved.png");
    script = [say("Love these."), say("Sure.")];
    const first = await askRaw("Make something fresh");
    const sent = calls[0]!.messages[0]!.content as { type: string; text?: string; source?: { url: string } }[];
    expect(sent[0]!.text).toContain("inspiration board (1 post");
    expect(sent[1]).toMatchObject({ type: "image", source: { url: "https://cdn.test/file_1.png" } });
    expect(sent.at(-1)!.text).toContain("Make something fresh");

    // A design can't put an inspiration post in a post.
    const id = (await t.app.inject({ url: "/api/assets", headers: agency.headers })).json().assets[0].id;
    await markTagged(id);
    const conversationId = first.events[0].conversationId;
    script = [useTool("design_piece", { kind: "post", title: "x", captions: { instagram: { text: "Hi there", alt_text: "A post" } }, design: { size: "portrait", layout: "polaroid", motifs: "test motif", css: "", frames: [{ html: `<img src="asset:${id}">` }] } }), say("ok")];
    await askRaw("Use that one", conversationId);
    const toolResult = (calls.at(-1)!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain("Inspiration only");

    const view = (await t.app.inject({ url: `/api/conversations/${conversationId}`, headers: agency.headers })).json().conversation;
    expect(view.items[0]).toEqual({ kind: "user", text: "Make something fresh" });
  });
});

describe("variety", () => {
  const caps = { instagram: { text: "Hi there", alt_text: "A post" } };
  const make = (title: string, layout: string, extra: Record<string, unknown> = {}) =>
    useTool("design_piece", { kind: "post", title, captions: caps, design: { size: "portrait", layout, motifs: "starburst top right", css: "", frames: [{ html: "<h1>Hi</h1>" }], ...extra } });

  it("won't reuse a recent layout for a new post unless the owner asked", async () => {
    await claudeOn();
    script = [make("First", "type-poster"), say("ok")];
    await askRaw("A post");
    script = [make("Second", "type-poster"), say("ok")];
    await askRaw("Another post");
    const blocked = (calls.at(-1)!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(blocked.is_error).toBe(true);
    expect(blocked.content).toContain('"First" already used the type-poster layout');
    // The next message describes recent designs, with their layout and motifs.
    const sent = calls.at(-1)!.messages.at(-3)!.content as { type: string; text?: string }[];
    expect(sent.find((b) => b.text?.includes("most recent designs"))!.text).toContain('"First" (post): layout type-poster (mostly graphics and type); motifs: starburst top right');

    script = [make("Third", "type-poster", { owner_asked_for_this_layout: true }), say("ok")];
    await askRaw("Same layout as the last one please");
    expect((await t.pool.query("SELECT title FROM pieces ORDER BY created_at")).rows.map((r) => r.title)).toEqual(["First", "Third"]);
  });

  it("switches the kind of post each time when the shop has photos", async () => {
    const photo = await upload();
    await markTagged(photo);
    await claudeOn();
    script = [make("Poster", "type-poster"), say("ok"), make("Quote", "quote-card"), say("ok"), make("Photo", "full-bleed-photo", { frames: [{ html: `<img class="photo" src="asset:${photo}">` }] }), say("ok")];
    await askRaw("A post");
    await askRaw("Another");
    const blocked = (calls[3]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(blocked.is_error).toBe(true);
    expect(blocked.content).toContain('The last post ("Poster") was mostly graphics and type');
    await askRaw("And another");
    expect((await t.pool.query("SELECT title FROM pieces ORDER BY created_at")).rows.map((r) => r.title)).toEqual(["Poster", "Photo"]);
  });

  it("asks for captions on every channel the post can go to", async () => {
    await claudeOn();
    script = [make("One", "minimal"), say("ok")];
    await askRaw("A post");
    const result = JSON.parse(((calls[1]!.messages.at(-1)!.content as { content: { type: string; text?: string }[] }[])[0]!.content)[0]!.text!);
    expect(result.notes.join(" ")).toMatch(/Still missing captions for: .*facebook/);
    expect((calls[0]!.system as { text: string }[])[0]!.text).toContain("a caption for every channel this kind of piece can go to");
  });
});

describe("love it / not this", () => {
  it("saves verdicts per shop and puts them in front of Claude", async () => {
    await claudeOn();
    const pieceId = (await t.app.inject({ method: "POST", url: "/api/pieces", headers: agency.headers, payload: { kind: "post", title: "Bandana post" } })).json().piece.id;
    const res = await t.app.inject({ method: "POST", url: `/api/pieces/${pieceId}/feedback`, headers: agency.headers, payload: { rating: -1, note: "Too busy, the text is hard to read" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().feedback).toEqual([expect.objectContaining({ rating: -1, note: "Too busy, the text is hard to read", by: "Katy Agency" })]);
    expect((await t.app.inject({ method: "POST", url: `/api/pieces/${pieceId}/feedback`, headers: agency.headers, payload: { rating: 5 } })).statusCode).toBe(400);
    const elsewhere = await signInAs(t.app, { ...people.agency, activeLocation: "loc_other" });
    expect((await t.app.inject({ url: `/api/pieces/${pieceId}/feedback`, headers: elsewhere.headers })).statusCode).toBe(404);

    script = [say("Noted.")];
    await askRaw("Make a post");
    const sent = calls[0]!.messages[0]!.content as { type: string; text?: string }[];
    expect(sent.find((b) => b.text?.includes("verdicts on recent posts"))!.text).toContain('NOT THIS: "Bandana post" (post) — "Too busy, the text is hard to read"');
  });
});
