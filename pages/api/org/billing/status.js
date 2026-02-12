// pages/api/org/billing/status.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgId, findBillingRecordByOrgToken, F, firstLookupValue } from "@/lib/airtableBilling";

function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function iso(date) {
  return date ? new Date(date).toISOString() : "";
}

function lower(v) {
  return String(v || "").trim().toLowerCase();
}

function computeIsPaidOk({ status, trialEnds, currentPeriodEnd }) {
  const s = lower(status);

  if (s.includes("trial")) return true;
  if (s === "active") return true;

  if (s.includes("past") || s.includes("due")) return false;
  if (s.includes("cancel")) return false;
  if (s.includes("unpaid") || s.includes("suspend")) return false;

  const te = toDateOrNull(trialEnds);
  if (te) {
    const now = Date.now();
    const end = te.getTime();
    if (!Number.isNaN(end) && now < end) return true;
  }

  const cpe = toDateOrNull(currentPeriodEnd);
  if (cpe) {
    const now = Date.now();
    const end = cpe.getTime();
    if (!Number.isNaN(end) && now < end) return true;
  }

  return false;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  const sessionOrgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();

  const sessionToken = String(user?.Token || user?.token || user?.orgToken || "").trim();

  if (!sessionOrgId && !sessionToken) {
    return res.status(400).json({ error: "Missing orgId/token in session." });
  }

  try {
    let rec = sessionOrgId ? await findBillingRecordByOrgId(sessionOrgId) : null;
    if (!rec && sessionToken) rec = await findBillingRecordByOrgToken(sessionToken);

    if (!rec?.id) {
      // No billing record yet -> treat as locked
      return res.status(200).json({
        ok: true,
        billing: {
          isPaidOk: false,
          status: "",
          statusRaw: "",
          trialEnds: "",
          currentPeriodEnd: "",
          renewalDate: "",
          stripeCustomerId: "",
          stripeSubscriptionId: "",
        },
      });
    }

    const f = rec.fields || {};

    const createdRaw = firstLookupValue(f?.[F.Created]);
    const createdAt = toDateOrNull(createdRaw);

    const statusRaw = String(f?.[F.BillingStatus] || "").trim();

    let trialEnds = f?.[F.TrialEnds] || "";
    const currentPeriodEnd = f?.[F.CurrentPeriodEnd] || "";
    const renewalDate = f?.[F.RenewalDate] || "";

    // Compute trialEnds if missing (READ ONLY — no writeback)
    const trialEndsDate = toDateOrNull(trialEnds);
    if (!trialEndsDate && createdAt) {
      trialEnds = iso(addDays(createdAt, 30));
    }

    const isPaidOk = computeIsPaidOk({
      status: statusRaw,
      trialEnds,
      currentPeriodEnd,
    });

    return res.status(200).json({
      ok: true,
      billing: {
        isPaidOk,
        status: statusRaw || "",
        statusRaw: statusRaw || "",
        trialEnds: trialEnds || "",
        currentPeriodEnd: currentPeriodEnd || "",
        renewalDate: renewalDate || "",
        stripeCustomerId: f?.[F.StripeCustomerId] || "",
        stripeSubscriptionId: f?.[F.StripeSubscriptionId] || "",
        created: createdRaw || "",
      },
    });
  } catch (e) {
    console.error("[billing/status] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load billing status." });
  }
}
