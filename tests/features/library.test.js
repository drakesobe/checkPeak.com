// Workout Library: athletes pick a coach-saved workout for an off day without asking a coach.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fakeSupabase";
import { callApi, coachSession, athleteSession, asCookie } from "../helpers/http";

const h = vi.hoisted(() => ({ db: null }));
vi.mock("@/lib/supabase", () => ({ get supabaseAdmin() { return h.db; }, get supabase() { return h.db; } }));

import library from "@/pages/api/athlete/library/index";
import start from "@/pages/api/athlete/library/start";
import coachLibrary from "@/pages/api/org/library";
import saveTemplate from "@/pages/api/org/templates/save";

const TEAM = "ORG-AAA111-BBB222";
const RIVAL = "ORG-ZZZ999-YYY888";
const today = new Date().toISOString().slice(0, 10);

const legDay = {
  id: "t-legs", name: "Off-day legs", category: "strength", sport: "", athleteVisible: true,
  exercises: [
    { Order: 2, ExerciseName: "RDL", Sets: 3, Reps: "10", EvidenceRequired: "none" },
    { Order: 1, ExerciseName: "Back squat", Sets: 4, Reps: "6", Weight: "70%", EvidenceRequired: "video" },
    { Order: 3, ExerciseName: "", Sets: 1 }, // blank rows are ignored
  ],
};
const testDay = { id: "t-test", name: "Max testing", category: "strength", athleteVisible: false, exercises: [{ ExerciseName: "1RM squat" }] };

beforeEach(() => {
  h.db = createFakeSupabase({
    organizations: [
      { id: "org-1", token: TEAM, name: "State", workout_templates: [legDay, testDay] },
      { id: "org-2", token: RIVAL, name: "Rival", workout_templates: [{ id: "t-rival", name: "Rival secret", athleteVisible: true, exercises: [{ ExerciseName: "x" }] }] },
    ],
    athletes: [
      { id: "a1", athlete_token: "ATH-111", org_token: TEAM, sport: "football", email: "a@state.edu" },
      { id: "a2", athlete_token: "ATH-NOTEAM", org_token: null, email: "free@agent.edu" },
    ],
    daily_workouts: [],
    workout_items: [],
  });
});

const asAthlete = async (athleteToken = "ATH-111", token = TEAM) => JSON.stringify(await athleteSession({ athleteToken, token }));

describe("GET /api/athlete/library", () => {
  it("shows the athlete's team workouts that are open to athletes, in exercise order", async () => {
    const res = await callApi(library, { query: { _authUser: await asAthlete(), date: today } });
    expect(res.statusCode).toBe(200);
    expect(res.body.program).toEqual({ name: "State" });
    expect(res.body.workouts.map((w) => w.name)).toEqual(["Off-day legs"]); // coaches-only workout hidden
    expect(res.body.workouts[0]).toMatchObject({ exerciseCount: 2, exercises: [{ name: "Back squat", evidence: "video" }, { name: "RDL" }] });
  });

  it("uses the athlete's real team even if their session claims another", async () => {
    const res = await callApi(library, { query: { _authUser: await asAthlete("ATH-111", RIVAL) } });
    expect(res.body.workouts.map((w) => w.name)).toEqual(["Off-day legs"]);
  });

  it("is empty (not an error) for an athlete not on a team yet", async () => {
    const res = await callApi(library, { query: { _authUser: await asAthlete("ATH-NOTEAM", "") } });
    expect(res.body).toMatchObject({ ok: true, program: null, workouts: [] });
  });

  it("is athletes only", async () => {
    expect((await callApi(library, { query: {} })).statusCode).toBe(401);
    const coach = await coachSession({ token: TEAM });
    expect((await callApi(library, { query: { _authUser: JSON.stringify(coach) } })).statusCode).toBe(403);
  });
});

describe("POST /api/athlete/library/start", () => {
  const go = async (workoutId, opts = {}) => callApi(start, { method: "POST", body: { workoutId, date: today, _authUser: await asAthlete(opts.athlete, opts.token) , ...opts.body } });

  it("puts the workout on the athlete's Today as a normal workout with its exercises", async () => {
    const res = await go("t-legs");
    expect(res.body).toMatchObject({ ok: true, alreadyAdded: false, itemCount: 2 });
    const [dw] = h.db.tables.daily_workouts;
    expect(dw).toMatchObject({ athlete_id: "a1", athlete_token: "ATH-111", org_token: TEAM, org_id: "org-1", date: today, title: "Off-day legs", status: "assigned", source_workout_id: "library:t-legs", sport: "football" });
    expect(h.db.tables.workout_items.map((i) => [i.exercise_name, i.sets, i.evidence_required])).toEqual([["Back squat", 4, "video"], ["RDL", 3, "none"]]);
  });

  it("doesn't duplicate if the athlete taps twice", async () => {
    await go("t-legs");
    const again = await go("t-legs");
    expect(again.body.alreadyAdded).toBe(true);
    expect(h.db.tables.daily_workouts).toHaveLength(1);
  });

  it("shows as added in the library afterwards", async () => {
    const { body } = await go("t-legs");
    const res = await callApi(library, { query: { _authUser: await asAthlete(), date: today } });
    expect(res.body.addedOn).toEqual({ "t-legs": body.dailyWorkoutId });
  });

  it("refuses coaches-only workouts and other teams' workouts", async () => {
    expect((await go("t-test")).statusCode).toBe(404);
    expect((await go("t-rival", { token: RIVAL })).statusCode).toBe(404);
    expect(h.db.tables.daily_workouts).toHaveLength(0);
  });

  it("only allows today or the coming week", async () => {
    expect((await go("t-legs", { body: { date: "2020-01-01" } })).statusCode).toBe(400);
    expect((await go("t-legs", { body: { date: "not-a-date" } })).statusCode).toBe(400);
  });

  it("needs a team", async () => {
    expect((await go("t-legs", { athlete: "ATH-NOTEAM", token: "" })).statusCode).toBe(403);
  });
});

describe("coach side", () => {
  it("lists every saved workout with usage from athletes", async () => {
    await callApi(start, { method: "POST", body: { workoutId: "t-legs", date: today, _authUser: await asAthlete() } });
    const res = await callApi(coachLibrary, { cookies: asCookie(await coachSession({ token: TEAM })) });
    expect(res.statusCode).toBe(200);
    expect(res.body.workouts.map((w) => [w.name, w.athleteVisible, w.uses30d])).toEqual([["Max testing", false, 0], ["Off-day legs", true, 1]]);
    expect(res.body.totals).toEqual({ uses30d: 1, athletes30d: 1 });
  });

  it("editing from the schedule builder (which doesn't know the toggle) keeps a workout hidden", async () => {
    const cookies = asCookie(await coachSession({ token: TEAM }));
    const { athleteVisible, ...withoutToggle } = testDay;
    await callApi(saveTemplate, { method: "POST", cookies, body: { template: { ...withoutToggle, name: "Max testing v2" } } });
    const saved = h.db.tables.organizations[0].workout_templates.find((t) => t.id === "t-test");
    expect(saved).toMatchObject({ name: "Max testing v2", athleteVisible: false });
  });

  it("new saved workouts are open to athletes by default", async () => {
    const cookies = asCookie(await coachSession({ token: TEAM }));
    const res = await callApi(saveTemplate, { method: "POST", cookies, body: { template: { name: "Conditioning", exercises: [{ ExerciseName: "Bike" }] } } });
    expect(res.body.template.athleteVisible).toBe(true);
  });
});
