// pages/api/org/billing/status.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import {
  findBillingRecordByOrgId,
  findBillingRecordByOrgToken,
  upsertBillingForOrg,
  F,
  firstLookupValue,
} from "@/lib/airtableBilling";

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

  // Always allow during trial/active
  if (s.includes("trial")) return true;
  if (s === "active") return true;

  // Block states
  if (s.includes("past") || s.includes("due")) return false;
  if (s.includes("cancel")) return false;
  if (s.includes("unpaid") || s.includes("suspend")) return false;

  // If status missing/blank, allow if still inside trialEnds
  const te = toDateOrNull(trialEnds);
  if (te) {
    const now = Date.now();
    const end = te.getTime();
    if (!Number.isNaN(end) && now < end) return true;
  }

  // Optional: if you want to allow “currentPeriodEnd” too:
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
      // No billing record yet -> NOT OK (trial must be created by ensureTrial)
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
    const status = statusRaw || ""; // keep raw, we’ll compute isPaidOk

    let trialEnds = f?.[F.TrialEnds] || "";
    let currentPeriodEnd = f?.[F.CurrentPeriodEnd] || "";
    let renewalDate = f?.[F.RenewalDate] || "";

    // If trialEnds missing but Created exists, compute it (and optional writeback)
    const trialEndsDate = toDateOrNull(trialEnds);
    if (!trialEndsDate && createdAt) {
      const computed = addDays(createdAt, 30);
      trialEnds = iso(computed);

      const writeback = String(req.query?.writeback ?? "1").trim() !== "0";
      if (writeback) {
        try {
          await upsertBillingForOrg(sessionOrgId || (Array.isArray(f?.[F.Organization]) ? f[F.Organization]?.[0] : ""), {
            [F.TrialEnds]: trialEnds,
            // If your status is blank, we can write Trial while trial is active
            ...(statusRaw ? {} : { [F.BillingStatus]: "Trial" }),
          });
        } catch {
          // ignore
        }
      }
    }

    const isPaidOk = computeIsPaidOk({
      status: statusRaw || status,
      trialEnds,
      currentPeriodEnd,
    });

    return res.status(200).json({
      ok: true,
      billing: {
        // what the dashboard gate expects
        isPaidOk,

        // what your gate screen displays
        status: statusRaw || "",
        statusRaw: statusRaw || "",

        // useful dates
        trialEnds: trialEnds || "",
        currentPeriodEnd: currentPeriodEnd || "",
        renewalDate: renewalDate || "",

        // stripe ids (read-only)
        stripeCustomerId: f?.[F.StripeCustomerId] || "",
        stripeSubscriptionId: f?.[F.StripeSubscriptionId] || "",

        // optional debug helpers
        created: createdRaw || "",
      },
    });
  } catch (e) {
    console.error("[billing/status] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load billing status." });
  }
}
