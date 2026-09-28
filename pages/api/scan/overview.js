// pages/api/scan/overview.js
// GET -> what the scanner checks against, plus the signed-in user's latest scans.

import { supabaseAdmin as db } from "@/lib/supabase";
import { getSupplementData, sessionEmail } from "@/lib/supplementCheck";

const ORG_ORDER = ["NCAA", "WADA", "NFL", "NBA", "MLB"];

function statusFrom(details) {
  if (details?.ProhibitedCount > 0) return "flagged";
  if (details?.LimitedCount > 0 || details?.OtherBannedCount > 0) return "review";
  return "no_match";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "private, no-store");

  const data = await getSupplementData();
  const orgs = new Set();
  (data?.bannedRecords || []).forEach((r) =>
    String(r.fields["Banned By"] || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean).forEach((o) => orgs.add(o))
  );
  const sortedOrgs = [...orgs].sort((a, b) => {
    const ia = ORG_ORDER.indexOf(a), ib = ORG_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });

  let recent = [];
  const email = sessionEmail(req);
  if (email) {
    const { data: rows, error } = await db
      .from("scans")
      .select("id, scan_name, product_name, scan_date, banned_details")
      .eq("user_email", email)
      .order("scan_date", { ascending: false })
      .limit(3);
    if (error) console.error("[scan/overview] recent scans:", error);
    recent = (rows || []).map((r) => ({
      id:     r.id,
      name:   r.product_name || String(r.scan_name || "Scan").replace(/\s*\([^)]*\)\s*$/, "") || "Scan",
      date:   r.scan_date,
      status: statusFrom(r.banned_details),
    }));
  }

  return res.status(200).json({
    bannedCount: data?.bannedRecords.length || 0,
    organizations: sortedOrgs,
    recent,
  });
}
