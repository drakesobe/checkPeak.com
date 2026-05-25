// pages/api/mux/webhook.js

import Mux from "@mux/mux-node";
import { updateVideo, getVideoByUploadId } from "../../../lib/commercial/airtable";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Verify the request is actually from Mux.
  try {
    Mux.Webhooks.verifySignature(
      JSON.stringify(req.body),
      req.headers,
      process.env.MUX_WEBHOOK_SECRET
    );
  } catch {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { type, data } = req.body;
  console.log("[mux-webhook] event:", type, data?.id);

  if (type === "video.upload.asset_created") {
    const uploadId = data?.upload_id;
    if (!uploadId) return res.status(200).end();
    const record = await getVideoByUploadId(uploadId);
    if (record) await updateVideo(record.id, { status: "processing" });
  }

  if (type === "video.asset.ready") {
    const assetId    = data?.id;
    const uploadId   = data?.upload_id;
    const playbackId = data?.playback_ids?.[0]?.id;
    const duration   = data?.duration;
    const aspectRatio = data?.aspect_ratio;

    if (!assetId || !playbackId) return res.status(200).end();

    const fields = {
      muxAssetId:    assetId,
      muxPlaybackId: playbackId,
      duration:      duration ? Math.round(duration) : null,
      aspectRatio,
      status:        "ready",
    };

    const recordId = data?.passthrough;
    if (recordId) {
      await updateVideo(recordId, fields);
    } else if (uploadId) {
      const record = await getVideoByUploadId(uploadId);
      if (record) await updateVideo(record.id, fields);
    }
  }

  if (type === "video.asset.errored") {
    const uploadId = data?.upload_id;
    const record = await getVideoByUploadId(uploadId);
    if (record) await updateVideo(record.id, { status: "error" });
  }

  return res.status(200).json({ received: true });
}