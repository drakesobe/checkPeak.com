// pages/api/mux/webhook.js

import Mux from "@mux/mux-node";
import { updateVideo, getVideoByUploadId } from "../../../lib/commercial/airtable";

export const config = {
  api: {
    bodyParser: false, // Must be false — signature verification needs the raw body
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Read raw body — required for Mux signature verification.
  // bodyParser must be false or JSON.stringify(req.body) won't match the
  // original signed string and every webhook call will fail with 401.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");

  // Verify the request is actually from Mux.
  try {
    Mux.Webhooks.verifySignature(
      rawBody,
      req.headers,
      process.env.MUX_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[mux-webhook] signature verification failed:", err?.message);
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { type, data } = JSON.parse(rawBody);
  console.log("[mux-webhook] event:", type, data?.id);

  if (type === "video.upload.asset_created") {
    const uploadId = data?.upload_id;
    if (!uploadId) return res.status(200).end();
    const record = await getVideoByUploadId(uploadId);
    if (record) await updateVideo(record.id, { status: "processing" });
  }

  if (type === "video.asset.ready") {
    const assetId     = data?.id;
    const uploadId    = data?.upload_id;
    const playbackId  = data?.playback_ids?.[0]?.id;
    const duration    = data?.duration;
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