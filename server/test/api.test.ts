import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { encryptLikeBoutiqly, people, signInAs, testApp } from "./helpers.ts";
import { accessTokenFor } from "../src/boutiqly/installs.ts";

let t: Awaited<ReturnType<typeof testApp>>;
const tokenCalls: URLSearchParams[] = [];
const apiCalls: string[] = [];
// Stands in for Boutiqly's API: OAuth tokens, a sub-account's users and its name.
const boutiqlyUsers = [
  { id: "u_owner", name: "Olive Owner", email: "olive@example.com", roles: { type: "account" } },
  { id: "u_new", firstName: "Nina", lastName: "New", email: "nina@example.com", roles: { type: "account" } },
  { id: "u_agency", name: "Katy Agency", email: "katy@example.com", roles: { type: "agency" } },
  { id: "u_gone", name: "Gone", deleted: true, roles: { type: "account" } },
];
const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
const fakeFetch = (async (url: string, init: RequestInit = {}) => {
  const path = url.replace("https://api.test", "");
  if (path === "/oauth/token") {
    const body = new URLSearchParams(init.body as URLSearchParams);
    tokenCalls.push(body);
    const n = tokenCalls.length;
    return json({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, expires_in: n === 1 ? 60 : 86_400, userType: "Location", companyId: "co_boutiqly", locationId: "loc_test_1", scope: "x" });
  }
  apiCalls.push(path);
  if (path.startsWith("/users/?locationId=loc_test_1")) return json({ users: boutiqlyUsers });
  if (path === "/locations/loc_test_1") return json({ location: { id: "loc_test_1", name: "Test Boutique" } });
  return new Response("not found", { status: 404 });
}) as unknown as typeof fetch;

async function install() {
  const res = await t.app.inject({ url: "/oauth/callback?code=abc" });
  expect(res.statusCode).toBe(200);
}

beforeEach(async () => {
  if (t) await t.pool.end();
  tokenCalls.length = 0;
  apiCalls.length = 0;
  t = await testApp(fakeFetch);
});
afterAll(async () => {
  await t?.pool.end();
});

describe("health", () => {
  it("reports the database and a worker that hasn't started", async () => {
    const res = await t.app.inject({ url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, database: "ok", worker: { status: "never seen" } });
  });

  it("only allows Boutiqly to frame the tab", async () => {
    const res = await t.app.inject({ url: "/health" });
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'self' https://app.gohighlevel.com");
  });
});

describe("signing in", () => {
  it("shows an agency user as Boutiqly team, with a brand and no owner yet", async () => {
    const { me } = await signInAs(t.app, people.agency);
    expect(me.role).toBe("boutiqly_team");
    expect(me.roleLabel).toBe("Boutiqly team");
    expect(me.user.name).toBe("Katy Agency");
    expect(me.brand).toMatchObject({ locationId: "loc_test_1", hasOwner: false });
  });

  it("never makes a sub-account admin an owner automatically", async () => {
    const { me } = await signInAs(t.app, people.owner);
    expect(me.role).toBe("none");
  });

  it("refuses payloads Boutiqly didn't encrypt", async () => {
    const res = await t.app.inject({ method: "POST", url: "/api/session", payload: { payload: encryptLikeBoutiqly(people.agency, "guess") } });
    expect(res.statusCode).toBe(401);
  });

  it("refuses API calls without a valid pass", async () => {
    expect((await t.app.inject({ url: "/api/me" })).statusCode).toBe(401);
    expect((await t.app.inject({ url: "/api/me", headers: { authorization: "Bearer nope" } })).statusCode).toBe(401);
  });

  it("asks agency users to pick a sub-account when opened at agency level", async () => {
    const { me } = await signInAs(t.app, { ...people.agency, activeLocation: undefined });
    expect(me.brand).toBeNull();
  });
});

