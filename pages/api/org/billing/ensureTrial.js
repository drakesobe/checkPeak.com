/// pages/api/org/billing/ensureTrial.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) {
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function firstValue(v) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseDateLoose(v) {
  const raw = firstValue(v);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d, days) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeStatus(v) {
  const s = asString(v).toLowerCase();
  if (!s) return "";
  if (s.includes("trial")) return "Trial";
  if (s.includes("active")) return "Active";
  if (s.includes("past")) return "Past Due";
  if (s.includes("cancel")) return "Cancelled";
  if (s.includes("suspend")) return "Suspended";
  return asString(v);
}

function isPaidOkFromStatus(status) {
  return status === "Trial" || status === "Active";
}

/**
 * ✅ Airtable field names (match your base exactly)
 * You said you do NOT have TrialEnds, but DO have "Current Period End" as single line text.
 */
const FIELDS = {
  token: "Token",
  status: "Billing Status",
  currentPeriodEnd: "Current Period End", // single line text field in your Billing table
  createdLookup: "Created", // optional lookup you mentioned; safe if missing
};

const base =
  process.env.BILLING_API_KEY && process.env.BILLING_BASE_ID
    ? new Airtable({ apiKey: process.env.BILLING_API_KEY }).base(process.env.BILLING_BASE_ID)
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Route", "billing/ensureTrial");

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "POST" && method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const BILLING_TABLE = process.env.BILLING_TABLE_NAME;
  if (!base || !BILLING_TABLE) {
    return res.status(500).json({
      error: "Billing Airtable not configured. Check BILLING_API_KEY, BILLING_BASE_ID, BILLING_TABLE_NAME.",
    });
  }

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const orgToken = asString(auth?.org?.token || auth?.org?.Token || auth?.org?.["Organization Token"]);
  if (!orgToken) return res.status(400).json({ error: "Organization token missing" });

  const TRIAL_DAYS = 30;

  try {
    const safeToken = escapeAirtableString(orgToken);

    // 1) Find existing billing row by {Token}
    const found = await base(BILLING_TABLE)
      .select({
        maxRecords: 1,
        filterByFormula: `{${FIELDS.token}}='${safeToken}'`,
      })
      .firstPage();

    let record = found?.[0] || null;

    // 2) If missing, create ONCE using only known fields
    if (!record) {
      const now = new Date();
      const trialEndsISO = addDays(now, TRIAL_DAYS).toISOString();

      const created = await base(BILLING_TABLE).create([
        {
          fields: {
            [FIELDS.token]: orgToken,
            [FIELDS.status]: "Trial",
            // ✅ Persist "trial end" into Current Period End
            [FIELDS.currentPeriodEnd]: trialEndsISO,
          },
        },
      ]);

      record = created?.[0] || null;
    }

    // 3) Compute what status SHOULD be today
    const fields = record?.fields || {};

    const currentStatus = normalizeStatus(fields[FIELDS.status] || fields.BillingStatus);

    // Trial start:
    // - Prefer the Created lookup if you have it
    // - Otherwise fall back to "now" (and we’ll still compute + persist end if missing)
    const createdDate = parseDateLoose(fields[FIELDS.createdLookup] || fields.Created);
    const trialStartDate = createdDate || new Date();

    // Trial end:
    // - Use Current Period End if present (single line text storing ISO)
    // - Otherwise compute from trialStartDate and persist it
    const currentPeriodEndRaw = fields[FIELDS.currentPeriodEnd];
    const currentPeriodEndDate =
      parseDateLoose(currentPeriodEndRaw) || addDays(trialStartDate, TRIAL_DAYS);

    let nextStatus = currentStatus || "Trial";

    // Only auto-advance Trial -> Past Due after trial end
    if (nextStatus === "Trial" && currentPeriodEndDate) {
      const now = new Date();
      if (now.getTime() > currentPeriodEndDate.getTime()) {
        nextStatus = "Past Due";
      }
    }

    // 4) Update Airtable ONLY if needed (only fields that exist)
    const updates = {};

    // set status if missing or needs change
    if (!currentStatus) updates[FIELDS.status] = nextStatus;
    if (currentStatus && nextStatus !== currentStatus) updates[FIELDS.status] = nextStatus;

    // persist Current Period End if missing/blank
    if (!asString(currentPeriodEndRaw) && currentPeriodEndDate) {
      updates[FIELDS.currentPeriodEnd] = currentPeriodEndDate.toISOString();
    }

    if (Object.keys(updates).length) {
      const updated = await base(BILLING_TABLE).update([{ id: record.id, fields: updates }]);
      record = updated?.[0] || record;
    }

    // 5) Gate decision response
    const finalFields = record?.fields || {};
    const finalStatus = normalizeStatus(finalFields[FIELDS.status] || finalFields.BillingStatus);

    const isPaidOk = isPaidOkFromStatus(finalStatus);

    const lockedReason =
      isPaidOk
        ? ""
        : finalStatus === "Past Due"
        ? "Trial ended — payment required."
        : finalStatus === "Cancelled"
        ? "Subscription cancelled."
        : finalStatus === "Suspended"
        ? "Subscription suspended."
        : "Subscription not active.";

    // Return trialEnds from Current Period End (so your UI still works)
    const finalTrialEnds =
      asString(finalFields[FIELDS.currentPeriodEnd]) ||
      (currentPeriodEndDate ? currentPeriodEndDate.toISOString() : "");

    // trialStart: created lookup if exists, else empty (or you can return now)
    const finalTrialStart =
      asString(finalFields[FIELDS.createdLookup] || finalFields.Created) ||
      (trialStartDate ? trialStartDate.toISOString() : "");

    return res.status(200).json({
      ok: true,
      billing: {
        status: finalStatus,
        isPaidOk,
        lockedReason,
        trialStart: finalTrialStart,
        trialEnds: finalTrialEnds,
        recordId: record?.id || "",
      },
    });
  } catch (err) {
    console.error("[billing/ensureTrial] error:", err);
    return res.status(500).json({
      error: "Failed to ensure billing status",
      airtable: {
        statusCode: err?.statusCode,
        message: err?.message,
        error: err?.error,
      },
    });
  }
}