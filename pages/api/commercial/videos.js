// pages/api/commercial/videos.js
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getVideosByTrainer,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
} from "@/lib/commercial/airtable";
import mux from "@/lib/mux";

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
    const { title, sourceType, embedUrl, tier, tags, muxUploadId } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    if (!["Basic", "Premium", "Ultra"].includes(tier))
      return res.status(400).json({ error: "Invalid tier" });
    if (sourceType === "embed" && !embedUrl)
      return res.status(400).json({ error: "embedUrl required for embed type" });

    const record = await createVideo({
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
    });
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
    const updated = await updateVideo(id, fields);
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