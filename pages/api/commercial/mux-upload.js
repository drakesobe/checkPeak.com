// pages/api/commercial/mux-upload.js
import { getRequestUser } from "@/lib/commercial/getRequestUser";
import mux from "@/lib/mux";
 
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
 
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
 
  try {
    const upload = await mux.video.uploads.create({
      new_asset_settings: {
        playback_policy: ["public"],
        encoding_tier:   "smart",
        passthrough:     req.body.videoRecordId ?? "",
      },
      cors_origin: process.env.NEXT_PUBLIC_SITE_URL || "*",
    });
 
    return res.status(200).json({
      uploadId:  upload.id,
      uploadUrl: upload.url,
    });
  } catch (err) {
    console.error("[mux-upload]", err);
    return res.status(500).json({ error: "Failed to create Mux upload" });
  }
}
 