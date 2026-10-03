import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { people, signInAs, testApp } from "./helpers.ts";
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
type Script = (params: StreamParams, call: number) => Partial<ClaudeMessage> & { content: ClaudeMessage["content"] };
let script: Script[] = [];
let calls: StreamParams[] = [];
const fakeClaude: ClaudeApi = {
  async send(params, onText) {
    calls.push(structuredClone(params));
    const step = script.shift();
    if (!step) throw new Error("No scripted reply left");
    const reply = step(params, calls.length);
    for (const b of reply.content) if (b.type === "text") onText?.(b.text);
    return {
      id: `msg_${calls.length}`,
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      stop_reason: reply.content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, server_tool_use: null, iterations: null },
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
  workerTimer = setInterval(async () => {
    const { rows } = await t.pool.query("SELECT id, kind, payload FROM jobs WHERE status = 'queued'");
    for (const job of rows) {
      const docs: string[] = job.kind === "render" ? job.payload.docs : ["blurred"];
      if (job.kind === "render") renderedDocs.push(docs);
      for (let i = 0; i < docs.length; i++) {
        await t.pool.query("INSERT INTO render_outputs (job_id, frame, mime, data) VALUES ($1, $2, 'image/png', $3)", [job.id, i, Buffer.from([137, 80, 78, 71, i])]);
      }
      await t.pool.query("UPDATE jobs SET status = 'done', result = '{}' WHERE id = $1", [job.id]);
    }
  }, 50);
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
    // 1,000 input at $4/M + 200 output at $20/M = $0.008 = 0.8 cents; credits are 2x.
    expect(ledger.rows).toEqual([{ model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 200, cost_cents: "0.8000", credits: "1.6000", purpose: "ask_claude" }]);

    script = [say("Again")];
    await askRaw("And again");
    // Now past 1 cent: the next one is refused before Claude is called.
    const before = calls.length;
    const third = await askRaw("One more");
    expect(third.events.find((e) => e.type === "error")?.message).toContain("this month's limit");
    expect(calls.length).toBe(before);
  });

  it("prices each model run at its own rates, including web searches", () => {
    expect(costCents({ model: "claude-opus-5-5", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 0, webSearches: 10 })).toBeCloseTo(400 + 20 + 10, 6);
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

describe("designing with Claude", () => {
  it("only uses files the rules allow", async () => {
    const photo = await upload(); // before Claude is on, so it isn't tagged in the background
    await claudeOn();
    const design = { size: "portrait", css: "", frames: [{ html: `<img class="photo" src="asset:${photo}">` }] };
    script = [useTool("design_piece", { kind: "post", title: "Window", design }), say("Done")];
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
      size: "portrait",
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
    script = [useTool("design_piece", { kind: "post", title: "x", design: { size: "portrait", css: "", frames: [{ html: `<img src="asset:${photo}">` }] } }), say("ok")];
    await askRaw("Use that photo");
    const toolResult = (calls[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain("isn't one of this shop's files");
  });

  it("uses the shop's look only once it's approved", async () => {
    await claudeOn();
    await t.app.inject({ method: "PUT", url: "/api/style", headers: agency.headers, payload: { colors: [{ name: "Riot Pink", hex: "#ff3399", role: "accent" }, { name: "Ink", hex: "#111111", role: "text" }], headingFont: "Bebas Neue" } });
    const design = { size: "story", css: "", frames: [{ html: "<h1>Hi</h1>" }] };
    script = [useTool("design_piece", { kind: "story", title: "a", design }), say("ok"), useTool("design_piece", { kind: "story", title: "b", design }), say("ok")];
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
    const [entry] = (await t.app.inject({ method: "POST", url: "/api/calendar", headers: agency.headers, payload: { pieceId, channels: ["threads"], date: "2030-10-20", time: "09:00" } })).json().entries;
    await t.pool.query("UPDATE calendar_entries SET status = 'approved' WHERE id = $1", [entry.id]);
    script = [useTool("design_piece", { piece_id: pieceId, kind: "text", title: "Changed", captions: { threads: { text: "changed" } } }), say("ok")];
    await askRaw("Change it");
    const toolResult = (calls[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(toolResult.is_error).toBe(true);
    const cap = await t.pool.query("SELECT text, status FROM captions WHERE piece_id = $1", [pieceId]);
    expect(cap.rows).toEqual([{ text: "hi", status: "final" }]);
  });
});

describe("proposals", () => {
  it("change nothing until someone taps Apply, and only once", async () => {
    await claudeOn();
    const make = await t.app.inject({ method: "POST", url: "/api/pieces", headers: agency.headers, payload: { kind: "text", title: "Hi" } });
    const pieceId = make.json().piece.id;
    script = [
      useTool("propose_change", { kind: "add_to_calendar", summary: "Post it on Threads Tue at 9", piece_id: pieceId, channels: ["threads"], date: "2030-10-22", time: "09:00" }),
      say("Tap Apply if that works"),
    ];
    const { events } = await askRaw("Schedule it");
    const proposal = events.find((e) => e.type === "proposal").proposal;
    expect(proposal).toMatchObject({ kind: "add_to_calendar", status: "open" });
    expect((await t.pool.query("SELECT 1 FROM calendar_entries")).rowCount).toBe(0);

    const elsewhere = await signInAs(t.app, { ...people.agency, activeLocation: "loc_other" });
    expect((await t.app.inject({ method: "POST", url: `/api/proposals/${proposal.id}/apply`, headers: elsewhere.headers })).statusCode).toBe(404);

    const apply = await t.app.inject({ method: "POST", url: `/api/proposals/${proposal.id}/apply`, headers: agency.headers });
    expect(apply.json().proposal.status).toBe("applied");
    const entries = await t.pool.query("SELECT channel, status FROM calendar_entries");
    expect(entries.rows).toEqual([{ channel: "threads", status: "suggested" }]);
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

    script = [useTool("design_piece", { kind: "post", title: "a", design: { size: "portrait", css: "", frames: [{ html: "<h1>Hi</h1>" }] } }), say("ok")];
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
    script = [useTool("design_piece", { kind: "post", title: "x", design: { size: "portrait", css: "", frames: [{ html: `<img src="asset:${id}">` }] } }), say("ok")];
    await askRaw("Use that one", conversationId);
    const toolResult = (calls.at(-1)!.messages.at(-1)!.content as { content: string; is_error?: boolean }[])[0]!;
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain("Inspiration only");

    const view = (await t.app.inject({ url: `/api/conversations/${conversationId}`, headers: agency.headers })).json().conversation;
    expect(view.items[0]).toEqual({ kind: "user", text: "Make something fresh" });
  });
});
