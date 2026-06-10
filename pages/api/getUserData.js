// pages/api/getUserData.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  const { userEmail } = req.query;
  if (!userEmail) return res.status(400).json({ error: "Missing userEmail" });

  try {
    const { data: records, error } = await db
      .from("athletes")
      .select("id, name, created_at, org_token")
      .eq("email", String(userEmail).trim().toLowerCase())
      .order("name", { ascending: true });

    if (error) throw error;

    const formattedRecords = (records || []).map(r => ({
      id:           r.id,
      name:         r.name || "",
      date:         r.created_at ? r.created_at.slice(0, 10) : "",
      organization: r.org_token || "",
      title:        "Athlete",
    }));

    return res.status(200).json({
      recentActivity: formattedRecords,
      stats: {
        totalScans:         formattedRecords.length,
        recentSearches:     5,
        stacksSaved:        3,
        accountCompletion:  80,
      },
    });
  } catch (err) {
    console.error("[getUserData]", err);
    return res.status(500).json({ error: "Failed to fetch user data" });
  }
}
