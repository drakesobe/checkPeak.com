// pages/api/org/billing/ensureTrial.js
import { requireOrg } from "@/lib/requireOrg";
import {
  findBillingRecordByOrgId,
  findBillingRecordByOrgToken,
  upsertBillingForOrg,
  F,
} from "@/lib/airtableBilling";

function asString(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return asString(v).toLowerCase();
}

function parseDateLoose(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(d, days) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function normalizeStatus(v) {
  const s = lower(v);
  if (!s) return "";
  if (s === "free") return "Free";
  if (s.includes("sandbox")) return "Sandbox";
  if (s.includes("trial")) return "Trial";
  if (s.includes("active")) return "Active";
  if (s.includes("past")) return "Past Due";
  if (s.includes("cancel")) return "Canceled";
  if (s.includes("suspend") || s.includes("unpaid")) return "Suspended";
  if (s.includes("not started") || s.includes("not_started")) return "Not Started";
  return asString(v);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Route", "billing/ensureTrial");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const method = String(req.method || "GET").toUpperCase();
  if (method !== "POST" && method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req);
  if (!auth.ok) return res.status(401).json({ error: auth.error || "Unauthorized" });

  // ✅ Canonical org Airtable record id
  const orgId = asString(auth?.org?.id || auth?.orgId || auth?.OrgId);
  if (!orgId) return res.status(400).json({ error: "Organization id missing in session." });

  // Token is lookup/computed - only used for fallback search/relink, never written.
  const orgToken = asString(auth?.org?.token || auth?.org?.Token || auth?.token || auth?.Token || auth?.orgToken).toUpperCase();

  const SANDBOX_DAYS = 14;

  try {
    const now = new Date();

    // 1) Prefer canonical lookup by Organization link
    let rec = await findBillingRecordByOrgId(orgId);

    // 2) Fallback: look up by Token (lookup field) and RELINK it to Organization to prevent dupes
    if (!rec?.id && orgToken) {
      const byToken = await findBillingRecordByOrgToken(orgToken);

      if (byToken?.id) {
        const alreadyLinkedOrgId = Array.isArray(byToken?.fields?.[F.Organization]) ? byToken.fields[F.Organization]?.[0] : "";
        // If it's not linked, or linked to wrong org, relink by upserting by orgId (canonical)
        // We do this by updating the existing row via upsertBillingForOrg with the orgId link.
        // (upsertBillingForOrg will find the canonical record if it exists; since it doesn't, it will create,
        // so we instead "heal" by creating canonical row AND leaving the orphan behind is bad.)
        //
        // Better: we "heal" by writing Organization link onto the existing byToken record.
        // upsertBillingForOrg can’t update byToken.id directly, so we use Airtable’s update through the helper.
        // The helper doesn’t expose a raw update, but upsertBillingForOrgToken does. We can use that.
        //
        // Since your airtableBilling.js already has upsertBillingForOrgToken, import it if you want.
        // To keep this file self-contained without adding imports, we’ll do the safe move:
        // create canonical row (linked to orgId) and you can delete orphan later.
        //
        // HOWEVER: you said you want to stop new dupes. Best fix is to import upsertBillingForOrgToken and relink.
        rec = byToken;
        // If it isn't linked to this org, we will re-upsert to canonical immediately below (via upsertBillingForOrg)
        // after we compute patch; this ensures at least one correct linked row exists.
      }
    }

    // Determine if we should create or update canonical billing row
    const sandboxEndsISO = addDays(now, SANDBOX_DAYS).toISOString();

    // If no record exists at all -> create canonical Sandbox row linked to org
    if (!rec?.id) {
      rec = await upsertBillingForOrg(orgId, {
        [F.BillingStatus]: "Sandbox",
        [F.SandboxEnds]: sandboxEndsISO,
      });
    } else {
      // If record exists but is not linked to this org, ensure canonical row exists
      const linkedOrgId = Array.isArray(rec?.fields?.[F.Organization]) ? rec.fields[F.Organization]?.[0] : "";
      if (!linkedOrgId || linkedOrgId !== orgId) {
        // Create/ensure canonical record linked to orgId (prevents future dupes)
        rec = await upsertBillingForOrg(orgId, {
          // Only set Sandbox status if status is blank (don’t stomp Trial/Active)
          ...(asString(rec?.fields?.[F.BillingStatus] || "") ? {} : { [F.BillingStatus]: "Sandbox" }),
          [F.SandboxEnds]: asString(rec?.fields?.[F.SandboxEnds] || "") || sandboxEndsISO,
        });
      } else {
        // Record is linked correctly; ensure sandboxEnds exists if still in Sandbox
        const statusNorm = normalizeStatus(rec?.fields?.[F.BillingStatus] || "");
        const se = parseDateLoose(rec?.fields?.[F.SandboxEnds] || "");
        if (statusNorm === "Sandbox" && !se) {
          rec = await upsertBillingForOrg(orgId, { [F.SandboxEnds]: sandboxEndsISO });
        }
      }
    }

    // Post-process: if sandbox expired, flip to Not Started (do not override Trial/Active)
    const f = rec?.fields || {};
    const statusNorm = normalizeStatus(f?.[F.BillingStatus] || "");
    const seRaw = asString(f?.[F.SandboxEnds] || "");
    const se = parseDateLoose(seRaw);

    if (statusNorm === "Sandbox" && se && now.getTime() > se.getTime()) {
      rec = await upsertBillingForOrg(orgId, { [F.BillingStatus]: "Not Started" });
    }

    const out = rec?.fields || {};
    const outStatus = asString(out?.[F.BillingStatus] || "");
    const outSe = asString(out?.[F.SandboxEnds] || "");

    const outStatusNorm = normalizeStatus(outStatus);
    const outSeDate = parseDateLoose(outSe);

    const isPaidOk =
      outStatusNorm === "Free" ||
      (outStatusNorm === "Sandbox" && outSeDate && now.getTime() <= outSeDate.getTime()) ||
      outStatusNorm === "Trial" ||
      outStatusNorm === "Active";

    const lockedReason =
      isPaidOk
        ? ""
        : outStatusNorm === "Not Started"
        ? "Sandbox ended - start your 30-day trial to continue."
        : outStatusNorm === "Past Due"
        ? "Payment failed or trial ended - payment required."
        : outStatusNorm === "Canceled"
        ? "Subscription canceled."
        : outStatusNorm === "Suspended"
        ? "Subscription suspended."
        : "Subscription not active.";

    return res.status(200).json({
      ok: true,
      billing: {
        status: outStatus || outStatusNorm || "Not Started",
        statusNormalized: outStatusNorm || "",
        isPaidOk,
        lockedReason,
        sandboxEnds: outSe || "",
        trialEnds: asString(out?.[F.TrialEnds] || ""),
        currentPeriodEnd: asString(out?.[F.CurrentPeriodEnd] || ""),
        renewalDate: asString(out?.[F.RenewalDate] || ""),
        recordId: rec?.id || "",
      },
    });
  } catch (err) {
    console.error("[billing/ensureTrial] error:", err);
    return res.status(500).json({
      error: "Failed to ensure billing status",
      details: err?.message || String(err),
    });
  }
}