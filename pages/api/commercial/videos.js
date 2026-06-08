// pages/api/commercial/videos.js
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getVideosByTrainer,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
} from "@/lib/commercial/db";
import mux from "@/lib/mux";

// null  = subscription-only (current behavior)
// number = also purchasable one-time for that dollar amount
// Empty / invalid / <= 0 all normalize to null so a stray "0" never creates a $0 item.
function normalizePrice(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

// Airtable returns { error: {...} } on failure but our helpers don't check status,
// so detect it here and surface a real error instead of a fake success.
function airtableError(record) {
  if (record?.error) {
    const e = record.error;
    return typeof e === "string" ? e : (e.message || "Airtable request failed");
  }
  if (!record?.id) return "Airtable returned no record id";
  return null;
}

export default async function handler(req, res) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(403).json({ error: "No trainer profile found" });

  const trainerId = trainer.id;

  if (req.method === "GET") {
    const videos = await getVideosByTrainer(trainerId);
    return res.status(200).json({ videos });
  }

  if (req.method === "POST") {
    const { title, sourceType, embedUrl, tier, tags, muxUploadId, price } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!["Basic", "Premium", "Ultra"].includes(tier))
      return res.status(400).json({ error: "Invalid tier" });
    if (sourceType === "embed" && !embedUrl)
      return res.status(400).json({ error: "embedUrl required for embed type" });

    const fields = {
      trainerId,
      title,
      sourceType:  sourceType ?? "upload",
      embedUrl:    embedUrl ?? "",
      muxUploadId: muxUploadId ?? "",
      tier,
      tags:        JSON.stringify(tags ?? {}),
      status:      sourceType === "embed" ? "ready" : "pending",
      published:   false,
      createdAt:   new Date().toISOString(),
    };
    // Only send price when it's actually set, so a missing "Price" column
    // never blocks creation of a normal subscription-only video.
    const priceVal = normalizePrice(price);
    if (priceVal !== null) fields.price = priceVal;

    const record = await createVideo(fields);
    const err = airtableError(record);
    if (err) {
      console.error("[videos POST] create failed:", err);
      return res.status(502).json({ error: `Could not create video record: ${err}` });
    }
    return res.status(201).json({ video: record });
  }

  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });

    const allowed = ["title", "tier", "tags", "published", "embedUrl", "description", "muxUploadId"];
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields[key] = key === "tags" ? JSON.stringify(req.body[key]) : req.body[key];
      }
    }
    // price is normalized server-side, never passed through raw
    if (req.body.price !== undefined) fields.price = normalizePrice(req.body.price);

    const updated = await updateVideo(id, fields);
    const err = airtableError(updated);
    if (err) {
      console.error("[videos PUT] update failed:", err);
      return res.status(502).json({ error: `Could not update video: ${err}` });
    }
    return res.status(200).json({ video: updated });
  }

  if (req.method === "DELETE") {
    const { id, hard } = req.query;
    if (!id) return res.status(400).json({ error: "Missing video id" });

    if (hard === "true") {
      const record = await getVideoById(id);
      const muxAssetId = record?.fields?.muxAssetId;
      if (muxAssetId) {
        try { await mux.video.assets.delete(muxAssetId); }
        catch (err) { console.warn("[videos DELETE] Mux asset delete failed:", err.message); }
      }
      await deleteVideo(id);
      return res.status(200).json({ deleted: true });
    }

    await updateVideo(id, { published: false });
    return res.status(200).json({ unpublished: true });
  }

  return res.status(405).end();
}