// pages/api/mux/webhook.js
// @mux/mux-node v14 - Webhooks is now a named export, not a static on the class.
// Adds explicit logging so silent Airtable failures / record-mapping misses surface.

import Mux from "@mux/mux-node";
import { updateVideo, getVideoByUploadId } from "../../../lib/commercial/airtable";

export const config = {
  api: {
    bodyParser: false, // Must be false - signature verification needs the raw body
  },
};

// Airtable helpers return { error } on failure (no thrown exception), so inspect
// the result and log loudly instead of silently moving on.
function logAirtable(tag, result) {
  if (result?.error) {
    const e = result.error;
    console.error(`[mux-webhook] ${tag} airtable error:`, typeof e === "string" ? e : (e.message || JSON.stringify(e)));
    return false;
  }
  if (!result?.id) {
    console.error(`[mux-webhook] ${tag} airtable returned no record id:`, JSON.stringify(result));
    return false;
  }
  console.log(`[mux-webhook] ${tag} updated record ${result.id}`);
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Read raw body - required for Mux signature verification
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");

  // v14: instantiate the client and use instance webhooks
  const muxClient = new Mux({
    tokenId:     process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
  });

  try {
    muxClient.webhooks.verifySignature(
      rawBody,
      req.headers,
      process.env.MUX_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("[mux-webhook] signature verification failed:", err?.message);
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { type, data } = JSON.parse(rawBody);
  console.log("[mux-webhook] event:", type, "asset:", data?.id, "upload:", data?.upload_id, "passthrough:", data?.passthrough);

  if (type === "video.upload.asset_created") {
    const uploadId = data?.upload_id;
    if (!uploadId) return res.status(200).end();
    const record = await getVideoByUploadId(uploadId);
    if (record) logAirtable("asset_created", await updateVideo(record.id, { status: "processing" }));
    else console.error("[mux-webhook] asset_created: no record found for uploadId", uploadId);
  }

  if (type === "video.asset.ready") {
    const assetId     = data?.id;
    const uploadId    = data?.upload_id;
    const playbackId  = data?.playback_ids?.[0]?.id;
    const duration    = data?.duration;
    const aspectRatio = data?.aspect_ratio;

    if (!assetId || !playbackId) {
      console.error("[mux-webhook] asset.ready missing assetId or playbackId", { assetId, playbackId });
      return res.status(200).end();
    }

    const fields = {
      muxAssetId:    assetId,
      muxPlaybackId: playbackId,
      duration:      duration ? Math.round(duration) : null,
      aspectRatio,
      status:        "ready",
    };

    const recordId = data?.passthrough;
    if (recordId) {
      logAirtable("asset.ready(passthrough)", await updateVideo(recordId, fields));
    } else if (uploadId) {
      const record = await getVideoByUploadId(uploadId);
      if (record) logAirtable("asset.ready(uploadId)", await updateVideo(record.id, fields));
      else console.error("[mux-webhook] asset.ready: no record found for uploadId", uploadId);
    } else {
      console.error("[mux-webhook] asset.ready: no passthrough and no uploadId - cannot map to a record");
    }
  }

  if (type === "video.asset.errored") {
    const uploadId = data?.upload_id;
    const record = await getVideoByUploadId(uploadId);
    if (record) logAirtable("asset.errored", await updateVideo(record.id, { status: "error" }));
    else console.error("[mux-webhook] asset.errored: no record found for uploadId", uploadId);
  }

  return res.status(200).json({ received: true });
}