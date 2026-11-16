// pages/api/removeSavedStack.js
// DELETE { UserEmail, recordId? | stackId? } - removes a saved stack.

import { sessionEmail } from "@/lib/supplementCheck";
import { supabaseAdmin as db } from "@/lib/supabase";


function normalizeStackId(id) { return String(id ?? "").trim(); }

async function fetchAllSaved(email) {
  const { data, error } = await db
    .from("saved_stacks")
    .select("id, stack_id, notes, date_saved")
    .eq("user_email", email)
    .order("date_saved", { ascending: false });

  if (error) throw error;

  return (data || []).map(r => ({
    recordId:  r.id,
    StackID:   r.stack_id,
    Notes:     r.notes     || "",
    DateSaved: r.date_saved || null,
  }));
}

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Always the signed-in user's list; UserEmail in the body is ignored
    const { recordId, stackId } = req.body || {};
    const normalizedEmail = sessionEmail(req);
    if (!normalizedEmail) return res.status(401).json({ error: "Please sign in to manage saved stacks." });

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return res.status(400).json({ error: "UserEmail is required" });
    }

    if (recordId) {
      // Delete by UUID, verify ownership
      const { error } = await db
        .from("saved_stacks")
        .delete()
        .eq("id", recordId)
        .eq("user_email", normalizedEmail);

      if (error) throw error;
    } else {
      const sid = normalizeStackId(stackId);
      if (!sid) return res.status(400).json({ error: "recordId or stackId is required" });

      const { error } = await db
        .from("saved_stacks")
        .delete()
        .eq("user_email", normalizedEmail)
        .eq("stack_id", sid);

      if (error) throw error;
    }

    const savedStacks = await fetchAllSaved(normalizedEmail);
    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("[removeSavedStack] error:", error);
    return res.status(500).json({ error: "Failed to remove saved stack" });
  }
}
