// pages/api/shareScan.js
// POST { scanId, enable } - toggles sharing for a scan.

import crypto from "crypto";
import { supabaseAdmin as db } from "@/lib/supabase";
import { loadOwnedScan } from "@/lib/scanAccess";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { scanId, enable } = req.body || {};

    if (!scanId) {
      return res.status(400).json({ error: "Missing scanId in request body." });
    }
    if (typeof enable !== "boolean") {
      return res.status(400).json({
        error: "Missing or invalid 'enable' flag in request body (must be boolean).",
      });
    }

    // Only the owner can share or unshare a scan
    const existing = await loadOwnedScan(req, res, scanId, "id, share_token");
    if (!existing) return;

    let token = existing.share_token || "";
    if (enable && !token) {
      token = crypto.randomBytes(16).toString("hex");
    }

    const { data: updated, error: updateErr } = await db
      .from("scans")
      .update({
        share_enabled:     enable,
        share_token:       token,
        share_disabled_at: enable ? null : new Date().toISOString(),
      })
      .eq("id", scanId)
      .select("share_enabled, share_token")
      .single();

    if (updateErr) throw updateErr;

    return res.status(200).json({
      shareEnabled: Boolean(updated.share_enabled),
      shareToken:   updated.share_token || token || "",
    });
  } catch (err) {
    console.error("[/api/shareScan] unexpected error:", err);
    return res.status(500).json({ error: err?.message || "Unexpected error while updating share settings." });
  }
}
