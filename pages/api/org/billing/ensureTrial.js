// pages/api/org/billing/ensureTrial.js
import Airtable from "airtable";
import { requireOrg } from "@/lib/requireOrg";

function asString(v) {
  return String(v ?? "").trim();
}

function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

function firstValue(v) {
  // Airtable sometimes returns lookups as arrays
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
  // Define what "allowed" means for your org pages:
  // Trial + Active allowed, everything else locked.
  return status === "Trial" || status === "Active";
}

const base =
  process.env.BILLING_API_KEY && process.env.BILLING_BASE_ID
    ? new Airtable({ apiKey: process.env.BILLING_API_KEY }).base(process.env.BILLING_BASE_ID)
    : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Route", "billing/ensureTrial");

  // I recommend allowing GET too, but POST is fine. Your hook uses POST already.
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

  // ✅ org token should come from the cookie session
  const orgToken = asString(auth?.org?.token || auth?.org?.Token || auth?.org?.["Organization Token"]);
  if (!orgToken) return res.status(400).json({ error: "Organization token missing" });

  // Trial expiry rule
  const TRIAL_DAYS = 30;

  try {
    const safeToken = escapeAirtableString(orgToken);

    // 1) Find existing billing row by {Token}
    // NOTE: This assumes your Billing table has a field named "Token" (lookup or text).
    const found = await base(BILLING_TABLE)
      .select({
        maxRecords: 1,
        filterByFormula: `{Token}='${safeToken}'`,
      })
      .firstPage();

    let record = found?.[0] || null;

    // 2) If missing, create ONCE
    if (!record) {
      const now = new Date();
      const trialEnds = addDays(now, TRIAL_DAYS).toISOString();

      const created = await base(BILLING_TABLE).create([
        {
          fields: {
            // If Token is a lookup, you often cannot write to it directly.
            // But some setups use a plain text Token field in Billing (recommended).
            Token: orgToken,

            "Billing Status": "Trial",

            // Optional but highly recommended so you're not relying only on lookup "Created"
            TrialStart: now.toISOString(),
            TrialEnds: trialEnds,
          },
        },
      ]);

      record = created?.[0] || null;
    }

    // 3) Compute what status SHOULD be today
    const fields = record?.fields || {};

    // Pull current status
    const currentStatus = normalizeStatus(fields["Billing Status"] || fields.BillingStatus);

    // Determine trial start
    // Priority:
    //   A) Created lookup (your requested source)
    //   B) TrialStart
    //   C) Airtable record createdTime fallback (not available here without extra call)
    const createdDate = parseDateLoose(fields.Created || fields["Created"]);
    const trialStartDate = createdDate || parseDateLoose(fields.TrialStart);

    // Determine trial end
    const trialEndsDate =
      parseDateLoose(fields.TrialEnds) ||
      (trialStartDate ? addDays(trialStartDate, TRIAL_DAYS) : null);

    let nextStatus = currentStatus || "Trial";

    // Only auto-advance Trial -> Past Due after 30 days
    if (nextStatus === "Trial" && trialEndsDate) {
      const now = new Date();
      if (now.getTime() > trialEndsDate.getTime()) {
        nextStatus = "Past Due";
      }
    }

    // 4) Update Airtable ONLY if needed
    const updates = {};
    if (!currentStatus) updates["Billing Status"] = nextStatus; // if blank, set it
    if (currentStatus && nextStatus !== currentStatus) updates["Billing Status"] = nextStatus;

    // Persist TrialEnds if missing (helps keep consistent behavior)
    if (!fields.TrialEnds && trialEndsDate) updates.TrialEnds = trialEndsDate.toISOString();
    if (!fields.TrialStart && trialStartDate) updates.TrialStart = trialStartDate.toISOString();

    if (Object.keys(updates).length) {
      const updated = await base(BILLING_TABLE).update([
        { id: record.id, fields: updates },
      ]);
      record = updated?.[0] || record;
    }

    // 5) Gate decision response
    const finalFields = record?.fields || {};
    const finalStatus = normalizeStatus(finalFields["Billing Status"] || finalFields.BillingStatus);

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

    return res.status(200).json({
      ok: true,
      billing: {
        status: finalStatus,
        isPaidOk,
        lockedReason,
        trialStart: finalFields.TrialStart || finalFields["TrialStart"] || finalFields.Created || "",
        trialEnds: finalFields.TrialEnds || finalFields["TrialEnds"] || "",
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
