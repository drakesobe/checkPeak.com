// lib/scanAccess.js
// Scan history belongs to the signed-in user. Identity comes from the (signature-verified) session,
// never from an email in the request.

import { supabaseAdmin as db } from "@/lib/supabase";
import { sessionEmail } from "@/lib/supplementCheck";

// Sends 401 and returns "" when nobody is signed in
export function requireScanUser(req, res) {
  const email = sessionEmail(req);
  if (!email) res.status(401).json({ ok: false, error: "Please sign in to view your scans." });
  return email;
}

// Loads a scan the signed-in user owns, or sends 401/404 and returns null.
// Someone else's scan answers 404 so scan IDs can't be probed.
export async function loadOwnedScan(req, res, scanId, columns = "*") {
  const email = requireScanUser(req, res);
  if (!email) return null;
  if (!scanId) {
    res.status(400).json({ ok: false, error: "Missing scan id." });
    return null;
  }
  const { data: scan, error } = await db
    .from("scans")
    .select(columns === "*" ? "*" : `${columns}, user_email`)
    .eq("id", scanId)
    .maybeSingle();
  if (error) throw error;
  if (!scan || String(scan.user_email || "").trim().toLowerCase() !== email) {
    res.status(404).json({ ok: false, error: "Scan not found." });
    return null;
  }
  return scan;
}
