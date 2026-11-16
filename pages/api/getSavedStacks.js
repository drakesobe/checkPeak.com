// pages/api/getSavedStacks.js
// GET ?UserEmail= - returns saved stacks for a user.

import { sessionEmail } from "@/lib/supplementCheck";
import { supabaseAdmin as db } from "@/lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Always the signed-in user's list; ?UserEmail= is ignored
  const normalizedEmail = sessionEmail(req);
  if (!normalizedEmail) return res.status(401).json({ error: "Please sign in to see saved stacks." });

  try {
    const { data: records, error } = await db
      .from("saved_stacks")
      .select("id, stack_id, notes, date_saved")
      .eq("user_email", normalizedEmail)
      .order("date_saved", { ascending: false });

    if (error) throw error;

    const savedStacks = (records || []).map(r => ({
      recordId:  r.id,
      StackID:   r.stack_id,
      UserEmail: normalizedEmail,
      Notes:     r.notes     || "",
      DateSaved: r.date_saved || null,
    }));

    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("[getSavedStacks] error:", error);
    return res.status(500).json({ error: "Failed to fetch saved stacks" });
  }
}
