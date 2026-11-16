// pages/api/getScans.js
import { supabaseAdmin as db } from "@/lib/supabase";
import { requireScanUser } from "@/lib/scanAccess";

export default async function handler(req, res) {
  // Always the signed-in user's own scans; the old ?userEmail= param is ignored
  const userEmail = requireScanUser(req, res);
  if (!userEmail) return;

  try {
    const { data, error } = await db
      .from("scans")
      .select("id, scan_name, scan_date, results_summary, stack_details, banned_details")
      .eq("user_email", userEmail)
      .order("scan_date", { ascending: false });

    if (error) throw error;

    const scans = (data || []).map((r) => ({
      id:           r.id,
      name:         r.scan_name,
      date:         r.scan_date,
      summary:      r.results_summary || "",
      stackDetails: r.stack_details   || "",
      bannedDetails: r.banned_details ?? null,
    }));

    return res.status(200).json({ scans });
  } catch (error) {
    console.error("❌ Error fetching scans:", error);
    return res.status(500).json({ error: "Failed to fetch scans" });
  }
}
