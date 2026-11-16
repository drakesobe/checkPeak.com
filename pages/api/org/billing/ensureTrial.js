// pages/api/org/billing/ensureTrial.js
// Called on coach page loads (hooks/org/useBillingGate.js) to make sure the program has a billing
// record, and returns whether the coach can use the app.
//
// Pricing: Starter is free (up to 10 athletes, no expiry); Program is paid through Stripe.
// - No billing record yet      -> create one on Free / Starter.
// - Legacy "Sandbox" record     -> while Sandbox Ends is in the future it stays as is; once it has
//                                  ended it falls back to Free / Starter (it used to lock the coach out).
// - Trial / Active / Past Due / Canceled come from Stripe and are never changed here.

import { requireOrg } from "@/lib/requireOrg";
import {
  findBillingRecordByOrgId,
  findBillingRecordByOrgToken,
  upsertBillingForOrg,
  upsertBillingForOrgToken,
  F,
} from "@/lib/billingStore";

const asString = (v) => String(v ?? "").trim();

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeStatus(v) {
  const s = asString(v).toLowerCase();
  if (!s) return "";
  if (s === "free" || s.includes("starter")) return "Free";
  if (s.includes("sandbox")) return "Sandbox";
  if (s.includes("trial")) return "Trial";
  if (s.includes("active")) return "Active";
  if (s.includes("past")) return "Past Due";
  if (s.includes("cancel")) return "Canceled";
  if (s.includes("suspend") || s.includes("unpaid")) return "Suspended";
  if (s.includes("not started") || s.includes("not_started")) return "Not Started";
  return asString(v);
}

const FREE = { [F.BillingStatus]: "Free", [F.Plan]: "Starter" };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "POST" && method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  const orgId = asString(auth?.org?.id);
  const orgToken = asString(auth?.org?.token).toUpperCase();
  if (!orgId && !orgToken) return res.status(400).json({ error: "Your session is missing a program. Please sign in again." });

  const save = (patch) => (orgId ? upsertBillingForOrg(orgId, patch) : upsertBillingForOrgToken(orgToken, patch));

  try {
    const now = Date.now();
    let rec = orgId ? await findBillingRecordByOrgId(orgId) : null;
    if (!rec?.id && orgToken) rec = await findBillingRecordByOrgToken(orgToken);

    if (!rec?.id) {
      rec = await save(FREE);
    } else {
      const linked = rec.fields?.[F.Organization]?.[0];
      const status = normalizeStatus(rec.fields?.[F.BillingStatus]);
      const sandboxEnds = parseDate(rec.fields?.[F.SandboxEnds]);
      const sandboxOver = status === "Sandbox" && (!sandboxEnds || sandboxEnds.getTime() < now);
      const noStatus = !status || status === "Not Started";

      if (sandboxOver || noStatus) rec = await save(FREE);
      else if (orgId && linked !== orgId) rec = await save({}); // link the row to this organization
    }

    const out = rec?.fields || {};
    const status = normalizeStatus(out[F.BillingStatus]);
    const sandboxEnds = parseDate(out[F.SandboxEnds]);
    const isPaidOk =
      status === "Free" || status === "Trial" || status === "Active" ||
      (status === "Sandbox" && sandboxEnds && now <= sandboxEnds.getTime());

    const lockedReason = isPaidOk ? ""
      : status === "Past Due"  ? "Your last payment didn't go through. Update your card to keep using CheckPeak."
      : status === "Canceled"  ? "Your Program subscription was canceled."
      : status === "Suspended" ? "Your subscription is suspended."
      : "Your subscription isn't active.";

    return res.status(200).json({
      ok: true,
      billing: {
        status: asString(out[F.BillingStatus]) || status,
        statusNormalized: status,
        plan: asString(out[F.Plan]),
        isPaidOk,
        lockedReason,
        sandboxEnds: asString(out[F.SandboxEnds]),
        trialEnds: asString(out[F.TrialEnds]),
        currentPeriodEnd: asString(out[F.CurrentPeriodEnd]),
        renewalDate: asString(out[F.RenewalDate]),
        recordId: rec?.id || "",
      },
    });
  } catch (err) {
    console.error("[billing/ensureTrial]", err);
    return res.status(500).json({ error: "Failed to check billing status." });
  }
}
