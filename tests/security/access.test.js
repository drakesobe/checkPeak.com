// Who can see and change what. Each test pins a hole that existed and was closed.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fakeSupabase";
import { callApi, coachSession, athleteSession, asCookie } from "../helpers/http";

const h = vi.hoisted(() => ({ db: null }));
vi.mock("@/lib/supabase", () => ({ get supabaseAdmin() { return h.db; }, get supabase() { return h.db; } }));

import { requireOrg } from "@/lib/requireOrg";
import { requireOwnOrgToken } from "@/lib/requireUser";
import getAthletesByToken from "@/pages/api/org/getAthletesByToken";
import teammates from "@/pages/api/athlete/teammates";
import reviewQueueUpdate from "@/pages/api/org/reviewQueue/reviewQueueUpdate";

const MY_TEAM = "ORG-AAA111-BBB222";
const OTHER_TEAM = "ORG-ZZZ999-YYY888";

beforeEach(() => {
  h.db = createFakeSupabase({
    organizations: [{ id: "org-1", token: MY_TEAM, name: "State" }, { id: "org-2", token: OTHER_TEAM, name: "Rival" }],
    billing: [{ id: "b1", org_id: "org-1", token: MY_TEAM, billing_status: "Free", plan: "Starter" }],
    athletes: [
      { id: "a1", athlete_token: "ATH-111", email: "athlete@state.edu", name: "Mine", org_token: MY_TEAM, status: "active" },
      { id: "a2", athlete_token: "ATH-222", email: "rival@rival.edu", name: "Theirs", org_token: OTHER_TEAM, status: "active" },
    ],
    workout_completions: [
      { id: "wc-mine", athlete_id: "a1", org_id: null, status: "pending_review", workout_item_id: null },
      { id: "wc-rival", athlete_id: "a2", org_id: null, status: "pending_review", workout_item_id: null },
    ],
  });
});

describe("requireOrg", () => {
  it("never accepts a bare team code as identity", () => {
    for (const req of [
      { query: { token: MY_TEAM }, headers: {} },
      { query: {}, headers: { "x-org-token": MY_TEAM } },
      { query: {}, headers: { authorization: `Bearer ${MY_TEAM}` } },
    ]) expect(requireOrg(req).ok).toBe(false);
  });

  it("rejects athlete sessions", async () => {
    const s = await athleteSession();
    expect(requireOrg({ query: {}, headers: {}, cookies: asCookie(s) }).ok).toBe(false);
  });

  it("accepts a coach via cookie or the mobile _authUser field", async () => {
    const s = await coachSession({ token: MY_TEAM });
    expect(requireOrg({ query: {}, headers: {}, cookies: asCookie(s) })).toMatchObject({ ok: true, org: { token: MY_TEAM } });
    expect(requireOrg({ query: { _authUser: JSON.stringify(s) }, headers: {} }).ok).toBe(true);
    expect(requireOrg({ query: {}, headers: {}, body: { _authUser: s } }).ok).toBe(true);
  });
});

describe("requireOwnOrgToken", () => {
  const res = () => ({ code: 0, status(c) { this.code = c; return this; }, json() { return this; } });

  it("allows staff of that team and refuses other teams", async () => {
    const s = await coachSession({ token: MY_TEAM });
    const req = { query: { _authUser: JSON.stringify(s) } };
    expect(requireOwnOrgToken(req, res(), MY_TEAM.toLowerCase(), { staffOnly: true })).toBeTruthy();
    const r = res();
    expect(requireOwnOrgToken(req, r, OTHER_TEAM, { staffOnly: true })).toBeNull();
    expect(r.code).toBe(403);
  });

  it("keeps athletes out of staff-only data even on their own team", async () => {
    const s = await athleteSession({ token: MY_TEAM });
    expect(requireOwnOrgToken({ query: { _authUser: JSON.stringify(s) } }, res(), MY_TEAM, { staffOnly: true })).toBeNull();
  });

  it("returns 401 with no session", () => {
    const r = res();
    expect(requireOwnOrgToken({ query: {} }, r, MY_TEAM)).toBeNull();
    expect(r.code).toBe(401);
  });
});

describe("GET /api/org/getAthletesByToken (roster with emails)", () => {
  it("401 without a session", async () => {
    expect((await callApi(getAthletesByToken, { query: { token: MY_TEAM } })).statusCode).toBe(401);
  });
  it("403 for another team's roster", async () => {
    const res = await callApi(getAthletesByToken, { query: { token: OTHER_TEAM }, cookies: asCookie(await coachSession({ token: MY_TEAM })) });
    expect(res.statusCode).toBe(403);
  });
  it("returns only my roster to my staff", async () => {
    const res = await callApi(getAthletesByToken, { query: { token: MY_TEAM }, cookies: asCookie(await coachSession({ token: MY_TEAM })) });
    expect(res.statusCode).toBe(200);
    expect(res.body.athletes.map((a) => a.email)).toEqual(["athlete@state.edu"]);
  });
});

