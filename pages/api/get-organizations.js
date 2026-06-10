// pages/api/get-organizations.js
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  try {
    const { data: records, error } = await db
      .from("organizations")
      .select("*")
      .order("name");

    if (error) throw error;

    const organizations = (records || []).map(rec => ({
      id:     rec.id,
      fields: rec,
    }));

    res.status(200).json({ organizations });
  } catch (err) {
    console.error("[get-organizations] error:", err);
    res.status(500).json({ error: err.message });
  }
}
