// pages/api/org/athlete/bulk-import.js
// POST { athletes: [{ firstName, lastName, email, sport?, phone? }] }
// Adds athletes to the coach's roster in Supabase. Athletes are created without a password:
// they finish their account in the CheckPeak app by signing up with the same email and the
// team code (see /api/athlete-signup), which links them to this row.
// Each new athlete gets an invite email with the app link and team code.
// Response: { ok, created, skipped, errors: [{ email, reason }], invites: { sent, failed, skipped } }

import { requireOrgSideUser } from "@/lib/requireUser";
import { supabaseAdmin as db } from "@/lib/supabase";
import { generateAthleteToken, normalizeEmail } from "@/lib/supabaseOrg";
import { sendAthleteInvites } from "@/lib/email/athleteInvite";

const MAX_ROWS = 1000;
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = requireOrgSideUser(req, res);
  if (!user) return;

  const orgToken = String(user.orgToken || user.org_token || "").trim();
  if (!orgToken) return res.status(400).json({ error: "Your session is missing a team. Please sign in again." });

  const { athletes } = req.body || {};
  if (!Array.isArray(athletes) || !athletes.length) return res.status(400).json({ error: "Add at least one athlete." });
  if (athletes.length > MAX_ROWS) return res.status(400).json({ error: `Import at most ${MAX_ROWS} athletes at a time.` });

  const errors = [];
  const valid = new Map(); // email -> row (later duplicates in the file are skipped)
  for (const a of athletes) {
    const email = normalizeEmail(a?.email);
    const firstName = clip(a?.firstName, 60);
    const lastName = clip(a?.lastName, 60);
    if (!isEmail(email)) { errors.push({ email: email || "(blank)", reason: "Invalid email" }); continue; }
    if (!firstName || !lastName) { errors.push({ email, reason: "Missing first or last name" }); continue; }
    if (valid.has(email)) { errors.push({ email, reason: "Listed twice in the file" }); continue; }
    valid.set(email, { email, name: `${firstName} ${lastName}`, sport: clip(a?.sport, 60) || null, phone: clip(a?.phone, 30) || null });
  }

  let skipped = 0;
  const emails = [...valid.keys()];
  for (let i = 0; i < emails.length; i += 200) {
    const { data: existing, error } = await db.from("athletes").select("email, org_token").in("email", emails.slice(i, i + 200));
    if (error) return res.status(500).json({ error: "Could not check your roster. Try again." });
    for (const row of existing ?? []) {
      const email = normalizeEmail(row.email);
      if (!valid.has(email)) continue;
      valid.delete(email);
      skipped++;
      errors.push({
        email,
        reason: String(row.org_token || "").toUpperCase() === orgToken.toUpperCase()
          ? "Already on your roster"
          : "Already has a CheckPeak account. Ask them to join with your team code.",
      });
    }
  }

  let created = 0;
  const added = [];
  const rows = [...valid.values()].map((a) => ({ ...a, athlete_token: generateAthleteToken(), org_token: orgToken, status: "active" }));
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await db.from("athletes").insert(batch);
    if (error) {
      console.error("[bulk-import]", error.message);
      for (const r of batch) errors.push({ email: r.email, reason: "Could not be added. Try again." });
    } else {
      created += batch.length;
      added.push(...batch);
    }
  }

  let invites = { sent: 0, failed: 0, skipped: 0 };
  if (added.length) {
    const { data: org } = await db.from("organizations").select("name").eq("token", orgToken).maybeSingle();
    invites = await sendAthleteInvites({
      athletes: added,
      orgName: org?.name || user.orgName,
      coachName: user.name || user.Name || "",
      teamCode: orgToken,
      replyTo: user.email,
    });
  }

  return res.status(200).json({ ok: true, created, skipped, errors, invites });
}
