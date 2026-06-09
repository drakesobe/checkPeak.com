// pages/api/org/billing/activate-free.js
// Activates the free Starter plan (1-10 athletes) for an organization.
// No Stripe involved — writes BillingStatus: "Free" directly to Airtable.
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { upsertBillingForOrgToken, F } from "@/lib/airtableBilling";

function asString(v) {
  return String(v ?? "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  const token = asString(user?.Token || user?.token || user?.orgToken).toUpperCase();
  if (!token) return res.status(400).json({ error: "Missing organization token in session." });

  const orgId = asString(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || ""
  );

  try {
    await upsertBillingForOrgToken(
      token,
      {
        [F.Token]:         token,
        [F.BillingStatus]: "Free",
        [F.Plan]:          "Starter",
        [F.Currency]:      "USD",
      },
      orgId
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[billing/activate-free] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to activate free plan." });
  }
}
