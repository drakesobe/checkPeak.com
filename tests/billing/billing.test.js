// Billing: who gets access, and that Stripe/webhook writes land on the right row.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fakeSupabase";
import { callApi, coachSession, asCookie } from "../helpers/http";

const h = vi.hoisted(() => ({ db: null }));
vi.mock("@/lib/supabase", () => ({ get supabaseAdmin() { return h.db; }, get supabase() { return h.db; } }));

import * as store from "@/lib/billingStore";
import ensureTrial from "@/pages/api/org/billing/ensureTrial";

const { F } = store;
const TOKEN = "ORG-AAA111-BBB222";
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const DAY = 24 * 3600 * 1000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

function seed(billing = []) {
  h.db = createFakeSupabase({
    organizations: [{ id: ORG_ID, airtable_id: "recORGAAAAAAAAAAAAAA", token: TOKEN, name: "State", created_at: "2026-01-01T00:00:00Z" }],
    billing,
  });
}

describe("billingStore", () => {
  beforeEach(() => seed([{ id: "b1", org_id: ORG_ID, token: TOKEN, billing_status: "Free", plan: "Starter", stripe_customer_id: "cus_1", tax_exempt: false, created_at: "2026-01-02T00:00:00Z" }]));

  it("finds the same record by token (any case), org id, legacy Airtable org id and Stripe customer", async () => {
    expect((await store.findBillingRecordByOrgToken(TOKEN.toLowerCase())).id).toBe("b1");
    expect((await store.findBillingRecordByOrgId(ORG_ID)).id).toBe("b1");
    expect(await store.findBillingRecordByOrgId("not-a-uuid")).toBeNull();
    expect((await store.findBillingRecordByOrgId("recORGAAAAAAAAAAAAAA")).id).toBe("b1");
    expect((await store.findBillingRecordByStripeCustomerId("cus_1")).id).toBe("b1");
    expect(await store.findBillingRecordByStripeCustomerId("")).toBeNull();
  });

  it("returns records in the field-name shape the routes expect, with the org link and created date", async () => {
    const rec = await store.findBillingRecordByOrgToken(TOKEN);
    expect(rec.fields).toMatchObject({ [F.BillingStatus]: "Free", [F.Plan]: "Starter", [F.Token]: TOKEN, [F.Organization]: [ORG_ID], [F.Created]: ["2026-01-01T00:00:00Z"] });
    expect(rec.fields).not.toHaveProperty(F.TaxExempt); // false/empty values are omitted like Airtable
    expect(rec.get(F.Plan)).toBe("Starter");
  });

  it("updates in place by token and converts types (webhook path)", async () => {
    const rec = await store.upsertBillingForOrgToken(TOKEN, {
      [F.BillingStatus]: "Active", [F.CurrentPeriodEnd]: store.isoDateFromUnixSeconds(1900000000), [F.TaxExempt]: "true", [F.BillingCity]: "",
    });
    expect(h.db.tables.billing).toHaveLength(1);
    expect(rec.fields[F.BillingStatus]).toBe("Active");
    expect(h.db.tables.billing[0]).toMatchObject({ billing_status: "Active", current_period_end: "2030-03-17T17:46:40.000Z", tax_exempt: true, billing_city: null });
  });

  it("creates a row for a new org and links it by token", async () => {
    seed([]);
    const rec = await store.upsertBillingForOrgToken(TOKEN, { [F.BillingStatus]: "Free" });
    expect(h.db.tables.billing).toHaveLength(1);
    expect(rec.fields[F.Organization]).toEqual([ORG_ID]);
  });

  it("refuses to create orphan rows for unknown organizations", async () => {
    await expect(store.upsertBillingForOrg("not-an-org", {})).rejects.toThrow();
    expect(await store.upsertBillingForOrgSafe("not-an-org", {})).toBeNull();
    await expect(store.upsertBillingForOrgToken("", {})).rejects.toThrow();
  });
});

describe("POST /api/org/billing/ensureTrial (access gate)", () => {
  const call = async () => callApi(ensureTrial, { method: "POST", cookies: asCookie(await coachSession({ orgId: ORG_ID, token: TOKEN })) });
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

  it("puts a brand-new program on the free Starter plan", async () => {
    seed([]);
    const res = await call();
    expect(res.body.billing).toMatchObject({ isPaidOk: true, statusNormalized: "Free", plan: "Starter" });
    expect(h.db.tables.billing).toHaveLength(1);
  });

  it("moves an expired legacy Sandbox to Free instead of locking the coach out", async () => {
    seed([{ id: "b1", org_id: ORG_ID, token: TOKEN, billing_status: "Sandbox", sandbox_ends: iso(-30) }]);
    const res = await call();
    expect(res.body.billing.isPaidOk).toBe(true);
    expect(h.db.tables.billing[0]).toMatchObject({ billing_status: "Free", plan: "Starter" });
  });

  it("keeps an unexpired Sandbox as is", async () => {
    seed([{ id: "b1", org_id: ORG_ID, token: TOKEN, billing_status: "Sandbox", sandbox_ends: iso(5) }]);
    const res = await call();
    expect(res.body.billing).toMatchObject({ isPaidOk: true, statusNormalized: "Sandbox" });
  });

  it.each([
    ["Active", true], ["Trialing", true], ["Free", true],
    ["Past Due", false], ["Canceled", false], ["Suspended", false],
  ])("Stripe status %s -> access %s, never rewritten", async (status, ok) => {
    seed([{ id: "b1", org_id: ORG_ID, token: TOKEN, billing_status: status, stripe_subscription_id: "sub_1" }]);
    const res = await call();
    expect(res.body.billing.isPaidOk).toBe(ok);
    expect(h.db.tables.billing[0].billing_status).toBe(status);
    if (!ok) expect(res.body.billing.lockedReason).toBeTruthy();
  });

  it("401 without a coach session", async () => {
    seed([]);
    expect((await callApi(ensureTrial, { method: "POST" })).statusCode).toBe(401);
  });
});
