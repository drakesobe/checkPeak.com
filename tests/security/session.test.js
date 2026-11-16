// Signed sessions: every permission check trusts these, so forgery must always fail.
import { describe, it, expect, vi } from "vitest";
import { signSession, verifySession, sessionClaims, parseSessionString } from "@/lib/session";

const coach = { email: "Coach@State.edu", role: "Organization", orgId: "org-1", Token: "ORG-AAA111-BBB222", name: "Coach" };

describe("signSession / verifySession", () => {
  it("accepts an untouched signed session", async () => {
    const [s] = await signSession(coach);
    expect(await verifySession(s)).toBe(true);
  });

  it("ignores display fields so clients can add them", async () => {
    const [s] = await signSession(coach);
    expect(await verifySession({ ...s, name: "Renamed", avatarUrl: "x.png", orgName: "New name" })).toBe(true);
  });

  it.each([
    ["role escalation", { role: "admin" }],
    ["email swap", { email: "someone@else.edu" }],
    ["team swap (staff)", { Token: "ORG-OTHER-TEAM" }],
    ["org id swap", { orgId: "org-2" }],
    ["conflicting alias added", { orgToken: "ORG-OTHER-TEAM" }],
    ["conflicting email alias", { Email: "attacker@x.edu" }],
  ])("rejects %s", async (_label, change) => {
    const [s] = await signSession(coach);
    expect(await verifySession({ ...s, ...change })).toBe(false);
  });

  it("treats case and whitespace differences in claims as the same identity", async () => {
    const [s] = await signSession(coach);
    expect(await verifySession({ ...s, email: " coach@state.edu ", Token: "org-aaa111-bbb222" })).toBe(true);
  });

  it("rejects unsigned, garbage and wrong-signature sessions", async () => {
    expect(await verifySession(coach)).toBe(false);
    expect(await verifySession(null)).toBe(false);
    expect(await verifySession("string")).toBe(false);
    const [s] = await signSession(coach);
    expect(await verifySession({ ...s, _sig: s._sig.replace(/.$/, (c) => (c === "a" ? "b" : "a")) })).toBe(false);
    expect(await verifySession({ ...s, _sig: "short" })).toBe(false);
  });

  it("expires after a year and rejects future-dated sessions", async () => {
    const [s] = await signSession(coach);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 366 * 24 * 3600 * 1000);
    expect(await verifySession(s)).toBe(false);
    vi.useRealTimers();
    const [future] = await signSession(coach);
    expect(await verifySession({ ...future, _iat: future._iat + 3600 })).toBe(false);
  });

  it("does not sign an athlete's team code (athletes switch teams in the app)", async () => {
    const [s] = await signSession({ email: "a@state.edu", role: "Athlete", athlete_token: "ATH-1", Token: "ORG-AAA" });
    expect(await verifySession({ ...s, Token: "ORG-BBB" })).toBe(true);
    // ...so routes must never trust an athlete session's team code (see access tests)
    expect(await verifySession({ ...s, athlete_token: "ATH-2" })).toBe(false);
  });

  it("refuses to sign a session whose identity fields disagree", async () => {
    await expect(signSession({ email: "a@x.edu", Email: "b@x.edu" })).rejects.toThrow();
  });

  it("signs several shapes of one login independently", async () => {
    const [cookie, body] = await signSession({ ...coach, athleteId: "" }, { email: coach.email, role: coach.role, Token: coach.Token, orgId: coach.orgId });
    expect(await verifySession(cookie)).toBe(true);
    expect(await verifySession(body)).toBe(true);
  });
});

describe("sessionClaims", () => {
  it("normalizes role spellings", () => {
    expect(sessionClaims({ role: "Head Trainer" }).role).toBe("admin");
    expect(sessionClaims({ role: "coach" }).role).toBe("trainer");
    expect(sessionClaims({ role: "Organization" }).role).toBe("organization");
  });
  it("returns null for non-objects and conflicting aliases", () => {
    expect(sessionClaims(null)).toBeNull();
    expect(sessionClaims({ Token: "A", token: "B" })).toBeNull();
  });
});

describe("parseSessionString", () => {
  it("parses plain, URI-encoded and double-encoded JSON", () => {
    const json = JSON.stringify({ a: 1 });
    expect(parseSessionString(json)).toEqual({ a: 1 });
    expect(parseSessionString(encodeURIComponent(json))).toEqual({ a: 1 });
    expect(parseSessionString(encodeURIComponent(encodeURIComponent(json)))).toEqual({ a: 1 });
  });
  it("returns null for empty, invalid or non-object input", () => {
    expect(parseSessionString("")).toBeNull();
    expect(parseSessionString(null)).toBeNull();
    expect(parseSessionString("{bad")).toBeNull();
    expect(parseSessionString("42")).toBeNull();
  });
});
