// Coach-facing features: ingredient search, nutrition plans, Today page, product catalog.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fakeSupabase";
import { callApi, coachSession, asCookie } from "../helpers/http";

const h = vi.hoisted(() => ({ db: null }));
vi.mock("@/lib/supabase", () => ({ get supabaseAdmin() { return h.db; }, get supabase() { return h.db; } }));

import search from "@/pages/api/search";
import bulkAssign from "@/pages/api/org/nutrition/bulk-assign-plan";
import assignPlan from "@/pages/api/org/nutrition/assign-plan";
import today from "@/pages/api/org/today";
import { listProducts, updateProduct } from "@/lib/affiliateProducts";

const TEAM = "ORG-AAA111-BBB222";
const coach = async () => asCookie(await coachSession({ token: TEAM, orgId: "org-1" }));

describe("POST /api/search", () => {
  beforeEach(() => {
    h.db = createFakeSupabase({
      banned_substances: [
        { id: "b1", substance_name: "DMAA", synonyms: "1, 3-dimethylamylamine, Methylhexanamine", banned_by: "NCAA, WADA", ban_type: "Prohibited" },
        { id: "b2", substance_name: "Caffeine", synonyms: "", banned_by: "NCAA", ban_type: "Limited" },
      ],
      ingredients: [
        { id: "i1", name: "Caffeine", benefits: "Alertness" },
        { id: "i2", name: "Creatine Monohydrate", synonyms: "creatine", benefits: "Strength" },
      ],
    });
  });
  const q = (query) => callApi(search, { method: "POST", body: { query } });

  it("returns banned matches first, enriched with ingredient info, without duplicates", async () => {
    const res = await q("caffeine");
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0]).toMatchObject({ name: "Caffeine", banType: "Limited", benefits: "Alertness" });
  });

  it("matches synonyms and treats commas loosely (1,3 vs 1, 3)", async () => {
    expect((await q("1,3-dimethyl")).body.records[0].name).toBe("DMAA");
    expect((await q("methylhexanamine")).body.records[0].name).toBe("DMAA");
  });

  it("rejects queries without at least 2 letters or numbers (no match-everything)", async () => {
    for (const bad of ["", "x", ",,", "%%", "()"]) expect((await q(bad)).statusCode).toBe(400);
  });

  it("strips filter syntax so input can't alter the database query", async () => {
    // An injected ",name.ilike.%" would match every row; neutralized, it matches nothing extra
    const res = await q("zzz),substance_name.ilike.%");
    expect(res.statusCode).toBe(200);
    expect(res.body.records).toEqual([]);
  });

  it("only accepts POST", async () => {
    expect((await callApi(search, { method: "GET" })).statusCode).toBe(405);
  });
});

