// pages/api/org/billing/status.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgToken, findBillingRecordByOrgId, F, firstLookupValue } from "@/lib/airtableBilling";

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

function computeIsPaidOk({ status, sandboxEnds, trialEnds, currentPeriodEnd }) {
  const s = lower(status);

  // Free tier is always OK (no Stripe subscription needed)
  if (s === "free") return true;

  // Explicit locked states always block
  if (s.includes("past") || s.includes("due")) return false;
  if (s.includes("cancel")) return false;
  if (s.includes("unpaid") || s.includes("suspend")) return false;
  if (s.includes("not started") || s.includes("not_started")) return false;

  // ✅ Sandbox: allow if Sandbox Ends exists and is in the future
  const se = toDateOrNull(sandboxEnds);
  if (se) {
    const now = Date.now();
    const end = se.getTime();
    if (!Number.isNaN(end) && now < end) return true;
    // If expired, sandbox is not ok (falls through to false)
  }

  // Stripe states
  if (s.includes("trial")) return true;
  if (s === "active") return true;

  // Legacy date fallbacks (if you still want them)
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

  // Prefer token (now the canonical stable key)
  const sessionToken = String(user?.Token || user?.token || user?.orgToken || "").trim().toUpperCase();

  // Keep orgId as optional fallback
  const sessionOrgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();

  if (!sessionToken && !sessionOrgId) {
    return res.status(400).json({ error: "Missing orgId/token in session." });
  }

  try {
    // ✅ token-first (reliable now that Billing.Token is writable)
    let rec = sessionToken ? await findBillingRecordByOrgToken(sessionToken) : null;
    if (!rec?.id && sessionOrgId) rec = await findBillingRecordByOrgId(sessionOrgId);

    if (!rec?.id) {
      return res.status(200).json({
        ok: true,
        billing: {
          isPaidOk: false,
          status: "",
          statusRaw: "",
          token: sessionToken || "",
          sandboxEnds: "",
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

    // ✅ Sandbox Ends
    let sandboxEnds = String(f?.[F.SandboxEnds] || "").trim();

    // Stripe/webhook-owned fields
    let trialEnds = String(f?.[F.TrialEnds] || "").trim();
    const currentPeriodEnd = String(f?.[F.CurrentPeriodEnd] || "").trim();
    const renewalDate = String(f?.[F.RenewalDate] || "").trim();

    // READ ONLY fallback: if sandboxEnds missing but createdAt exists, infer +14 days
    // (Optional safeguard; remove if you want ONLY explicit sandboxEnds to count)
    const SANDBOX_DAYS = 14;
    const se = toDateOrNull(sandboxEnds);
    if (!se && createdAt) {
      sandboxEnds = iso(addDays(createdAt, SANDBOX_DAYS));
    }

    // READ ONLY fallback: infer trialEnds if missing (Created + 30 days)
    const trialEndsDate = toDateOrNull(trialEnds);
    if (!trialEndsDate && createdAt) {
      trialEnds = iso(addDays(createdAt, 30));
    }

    const isPaidOk = computeIsPaidOk({
      status: statusRaw,
      sandboxEnds,
      trialEnds,
      currentPeriodEnd,
    });

    return res.status(200).json({
      ok: true,
      billing: {
        isPaidOk,
        status: statusRaw || "",
        statusRaw: statusRaw || "",
        token: String(f?.[F.Token] || sessionToken || "").trim(),
        sandboxEnds: sandboxEnds || "",
        trialEnds: trialEnds || "",
        currentPeriodEnd: currentPeriodEnd || "",
        renewalDate: renewalDate || "",
        stripeCustomerId: f?.[F.StripeCustomerId] || "",
        stripeSubscriptionId: f?.[F.StripeSubscriptionId] || "",
        created: createdRaw || "",
        billingRecordId: rec?.id || "",
      },
    });
  } catch (e) {
    console.error("[billing/status] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to load billing status." });
  }
}