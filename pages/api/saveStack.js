// pages/api/saveStack.js
// POST { UserEmail, stack: { id, notes? } } - saves a stack for a user.

import { supabaseAdmin as db } from "@/lib/supabase";

function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { UserEmail, stack } = req.body || {};
    const normalizedEmail = normalizeEmail(UserEmail);
    const stackId = normalizeStackId(stack?.id);

    if (!normalizedEmail || !normalizedEmail.includes("@") || !stackId) {
      return res.status(400).json({ error: "UserEmail and stack.id are required" });
    }

    // Check for duplicate
    const { data: existing } = await db
      .from("saved_stacks")
      .select("id")
      .eq("user_email", normalizedEmail)
      .eq("stack_id", stackId)
      .maybeSingle();

    if (!existing) {
      const { error } = await db.from("saved_stacks").insert({
        user_email: normalizedEmail,
        stack_id:   stackId,
        notes:      stack?.notes || null,
        date_saved: new Date().toISOString(),
      });
      if (error) throw error;
    }

    const savedStacks = await fetchAllSaved(normalizedEmail);
    return res.status(200).json({ savedStacks });
  } catch (error) {
    console.error("[saveStack] error:", error);
    return res.status(500).json({ error: "Failed to save stack" });
  }
}
