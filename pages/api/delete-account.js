// pages/api/delete-account.js
// Permanently deletes an athlete account from Supabase.
// POST { athleteId?, athleteToken?, password }

import bcrypt from "bcryptjs";
import { supabaseAdmin as db } from "@/lib/supabase";
import { getAthleteById, getAthleteByToken } from "@/lib/supabaseOrg";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { athleteId, athleteToken, password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Password confirmation is required." });

  const identifier = asString(athleteId || athleteToken);
  if (!identifier) return res.status(400).json({ error: "athleteId or athleteToken is required." });

  try {
    let athlete = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(identifier)) {
      const { data } = await getAthleteById(identifier);
      athlete = data;
    } else {
      const { data } = await getAthleteByToken(identifier);
      athlete = data;
    }

    if (!athlete) return res.status(404).json({ error: "Athlete not found." });
    if (!athlete.password_hash) return res.status(400).json({ error: "Account has no password set." });

    const match = await bcrypt.compare(String(password), athlete.password_hash);
    if (!match) return res.status(401).json({ error: "Password is incorrect." });

    const { error } = await db.from("athletes").delete().eq("id", athlete.id);
    if (error) return res.status(500).json({ error: "Failed to delete account.", details: error.message });

    // Clear the session cookie
    res.setHeader("Set-Cookie", "user=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[delete-account]", err);
    return res.status(500).json({ error: "Failed to delete account.", details: err?.message });
  }
}
