// Getting athletes onto a team: CSV import, invite email, and claiming the pre-added account.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fakeSupabase";
import { callApi, coachSession, asCookie } from "../helpers/http";

const h = vi.hoisted(() => ({ db: null, send: null }));
vi.mock("@/lib/supabase", () => ({ get supabaseAdmin() { return h.db; }, get supabase() { return h.db; } }));
vi.mock("resend", () => ({ Resend: class { constructor() { this.batch = { send: (...a) => h.send(...a) }; this.emails = { send: async () => ({}) }; } } }));

import bulkImport from "@/pages/api/org/athlete/bulk-import";
import athleteSignup from "@/pages/api/athlete-signup";
import { buildAthleteInvite, sendAthleteInvites, APP_STORE_URL } from "@/lib/email/athleteInvite";

const TEAM = "ORG-AAA111-BBB222";

beforeEach(() => {
  h.db = createFakeSupabase({
    organizations: [{ id: "org-1", token: TEAM, name: "Northwestern State" }, { id: "org-2", token: "ORG-OTHER", name: "Rival" }],
    athletes: [
      { id: "a-existing", email: "already@state.edu", org_token: TEAM, athlete_token: "ATH-1", password_hash: "x" },
      { id: "a-elsewhere", email: "transfer@rival.edu", org_token: "ORG-OTHER", athlete_token: "ATH-2", password_hash: "x" },
    ],
  });
  h.send = vi.fn(async () => ({ data: {}, error: null }));
  process.env.RESEND_API_KEY = "re_test";
});

const importAs = async (athletes) => callApi(bulkImport, {
  method: "POST", body: { athletes }, cookies: asCookie(await coachSession({ token: TEAM, email: "coach@state.edu", name: "Coach Ramirez" })),
});

describe("POST /api/org/athlete/bulk-import", () => {
  it("adds new athletes to the coach's team without a password, and emails each one", async () => {
    const res = await importAs([
      { firstName: "Jordan", lastName: "Ellis", email: "Jordan.Ellis@State.edu", sport: "Football" },
      { firstName: "Sam", lastName: "Lee", email: "sam@state.edu" },
    ]);
    expect(res.body).toMatchObject({ ok: true, created: 2, skipped: 0, invites: { sent: 2, failed: 0 } });
    const added = h.db.tables.athletes.filter((a) => a.email === "jordan.ellis@state.edu" || a.email === "sam@state.edu");
    expect(added).toHaveLength(2);
    expect(added.every((a) => a.org_token === TEAM && !a.password_hash && /^ATH-/.test(a.athlete_token))).toBe(true);

    const [batch] = h.send.mock.calls[0];
    expect(batch.map((m) => m.to)).toEqual(["jordan.ellis@state.edu", "sam@state.edu"]);
    expect(batch[0]).toMatchObject({ replyTo: "coach@state.edu", subject: "Coach Ramirez added you to Northwestern State on CheckPeak" });
    expect(batch[0].text).toContain(TEAM);
  });

  it("skips people already on CheckPeak with a clear reason, and bad rows", async () => {
    const res = await importAs([
      { firstName: "A", lastName: "B", email: "already@state.edu" },
      { firstName: "C", lastName: "D", email: "transfer@rival.edu" },
      { firstName: "", lastName: "D", email: "noname@state.edu" },
      { firstName: "E", lastName: "F", email: "not-an-email" },
      { firstName: "G", lastName: "H", email: "dup@state.edu" },
      { firstName: "G", lastName: "H", email: "DUP@state.edu" },
    ]);
    expect(res.body.created).toBe(1);
    const reasons = Object.fromEntries(res.body.errors.map((e) => [e.email, e.reason]));
    expect(reasons["already@state.edu"]).toBe("Already on your roster");
    expect(reasons["transfer@rival.edu"]).toMatch(/join with your team code/);
    expect(reasons["noname@state.edu"]).toMatch(/name/);
    expect(reasons["not-an-email"]).toBe("Invalid email");
    expect(reasons["dup@state.edu"]).toMatch(/twice/);
  });

  it("still imports when email isn't configured, and reports invites as not sent", async () => {
    delete process.env.RESEND_API_KEY;
    const res = await importAs([{ firstName: "Jo", lastName: "X", email: "jo@state.edu" }]);
    expect(res.body).toMatchObject({ created: 1, invites: { sent: 0, skipped: 1 } });
  });

  it("reports failed invites without failing the import", async () => {
    h.send = vi.fn(async () => { throw new Error("Resend down"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await importAs([{ firstName: "Jo", lastName: "X", email: "jo@state.edu" }]);
    expect(res.body).toMatchObject({ created: 1, invites: { sent: 0, failed: 1 } });
  });

  it("is staff-only", async () => {
    expect((await callApi(bulkImport, { method: "POST", body: { athletes: [] } })).statusCode).toBe(401);
  });
});

describe("POST /api/athlete-signup (claiming a pre-added account)", () => {
  beforeEach(async () => {
    h.db.tables.athletes.push({ id: "a-pre", email: "jordan@state.edu", org_token: TEAM, athlete_token: "ATH-PRE", password_hash: null, name: "Jordan Ellis" });
  });
  const signup = (body) => callApi(athleteSignup, { method: "POST", body: { name: "Jordan Ellis", email: "jordan@state.edu", password: "Sup3rSecret!", ...body } });

  it("links the athlete to the roster row when the team code matches", async () => {
    const res = await signup({ token: TEAM.toLowerCase() });
    expect(res.body).toMatchObject({ success: true, athleteId: "a-pre", athleteToken: "ATH-PRE", organization: TEAM });
    expect(h.db.tables.athletes.find((a) => a.id === "a-pre").password_hash).toMatch(/^\$2/);
  });

  it("refuses without the right team code, so knowing an email isn't enough", async () => {
    expect((await signup({ token: "ORG-WRONG" })).statusCode).toBe(409);
    expect((await signup({})).statusCode).toBe(409);
    expect(h.db.tables.athletes.find((a) => a.id === "a-pre").password_hash).toBeNull();
  });

  it("can only be claimed once", async () => {
    await signup({ token: TEAM });
    const again = await signup({ token: TEAM, password: "Different99!" });
    expect(again.statusCode).toBe(409);
  });

  it("requires a real password", async () => {
    expect((await signup({ token: TEAM, password: "short" })).statusCode).toBe(400);
  });
});

describe("invite email content", () => {
  it("escapes names so a roster file can't inject HTML", () => {
    const { html, subject } = buildAthleteInvite({ athleteName: "<script>x</script>", orgName: "State & Co", coachName: "", teamCode: TEAM, email: "a@b.edu" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("State &amp; Co");
    expect(subject).toBe("You've been added to State & Co on CheckPeak");
    expect(html).toContain(APP_STORE_URL);
  });

  it("sends in batches of 100", async () => {
    const athletes = Array.from({ length: 205 }, (_, i) => ({ email: `a${i}@state.edu`, name: "A" }));
    const r = await sendAthleteInvites({ athletes, orgName: "State", teamCode: TEAM });
    expect(r.sent).toBe(205);
    expect(h.send.mock.calls.map(([b]) => b.length)).toEqual([100, 100, 5]);
  });
});
