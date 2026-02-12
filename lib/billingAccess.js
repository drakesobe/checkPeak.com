// lib/billingAccess.js
import { findBillingRecordByOrgToken, upsertBillingForOrgToken, F } from "@/lib/airtableBilling";

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString();
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function now() {
  return new Date();
}

export function normalizeBillingStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "none";
  if (s.includes("trial")) return "trial";
  if (s.includes("active")) return "active";
  if (s.includes("past")) return "past_due";
  if (s.includes("cancel")) return "canceled";
  if (s.includes("suspend") || s.includes("unpaid")) return "suspended";
  return s; // fallback
}

export function computeBillingStateFromRecord(rec) {
  const fields = rec?.fields || {};
  const statusRaw = fields[F.BillingStatus] || "";
  const plan = fields[F.Plan] || "";
  const trialEndsRaw = fields[F.TrialEnds] || "";
  const renewalRaw = fields[F.RenewalDate] || "";

  const status = normalizeBillingStatus(statusRaw);
  const trialEnds = toDate(trialEndsRaw);
  const renewalDate = toDate(renewalRaw);

  const inTrial = status === "trial" && trialEnds && trialEnds.getTime() > now().getTime();
  const isActive = status === "active";
  const isPaidOk = isActive || inTrial;

  return {
    status,               // none | trial | active | past_due | canceled | suspended | ...
    statusRaw: String(statusRaw || ""),
    plan: String(plan || ""),
    trialEnds: trialEnds ? trialEnds.toISOString() : "",
    renewalDate: renewalDate ? renewalDate.toISOString() : "",
    isPaidOk,
    inTrial,
    isActive,
    hasRecord: Boolean(rec?.id),
    stripeCustomerId: String(fields[F.StripeCustomerId] || ""),
    stripeSubscriptionId: String(fields[F.StripeSubscriptionId] || ""),
  };
}

/**
 * Ensures there is a billing record with:
 * - Billing Status = Trial
 * - Trial Ends = now + 30 days
 * - Plan = Org (or your default)
 *
 * This does NOT create Stripe objects. It just starts the trial clock.
 */
export async function ensureTrialForOrgToken(orgToken, { orgId = "", plan = "Org", trialDays = 30 } = {}) {
  const token = String(orgToken || "").trim();
  if (!token) throw new Error("Missing org token");

  const existing = await findBillingRecordByOrgToken(token);
  if (existing?.id) return computeBillingStateFromRecord(existing);

  const patch = {
    [F.Plan]: plan,
    [F.BillingStatus]: "Trial",             // MUST match Airtable option exactly
    [F.TrialEnds]: addDaysISO(trialDays),
  };

  // Optionally link to org record (nice UX in Airtable)
  const created = await upsertBillingForOrgToken(token, patch, orgId);
  return computeBillingStateFromRecord(created);
}

/**
 * Reads billing state by token. If no record -> returns "none".
 */
export async function getBillingStateByOrgToken(orgToken) {
  const token = String(orgToken || "").trim();
  if (!token) return { status: "none", isPaidOk: false, hasRecord: false };

  const rec = await findBillingRecordByOrgToken(token);
  if (!rec?.id) return { status: "none", isPaidOk: false, hasRecord: false };

  return computeBillingStateFromRecord(rec);
}
