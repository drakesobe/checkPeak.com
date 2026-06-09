// pages/api/commercial/backfill-mux-playback.js
// One-time maintenance endpoint: finds uploaded videos in Supabase that have
// a mux_upload_id but no mux_playback_id, resolves the playback ID via the
// Mux API, and writes it back so thumbnails and playback work.
//
// Protected by BACKFILL_SECRET env var.  Hit it once, then you're done.
// GET  /api/commercial/backfill-mux-playback?secret=<BACKFILL_SECRET>   (dry-run)
// POST /api/commercial/backfill-mux-playback?secret=<BACKFILL_SECRET>   (writes)

import { supabaseAdmin as db } from "@/lib/supabase";
import mux from "@/lib/mux";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const secret = String(req.query.secret ?? "").trim();
  if (!process.env.BACKFILL_SECRET || secret !== process.env.BACKFILL_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const dryRun = req.method !== "POST";

  // Fetch all uploaded videos that have a mux_upload_id but no mux_playback_id
  const { data: videos, error: fetchErr } = await db
    .from("videos")
    .select("id, mux_upload_id, mux_asset_id, mux_playback_id, title, status")
    .eq("source_type", "upload")
    .not("mux_upload_id", "is", null)
    .neq("mux_upload_id", "")
    .or("mux_playback_id.is.null,mux_playback_id.eq.");

  if (fetchErr) {
    return res.status(500).json({ error: fetchErr.message });
  }

  const results = [];

  for (const video of videos ?? []) {
    const entry = { id: video.id, title: video.title, uploadId: video.mux_upload_id };

    try {
      // Step 1: resolve asset ID from upload (skip if we already have it)
      let assetId = video.mux_asset_id;
      if (!assetId) {
        const upload = await mux.video.uploads.retrieve(video.mux_upload_id);
        assetId = upload.asset_id;
      }

      if (!assetId) {
        entry.result = "skip";
        entry.reason = "upload has no asset yet (still processing or errored)";
        results.push(entry);
        continue;
      }

      // Step 2: get the asset to find playback ID and duration
      const asset = await mux.video.assets.retrieve(assetId);
      const playbackId = asset.playback_ids?.[0]?.id;

      if (!playbackId) {
        entry.result = "skip";
        entry.reason = "asset has no playback ID yet";
        results.push(entry);
        continue;
      }

      entry.assetId    = assetId;
      entry.playbackId = playbackId;
      entry.duration   = asset.duration ? Math.round(asset.duration) : null;
      entry.aspectRatio = asset.aspect_ratio ?? null;

      if (!dryRun) {
        const { error: updateErr } = await db
          .from("videos")
          .update({
            mux_asset_id:    assetId,
            mux_playback_id: playbackId,
            ...(entry.duration   ? { duration:     entry.duration }   : {}),
            ...(entry.aspectRatio ? { aspect_ratio: entry.aspectRatio } : {}),
            status: "ready",
          })
          .eq("id", video.id);

        entry.result = updateErr ? "error" : "updated";
        if (updateErr) entry.error = updateErr.message;
      } else {
        entry.result = "would-update";
      }
    } catch (err) {
      entry.result = "error";
      entry.error  = err?.message ?? String(err);
    }

    results.push(entry);
  }

  return res.status(200).json({
    dryRun,
    total:   results.length,
    updated: results.filter(r => r.result === "updated" || r.result === "would-update").length,
    skipped: results.filter(r => r.result === "skip").length,
    errors:  results.filter(r => r.result === "error").length,
    results,
  });
}
