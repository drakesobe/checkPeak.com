// pages/api/org/rotateToken.js
// POST — generates a new org token for the authenticated organization.

import { supabaseAdmin as db } from "@/lib/supabase";
import { requireOrg } from "@/lib/requireOrg";
import crypto from "crypto";

function generateOrgToken() {
  const a = crypto.randomBytes(3).toString("hex").toUpperCase();
  const b = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORG-${a}-${b}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = requireOrg(req, res);
  if (!auth?.ok) return;

  const orgToken = String(auth?.org?.token || "").trim();
  const orgId    = String(auth?.org?.id    || "").trim();

  if (!orgToken && !orgId) {
    return res.status(401).json({ error: "Org identity missing from session." });
  }

  try {
    const newToken = generateOrgToken();

    let query = db.from("organizations").update({ token: newToken });
    if (orgId) {
      query = query.eq("id", orgId);
    } else {
      query = query.eq("token", orgToken);
    }

    const { error } = await query;
    if (error) throw error;

    return res.status(200).json({ ok: true, newToken });
  } catch (err) {
    console.error("[org/rotateToken] error:", err);
    return res.status(500).json({ error: "Failed to rotate token.", detail: err?.message });
  }
}
