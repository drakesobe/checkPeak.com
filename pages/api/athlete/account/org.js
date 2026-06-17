// pages/api/athlete/account/org.js
// GET - returns the athlete's connected organization info.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireAthlete } from "@/lib/requireAthlete";

function asString(v) { return String(v ?? "").trim(); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Route", "athlete/account/org");

  if (String(req.method || "GET").toUpperCase() !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAthlete(req);
  if (!auth?.ok) return res.status(401).json({ error: auth?.error || "Unauthorized" });

  const athlete = auth.athlete || {};
  const athleteId    = asString(athlete.id || athlete.Id || "");
  const athleteEmail = asString(athlete.email || athlete.Email || "").toLowerCase();

  if (!athleteId && !athleteEmail) {
    return res.status(400).json({
      error: "Cannot identify athlete - session cookie is missing id and email. Log out and back in.",
    });
  }

  try {
    // 1) Fetch athlete row from Supabase
    let query = db.from("athletes").select("id, email, org_token");
    if (athleteId) {
      query = query.eq("id", athleteId);
    } else {
      query = query.eq("email", athleteEmail);
    }
    const { data: athleteRow, error: athErr } = await query.maybeSingle();
    if (athErr) throw athErr;
    if (!athleteRow) return res.status(404).json({ error: "Athlete record not found." });

    // DB row is canonical; session cookie is fallback for athletes migrated before org_token was backfilled
    const dbOrgToken      = asString(athleteRow.org_token);
    const sessionOrgToken = asString(auth.user?.Token || auth.user?.token || auth.user?.orgToken || "");
    const orgToken        = dbOrgToken || sessionOrgToken;

    // Backfill missing org_token onto the DB row so future lookups don't need the fallback
    if (!dbOrgToken && sessionOrgToken) {
      await db.from("athletes").update({ org_token: sessionOrgToken }).eq("id", athleteRow.id);
    }

    if (!orgToken) {
      return res.status(200).json({
        ok:  true,
        org: { name: "", id: "", token: "" },
        debug: { resolvedBy: athleteId ? "id" : "email", hasOrgToken: false },
      });
    }

    // 2) Look up org by org_token
    const { data: org, error: orgErr } = await db
      .from("organizations")
      .select("id, name, token")
      .eq("token", orgToken)
      .maybeSingle();

    if (orgErr) throw orgErr;

    return res.status(200).json({
      ok:  true,
      org: {
        name:  asString(org?.name),
        id:    asString(org?.id),
        token: asString(org?.token || orgToken),
      },
      debug: {
        resolvedBy:  athleteId ? "id" : "email",
        hasOrgToken: Boolean(orgToken),
        hasOrgId:    Boolean(org?.id),
        hasOrgName:  Boolean(org?.name),
      },
    });

  } catch (err) {
    console.error("[athlete/account/org] error:", err);
    return res.status(500).json({ error: "Failed to load athlete org info.", detail: err?.message });
  }
}
