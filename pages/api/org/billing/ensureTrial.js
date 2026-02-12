// pages/api/org/billing/ensureTrial.js
import { requireBillingAdmin } from "@/lib/requireBillingAdmin";
import { findBillingRecordByOrgId, upsertBillingForOrg, F, firstLookupValue } from "@/lib/airtableBilling";

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireBillingAdmin(req, res);
  if (!user) return;

  const orgId = String(
    user?.orgId || user?.OrgId || user?.OrganizationId || user?.organizationId || user?.id || ""
  ).trim();
  if (!orgId) return res.status(400).json({ error: "Missing orgId in session." });

  // only allow org owner/admin to init trial (your dashboard already enforces this)
  const role = String(user?.role || user?.Role || "").trim().toLowerCase();
  const canInit = role === "organization" || role === "admin" || role.includes("org") || role.includes("admin");
  if (!canInit) return res.status(403).json({ error: "Forbidden." });

  try {
    const rec = await findBillingRecordByOrgId(orgId);

    // If no record, create minimal shell
    if (!rec?.id) {
      await upsertBillingForOrg(orgId, {
        [F.Plan]: "Org",
        [F.BillingStatus]: "Trial",
        [F.Currency]: "USD",
      });

      return res.status(200).json({ ok: true, created: true });
    }

    // Record exists: ensure TrialEnds is populated if Created exists
    const f = rec.fields || {};
    const createdRaw = firstLookupValue(f?.[F.Created]);
    const createdAt = toDateOrNull(createdRaw);

    const hasTrialEnds = Boolean(toDateOrNull(f?.[F.TrialEnds]));
    const statusRaw = String(f?.[F.BillingStatus] || "").trim();

    if (createdAt && !hasTrialEnds) {
      const trialEnds = addDays(createdAt, 30);
      await upsertBillingForOrg(orgId, {
        [F.TrialEnds]: iso(trialEnds),
        ...(statusRaw ? {} : { [F.BillingStatus]: "Trial" }),
      });
      return res.status(200).json({ ok: true, updated: true });
    }

    return res.status(200).json({ ok: true, noop: true });
  } catch (e) {
    console.error("[billing/ensureTrial] error:", e);
    return res.status(500).json({ error: e?.message || "Failed to ensure trial." });
  }
}
