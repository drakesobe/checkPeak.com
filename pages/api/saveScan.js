// pages/api/saveScan.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userEmail, stackDetails, resultSummary, bannedDetails } = req.body;

    if (!userEmail) {
      return res.status(400).json({ error: "Missing userEmail" });
    }

    const scanDate = new Date();

    const { data, error } = await db
      .from("scans")
      .insert({
        user_email:      userEmail,
        scan_name:       `Scan - ${scanDate.toLocaleString("en-US", { hour12: false })}`,
        scan_date:       scanDate.toISOString(),
        stack_details:   stackDetails || "No stack details provided",
        results_summary: resultSummary || "No summary available",
        banned_details:  bannedDetails ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return res.status(200).json({ success: true, recordId: data.id });
  } catch (error) {
    console.error("❌ Error saving scan:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error while saving scan",
    });
  }
}
