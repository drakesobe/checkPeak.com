// lib/requireActiveOrgSubscription.js
import { getBillingStateByOrgToken } from "@/lib/billingAccess";

/**
 * Enforces: org must be Active OR in Trial (trialEnds in the future).
 * - Allows OWNER/ADMIN/TRAINER to be gated the same way.
 * - Billing endpoints should NOT use this (so users can pay even if locked).
 */
export async function requireActiveOrgSubscription(req, res, user) {
  // user: session user payload already validated by requireOrgSideUser/requireOrg
  const token = String(user?.Token || user?.token || user?.["Organization Token"] || "").trim();
  if (!token) {
    res.status(403).json({ error: "Missing organization token in session." });
    return null;
  }

  const state = await getBillingStateByOrgToken(token);

  if (!state.isPaidOk) {
    res.status(402).json({
      error: "Subscription required.",
      billing: {
        status: state.status,
        statusRaw: state.statusRaw || "",
        trialEnds: state.trialEnds || "",
        renewalDate: state.renewalDate || "",
      },
    });
    return null;
  }

  return state;
}
