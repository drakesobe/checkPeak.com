// pages/api/update-athlete.js
// POST|PATCH { id | athleteId | athleteToken, name?, sport?, status?, email?, orgToken? }
//   (also accepts the account-page shape { athleteId, updates: { Name, Email, Sport, Status } })
// Athletes may edit their own profile. Coaches may edit athletes on their roster (not their email),
// and may remove an athlete from the team (orgToken: "").

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireUser, readUserFromRequest } from "@/lib/requireUser";
import { signSession } from "@/lib/session";
import { normalizeEmail } from "@/lib/supabaseOrg";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" && req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = requireUser(req, res);
  if (!user) return;

  const body = req.body || {};
  const u = body.updates && typeof body.updates === "object" ? body.updates : {};
  const pick = (top, nested) => (body[top] !== undefined ? body[top] : u[nested]);

  const identifier = asString(body.id || body.athleteId || body.athleteToken);
  if (!identifier) return res.status(400).json({ error: "id or athleteToken is required" });

  const column = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(identifier) ? "id" : /^ATH-/i.test(identifier) ? "athlete_token" : null;
  if (!column) return res.status(400).json({ error: "id must be a UUID or ATH- token" });

  const { data: target, error: findErr } = await db
    .from("athletes").select("id, athlete_token, org_token").eq(column, identifier).maybeSingle();
  if (findErr) return res.status(500).json({ error: "Failed to update athlete." });
  if (!target) return res.status(404).json({ error: "Athlete not found." });

  const isSelf = user.role === "athlete" && (
    [user.id, user.athleteId].map(asString).includes(asString(target.id)) ||
    [user.AthleteToken, user.athleteToken, user.athlete_token].map(asString).includes(asString(target.athlete_token))
  );
  const staffOrg = ["organization", "admin", "trainer"].includes(user.role)
    ? asString(user.orgToken || user.Token || user.org_token).toUpperCase() : "";
  const isCoach = !!staffOrg && asString(target.org_token).toUpperCase() === staffOrg;
  if (!isSelf && !isCoach) return res.status(404).json({ error: "Athlete not found." });

  const name   = pick("name", "Name");
  const sport  = pick("sport", "Sport");
  const status = pick("status", "Status");
  const email  = pick("email", "Email");
  const orgToken = body.orgToken;

  const update = {};
  if (name   !== undefined) update.name   = asString(name);
  if (sport  !== undefined) update.sport  = asString(sport) || null;
  if (status !== undefined && isCoach) update.status = asString(status) || "active";
  if (email  !== undefined) {
    if (!isSelf) return res.status(403).json({ error: "Only the athlete can change their email." });
    const e = normalizeEmail(email);
    if (!e.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
    update.email = e;
  }
  if (orgToken !== undefined) {
    // Joining a team goes through /api/athlete/connectOrg; here a coach can only remove an athlete
    if (!isCoach || asString(orgToken)) return res.status(403).json({ error: "Use the team code to change teams." });
    update.org_token = null;
  }

  if (Object.keys(update).length === 0) return res.status(400).json({ error: "No fields to update." });

  try {
    const { data, error } = await db.from("athletes").update(update).eq("id", target.id)
      .select("id, email, name, athlete_token, sport, status").single();
    if (error) {
      console.error("[update-athlete]", error);
      const taken = /duplicate|unique/i.test(error.message || "");
      return res.status(taken ? 409 : 500).json({ error: taken ? "That email is already in use." : "Failed to update athlete." });
    }
    // New email = new identity: re-issue the signed session so the user stays signed in
    let session;
    if (isSelf && update.email) {
      const raw = { ...(readUserFromRequest(req) || {}) };
      delete raw._sig; delete raw._iat;
      for (const k of ["email", "Email"]) if (k in raw || k === "Email") raw[k] = update.email;
      [session] = await signSession(raw);
      const parts = [`user=${encodeURIComponent(JSON.stringify(session))}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=2592000"];
      if (process.env.NODE_ENV === "production") parts.push("Secure");
      res.setHeader("Set-Cookie", parts.join("; "));
    }
    return res.status(200).json({ ok: true, athlete: data, user: data, ...(session ? { session } : {}) });
  } catch (err) {
    console.error("[update-athlete]", err);
    return res.status(500).json({ error: "Failed to update athlete." });
  }
}