describe("GET /api/athlete/teammates", () => {
  it("uses the database team, not the athlete session's unsigned team code", async () => {
    // Athlete edits their (unsigned) Token to the rival team and asks for that roster
    const s = await athleteSession({ athleteToken: "ATH-111", token: OTHER_TEAM });
    const res = await callApi(teammates, { query: { token: OTHER_TEAM, _authUser: JSON.stringify(s) } });
    expect(res.statusCode).toBe(403);
  });
  it("lists teammates on the athlete's real team", async () => {
    const s = await athleteSession({ athleteToken: "ATH-111", token: MY_TEAM });
    const res = await callApi(teammates, { query: { _authUser: JSON.stringify(s) } });
    expect(res.statusCode).toBe(200);
    expect(res.body.teammates.map((t) => t.name)).toEqual(["Mine"]);
  });
});

describe("POST /api/org/reviewQueue/reviewQueueUpdate", () => {
  const approve = (id) => ({ id, type: "workout", reviewStatus: "approved" });

  it("athletes cannot approve workouts (mobile path)", async () => {
    const s = await athleteSession({ token: MY_TEAM });
    const res = await callApi(reviewQueueUpdate, { method: "POST", body: { ...approve("wc-mine"), _authUser: JSON.stringify(s) } });
    expect(res.statusCode).toBe(401);
    expect(h.db.tables.workout_completions[0].status).toBe("pending_review");
  });

  it("coaches cannot approve another program's work", async () => {
    const s = await coachSession({ token: MY_TEAM });
    const res = await callApi(reviewQueueUpdate, { method: "POST", body: { ...approve("wc-rival"), _authUser: JSON.stringify(s) } });
    expect(res.statusCode).toBe(403);
    expect(h.db.tables.workout_completions[1].status).toBe("pending_review");
  });

  it("coaches approve their own athletes' work", async () => {
    const s = await coachSession({ token: MY_TEAM });
    const res = await callApi(reviewQueueUpdate, { method: "POST", body: { ...approve("wc-mine"), _authUser: JSON.stringify(s) } });
    expect(res.statusCode).toBe(200);
    expect(h.db.tables.workout_completions[0].status).toBe("completed");
  });

  it("requires a note when asking for more info", async () => {
    const s = await coachSession({ token: MY_TEAM });
    const res = await callApi(reviewQueueUpdate, { method: "POST", body: { id: "wc-mine", type: "workout", reviewStatus: "needs_info", _authUser: JSON.stringify(s) } });
    expect(res.statusCode).toBe(400);
  });
});

describe("staff permission rules", async () => {
  const { canManageMembers, canManageAdmins, canInviteRole, requireOrgOwner, requireOrgAdminish, requireAthleteUser } = await import("@/lib/requireUser");
  const res = () => ({ code: 200, status(c) { this.code = c; return this; }, json() { return this; } });
  const reqFor = (s) => ({ query: { _authUser: JSON.stringify(s) } });

  it("owner manages everyone; head coach invites trainers only; trainers invite no one", () => {
    expect(canInviteRole({ role: "organization" }, "admin")).toBe(true);
    expect(canInviteRole({ role: "organization" }, "trainer")).toBe(true);
    expect(canInviteRole({ role: "admin" }, "trainer")).toBe(true);
    expect(canInviteRole({ role: "admin" }, "admin")).toBe(false);
    expect(canInviteRole({ role: "trainer" }, "trainer")).toBe(false);
    expect(canInviteRole({ role: "organization" }, "athlete")).toBe(false);
    expect(canManageMembers({ role: "admin" })).toBe(true);
    expect(canManageMembers({ role: "trainer" })).toBe(false);
    expect(canManageAdmins({ role: "organization" })).toBe(true);
    expect(canManageAdmins({ role: "admin" })).toBe(false);
  });

  it("route guards return 403 for the wrong role", async () => {
    const trainer = await coachSession({ role: "Trainer" });
    const owner = await coachSession({ role: "Organization" });
    const athlete = await athleteSession();
    let r = res(); expect(requireOrgOwner(reqFor(trainer), r)).toBeNull(); expect(r.code).toBe(403);
    r = res(); expect(requireOrgAdminish(reqFor(trainer), r)).toBeNull(); expect(r.code).toBe(403);
    expect(requireOrgOwner(reqFor(owner), res())).toMatchObject({ role: "organization" });
    r = res(); expect(requireAthleteUser(reqFor(owner), r)).toBeNull(); expect(r.code).toBe(403);
    expect(requireAthleteUser(reqFor(athlete), res())).toMatchObject({ role: "athlete" });
  });
});
