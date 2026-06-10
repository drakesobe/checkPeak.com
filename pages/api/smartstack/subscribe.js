// pages/api/smartstack/subscribe.js
// Saves a price-alert email as a lightweight lead in the athletes table.
// POST { email, category }

import { supabaseAdmin as db } from "@/lib/supabase";

function asString(v) { return String(v ?? "").trim(); }

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(asString(e));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email    = asString(req.body?.email).toLowerCase();
  const category = asString(req.body?.category) || "Supplements";

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  try {
    // Check for existing record - don't create duplicates
    const { data: existing } = await db
      .from("athletes")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      console.log(`[smartstack/subscribe] Already exists: ${email}`);
      return res.status(200).json({ ok: true, saved: false, reason: "already_exists" });
    }

    // Create lightweight lead record
    const { error } = await db.from("athletes").insert({
      email,
      name:       email.split("@")[0],
      source:     "price_alert",
      notes:      `Price alert subscriber - interested in: ${category}`,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    console.log(`[smartstack/subscribe] Saved: ${email} (${category})`);
    return res.status(200).json({ ok: true, saved: true });

  } catch (err) {
    console.error("[smartstack/subscribe] error:", err);
    // Non-fatal - don't break the UX
    return res.status(200).json({ ok: true, saved: false, reason: err?.message });
  }
}
