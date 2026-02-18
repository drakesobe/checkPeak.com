// lib/requireActiveOrgSubscription.js
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

/**
 * Enforces: org must be Active OR in Trial (trialEnds in the future).
 * IMPORTANT: must match /api/org/billing/status behavior:
 *  - try orgId first (preferred; links are canonical)
 *  - fallback to token lookup (legacy)
 *
 * authOrUser may be:
 * - requireOrg(...) auth object { ok, user, org: { id, token }, token }
 * - legacy session payload user
 */
export async function requireActiveOrgSubscription(req, res, authOrUser) {
  const orgId = String(
    authOrUser?.org?.id ||
      authOrUser?.orgId ||
      authOrUser?.OrgId ||
      authOrUser?.user?.orgId ||
      authOrUser?.user?.OrgId ||
      authOrUser?.user?.OrganizationId ||
      authOrUser?.organizationId ||
      authOrUser?.id ||
      ""
  ).trim();

  const orgToken = String(
    authOrUser?.org?.token ||
      authOrUser?.token ||
      authOrUser?.user?.Token ||
      authOrUser?.user?.token ||
      authOrUser?.user?.orgToken ||
      authOrUser?.Token ||
      authOrUser?.token ||
      authOrUser?.orgToken ||
      ""
  )
    .trim()
    .toUpperCase();

  if (!orgId && !orgToken) {
    res.status(403).json({ error: "Missing orgId/token in session." });
    return null;
  }

  try {
    // ✅ match billing/status lookup order
    let rec = orgId ? await findBillingRecordByOrgId(orgId) : null;
    if (!rec?.id && orgToken) rec = await findBillingRecordByOrgToken(orgToken);

    if (!rec?.id) {
      // No billing record -> locked
      res.status(402).json({
        error: "Subscription required.",
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
      return null;
    }

    const f = rec.fields || {};

    const createdRaw = firstLookupValue(f?.[F.Created]);
    const createdAt = toDateOrNull(createdRaw);

    const statusRaw = String(f?.[F.BillingStatus] || "").trim();

    let trialEnds = f?.[F.TrialEnds] || "";
    const currentPeriodEnd = f?.[F.CurrentPeriodEnd] || "";
    const renewalDate = f?.[F.RenewalDate] || "";

    // READ ONLY: infer trialEnds if missing
    const trialEndsDate = toDateOrNull(trialEnds);
    if (!trialEndsDate && createdAt) {
      trialEnds = iso(addDays(createdAt, 30));
    }

    const isPaidOk = computeIsPaidOk({ status: statusRaw, trialEnds, currentPeriodEnd });

    if (!isPaidOk) {
      res.status(402).json({
        error: "Subscription required.",
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
      return null;
    }

    // ✅ return state (same shape as billing/status uses internally)
    return {
      isPaidOk,
      status: statusRaw || "",
      statusRaw: statusRaw || "",
      trialEnds: trialEnds || "",
      currentPeriodEnd: currentPeriodEnd || "",
      renewalDate: renewalDate || "",
      stripeCustomerId: f?.[F.StripeCustomerId] || "",
      stripeSubscriptionId: f?.[F.StripeSubscriptionId] || "",
      created: createdRaw || "",
    };
  } catch (e) {
    console.error("[requireActiveOrgSubscription] error:", e);
    res.status(500).json({ error: e?.message || "Failed to check subscription." });
    return null;
  }
}
