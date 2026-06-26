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

function getField(fields, keyConstOrName, fallbackName) {
  // Allows using F.SomeField if present, otherwise fallback to literal name
  const k = keyConstOrName || fallbackName;
  if (!k) return "";
  return fields?.[k] ?? "";
}

function computeIsPaidOk({ status, sandboxEnds, trialEnds, currentPeriodEnd }) {
  const s = lower(status);

  // Known locked states (explicit lock wins)
  if (s.includes("past") || s.includes("due")) return false;
  if (s.includes("cancel")) return false;
  if (s.includes("unpaid") || s.includes("suspend")) return false;
  if (s.includes("not started") || s.includes("not_started")) return false;

  // ✅ Sandbox window:
  // - allow if status says sandbox OR sandboxEnds exists and is still in the future
  const se = toDateOrNull(sandboxEnds);
  if (s.includes("sandbox") || se) {
    if (se) {
      const now = Date.now();
      const end = se.getTime();
      if (!Number.isNaN(end) && now < end) return true;
    }
    // If we have a sandboxEnds value but it's expired, sandbox is not ok.
    if (s.includes("sandbox")) return false;
  }

  // ✅ Free / Starter plan — no Stripe involved
  if (s === "free" || s === "starter" || s.includes("starter")) return true;

  // ✅ Stripe subscription states
  if (s.includes("trial")) return true;
  if (s === "active") return true;

  // Fallback: date-based unlocks (legacy)
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
 * Enforces: org must be
 * - Sandbox AND Sandbox Ends is in the future, OR (also supports sandboxEnds being set even if status is blank)
 * - Active OR Trial (Stripe), OR
 * - (legacy) trialEnds/currentPeriodEnd in the future
 *
 * Lookup order:
 *  - orgId first (preferred; links are canonical)
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
          sandboxEnds: "",
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

    // ✅ Sandbox Ends (new field)
    // Prefer F.SandboxEnds if present, otherwise fallback to literal name
    let sandboxEnds =
      getField(f, F?.SandboxEnds, "Sandbox Ends") ||
      getField(f, F?.SandboxEndsAt, "Sandbox Ends") ||
      "";

    // Stripe dates (webhook-owned)
    let trialEnds = f?.[F.TrialEnds] || "";
    const currentPeriodEnd = f?.[F.CurrentPeriodEnd] || "";
    const renewalDate = f?.[F.RenewalDate] || "";

    // READ ONLY fallback: if sandboxEnds missing and we have Created, infer +14 days
    // (Prevents accidental locks if field was blank)
    const SANDBOX_DAYS = 14;
    const sandboxEndsDate = toDateOrNull(sandboxEnds);
    if (!sandboxEndsDate && createdAt) {
      sandboxEnds = iso(addDays(createdAt, SANDBOX_DAYS));
    }

    // READ ONLY: infer trialEnds if missing (30 days) - legacy support
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

    if (!isPaidOk) {
      res.status(402).json({
        error: "Subscription required.",
        billing: {
          isPaidOk,
          status: statusRaw || "",
          statusRaw: statusRaw || "",
          sandboxEnds: sandboxEnds || "",
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

    // ✅ return state (useful to caller for UI decisions)
    return {
      isPaidOk,
      status: statusRaw || "",
      statusRaw: statusRaw || "",
      sandboxEnds: sandboxEnds || "",
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