describe("nutrition plans", () => {
  beforeEach(() => {
    h.db = createFakeSupabase({
      athletes: [
        { id: "a1", athlete_token: "ATH-1", org_token: TEAM },
        { id: "a2", athlete_token: "ATH-2", org_token: TEAM },
        { id: "x1", athlete_token: "ATH-RIVAL", org_token: "ORG-OTHER" },
      ],
      nutrition_plans: [{ id: "p-old", athlete_token: "ATH-1", status: "active" }],
    });
  });
  const plan = { calories: 3200, protein: 210, carbs: 380, fat: 90, phase: "bulk", notes: "Game week" };

  it("Group Blast gives everyone the plan, archives old ones, and skips other teams' athletes", async () => {
    const res = await callApi(bulkAssign, { method: "POST", cookies: await coach(), body: { athleteTokens: ["ATH-1", "ATH-2", "ATH-RIVAL", "ATH-1"], plan } });
    expect(res.body).toMatchObject({ ok: true, succeeded: 2, failed: 1 });
    expect(res.body.results.find((r) => r.athleteToken === "ATH-RIVAL")).toMatchObject({ ok: false });
    expect(h.db.tables.nutrition_plans.find((p) => p.id === "p-old").status).toBe("archived");
    const active = h.db.tables.nutrition_plans.filter((p) => p.status === "active");
    expect(active).toHaveLength(2);
    expect(active[0]).toMatchObject({ phase: "Surplus", daily_calories: "3200", org_token: TEAM });
  });

  it("validates input", async () => {
    const cookies = await coach();
    expect((await callApi(bulkAssign, { method: "POST", cookies, body: { athleteTokens: [], plan } })).statusCode).toBe(400);
    expect((await callApi(bulkAssign, { method: "POST", cookies, body: { athleteTokens: ["ATH-1"], plan: { calories: 1 } } })).statusCode).toBe(400);
    expect((await callApi(bulkAssign, { method: "POST", body: { athleteTokens: ["ATH-1"], plan } })).statusCode).toBe(401);
  });

  it("single assign returns 404 for an athlete on another team", async () => {
    const res = await callApi(assignPlan, { method: "POST", cookies: await coach(), body: { athleteToken: "ATH-RIVAL", plan } });
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/org/today", () => {
  beforeEach(() => {
    h.db = createFakeSupabase({
      organizations: [{ id: "org-1", token: TEAM, name: "State", email: "owner@state.edu", season_calendar: [] }],
      athletes: [{ id: "a1", org_token: TEAM }, { id: "a2", org_token: TEAM }],
      org_members: [{ email: "owner@state.edu", org_token: TEAM, active: true }, { email: "asst@state.edu", org_token: TEAM, active: false }],
      daily_workouts: [
        { id: "w1", org_token: TEAM, date: "2026-11-15", title: "Lift A", scheduled_time: "06:00:00", status: "completed", sport: "football" },
        { id: "w2", org_token: TEAM, date: "2026-11-15", title: "Lift A", scheduled_time: "06:00:00", status: "pending_review", sport: "football" },
        { id: "w3", org_token: TEAM, date: "2026-11-15", title: "Recovery", scheduled_time: null, status: "assigned" },
        { id: "w4", org_token: "ORG-OTHER", date: "2026-11-15", title: "Not mine", status: "assigned" },
      ],
    });
  });

  it("builds the setup checklist from real data and groups today's sessions", async () => {
    const res = await callApi(today, { query: { date: "2026-11-15" }, cookies: await coach() });
    expect(res.statusCode).toBe(200);
    // owner and inactive staff don't count as invited staff
    expect(res.body.setup).toEqual({ athletes: 2, seasonSet: false, workouts: 3, staff: 0 });
    expect(res.body.org).toEqual({ name: "State", token: TEAM });
    expect(res.body.today.sessions.map((s) => [s.title, s.time, s.assigned, s.done, s.review])).toEqual([
      ["Lift A", "06:00", 2, 1, 1],
      ["Recovery", null, 1, 0, 0],
    ]);
    expect(res.body.today.totals).toEqual({ assigned: 3, done: 1 });
  });

  it("requires a date and a coach session", async () => {
    expect((await callApi(today, { query: {}, cookies: await coach() })).statusCode).toBe(400);
    expect((await callApi(today, { query: { date: "2026-11-15" } })).statusCode).toBe(401);
  });
});

describe("product catalog (lib/affiliateProducts)", () => {
  beforeEach(() => {
    h.db = createFakeSupabase({
      affiliate_products: [
        { id: "u1", airtable_id: "recAAAAAAAAAAAAAAA1", name: "Creatine", price: 19.99, servings: 100, product_url: "https://amazon.com/x", short_link: "https://amzn.to/y", review_rating: 4.6, coach_pick: false, supplements: [], active: true },
        { id: "u2", airtable_id: null, name: "Hidden", price: 1, active: false },
      ],
    });
  });

  it("returns active products in the original field shape, keeping Airtable ids for saved stacks", async () => {
    const products = await listProducts();
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe("recAAAAAAAAAAAAAAA1");
    expect(products[0].fields).toMatchObject({ "Product Name": "Creatine", Price: 19.99, Servings: 100, "Lo. Amazon/Stripe Link": "https://amazon.com/x", "Value Rating": 100 / 19.99 });
    expect(products[0].fields).not.toHaveProperty("Coach Pick");
  });

  it("writes Amazon sync results to the right row with converted types", async () => {
    await updateProduct("recAAAAAAAAAAAAAAA1", { Price: 17.49, "Review Rating": 4.7, Variations: JSON.stringify([{ asin: "B1" }]), "Last Synced": "2026-11-15", Unknown: 1 });
    expect(h.db.tables.affiliate_products[0]).toMatchObject({ price: 17.49, review_rating: 4.7, variations: [{ asin: "B1" }], last_synced_at: "2026-11-15T00:00:00.000Z" });
    expect(h.db.tables.affiliate_products[0]).not.toHaveProperty("Unknown");
  });
});