describe("team and access", () => {
  async function setup() {
    const agency = await signInAs(t.app, people.agency);
    const owner = await signInAs(t.app, people.owner);
    await t.app.inject({ method: "POST", url: "/api/access-requests", headers: owner.headers });
    return { agency, owner };
  }

  it("lets Boutiqly's team name the owner from an access request", async () => {
    const { agency, owner } = await setup();
    const team = (await t.app.inject({ url: "/api/team", headers: agency.headers })).json().team;
    expect(team).toEqual([expect.objectContaining({ userId: "u_owner", role: "requested" })]);

    const res = await t.app.inject({ method: "PUT", url: "/api/team/u_owner", headers: agency.headers, payload: { role: "owner" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().team).toEqual([expect.objectContaining({ userId: "u_owner", role: "owner" })]);

    const me = (await t.app.inject({ url: "/api/me", headers: owner.headers })).json().me;
    expect(me.role).toBe("owner");
    expect(me.brand.hasOwner).toBe(true);

    const log = await t.pool.query("SELECT user_name, action FROM audit_log ORDER BY id");
    expect(log.rows).toEqual([
      { user_name: "Olive Owner", action: "access.requested" },
      { user_name: "Katy Agency", action: "team.set_role" },
    ]);
  });

  it("lets an owner add a team member, who can use the tab but not manage the team", async () => {
    const { agency, owner } = await setup();
    await t.app.inject({ method: "PUT", url: "/api/team/u_owner", headers: agency.headers, payload: { role: "owner" } });
    const staff = await signInAs(t.app, people.staff);
    expect(staff.me.role).toBe("none");
    await t.app.inject({ method: "POST", url: "/api/access-requests", headers: staff.headers });

    const add = await t.app.inject({ method: "PUT", url: "/api/team/u_staff", headers: owner.headers, payload: { role: "team" } });
    expect(add.statusCode).toBe(200);

    const me = (await t.app.inject({ url: "/api/me", headers: staff.headers })).json().me;
    expect(me.role).toBe("team");
    expect(me.permissions).toEqual(["use_tab"]);
    const tryManage = await t.app.inject({ method: "PUT", url: "/api/team/u_owner", headers: staff.headers, payload: { role: "team" } });
    expect(tryManage.statusCode).toBe(403);
  });

  it("doesn't let a no-access user see or change the team", async () => {
    await setup();
    const other = await signInAs(t.app, people.other);
    expect((await t.app.inject({ url: "/api/team", headers: other.headers })).statusCode).toBe(403);
    const res = await t.app.inject({ method: "PUT", url: "/api/team/u_other", headers: other.headers, payload: { role: "owner" } });
    expect(res.statusCode).toBe(403);
  });

  it("keeps the last owner from removing themselves", async () => {
    const { agency, owner } = await setup();
    await t.app.inject({ method: "PUT", url: "/api/team/u_owner", headers: agency.headers, payload: { role: "owner" } });
    const res = await t.app.inject({ method: "DELETE", url: "/api/team/u_owner", headers: owner.headers });
    expect(res.statusCode).toBe(400);
  });

  it("keeps brands apart: another sub-account's owner can't touch this one", async () => {
    const { agency } = await setup();
    await t.app.inject({ method: "PUT", url: "/api/team/u_owner", headers: agency.headers, payload: { role: "owner" } });
    // The same person opens the tab in a different sub-account: no access there.
    const elsewhere = await signInAs(t.app, { ...people.owner, activeLocation: "loc_other" });
    expect(elsewhere.me.role).toBe("none");
    expect(elsewhere.me.brand.locationId).toBe("loc_other");
    const res = await t.app.inject({ method: "PUT", url: "/api/team/u_staff", headers: elsewhere.headers, payload: { role: "team" } });
    expect(res.statusCode).toBe(403);
  });

  it("refuses a sub-account claimed by a different agency", async () => {
    await signInAs(t.app, people.agency);
    const intruder = await signInAs(t.app, { ...people.agency, userId: "u_x", companyId: "co_other" });
    expect(intruder.me.brand).toBeNull();
  });

  it("won't add someone Boutiqly doesn't list in this sub-account", async () => {
    await install();
    const { agency } = await setup();
    const res = await t.app.inject({ method: "PUT", url: "/api/team/u_nobody", headers: agency.headers, payload: { role: "team" } });
    expect(res.statusCode).toBe(404);
  });

  it("won't add someone who only asked for access in a different sub-account", async () => {
    await install();
    const agency = await signInAs(t.app, people.agency);
    const elsewhere = await signInAs(t.app, { ...people.other, activeLocation: "loc_other" });
    await t.app.inject({ method: "POST", url: "/api/access-requests", headers: elsewhere.headers });
    const res = await t.app.inject({ method: "PUT", url: "/api/team/u_other", headers: agency.headers, payload: { role: "team" } });
    expect(res.statusCode).toBe(404);
  });
});

describe("setting up a shop from Boutiqly's user list", () => {
  it("lists the sub-account's users, then Boutiqly's team, without people already on the team", async () => {
    await install();
    const agency = await signInAs(t.app, people.agency);
    const res = await t.app.inject({ url: "/api/team/candidates", headers: agency.headers });
    expect(res.json()).toEqual({
      available: true,
      people: [
        { userId: "u_new", name: "Nina New", email: "nina@example.com", role: "candidate", isAgency: false },
        { userId: "u_owner", name: "Olive Owner", email: "olive@example.com", role: "candidate", isAgency: false },
        { userId: "u_agency", name: "Katy Agency", email: "katy@example.com", role: "candidate", isAgency: true },
      ],
    });
  });

  it("lets Boutiqly's team name an owner who has never opened the tab", async () => {
    await install();
    const agency = await signInAs(t.app, people.agency);
    const res = await t.app.inject({ method: "PUT", url: "/api/team/u_new", headers: agency.headers, payload: { role: "owner" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().team).toEqual([expect.objectContaining({ userId: "u_new", name: "Nina New", role: "owner" })]);

    // When Nina opens the tab later, she's the owner straight away.
    const nina = await signInAs(t.app, { ...people.staff, userId: "u_new", userName: "Nina New", email: "nina@example.com" });
    expect(nina.me.role).toBe("owner");
    const candidates = (await t.app.inject({ url: "/api/team/candidates", headers: agency.headers })).json().people;
    expect(candidates.map((p: { userId: string }) => p.userId)).toEqual(["u_owner", "u_agency"]);
  });

  it("lets an agency admin be named owner, and lists agency people who've opened the tab", async () => {
    await install();
    const katy = await signInAs(t.app, people.agency);
    // Ashley is on the agency team but has no login to this sub-account.
    await signInAs(t.app, { ...people.agency, userId: "u_ashley", userName: "Ashley Agency", email: "ashley@example.com" });
    // Someone from a different agency never shows up.
    await signInAs(t.app, { ...people.agency, userId: "u_stranger", companyId: "co_other", activeLocation: "loc_elsewhere" });

    const candidates = (await t.app.inject({ url: "/api/team/candidates", headers: katy.headers })).json().people;
    expect(candidates.filter((p: { isAgency: boolean }) => p.isAgency).map((p: { userId: string }) => p.userId)).toEqual([
      "u_ashley",
      "u_agency",
    ]);

    const res = await t.app.inject({ method: "PUT", url: "/api/team/u_ashley", headers: katy.headers, payload: { role: "owner" } });
    expect(res.statusCode).toBe(200);
    expect(res.json().team).toEqual([expect.objectContaining({ userId: "u_ashley", role: "owner", isAgency: true })]);

    // Katy can name herself too. Both keep full access as Boutiqly's team.
    expect((await t.app.inject({ method: "PUT", url: "/api/team/u_agency", headers: katy.headers, payload: { role: "team" } })).statusCode).toBe(200);
    const me = (await t.app.inject({ url: "/api/me", headers: katy.headers })).json().me;
    expect(me.role).toBe("boutiqly_team");
    expect(me.brand.hasOwner).toBe(true);
    expect((await t.app.inject({ method: "PUT", url: "/api/team/u_stranger", headers: katy.headers, payload: { role: "owner" } })).statusCode).toBe(404);
  });

  it("doesn't show the list to team members or people without access", async () => {
    await install();
    const other = await signInAs(t.app, people.other);
    expect((await t.app.inject({ url: "/api/team/candidates", headers: other.headers })).statusCode).toBe(403);
  });

  it("explains when the app isn't installed in the sub-account", async () => {
    const agency = await signInAs(t.app, people.agency);
    const res = await t.app.inject({ url: "/api/team/candidates", headers: agency.headers });
    expect(res.json()).toMatchObject({ available: false, people: [] });
    expect(res.json().message).toContain("Install Social Studio");
    const add = await t.app.inject({ method: "PUT", url: "/api/team/u_new", headers: agency.headers, payload: { role: "owner" } });
    expect(add.statusCode).toBe(400);
  });

  it("shows the shop's real name once the app is installed", async () => {
    const before = await signInAs(t.app, people.agency);
    expect(before.me.brand.name).toBeNull();
    await install();
    const after = await signInAs(t.app, people.agency);
    expect(after.me.brand.name).toBe("Test Boutique");
    // Only asked once: it's saved after that.
    await signInAs(t.app, people.agency);
    expect(apiCalls.filter((p) => p.startsWith("/locations/"))).toHaveLength(1);
  });
});

describe("install", () => {
  it("stores tokens encrypted and refreshes them when they're about to expire", async () => {
    const res = await t.app.inject({ url: "/oauth/callback?code=abc" });
    expect(res.statusCode).toBe(200);
    expect(tokenCalls[0]?.get("grant_type")).toBe("authorization_code");
    expect(tokenCalls[0]?.get("code")).toBe("abc");

    const row = (await t.pool.query("SELECT * FROM installs")).rows[0];
    expect(row.resource_id).toBe("loc_test_1");
    expect(row.access_token_enc).not.toContain("access-1");

    // The first token expires in 60s, so asking for one refreshes it.
    expect(await accessTokenFor(t.db, t.config, "loc_test_1", fakeFetch)).toBe("access-2");
    expect(tokenCalls[1]?.get("grant_type")).toBe("refresh_token");
    expect(tokenCalls[1]?.get("refresh_token")).toBe("refresh-1");
    // The new one lasts a day, so it's reused.
    expect(await accessTokenFor(t.db, t.config, "loc_test_1", fakeFetch)).toBe("access-2");
    expect(tokenCalls).toHaveLength(2);
  });

  it("explains a missing code", async () => {
    expect((await t.app.inject({ url: "/oauth/callback" })).statusCode).toBe(400);
  });
});
