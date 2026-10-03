import { describe, expect, it } from "vitest";
import { decryptUserContext, UserContextError } from "../src/auth/userContext.ts";
import { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from "../src/auth/session.ts";
import { open, seal } from "../src/auth/secretBox.ts";
import { encryptLikeBoutiqly, people, TEST_SECRET } from "./helpers.ts";
import { resolveRole } from "../../shared/roles.ts";

describe("Boutiqly user context", () => {
  it("decrypts and normalizes a sub-account user", () => {
    const ctx = decryptUserContext(encryptLikeBoutiqly(people.owner), TEST_SECRET);
    expect(ctx).toEqual({
      userId: "u_owner", companyId: "co_boutiqly", locationId: "loc_test_1",
      isAgencyUser: false, platformRole: "admin", name: "Olive Owner", email: "olive@example.com",
    });
  });

  it("recognizes agency users", () => {
    expect(decryptUserContext(encryptLikeBoutiqly(people.agency), TEST_SECRET).isAgencyUser).toBe(true);
  });

  it("rejects the wrong secret", () => {
    expect(() => decryptUserContext(encryptLikeBoutiqly(people.owner), "other-secret")).toThrow(UserContextError);
  });

  it("rejects tampered payloads", () => {
    const raw = Buffer.from(encryptLikeBoutiqly(people.owner), "base64");
    raw[raw.length - 5]! ^= 0xff;
    expect(() => decryptUserContext(raw.toString("base64"), TEST_SECRET)).toThrow(UserContextError);
  });

  it("rejects junk and missing ids", () => {
    expect(() => decryptUserContext("hello", TEST_SECRET)).toThrow(UserContextError);
    expect(() => decryptUserContext(encryptLikeBoutiqly({ userId: "x" }), TEST_SECRET)).toThrow(UserContextError);
    expect(() => decryptUserContext(encryptLikeBoutiqly(people.owner), "")).toThrow(UserContextError);
  });
});

describe("session token", () => {
  const ctx = decryptUserContext(encryptLikeBoutiqly(people.staff), TEST_SECRET);

  it("round-trips", () => {
    expect(verifySessionToken(createSessionToken(ctx, "k"), "k")).toEqual(ctx);
  });

  it("expires", () => {
    const t = createSessionToken(ctx, "k", 0);
    expect(verifySessionToken(t, "k", (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
  });

  it("rejects a forged or edited token", () => {
    const t = createSessionToken(ctx, "k");
    expect(verifySessionToken(t, "other")).toBeNull();
    const [data, sig] = t.split(".");
    const edited = Buffer.from(JSON.stringify({ ...ctx, isAgencyUser: true, exp: 9e9 })).toString("base64url");
    expect(verifySessionToken(`${edited}.${sig}`, "k")).toBeNull();
    expect(verifySessionToken(`${data}.${sig}.x`, "k")).toBeNull();
  });
});

describe("token encryption", () => {
  it("round-trips and refuses the wrong key", () => {
    const sealed = seal("secret-token", "key-1");
    expect(sealed).not.toContain("secret-token");
    expect(open(sealed, "key-1")).toBe("secret-token");
    expect(() => open(sealed, "key-2")).toThrow();
  });
});

describe("roles", () => {
  it.each([
    [true, null, "boutiqly_team"],
    [true, "team", "boutiqly_team"],
    [false, "owner", "owner"],
    [false, "team", "team"],
    [false, null, "none"],
  ] as const)("agency=%s team=%s → %s", (isAgencyUser, teamRole, role) => {
    expect(resolveRole({ isAgencyUser, teamRole })).toBe(role);
  });
});
